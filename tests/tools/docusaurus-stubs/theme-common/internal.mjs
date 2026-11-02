// Test stub for `@docusaurus/theme-common/internal`.
//
// The real useDateTimeFormat reads the locale and calendar out of Docusaurus
// context. Unit tests run without that context, so this stub formats in the
// default locale — close enough to assert which options a component asked
// for.

export function useDateTimeFormat(options = {}) {
  return new Intl.DateTimeFormat('en-US', options);
}
