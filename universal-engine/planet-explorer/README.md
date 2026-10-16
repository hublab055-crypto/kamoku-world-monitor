# Universal Engine — Planet Explorer v0.7e

独立した架空マルチバースの **WebGL2 3D惑星探索プロトタイプ**。宇宙から3D球体惑星を観察し、同一の地理座標・地形サンプラーで細密な地表メッシュへ降下し、人物を操作できます。

**v0.7予定:** [詳細設計・9タスク・状態スキーマ・受入チェック](../design/v0.7/)（設計完了、実装未着手）

**URL:** https://hublab055-crypto.github.io/kamoku-world-monitor/universal-engine/planet-explorer/

- 宇宙: WebGL2で球体惑星・大陸・海・雲の三角形メッシュ、自転の見かけと恒星照明。
- 地表: WGS84ではなく架空惑星の球面緯度・経度、地形の高さに連続する高解像度メッシュを高度別LODで生成。
- 人物: 地表にいる時、WASD/方向ボタンで前後左右移動、Q/Eで旋回。移動先の水域・急斜面を簡易的にブロック。
- 操作: 降下・帰還、拡大・縮小、惑星日数の早送り、時間停止、端末ローカル保存・復元。
- モバイル: 画面ボタンを押し続ける操作、タッチでカメラ回転、ピンチの代わりに拡大縮小ボタン。
- JavaScript ES Modules + ブラウザ標準WebGL2だけで動作。CDN・外部アセット・認証・外部ネットワーク通信なし。

## v0.7e — 小屋の開閉ドアと屋内 (2026-10-16)

ゲーム中に資源を使って小屋を完成させると、正面に開閉可能な扉が付きます。ドアをタップすると、離れていれば入口まで自動歩行し、近づくと開けます。近距離では画面の「🚪 開ける／閉める」またはPCのFキーでも操作できます。

扉が開いたら「🏠 中に入る」か、アバターをドアから前進させます。入室すると屋根が外れ、床・ベッド・チェスト・机・椅子・ランプが見える簡易室内俯瞰カメラに切り替わります。出るときは扉を開けてそのまま歩き出すか「🌿 外に出る」。外壁は通り抜けられません。

既存のv0.7d保存ボタンは引き続き使えます。扉の開閉は構造物状態として、入室状態は追加の `v0_7e` 欄に保存します。以前のセーブも開けます。**家具の配置編集やNPCの室内追従は未実装**であり、iPhoneでの最終表示確認もこれからです。

## v0.7d — RTS 3人指揮・🤔条件分岐自動行動 (2026-10-16)

- 地表へ降りたら3Dビュー右上の「⚓ RTS視点」で俯瞰45mに切替。人物をタップして選択し、地面をタップすると選択中の人物が移動。**全員選択／複数選択／集合地点／停止** ボタンも利用できます。
- キャラクターはプレイヤー開拓者＋斥候＋職人の計3人。NPCはそれぞれ移動・アニメーションの状態を持ち、色と名前表示で区別します。単体手動操作は今まで通り。
- 「🤖 自動行動」から**8つの条件→行動の優先順位つきスロット**を人物ごとに編集。条件は木材数、石材数、完成した小屋数、待機状態、隊長との距離、累計歩行距離。比較演算子は `<, <=, >, >=, ==, !=`。行動は木採集・石採集・小屋建築・集合地点移動・追従・巡回・待機。
- 自動行動は人物ごと・一括ON/OFFが可能。初期スロットは「木材が18未満なら採集」「石材が12未満なら採集」。**初期状態の自動実行はOFF** です。「停止」は自動行動もOFFにします。採集はデモ資源+2、実際の樹木採伐・道具耐久・歩行経路探索は未実装です。
- 「v0.7d保存」でローカル端末に各人物の条件、移動位置、集合位置、自動ON/OFFを保存。旧 `v0.7c` の保存を読み取りのみで取り込めます。独立した旧版リンクv0.7b/v0.7a/v0.6は保持。変更前v0.7cの**ソース**は `universal-engine-v0.7c-before-rts` ブランチに保管（実行版URLではありません）。
- マルチ端末協力操作、キャラクター雇用・AI会話・詳細採集・複雑な複数条件 AND/OR・キャンセル優先度・混雑回避は今後の実装対象です。

