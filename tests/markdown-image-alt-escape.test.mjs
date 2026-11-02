// Guards the alt text of Markdown images under docs/ and blog/ against the
// characters Docusaurus HTML-escapes on the way to JSX.
// @docusaurus/mdx-loader's transformImage builds the `alt` JSX attribute as
// `escapeHtml(node.alt)` (node_modules/@docusaurus/mdx-loader/lib/remark/
// transformImage/index.js), so an authored `&` is already `&amp;` in the
// compiled chunk; React then escapes the attribute a second time and the
// rendered page carries the entity as literal text. A screen reader announces
// the entity, and the same string is painted when the image fails to load.
// escape-html rewrites `"`, `'`, `&`, `<` and `>`, so all five are affected.
// The build stays green either way — nothing else in the suite looks at the
// content of an alt string — so this is the only thing standing between the
// next submission that writes `&` in a caption and a published page that
// reads `&amp;`.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));

function markdownFiles(dir) {
  const found = [];
  for (const entry of readdirSync(join(repoRoot, dir), {
    withFileTypes: true,
    recursive: true,
  })) {
    if (!entry.isFile()) continue;
    if (!/\.mdx?$/.test(entry.name)) continue;
    found.push(relative(repoRoot, join(entry.parentPath, entry.name)));
  }
  return found;
}

const files = [...markdownFiles('docs'), ...markdownFiles('blog')].sort();

// An inline (`![alt](src)`) or reference-style (`![alt][ref]`) image. The alt
// run accepts an escaped bracket so `![a \] b](x.png)` is read whole.
const IMAGE = /!\[((?:[^\][\\]|\\.)*)\](?=[([])/g;

// The set escape-html rewrites: node_modules/escape-html/index.js matches
// /["'&<>]/.
const ESCAPED = /["'&<>]/;

function offendingImages(source) {
  const found = [];
  source.split('\n').forEach((line, index) => {
    for (const [, alt] of line.matchAll(IMAGE)) {
      if (ESCAPED.test(alt)) found.push({ line: index + 1, alt });
    }
  });
  return found;
}

test('the scan finds markdown sources to check', () => {
  assert.ok(
    files.length > 0,
    'no .md/.mdx files found under docs/ or blog/ — the assertion below would be vacuous',
  );
});

test('the detector reports an alt string carrying an escaped character', () => {
  assert.deepEqual(offendingImages('![A & B](x.png)\n'), [
    { line: 1, alt: 'A & B' },
  ]);
  assert.deepEqual(offendingImages('text\n![A & B][ref]\n'), [
    { line: 2, alt: 'A & B' },
  ]);
  assert.deepEqual(offendingImages('![a \\] & b](x.png)\n'), [
    { line: 1, alt: 'a \\] & b' },
  ]);
  for (const alt of ['q "x"', "it's", 'a < b', 'a > b']) {
    assert.deepEqual(offendingImages(`![${alt}](x.png)\n`), [{ line: 1, alt }]);
  }
});

test('the detector leaves alt text the loader does not rewrite alone', () => {
  assert.deepEqual(offendingImages('![A and B](x.png)\n'), []);
  assert.deepEqual(offendingImages('![](x.png)\n'), []);
  // A `&` outside an image, and an image-looking run that opens no
  // destination, are not alt text.
  assert.deepEqual(offendingImages('A & B ![alt](x.png)\n'), []);
  assert.deepEqual(offendingImages('![A & B] is not an image\n'), []);
});

test('no image alt text in docs/ or blog/ is double-escaped when rendered', () => {
  const offenders = [];
  for (const file of files) {
    for (const { line, alt } of offendingImages(
      readFileSync(join(repoRoot, file), 'utf8'),
    )) {
      offenders.push(`${file}:${line}: ${alt}`);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    'Docusaurus escapes these characters into the alt attribute and React ' +
      'escapes the result again, so the page announces and paints the entity ' +
      'itself. Spell the character as a word (`and` for `&`) or drop it:\n' +
      offenders.join('\n'),
  );
});
