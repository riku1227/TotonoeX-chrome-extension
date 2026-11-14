# X Direct URL Copy Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans for inline implementation. The user authorized proceeding with the investigated replacement design. No delegation or further approval is needed.

**Goal:** Chromeへ読み込める、ホームの共有ボタンを直接URLコピーに置き換える拡張機能。

**Architecture:** Manifest V3のdocument_start content scriptのみ。独自ボタンのイベントをwindow captureで処理し、Xの共有・詳細遷移ハンドラーを呼ばず、押した時点の投稿ヘッダーからURLを取得する。DOM識別が曖昧なら置換しない。

**Tech Stack:** Vanilla JavaScript、Shadow DOM、Clipboard API。開発テストのみPlaywright Chromium。

**Spec:** ../../../../DOM-RESEARCH.md

## Global Constraints

- 初版はhttps://x.com/home、日本語の調査済み構造に限定。
- cookies、clipboardRead、webRequest権限なし。外部通信・利用履歴保存なし。
- 閲覧・滞在など全計測の遮断や、おすすめへの影響ゼロは保証しない。

## Review Focus

- 引用・写真・analyticsのURLをコピーしない。
- DOM再利用後に古い投稿URLをコピーしない。
- マウスとキーボードから標準共有・詳細遷移を発火させない。
- DOM変更やSPA遷移で二重ボタン・隠れたままの共有を残さない。
- コピー失敗を成功と表示しない。

## Task 1: ブラウザで契約を検証する

- [x] `tests/extension.test.mjs`で匿名のX構造fixtureをroute.fulfillし、実MV3拡張として読み込む。
- [x] URL正規化・引用・写真・analytics、イベントcapture、キーボード、再利用、動的追加、曖昧URL、SPA離脱、失敗表示をテストする。
- [x] 空のcontent scriptに対して、置換ボタンが存在しないため失敗することを確認。

## Task 2: 実装と配布

- [x] `extension/manifest.json`と`extension/content.js`に実装。依存なし、ビルド不要。
- [x] `npm test`と`npm run check`で実ブラウザと構文を確認。
- [x] `tools/package.mjs`で拡張フォルダを配布先へコピーし、`README.md`に導入・制約・検証範囲を書く。
- [x] 配布フォルダのファイル一致を確認。実Xでの本人操作は未検証と明記。

## 実行記録

- 初回はChromium不足で起動失敗。Playwright付属Chromiumを導入後、空のcontent scriptで置換機能の8項目が失敗することを確認した。
- 実装後は8項目成功。clipboardWrite権限はページの権限拒否より優先されるため、OS書込み失敗のみテスト用のisolated worldで注入する方式に変更。成功経路は実OSクリップボードで検証。
- 独立した読取りレビューで、合成イベントがクリップボード書込みを実行する問題を発見。回帰テストで実際にbobのURLへ書き換わる失敗を確認後、isTrusted条件を追加。
- 最終npm test：10 subtests成功（親を含むNode集計11/11）、失敗0。npm run check成功。npm run packageで配布ファイルのSHA256一致を確認。
- 実Xは調査済みだが、初版拡張機能を本人のChrome/Xへ導入した後の実操作・計測通信は未検証。
