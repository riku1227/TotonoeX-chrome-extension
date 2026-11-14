# 実ポップアップの横幅修正

本人の画像ではツールバーポップアップが極端に狭く、設定を読めない。

- [x] 既存CSSのhtml width:380px/max-width:100vwを確認。
- [x] viewport:nullの実Chromiumでchrome.action.openPopupを実行。通常タブと別のaction targetへCDPで接続し、幅55px/本文高さ3697pxを再現。
- [x] 回帰テストを追加し、55px幅のアサーション失敗を確認。
- [x] html/bodyにwidthとmin-width:380pxを指定。初期viewportに依存する上限を外す。
- [x] 同じaction popupで380×455px、3設定の幅314px、最終行bottom434pxを確認。画像も目視確認。
- [x] 全テスト・構文・通常UI監査を実行し、0.3.1の配布版とCraft記録を更新。

前回の検証不足：通常タブで380px幅を指定して開いていたため、Chromeホストが最初に狭いサイズから自動拡張する経路を検証していなかった。説明文は各項目の直下に維持する。
