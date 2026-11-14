# Japanese and English localization

User approved localizing the extension after removing language-dependent X detection. Implement inline with a failing browser test first; no design approval or delegation is needed for translation choices.

1. Use Chrome native i18n: `_locales/en/messages.json`, `_locales/ja/messages.json`, `default_locale: en`. Browser UI locale chooses messages; X's display language does not. Other locales fall back to English. Existing storage keys and permissions stay unchanged. Names are provisional translations: Japanese Xのひと工夫, English Tweaks for X; global brand remains undecided.
2. Translate extension metadata/action tooltip, popup title/category/option names and descriptions, loading/retry/load and save errors, and injected copy idle/success/error labels and live announcements. Keep the Japanese descriptions exactly as user specified. Set document and kit root language without changing kit originals.
3. Use getMessage in popup and content scripts. Set translated labels via DOM properties, not HTML interpolation. Translation catalogs are packaged and hash-verified with distribution files.
4. Add real MV3 tests for Japanese, regional English and an unsupported locale fallback; verify metadata, popup, copy success/failure, announcements, settings persistence and localized load/save errors. Pin existing regression tests to Japanese Chrome UI so their assertions remain meaningful. Native UI locale must be verified; do not mock i18n.
5. Capture/audit Japanese/English in light/dark at popup, 390px and 1280px. Fix real layout problems, preserve scrolling and per-option explanations. Check actual action popup sizing in English as well as Japanese.
6. Package 0.7.0, verify ZIP against distribution, update README/DESIGN and Craft. UI work requires no live X browser operations or account changes.