## v0.7c スマホ画面改善パッチ（2026-10-16）

- **スマホを開いた直後はプレイ画面を優先:** iPhoneなどの狭いタッチ画面で、最初はCSSによる没入表示になります。右上の「⤡ 戻る」で通常画面・カメラ詳細設定・旧版リンクへ戻れます。戻った選択は同じタブ内では保持します。
- **ゲーム画面上で切替:** 右上に「全画面/戻る」「カメラ（6モードを巡回）」「スティック/タップ移動」「メニュー」を追加。「メニュー」を開くと保存・降下/宇宙・時間・拡大縮小を表示します。
- **端末対応:** `100dvh` と `safe-area-inset-*` で上下の操作を見切れにくくし、縦横のレイアウトを調整。ブラウザのアドレスバーや他アプリの表示はWebページから強制的に消せません。
- **背景:** 地表ビューのWebGL描画を透明クリアし、惑星の日照に応じて昼・夕暮れ・夜の空色を表示。宇宙モードは従来どおり暗い背景です。山脈・海・谷の遠景3Dモデルは次段階です。
- **復帰:** 旧版v0.7b/v0.7a/v0.6の実行環境と旧セーブキーは変更しません。パッチ前v0.7cのソースはGitHubブランチ `universal-engine-v0.7c-before-mobile` に保持します。iPhone Safari実機描画確認は未実施です。

## v0.7c — カメラ6モード（2026-10-16）

- `camera-controller.mjs` でアバター地理座標とは完全に独立したカメラ状態と移動を実装。6モード（従来、三人称追従、肩越し、自由視点、人物注視、上空俯瞰）。
- 設定欄からカメラモード、視野角35〜90°、距離1〜120m、追従係数、俯瞰高度35〜18,000m、アバター位置マーカーを変更できる。
- 人物の顔を見るボタン、スティック/WASDで自由カメラだけを移動、ドラッグによる回転、ホイールによる距離変更。
- 俯瞰では人物を正しい大きさのまま描画し、遠距離では位置マーカーで地表の場所を示す。惑星モードでも地理座標からマーカー位置を算出。
- 新版のセーブキーは `universal-engine:explorer:v0.7c`、カメラ設定は任意の `v0_7c.camera` オブジェクトとして保存。v0.7b・v0.7a・v0.6セーブを読み取り専用で取り込む。
- [v0.7b保存版](../versions/v0.7b/planet-explorer/) / [v0.7a保存版](../versions/v0.7a/planet-explorer/) / [v0.6保存版](../versions/v0.6/planet-explorer/)を独立したURLで保管。旧セーブは別キーで保護。
- **既知の制限:** 地上と全球の描画は高度約23kmで切替（完全な連続LODではない）。18km俯瞰の詳細地形半径は最大55km。背景として無限遠の山脈や海までを完全に描く機能はv0.7d。地形/建築物を遮るカメラ衝突も未実装。実iPhone/PCブラウザでの描画実機QAは今後実施。
- `tests/camera-v07c.test.mjs` が6モード、自由視点の人物位置不変、地上/宇宙マーカー、保存データ/範囲検査を検証。

## v0.7b — 着せ替え・表情の試験版（2026-10-16）

