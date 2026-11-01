// Test stub for `@docusaurus/Translate`.
//
// The real translate() looks the message id up in the active locale's
// catalog. Unit tests run without a catalog, so this stub returns the
// default message, which is what an untranslated build renders.

export function translate({ message }) {
  return message;
}
