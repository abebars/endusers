// Render contract for src/theme/BlogArchivePage/index.js, the swizzled blog
// archive page. The swizzle exists to change one thing — the theme renders
// each archive year as an <h3> directly under the page's <h1>, skipping a
// level that axe's heading-order rule (tests/e2e/accessibility.spec.js)
// reports — so the assertions below pin the heading outline first and the
// grouping and links that the swizzle must not drift from second.

import assert from 'node:assert/strict';
import test from 'node:test';

import { importSource } from './helpers-jsx.mjs';
import {
  findAllByType,
  findByType,
  textOf,
} from './tools/react-element-tree.mjs';
import Layout from './tools/theme-stubs/Layout.mjs';
import Heading from './tools/theme-stubs/Heading.mjs';
import { PageMetadata } from './tools/docusaurus-stubs/theme-common.mjs';
import { translate } from './tools/docusaurus-stubs/Translate.mjs';
import { useDateTimeFormat } from './tools/docusaurus-stubs/theme-common/internal.mjs';

const { default: BlogArchive } = await importSource(
  'src/theme/BlogArchivePage/index.js',
);

// Every function component in the tree is hook-free once the Docusaurus
// aliases are stubbed, so the whole archive can be expanded inline.
const EXPAND_ALL = { expand: () => true };

function post(date, title) {
  return {
    metadata: {
      date,
      permalink: `/blog/${title.toLowerCase().replaceAll(' ', '-')}`,
      title,
    },
  };
}

const POSTS = [
  post('2026-03-10', 'Third Post'),
  post('2026-01-05', 'Second Post'),
  post('2025-06-20', 'First Post'),
];

function renderArchive(blogPosts = POSTS) {
  return BlogArchive({ archive: { blogPosts } });
}

test('the page title and metadata come from the archive translations', () => {
  const tree = renderArchive();

  const title = findByType(tree, 'h1', EXPAND_ALL);
  assert.equal(textOf(title), 'Archive');

  const metadata = findByType(tree, PageMetadata);
  assert.equal(metadata.props.title, 'Archive');
  assert.equal(metadata.props.description, 'Archive');
});

test('each year is an h2 — one level under the page h1, nothing skipped', () => {
  const tree = renderArchive();

  const years = findAllByType(tree, 'h2', EXPAND_ALL);
  assert.deepEqual(
    years.map((heading) => textOf(heading)),
    ['2026', '2025'],
  );
  // The anchor id is what the theme's own hash links target.
  assert.deepEqual(
    years.map((heading) => heading.props.id),
    ['2026', '2025'],
  );
  // No year renders at the theme's original h3 any more, and no post does.
  assert.equal(findByType(tree, 'h3', EXPAND_ALL), undefined);
});

test('posts group under their publication year, linked with their date', () => {
  const tree = renderArchive();

  const links = findAllByType(tree, 'a', EXPAND_ALL);
  // The theme prepends within a year, so the input order is reversed there.
  assert.deepEqual(
    links.map((link) => link.props.href),
    ['/blog/second-post', '/blog/third-post', '/blog/first-post'],
  );
  assert.deepEqual(
    links.map((link) => textOf(link)),
    [
      'January 5 - Second Post',
      'March 10 - Third Post',
      'June 20 - First Post',
    ],
  );
});

test('an empty archive renders no year section at all', () => {
  const tree = renderArchive([]);

  assert.equal(findByType(tree, 'h2', EXPAND_ALL), undefined);
  // The h1 and metadata still render; only the years list is conditional.
  assert.equal(textOf(findByType(tree, 'h1', EXPAND_ALL)), 'Archive');
});

// The stubs the tree above resolves through, asserted directly so their own
// lines are covered even where the archive only passes props across them.
test('the theme stubs render what the component asks for', () => {
  assert.equal(
    translate({ id: 'x', message: 'Fallback' }),
    'Fallback',
    'translate returns the default message',
  );
  assert.equal(
    PageMetadata({ title: 't' }),
    null,
    'PageMetadata renders nothing outside the runtime',
  );
  assert.equal(
    Layout({ children: 'content' }),
    'content',
    'Layout flattens to its children',
  );

  const heading = Heading({ as: 'h2', id: 'y', children: 'Year' });
  assert.equal(heading.type, 'h2');
  assert.equal(heading.props.id, 'y');

  const withOptions = useDateTimeFormat({ month: 'long', timeZone: 'UTC' });
  assert.equal(
    withOptions.format(new Date('2026-01-05')),
    'January',
    'useDateTimeFormat honours the options it is given',
  );
  assert.ok(
    useDateTimeFormat() instanceof Intl.DateTimeFormat,
    'useDateTimeFormat works with no options',
  );
});