- **衣装10プリセット:** 開拓者・斥候・職人・農民・商人・司祭・衛兵・狩人・旅人・村人。既存3素体とは独立して選択できる。
- **着せ替え:** 帽子4、マント3、鞄3、髪型4。上着・ズボン・靴・髪のRGB染色と関節追従。素材は元のオリジナル3D形状の色替え＋新しい小物メッシュ。
- **表情7種:** 平常・喜び・悲しみ・怒り・不安・驚き・疲労。眉・眼球・まぶた・口の3D部品を顔関節へ追加、視線・自動まばたき・時間補間。
- **UI:** 「人物の設定」パネルに衣装プリセット、部位別設定と感情プレビュー操作を追加。
- **保存:** v0.7bは`universal-engine:explorer:v0.7b`へ保存。v0.7a/v0.6のセーブは読み込み専用で取り込める。外見/表情は`v0_7b`下へ追加。
- **復帰:** [v0.7a保存版](../versions/v0.7a/planet-explorer/) / [v0.6保存版](../versions/v0.6/planet-explorer/)。どちらも独立した実行コードとURL。
- **注意:** 衣装は低ポリゴン関節パーツで、布シミュレーションや連続頂点スキニングではない。感情はユーザーの選択による演出で、会話AIや人物間関係にはまだ連動していない。カメラ自由操作・遠景・屋内・村は次フェーズ。
- **テスト:** 10衣装×3素体、各部位、視線、まばたき、顔関節、保存復元、旧ゲーム機能の回帰を追加。

## v0.7a 実験版 — 2026-10-16

**v0.7本体は開発途中です。** この公開版では、旧v0.6との共存と関節/動作の最初の改善を実装しました。

- [最新版v0.7a](../planet-explorer/)：60点の拡張関節定義、既存の21ピボットを壊さない変換、動作切替時の時間補間、肘・膝・手首・足先/指のオリジナルパーツ。
- [旧版v0.6](../versions/v0.6/planet-explorer/)：完全に独立した旧実行環境、旧人物描画と以前の操作。
- v0.6のセーブキー`universal-engine:explorer:v1`と、v0.7aの`universal-engine:explorer:v0.7a`を分離。旧データを上書きしない。
- 新版の「v0.6データ読込」で**明示的にコピーして読み込み**。元の保存情報は維持。新版への保存は必ず「v0.7a保存」を操作する。
- [v0.6独立保存ソース](../versions/v0.6/)には惑星エンジン・原型モデル・12GLB・モデル工房などを含む。GitHubブランチ`universal-engine-v0.6-stable`も別途固定。
- 旧版との描画互換・姿勢・アクション・セーブ分離の自動テストを追加。
- **未実装:** 6カメラモード、10衣装、表情の細かな可動メッシュ、遠景LOD、建物内部/家具/村。これらはv0.7b〜v0.9の範囲。

## v0.6 — Original 3D art pack

The hand-built avatar and basic vegetation/building placeholders have been replaced by **original, procedurally-authored 3D geometry** from [`../original-assets/`](../original-assets/). Three avatar variants (pioneer/scout/artisan) can be selected in the exploration UI and are rendered through the **existing 21-pivot joint animation**. Trees, rock, tools and house also use original geometry in the WebGL scene.

The separate [Original Model Lab](../model-lab/) allows rotating and previewing all 12 models and exporting `GLB` (rigid joint hierarchy + 5 clips for avatars) or `OBJ` (static geometry). Twelve actual `.glb` files are stored in `../original-assets/models/` for immediate import into 3D editors. See the original asset pack's [README](../original-assets/README.md) and [LICENSE](../original-assets/LICENSE.md).

Current characters are stylized segmented low-poly models rather than skinned high-detail avatars. Models are original designs, not modified copies of KayKit, Quaternius or Kenney assets. Import/export visual QA in Blender and mobile browser is still pending.

## v0.5: Enlarged screen and 3D asset research (2026-10-16)

- Normally, the 3D viewport is wider (up to 1700px page) and taller: 72% of viewport height for large screens, 76% on narrow screens, with minimum readable height.
- Select **「⛶ 画面を広げる」** to maximize the game. Native browser fullscreen is used when supported; an independent CSS immersive mode is the fallback for iPhone Safari, with an on-screen restore button and Escape key support.
- The joystick and action controls remain visible inside the expanded viewport. No change to core simulation, save formats, existing Frontier World, or Kamoku Monitor.
- See [ASSET_CANDIDATES.md](ASSET_CANDIDATES.md) for commercially usable **CC0** 3D asset sources: KayKit Adventurers and animations, Quaternius Universal Base Characters, Nature MegaKit, and Kenney kits.
- **No third-party 3D assets have yet been imported.** The present WebGL2 renderer still uses procedural low-poly models; glTF rigging, skeletal skinning and animation retargeting require another integration phase.

