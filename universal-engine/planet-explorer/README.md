# Universal Engine — Planet Explorer v0.6

独立した架空マルチバースの **WebGL2 3D惑星探索プロトタイプ**。宇宙から3D球体惑星を観察し、同一の地理座標・地形サンプラーで細密な地表メッシュへ降下し、人物を操作できます。

**URL:** https://hublab055-crypto.github.io/kamoku-world-monitor/universal-engine/planet-explorer/

- 宇宙: WebGL2で球体惑星・大陸・海・雲の三角形メッシュ、自転の見かけと恒星照明。
- 地表: WGS84ではなく架空惑星の球面緯度・経度、地形の高さに連続する高解像度メッシュを高度別LODで生成。
- 人物: 地表にいる時、WASD/方向ボタンで前後左右移動、Q/Eで旋回。移動先の水域・急斜面を簡易的にブロック。
- 操作: 降下・帰還、拡大・縮小、惑星日数の早送り、時間停止、端末ローカル保存・復元。
- モバイル: 画面ボタンを押し続ける操作、タッチでカメラ回転、ピンチの代わりに拡大縮小ボタン。
- JavaScript ES Modules + ブラウザ標準WebGL2だけで動作。CDN・外部アセット・認証・外部ネットワーク通信なし。

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
