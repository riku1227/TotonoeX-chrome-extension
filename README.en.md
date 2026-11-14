![TotonoeX for X](assets/branding/readme-banner.png)

# TotonoeX for X

**Small tweaks for a more comfortable X.**

Copy links in one click, open Media with images selected, and hide unwanted prompts. A Chrome extension that lets you adjust X to your liking.

[日本語](README.md) · [Issues & requests](https://github.com/riku1227/TotonoeX-chrome-extension/issues) · [MIT License](LICENSE)

## Features

| Feature | What it does |
| --- | --- |
| Direct URL copying | Replaces Share on Home with a button that copies the post URL. |
| Images first | Selects images by default when opening a profile's Media tab. |
| Hide Grok explanations | Hides the post explanation button. |
| Hide image editing | Hides the editing button over posted images. |
| Hide Premium prompts | Hides the Premium sidebar entry and subscription prompts on Home and profiles. |

Toggle each feature independently. Settings save automatically. Japanese and English are supported, with automatic light and dark appearance.

## Get started

1. Download this repository using **Code → Download ZIP** and extract it.
2. Open `chrome://extensions` in Chrome and enable **Developer mode**.
3. Choose **Load unpacked** and select the `extension` folder inside the extracted repository.
4. Reload X and open the extension's icon to adjust your settings.

Keep the loaded folder in place. To update, replace its files, reload the extension in Chrome, then reload X. For a built distribution, select the folder containing `manifest.json`.

## Development

Use Node.js 22 or newer. Run these commands from your checkout:

```sh
npm ci
npx playwright install chromium
npm test
npm run check
npm run package
```

`src/` contains the settings UI, `extension/` the extension itself, and `tests/` the browser tests. Use `npm run build` to build the popup, or `npm run package` to prepare the distribution in `dist/x-direct-url-copy/`.

[Behavior, permissions & development notes](docs/reference.en.md) · [Full development guide (Japanese)](docs/development.md)

---

Settings stay in your browser; the extension does not send data to external services. Changes to X may affect compatibility. Direct URL copying does not guarantee zero effect on recommendations.
