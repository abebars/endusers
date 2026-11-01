const { createHash } = require('node:crypto');

const { test: baseTest, expect } = require('@playwright/test');
const { version: playwrightVersion } = require('@playwright/test/package.json');

const managers = new Map();
const runModulePromise = import('./e2e-coverage-run.mjs');
const COVERAGE_ARTIFACT_KIND = 'endusers.playwright.v8-coverage';

// How long stopPage waits for the page React has not yet hydrated. Hydration
// of a built page takes well under a second even on a loaded CI runner; the
// bound only keeps a page that never hydrates (a 404 shell, a navigation the
// test abandoned) from holding the worker.
const HYDRATION_SETTLE_MS = 10_000;

/* global document -- runs inside the browser page via page.waitForFunction */
// Runs in the page. Docusaurus mounts into #__docusaurus and React stamps a
// `__reactFiber$...` key on each DOM node as it hydrates it, so `main`
// carrying one means the route's component tree has run on the client. A
// document without the mount point (about:blank, a non-site URL) has nothing
// to wait for.
function isHydrated() {
  const root = document.getElementById('__docusaurus');
  const target = root?.querySelector('main') ?? root;
  return (
    target === null ||
    Object.keys(target).some((key) => key.startsWith('__react'))
  );
}

// Docusaurus serves server-rendered HTML, so a test can see the text it
// asserts and finish before the client bundle has hydrated the page. V8 only
// counts code that ran: the component the assertion was about then records
// module evaluation and nothing else, and the report calls its render
// uncovered. The window is a few hundred milliseconds wide and is reached
// whenever the runner is busy enough, which four parallel workers on a hosted
// runner are. Settling hydration before the coverage is read makes what the
// test saw what the report measures. A page that is closed or mid-navigation
// when the wait starts, or that never hydrates, is read as it is.
async function settleHydration(page) {
  try {
    await page.waitForFunction(isHydrated, null, {
      timeout: HYDRATION_SETTLE_MS,
    });
  } catch {
    // Take the coverage there is; the report will say what it missed.
  }
}

function isCoverageEnabled(env = process.env) {
  return env.E2E_COVERAGE === '1';
}

function coverageArtifactStem({
  workerIndex,
  parallelIndex,
  retry,
  testId,
  pageIndex,
}) {
  const digest = createHash('sha256').update(testId).digest('hex').slice(0, 16);
  return `worker-${workerIndex}-parallel-${parallelIndex}-retry-${retry}-page-${pageIndex}-${digest}`;
}

function errorDetails(error) {
  return {
    name: error?.name ?? 'Error',
    message: error?.message ?? String(error),
    stack: error?.stack ?? null,
  };
}

class CoverageManager {
  constructor(testInfo, runDir, runId) {
    this.testInfo = testInfo;
    this.runDir = runDir;
    this.runId = runId;
    this.pageIndex = 0;
    this.pages = new Map();
    this.contexts = new Map();
  }

  async runModule() {
    return runModulePromise;
  }

  async verifyRun() {
    const { readCoverageRun } = await this.runModule();
    const manifest = await readCoverageRun(this.runDir);
    if (manifest.runId !== this.runId) {
      throw new Error(
        `coverage runId ${this.runId} does not match manifest ${manifest.runId}`,
      );
    }
    if (manifest.status !== 'started') {
      throw new Error(
        `coverage run ${manifest.runId} is already sealed as ${manifest.status}`,
      );
    }
  }

  async writeError(pageInfo, error) {
    const { writeCoverageArtifact } = await this.runModule();
    const stem = `${coverageArtifactStem(pageInfo)}-error`;
    await writeCoverageArtifact(this.runDir, stem, {
      schemaVersion: 1,
      kind: 'endusers.playwright.v8-coverage-error',
      runId: this.runId,
      project: this.testInfo.project.name,
      testId: this.testInfo.testId,
      workerIndex: this.testInfo.workerIndex,
      parallelIndex: this.testInfo.parallelIndex,
      retry: this.testInfo.retry,
      pageIndex: pageInfo.pageIndex,
      runtime: pageInfo.runtime ?? null,
      error: errorDetails(error),
    });
  }

  async startPage(page, { empty = false } = {}) {
    if (this.pages.has(page)) return this.pages.get(page);
    const info = {
      workerIndex: this.testInfo.workerIndex,
      parallelIndex: this.testInfo.parallelIndex,
      retry: this.testInfo.retry,
      testId: this.testInfo.testId,
      pageIndex: this.pageIndex,
    };
    this.pageIndex += 1;
    try {
      if (!empty && typeof page.coverage?.startJSCoverage !== 'function') {
        throw new Error('Playwright JavaScript coverage is unavailable');
      }
      const session = await page.context().newCDPSession(page);
      try {
        const version = await session.send('Browser.getVersion');
        info.runtime = {
          node: process.version,
          v8: process.versions.v8,
          playwright: playwrightVersion,
          browser: version.product,
          browserV8: version.jsVersion,
        };
      } finally {
        await session.detach();
      }
      if (!empty)
        await page.coverage.startJSCoverage({
          reportAnonymousScripts: false,
          resetOnNavigation: false,
        });
    } catch (error) {
      await this.writeError(info, error);
      throw error;
    }
    const record = { info, page, empty };
    this.pages.set(page, record);
    return record;
  }

