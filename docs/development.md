# 開発ガイド

[READMEに戻る](../README.md)


Node.js 22以降を使用します。配布版を使う人にはNode.jsは不要です。

リポジトリは [riku1227/TotonoeX-chrome-extension](https://github.com/riku1227/TotonoeX-chrome-extension)、開発用パッケージ名は `totonoex` です。クローンしたフォルダで以下を実行します。

```powershell
npm ci
npx playwright install chromium
npm test
npm run check
npm run package
```

配布フォルダを読み込む人はビルド不要です。開発時は `npm run build` でReact製ポップアップをローカルのJavaScript/CSSへまとめます。content scriptにはライブラリを使用しません。Playwright・esbuild・Tailwindは開発用です。space-ui-designのkit.tsxとtheme.cssは原本をコピーして保持し、生成CSSから外部フォント読込みだけを除去しています。

翻訳は `extension/_locales/en/messages.json` と `extension/_locales/ja/messages.json` で管理します。英語を既定言語とし、両方に同じキーを用意します。配布スクリプトは翻訳ファイルも含めてコピー・ハッシュ検証します。UI撮影は `node tools/check-ui.mjs <出力名> <lightまたはdark> <jaまたはen>` で実行できます。

UI撮影のDOM監査と `node tools/lint-design.mjs` は、別途space-ui-designスキルを必要とします。既定では `~/.agents/skills/space-ui-design` を参照します。別の場所にある場合は環境変数 `SPACE_UI_DESIGN_DIR` にそのスキルのディレクトリを指定してください。通常のビルドとテストには不要です。

仕様確認：

- https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts
- https://developer.chrome.com/docs/extensions/reference/permissions-list
- https://playwright.dev/docs/chrome-extensions

アイコンは `extension/icons/` に16・32・48・128pxのPNGを用意しています。生成元は `assets/branding/totonoex-icon-source.png`、512px版と生成プロンプトも同じフォルダにあります。サイズの書き出しはPillowを入れた環境で `python tools/export-icons.py` を実行します。
