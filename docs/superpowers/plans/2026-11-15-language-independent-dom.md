# Language-independent DOM detection — 2026-11-15

The user approved removing display-language dependencies before UI translation. Use writing-plans and test-driven-development for this change; implement inline in the existing scratch workspace.

1. Inspect the existing logged-in research tab for structural signals: share action group, premium cards, media menu, Grok header and image editing entry. Record only anonymous structure and component signals. Do not invoke Grok, edit images, or change account preferences.
2. Replace localized aria-label/text checks in content.js, premium.js, post-tools.js. Prefer test IDs, same-origin action URLs and tightly scoped semantic structure. Do not use nth-child ordering, obfuscated class names or React internals. Where the public DOM exposes only an icon, require both an exact observed icon signature and a strict context, isolate that fallback, and document its change sensitivity. Ambiguous candidates stay unchanged.
3. Update real-MV3 fixtures to the observed structure, and add randomized-label/removed-label tests plus negative cases for competing controls, unknown promos and composer/protected content. Verify a failing test before production changes, then run all existing tests.
4. Preserve copy event isolation, URL validation, settings, manual media selection, no reloads and style restoration. UI strings remain Japanese for this task.
5. Verify observed DOM against selectors without sending normal share/Grok actions. Package an updated release, verify ZIP contents, update README/DOM-RESEARCH and Craft. Keep the user's research tab open.