## v0.4 — 関節アバターと行動UI（2026-10-16）

- **関節:** 頭・首・胴・腰、左右の肩/肘/手首、股/膝/足首を階層変換し、低ポリゴンの16身体パーツを別々に描画。歩行中は脚と腕が逆位相で揺れ、ジャンプ中は膝と腕が変形。行動中は剣/斧/つるはし/金槌を右手に描画。
- **ジャンプ:** 地表上の単純な跳躍、惑星の重力値で加速・着地。カメラと人物描画を連動。多段ジャンプ不可。
- **移動:** 画面左の仮想スティック、従来のWASD/方向ボタン、地表クリックで3D三角形をレイキャストして目標地点まで歩くタップ移動を選択。水域・急斜面では自動移動を停止。視点ドラッグでも方向転換。
- **作業:** 剣はモーション（対戦ダメージ未実装）。斧は木材+2、つるはしは石+2のデモ用採取ルール。金槌の建築は木4・石2を消費して小屋を段階的に描画。小屋の惑星緯度/経度を保存し、着陸地を変更しても地理的位置は変わらない。
- **セーブ:** 既存のExplorerキーの保存内容に`actions`を追加。旧データは初期行動状態へフォールバック。システム関数は復元時に再登録。
- **検証:** 階層関節、跳躍、移動・地面レイキャスト、建築資材・進捗・復元を自動テスト化。Safari/PC実機での画素やポインターE2Eは別途必要。

## ファイル

- `geo.mjs`：球面上の緯度/経度→位置、東北方向メートル→地理座標、地表を共有する `terrainSurface`、局所メッシュ。
- `controller.mjs`：高度/降下/地表の歩行と簡易衝突、セーブ形式。
- `render.mjs`：WebGL2プログラム、球面メッシュ、LOD地形パッチ、樹木・草・人物の簡易立体モデル。
- `rig.mjs`：階層関節21点と胴体・頭・首・腰・上腕・前腕・手・太腿・脛・足の独立パーツ、および関節モーション。
- `actions.mjs`：剣・斧・採掘・建築の簡易行動と資材、建築物の地理位置、セーブ。
- `picking.mjs`：WebGLビューポートから地表三角形へのレイ判定。
- `app.mjs`：UI・シミュレーション時間・スマホ仮想スティック・タップ移動・独立保存管理。
- `index.html`、`style.css`：ブラウザ表示。
- `../tests/explorer.test.mjs`：座標、地形、移動、WebGL描画のテスト。
- `../tests/interaction.test.mjs`：階層関節、歩行・ジャンプ、道具、建築、タップ移動のテスト。

## 実行

GitHub Pages上のリンクを開くか、リポジトリのルートで `python3 -m http.server 8000` を実行し `http://localhost:8000/universal-engine/planet-explorer/` を開いてください。ローカルの `file://` URLではES Modulesが読み込めません。

テスト: `cd universal-engine && npm test`（Node.js 20以降・追加npm依存なし）。

## 守る境界

Kamoku Monitorは現実の観測・投影専用。Frontier Worldは既存の独立ゲーム。両者の実装、保存、API、ルートページには一切接続しません。Explorer独自のセーブキーは `universal-engine:explorer:v1` です。

## 制限事項

**地表と惑星の地形サンプルは同一ですが、完全に連続した単一メッシュではありません。** 高度約23kmで球面表示から地表詳細パッチへ切り替わり、映像が少し切り替わることがあります。地表の樹木/草と関節付き人物は仮モデルで、v0.2の種子散布・動物AI・石投げシステムとはこの画面ではまだ連携していません。地表の一部の水域・急斜面だけ簡易通行止めを行い、積雪、地下、洞窟、完全な建築システム、衝突剛体、広域水文学は今後の開発範囲です。

ブラウザ実機での描画・タッチ・GPU性能のE2Eテストは別途必要です。