  async stopPage(page) {
    const record = this.pages.get(page);
    if (!record) return;
    try {
      if (!record.empty) await settleHydration(page);
      const result = record.empty ? [] : await page.coverage.stopJSCoverage();
      const normalized = result.map(({ source, ...script }) => ({
        ...script,
        ...(source === undefined
          ? {}
          : {
              sourceLength: source.length,
              sourceSha256: createHash('sha256').update(source).digest('hex'),
            }),
      }));
      const { writeCoverageArtifact } = await this.runModule();
      await writeCoverageArtifact(
        this.runDir,
        coverageArtifactStem(record.info),
        {
          schemaVersion: 1,
          kind: COVERAGE_ARTIFACT_KIND,
          runId: this.runId,
          project: this.testInfo.project.name,
          testId: this.testInfo.testId,
          workerIndex: this.testInfo.workerIndex,
          parallelIndex: this.testInfo.parallelIndex,
          retry: this.testInfo.retry,
          pageIndex: record.info.pageIndex,
          runtime: record.info.runtime,
          result: normalized,
        },
      );
      this.pages.delete(page);
    } catch (error) {
      record.lastError = error;
      if (!record.errorArtifactWritten) {
        await this.writeError(record.info, error);
        record.errorArtifactWritten = true;
      }
      throw error;
    }
  }

  async registerContext(context, options = {}) {
    const record = {
      context,
      pages: new Set(),
      closed: false,
      empty: options.javaScriptEnabled === false,
    };
    this.contexts.set(context, record);
    const manager = this;
    return new Proxy(context, {
      get(target, property) {
        if (property === 'newPage') {
          return async (...args) => {
            const page = await target.newPage(...args);
            record.pages.add(page);
            await manager.startPage(page, { empty: record.empty });
            return page;
          };
        }
        if (property === 'close') {
          return async (...args) => {
            return manager.stopContext(record, args);
          };
        }
        const value = Reflect.get(target, property, target);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
  }

  async stopContext(record, closeArgs = []) {
    if (record.closed) return;
    const errors = [];
    for (const page of record.pages) {
      try {
        await this.stopPage(page);
      } catch (error) {
        errors.push(error);
      }
    }
    try {
      await record.context.close(...closeArgs);
    } catch (error) {
      errors.push(error);
    }
    record.closed = true;
    this.contexts.delete(record.context);
    if (errors.length > 0) {
      throw new AggregateError(errors, 'failed to flush e2e coverage context');
    }
  }

  async cleanup() {
    const errors = [];
    for (const page of [...this.pages.keys()]) {
      try {
        await this.stopPage(page);
      } catch (error) {
        errors.push(error);
      }
    }
    for (const record of [...this.contexts.values()]) {
      try {
        await this.stopContext(record);
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length > 0) {
      throw new AggregateError(errors, 'failed to flush e2e coverage');
    }
  }
}

async function createManager(testInfo) {
  const runDir = process.env.E2E_COVERAGE_DIR;
  const runId = process.env.E2E_COVERAGE_RUN_ID;
  if (!runDir || !runId) {
    throw new Error(
      'E2E_COVERAGE_DIR and E2E_COVERAGE_RUN_ID are required when E2E_COVERAGE=1',
    );
  }
  const manager = new CoverageManager(testInfo, runDir, runId);
  await manager.verifyRun();
  return manager;
}

// eslint-disable-next-line no-empty-pattern -- Playwright reads fixture dependencies from a destructured first parameter
async function coverageManagerFixture({}, use, testInfo) {
  if (!isCoverageEnabled()) {
    await use(null);
    return;
  }
  const manager = await createManager(testInfo);
  managers.set(testInfo.testId, manager);
  try {
    await use(manager);
  } finally {
    managers.delete(testInfo.testId);
    await manager.cleanup();
  }
}

async function pageFixture({ page, coverageManager }, use) {
  if (!coverageManager) {
    await use(page);
    return;
  }
  await coverageManager.startPage(page);
  try {
    await use(page);
  } finally {
    await coverageManager.stopPage(page);
  }
}

async function newCoverageContextForTest(browser, options, testInfo) {
  if (!isCoverageEnabled()) return browser.newContext(options);
  const manager = managers.get(testInfo.testId);
  if (!manager) {
    throw new Error('coverage manager is unavailable outside an active test');
  }
  const context = await browser.newContext(options);
  return manager.registerContext(context, options);
}

async function newCoverageContext(browser, options = {}, testInfoOverride) {
  if (!isCoverageEnabled()) return browser.newContext(options);
  return newCoverageContextForTest(
    browser,
    options,
    testInfoOverride ?? baseTest.info(),
  );
}

// React attaches its fiber to the DOM node it hydrates, so the presence of a
// `__react*` property is the signal that the element's handlers are live.
// Interacting before that point silently discards the input: the element is
// visible and enabled, but no state update follows. Every spec that clicks a
// React-rendered control waits on this first; it is a timing helper, so it is
// defined once here rather than per spec, where a changed poll or predicate
// would reach some specs and leave the rest to flake.
async function waitForHydration(locator) {
  await locator.waitFor({ state: 'visible' });
  await locator.evaluate(async (element) => {
    const hydrated = (node) =>
      Object.keys(node).some((key) => key.startsWith('__react'));
    while (!hydrated(element)) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  });
}

exports.coverageArtifactStem = coverageArtifactStem;
exports.CoverageManager = CoverageManager;
exports.coverageManagerFixture = coverageManagerFixture;
exports.expect = expect;
exports.isCoverageEnabled = isCoverageEnabled;
exports.isHydrated = isHydrated;
exports.newCoverageContext = newCoverageContext;
exports.newCoverageContextForTest = newCoverageContextForTest;
exports.pageFixture = pageFixture;
exports.waitForHydration = waitForHydration;
exports.test = baseTest.extend({
  coverageManager: [coverageManagerFixture, { auto: true }],
  page: pageFixture,
});
