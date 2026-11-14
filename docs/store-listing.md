# Chrome Web Store submission notes

Version: 1.0.0

## Single purpose

Customize the browsing experience on X (x.com) by simplifying post URL copying, selecting images by default in profile Media tabs, and hiding optional Grok and Premium interface elements. All controls serve this single purpose of adjusting the X interface and can be enabled individually.

## Permission justifications

### clipboardWrite

When the user activates the extension's copy button on X Home, the extension writes the URL of that post to the system clipboard. It obtains the URL from the displayed post's DOM and removes query parameters and fragments. The permission is used only to provide this user-triggered copying feature. The extension does not read the clipboard.

### storage

The extension uses chrome.storage.local to save five on/off preferences for direct URL copying, images-first Media tabs, hiding Grok explanation buttons, hiding image editing buttons, and hiding Premium prompts. Preferences persist across browser restarts and are applied to open X tabs. No post content, browsing history, or account credentials are stored.

### Host access: https://x.com/*

Content scripts must run on x.com to identify the displayed post URL, replace Home's share control with a copy button, select images in profile Media tabs, and hide the optional interface elements selected by the user. Access across x.com paths is needed because X navigates between Home, profiles, and Media without reloading the document. The extension does not run on other websites and does not transmit page content to external servers.

### Remote code

No remote code is used. All JavaScript, CSS, icons, and translations are bundled in the extension. It does not load scripts or executable logic from remote servers.

## Images

- Shop icon: [128px icon](../extension/icons/icon-128.png).
- Japanese screenshot: [settings-ja-1280x800.png](../assets/store/settings-ja-1280x800.png).
- English screenshot: [settings-en-1280x800.png](../assets/store/settings-en-1280x800.png).
- Screenshots show the actual bundled settings UI in light and dark appearance, placed on a captioned background. They contain no real posts, account information, or third-party photographs.
- Recreate with `node tools/export-store-assets.mjs` after building the extension. The script uses isolated Chromium profiles and a local empty X fixture; it does not access a logged-in account.

## Testing instructions

Open the extension popup to verify that each of the five settings can be switched independently and persists after closing and reopening the popup. The popup can be tested without an X account. To test the page features, sign in to X using a reviewer-owned account and visit x.com/home and a profile's Media tab. Direct copying applies to Home. X may vary the availability of Premium and image-editing prompts between accounts. No extension-specific account or credentials are required.
