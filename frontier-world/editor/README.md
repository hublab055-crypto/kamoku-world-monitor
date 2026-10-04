# Frontier World Creator Suite

Frontier World の人間向けコンテンツ制作ツール。

## URL

GitHub Pages:

`/frontier-world/editor/`

## 搭載エディタ

- キャラクター
- スプライト / アニメーション定義
- 画像エディタ（新規作成 / 画像取込 / ペイント / Undo・Redo / PNG出力 / ゴミ箱 / 復元）
- 会話（既存 `data/dialogue-pack.json` 読み込み対応）
- アイテム
- 制作 / 料理レシピ
- 建物 / 家具
- AI / ガンビット
- 個人予定表（3時間 × 8ブロック）
- クエスト
- イベント
- 経済 / 店
- 2Dワールド配置
- 整合性検証 / Project JSON

## データ保存

編集中のプロジェクトはブラウザの `localStorage` に自動保存する。
「プロジェクトを書出」で `frontier-world-content.json` をダウンロードできる。

会話だけは `dialogue-pack.json` と同じ構造で個別出力できる。

## ゲーム本体との関係

Creator Suite は **authoring/staging tool**。
現時点ではゲーム本体 `frontier-world/index.html` が Creator Suite の全データを自動ロードするわけではない。

安全な移行順:

1. Creator Suite でデータを作る
2. 検証画面で ID 重複・参照切れを確認
3. JSON を書き出す
4. 各データを `frontier-world/data/` へ分離
5. ゲーム側にランタイムローダーを追加
6. index.html 内のハードコード定義を段階的に置換

## スプライト

画像はプレビューのためだけにローカルで読み込む。
画像バイナリは Project JSON へ埋め込まず、ファイル名・フレームサイズ・FPS・アニメーション範囲だけを保存する。

## ワールド配置

1セル1配置の軽量な設計。
資源、建物、NPC、敵、プレイヤー開始位置を置ける。
大規模マップ、レイヤー、地形ブラシ、複数セル建物の占有判定は次段階で拡張する。


## 画像エディタ

画像本体は JSON へ Base64 埋め込みせず、ブラウザの IndexedDB `frontier-world-creator-assets` に保存する。

機能:
- 透明キャンバスから新規画像を作成
- PNG / WebP / JPEG を取り込んで編集
- ブラシ
- 消しゴム
- 直線
- 塗りつぶし
- スポイト
- ブラシサイズ / 色
- Undo / Redo
- 50%〜800% 表示ズーム
- PNG 書き出し
- 複製
- ゴミ箱へ移動する論理削除
- ゴミ箱から復元
- ゴミ箱内のみ完全削除

削除直後に画像データを破棄しないため、誤削除から復旧できる。


## GitHub 直接編集

Creator Suite は Supabase Auth + GitHub OAuth を使ったログインUIと、GitHub REST APIによる直接編集機能を持つ。

- 対象 repository: `hublab055-crypto/kamoku-world-monitor`
- branch: `main`
- 通常編集範囲: `frontier-world/`
- テキストファイル読込 / 新規作成 / 差分確認 / commit / delete
- SHAベースの競合検出
- 画像をGitHubから画像エディタへ直接読込
- 編集画像をGitHubへ直接PNG commit
- `frontier-world/index.html` は追加チェックなしでは更新不可

GitHub OAuth provider の初回設定は `GITHUB_AUTH_SETUP.md` を参照。
