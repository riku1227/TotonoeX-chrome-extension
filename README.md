![TotonoeX for X](assets/branding/readme-banner.png)

# ととのえっくす for X

**いつものXを、ちょっと使いやすく。**

コピーを手軽に、見たい画像へすぐに、不要な案内をすっきりと。Xの表示と操作を自分好みに整えるChrome拡張機能です。

[English](README.en.md) · [不具合・要望](https://github.com/riku1227/TotonoeX-chrome-extension/issues) · [MIT License](LICENSE)

## できること

| 機能 | 内容 |
| --- | --- |
| 共有をURLコピーに | ホームの共有ボタンを、投稿URLを直接コピーするボタンに。 |
| メディアの既定を画像に | プロフィールのメディアを開くと、画像を初期選択。 |
| Grokの説明ボタンを非表示 | 投稿にある「このポストを説明する」の入口を隠す。 |
| 画像編集ボタンを非表示 | 投稿画像に重なる編集ボタンを隠す。 |
| プレミアムの案内を非表示 | サイドメニューやホーム、プロフィールの加入案内を隠す。 |

すべて個別にオン・オフできます。設定は自動保存。日本語・英語に対応し、ライト／ダークの表示にも自動で切り替わります。

## 使いはじめる

1. このリポジトリの **Code → Download ZIP** からダウンロードして展開します。
2. Chromeで `chrome://extensions` を開き、**デベロッパーモード**をオンにします。
3. **パッケージ化されていない拡張機能を読み込む**から、展開した中の `extension` フォルダを選びます。
4. Xを再読み込みし、拡張機能のアイコンから設定を開きます。

読み込んだフォルダはそのまま残してください。更新時は同じフォルダのファイルを更新し、Chrome側の拡張機能とXを再読み込みします。ビルド済みの配布版を使う場合は、`manifest.json` が入っているフォルダを選びます。

## 開発

Node.js 22以降を使用します。クローンしたフォルダで実行してください。

```sh
npm ci
npx playwright install chromium
npm test
npm run check
npm run package
```

`src/` が設定画面、`extension/` が拡張機能本体、`tests/` がブラウザテストです。`npm run build` で設定画面をビルドし、`npm run package` で `dist/x-direct-url-copy/` に配布用ファイルをまとめます。

[開発ガイド](docs/development.md) · [詳しい挙動・権限・検証記録](docs/reference.md)

---

設定はブラウザ内に保存し、外部へのデータ送信は行いません。Xの変更により動作しなくなる場合があります。URLの直接コピーは、おすすめへの影響がなくなることを保証するものではありません。
