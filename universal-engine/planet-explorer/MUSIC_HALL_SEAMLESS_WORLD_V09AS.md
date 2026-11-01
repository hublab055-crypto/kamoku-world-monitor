# Universal Engine v0.9as — 音楽劇場の屋内外を同じ地表WebGLシーンへ統合

## 適用
ベースPR #67（音楽劇場・学校の開閉扉、徒歩ポータル、客席衝突）へ積み上げる実装。先行PRの依存：#60 → #61 → #62 → #64 → #65 → #66 → #67 → 本PR。mainへのマージは本PRでは行わない。

## 実装の狙い
- 建物の外にいる時点で、ドアの向こうの舞台・家具・NPCが地表の3Dワールドに存在する。
- 扉を歩いて横断しても、地表・街・建物・アバター・内部装飾を別々のWebGLフレームバッファへ切り替えない。**同一 `ground()` 描画パス、同一VP、同一深度バッファ**を使用。
- 街の `settlementId`、建物 `village-N`、NPC ID、鉄道・船舶・再基準化・惑星セーブの既存規則は変えない。

## 技術的変更

### 1. 共通座標と世界側の実アバター位置
- `music-hall-world.mjs` を追加。 `hallWorldPoint`, `hallLocalPoint` は町の建物座標と室内局所メートルを相互変換。建物のyawにも対応。
- `syncHallActorWorld` は既存 `TownLife.inside.pose` から `ExplorerController.x/z/yaw` と `lat/lon` を更新する。`actor.locationAt`を使い、**`actor.origin` は変更しない**。
- 室内歩行は依然として `TownLife.walk` が壁・椅子・舞台衝突を担当するが、計算後に同じ地表アバター位置へ反映。VRの視点と歩行アニメーションも地表アバターを追う。
- 扉を横断したときに既定の屋内開始点へ移すのではなく、その瞬間の正確な座標と向きを引き継ぐ。
- UIボタンで退出した場合も、実際の地表にある入口のすぐ外へアバターを戻す。既存の屋外徒歩退出も保持。

### 2. 描画の統合
- `ExplorerRenderer.frame()` では音楽劇場/教室のみ `renderTownInterior` への早期returnを行わず `ground()` を経由する。宿屋、住宅、留置所、駅、列車、客船などの独立室内レンダリングは維持。
- `drawMusicHallWorld` が、既存地形パッチ内の建物 `localX/localZ/elevationM` に家具、ステージ、演奏家、楽団、観客を配置。
- 屋外から内部を見る場合も、演奏中の楽団と観客は世界座標上の同じメッシュ。内側に入った時に作り直す必要なし。
- `musicHallInteriorGeometry(kind,{furnishingsOnly:true})` は共通地表用の家具・客席・舞台・床のみを描画。古い室内レンダラー用の`furnishingsOnly:false` も残す。
- 音楽施設の建物殻と屋根を`musicHallShellGeometry` / `musicHallRoofGeometry`へ分離。屋外からは屋根を描き、プレイヤーがその劇場/学校の内部にいる時だけ屋根を非表示にして、TPV/RTSの視界を確保する。
- 地表パッチが再生成された場合は、個別の屋根メッシュを削除・再生成し、既存の原点`this.cx/cz`に合わせる。遠距離LODや鉄道用の地表メッシュ仕様は変更なし。

### 3. 入退場・物理空間の互換
- 物理的な位置は`ExplorerController`の地理原点に対する局所メートルで統一。ドア通過で別惑星や世界基準点へテレポートしない。
- `TownLife.hallStep` で扉を通った位置をそのまま室内位置へ格納。
- `TownLife.walk`は先行PR #67の壁・客席・舞台の簡易衝突を利用。遮られたときはアバターの `moving/blocked` を正しく更新。
- 屋内から地表へ戻る際には`TownLife.portalExit`、ボタン退出時には`TownLife.leave(controller)`が地表経緯度へ整合する。
- 初期画面や他の建物の室内操作を変更せず、文化パネル・街の生活パネルもそのまま利用。

## テスト
`node --test universal-engine/planet-explorer/music-culture.test.mjs universal-engine/planet-explorer/music-band.test.mjs universal-engine/planet-explorer/music-hall.test.mjs universal-engine/planet-explorer/music-hall-portal.test.mjs universal-engine/planet-explorer/music-hall-world.test.mjs`

- 既存32件 + 新規7件 = **39件成功**（コードモードのJavaScriptテスト実行）。
- 相互変換の可逆性、扉横断で座標が飛ばないこと、室内歩行が地表位置へ同期すること、惑星原点を保つこと、UI退出の地表位置、屋根/殻の分離、家具単体ジオメトリを検証。
- 関連20ファイルのJavaScript構文チェック成功。
- 実際のNode test runner、PC/WebGL、iOS Safari、Meta Quest 3/3Sでの実機統合試験とfps計測は未実施。

## 制約・次段階
- 同じ地表WebGLパスを使うのは**音楽劇場と教室のみ**。既存の住宅や交通機関の室内は旧レンダラーで、全建物共通の完全シームレス化は別段階。
- 扉の物理開閉はあくまでアニメーションと簡易衝突。VRでドアノブを掴んで引く実体物理・複数人の衝突や一人ずつの扉競合制御には未対応。
- 室内の床は地表の高さを基準とする水平な家具メッシュ。坂道・大きな地形起伏に対する地表パッチの穴あけ・局所的なフラット化は今後調整。
- 内部が覗けるのは、入口が開いた場合やカメラに視線が通る場合。屋外で屋根は描画し、内部へ移動するとその建物の屋根だけ非表示にする。
- 建物の自由配置、任意角度の壁衝突、再基準化をまたぐ星間・他惑星への同一描画の一般化、マルチプレイ権限とチケット共有は別段階。
