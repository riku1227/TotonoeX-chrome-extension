# TotonoeX for X

Japanese name: **ととのえっくす for X**. Version 0.8.0 adopts this name and a blue icon with a white Japanese 「と」 mark. The popup uses the short name **TotonoeX**.

[日本語の説明](README.md)

A Chrome extension with five independent settings:

- **General:** replace Share on Home with direct post URL copying, and default profile Media tabs to images.
- **Grok:** hide the post explanation button and the image editing button.
- **Premium:** hide the Premium sidebar entry and subscription prompts on Home and profiles.

## Install or update

From a repository checkout, load the `extension` directory directly. For a packaged ZIP, follow the steps below.

1. Extract the release ZIP and keep the extracted folder in a permanent location.
2. Open `chrome://extensions` and enable **Developer mode**.
3. Choose **Load unpacked** and select `x-direct-url-copy`, the folder containing `manifest.json`.
4. Reload your X tabs.

When updating an existing installation, replace the files in the same folder, click **Reload** on the extension's card, then reload X. Keeping the same folder preserves the unpacked installation and its settings.

## Language and appearance

The popup, extension information, copy notifications and errors use Japanese when Chrome's UI language is Japanese, and English otherwise. The extension uses Chrome's native localization system. It does not change X's language or use it to choose the popup language.

Light and dark appearance follow the browser's reported color scheme. The popup groups settings under General, Grok and Premium; scroll to reach the lower settings. Changes save automatically and apply to open X tabs.

## Behavior and limits

Direct copying currently works on **Home**. It reads the displayed post URL without opening the post or X's Share menu, and removes URL tracking parameters and fragments. Other views keep their normal Share button.

The image default uses X's own Media menu without reloading the page. Explicit filters and manual switching back to videos are respected.

Detection uses attributes, URLs and scoped DOM structure rather than localized labels. Some controls without dedicated IDs also require known SVG icons. Unrecognized or ambiguous controls are left unchanged. X updates can require selector updates. The image editing entry has been verified against X's delivered component and browser fixtures; verification of that entry in the logged-in research session is still outstanding because it was not displayed there.

Copying avoids invoking X's standard Share action. It does **not** guarantee zero effect on recommendations or block X's existing viewing and timing measurements.

## Permissions and data

The extension requests `clipboardWrite` and `storage` and runs on `https://x.com/*`. It stores only the five on/off settings locally. It does not read the clipboard, request cookies, store posts or browsing history, or send data to an external service. Popup code, fonts and translations are local. No API key or additional account is required.

## Development

Use Node.js 22 or newer. Run `npm ci`, `npx playwright install chromium`, `npm test`, `npm run check` and `npm run package`.

Repository: [riku1227/TotonoeX-chrome-extension](https://github.com/riku1227/TotonoeX-chrome-extension). The development package name is `totonoex`.

The optional UI audit and design lint scripts require the separate space-ui-design skill at `~/.agents/skills/space-ui-design`. Set `SPACE_UI_DESIGN_DIR` to override this location. Normal builds and tests do not require the skill.

Translations are in `extension/_locales/en/messages.json` and `extension/_locales/ja/messages.json`. English is the default locale. Keep message keys consistent between both catalogs. Browser tests use actual Chrome UI locales, including regional English and an unsupported-language fallback.
