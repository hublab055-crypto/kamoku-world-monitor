# Frontier World Creator Suite

Frontier World の人間向けコンテンツ制作ツール。

## URL

GitHub Pages:

`/frontier-world/editor/`

## 搭載エディタ

- キャラクター
- スプライト / アニメーション定義
- 会話（既存 `data/dialogue-pack.json` 読み込み対応）
- アイテム
- 制作 / 料理レシピ
- 建物 / 家具
- AI / ガンビット
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
