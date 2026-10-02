# Frontier World — 複数チャット協働ルール

更新日: 2026-10-03 JST

## 目的

複数の ChatGPT チャットが同じ Frontier World を並行して進めても、仕様・セリフ・ゲームコードが食い違わないようにする。

## 共有の基準

作業開始時に必ず読む:

1. `frontier-world/SPEC.md`
2. `frontier-world/project-state.json`
3. `frontier-world/COLLAB.md`
4. 対象ファイルの GitHub 最新版

## ファイル担当

### メイン実装チャット

担当:
- `frontier-world/index.html`
- `frontier-world/SPEC.md`
- `frontier-world/project-state.json`

役割:
- ゲームロジック、UI、AI、セーブ、移動、統合。
- 実装後に SPEC と project-state を更新。
- セリフパックをゲーム本体へ統合する時は dialogue-pack.json を読む。

### セリフ専用チャット

担当:
- `frontier-world/data/dialogue-pack.json`

原則:
- `index.html` を変更しない。
- 既存キーを壊さず、配列へ追加。
- 同じ意味の重複セリフを避ける。
- Mio / Riku / Guard / Merchant それぞれの人格を崩さない。
- relationship、situation、exchange を意識して分類する。
- 更新時に `pack_version` と `updated_at` を進める。

### 仕様整理チャット

担当:
- `SPEC.md`
- `project-state.json`
- 必要なら `COLLAB.md`

原則:
- 実装済みと構想を分ける。
- GitHubコミットで確認できた機能だけを「実装済み」にする。

## 競合を避けるルール

- 同時に複数チャットが `frontier-world/index.html` を編集しない。
- セリフ専用チャットは dialogue-pack.json だけを触る。
- メイン実装チャットは index.html を更新する前に必ず最新 SHA/コミットを再取得する。
- 書き込み前に対象ファイルが他チャットで更新されていないか確認する。
- 大きな更新はコミットメッセージに機能名を列挙する。

## セリフパック形式

`data/dialogue-pack.json` の基本構造:

- `characters.<id>.relationships.<relationship>.<category>`
- relationship:
  - acquaintance
  - companion
  - friend
  - lover
  - family
- category:
  - intro
  - hello
  - work
  - life
  - proactive
- `exchanges`: NPCからの質問とプレイヤー回答
- `gift_thanks`: プレゼントを受け取った反応
- `events`: 妊娠、育児、結婚、葬儀、危険、備蓄不足など

## セリフ品質ガイド

- 1文を短めにする。
- 同じ呼び方を毎行つけない。
- 関係性が上がるほど距離感を自然に縮める。
- 家族だから常に甘い会話にせず、生活・仕事・疲労・育児の現実も混ぜる。
- プレゼントには必ず何らかの受領反応を返せるようにする。
- キャッチボールは質問 → 回答 → NPC反応 → 必要なら追加質問、の2〜6往復を目安にする。
- プレイヤーの過去回答を conversationMemory で再利用できる内容にする。

## 実装完了時の更新

メイン実装チャットは最低限以下を更新する。

- SPEC.md の「実装済み / 今後」
- project-state.json:
  - updated_at
  - game_commit
  - implementation_version
  - implemented
  - known_issues
  - next_tasks

## 新チャット用プロンプト

> Frontier World の共同開発を続けます。GitHub `hublab055-crypto/kamoku-world-monitor` の `frontier-world/SPEC.md`、`COLLAB.md`、`project-state.json` を最初に読んでください。対象ファイルの最新状態も確認し、既存仕様を壊さずに続きから作業してください。
