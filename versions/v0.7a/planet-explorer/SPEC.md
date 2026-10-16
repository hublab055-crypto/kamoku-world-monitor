# Universal Engine v0.7a — 惑星から地表への地理・描画接続仕様

更新: 2026-10-16 / 既存資産との分離を維持。

## 目的と非目的

架空の惑星に共通の地形データを用い、宇宙から3D地表までズームし、地上では操作キャラで歩ける基盤を提供する。Kamoku Monitorは**現実投影**であり、入力・出力・編集のいずれにも接続しない。Frontier Worldのゲーム本体を今回は変更しない。

## 共通地理モデル

- `Planet.radiusM` は惑星半径（既定6371000m）。
- `geoNormal(lat,lon)` は球面上の単位法線。
- `geoOffset(lat,lon,eastM,northM,radiusM)` は球面指数写像によるオフセット。日付変更線の切替と高緯度でも連続。
- `geoLocal` は逆写像。近距離の歩行の原点を保つ。
- `terrainSurface(terrain,lat,lon)` が **グローブと地上の共通地表標高**。既存の惑星規模`Terrain.sample`に、球面3次元ノイズで数十〜数百mスケールの起伏を付加。海面は0m。
- `samplePatch` は同じ関数で生成した `Float32Array` 頂点・法線・色と `Uint16Array` 索引を返す。隣接パッチが同じ地理座標を参照する点では同一標高となる。
- `findLand` は既存地形上の陸地・中標高を優先して出発地を探す。

## レンダリング

WebGL2の頂点・フラグメントシェーダーを採用。球体と雲を三角形で描画し、太陽ベクトル方向による明暗を計算。遠景球体の高さは視認性のため控えめに誇張する。地表は実メートルの高度で描画。空気遠近法や大気散乱は未実装。

- 高度が23,000m超：球面/雲表示。
- 以下：地表メッシュ。地理座標 `origin` と現在位置を球面指数写像で相互変換する。
- 概ね2.5mまで降下すると、三人称でプレイヤーの低ポリゴンアバターを追従表示。
- 高度に応じて地上パッチの半径450〜55,000mと分割数56〜64を使用。再作成時、旧GPUバッファを破棄。
- 地表パッチはプレイヤー近傍に再配置し、浮動小数点の桁落ちを抑える。ユーザー座標はメートルで維持。
- 宇宙モードで惑星を見せる表示時の回転と、地表の座標原点は相互変換するが、切替を隠す画像ブレンドは未対応。

## 移動・衝突

- 前後5m/s、左右横移動5m/s、旋回1.7rad/s。
- 斜め移動は正規化。描画のフレーム長は最大0.1秒にクランプ。
- 地上の海、河川、標高2800m超、歩幅に対して急な標高段差は進入を拒否。
- 位置 `(x,z)` と緯度経度は毎歩更新。ワープ／世界間の移動は未実装。
- ジャンプは重力加速度によるローカル垂直速度の簡易積分と地面着地のみ実装。崖からの落下、海中移動、剛体衝突、地形との連続衝突検知は未実装。v0.2のBallisticsは別デモで引き続き使用可能。

## v0.7a 差分と復帰保証

- `rig-v2.mjs`: 60 semantic joints with stable 21 names. `jointTransformsV2` reproduces old 21-joint matrices when fed a legacy pose. Adds clavicle, finger pairs, toe, heel, spine/chest, jaw/eyes semantic pivots. Extended joints are not yet exported into the v0.6 GLB assets.
- `animator.mjs`: finite-dt exponential interpolation of legacy poses, locomotion and upper-body action overlay; extra values for clavicles/twists/finger curl. Animations remain segmented meshes, **not skinning**.
- `joint-covers.mjs`: 36 low-poly companion parts for elbow/knee/wrist/hip/shoulder/ankle/toe/fingers/spine to reduce visible segment gaps. Colors depend on original avatar variant.
- `render.mjs`: uses the new animator and FK matrices with existing 3 avatar models; maintains existing action geometry, terrain, and interfaces. Existing v0.6 renderer remains independent under the archive folder.
- `planet-explorer/index.html`: explicit navigation link `../versions/v0.6/planet-explorer/`.
- **v0.6 saved state:** `universal-engine:explorer:v1` (untouched); **v0.7a saved state:** `universal-engine:explorer:v0.7a` (new). The old state is not automatically imported; a manual read-only import control is available.
- `universal-engine/versions/v0.6/`: independent copies of core, planet engines, all demos, original-models and GLB binary assets. Only legacy HTML has a version-navigation banner.
- Recovery source branch: `universal-engine-v0.6-stable` at commit `82da310c33c87526aebac5932ca43978bfe0fdf3`.
- `tests/rig-v07.test.mjs`: 60-joint unique graph, old joint matrix equality in six animation kinds, smooth transitions, frame-rate invariance, joint filler geometry, archive key separation.
- **Out of scope:** full cloth wardrobe, skinned GLBs, facial expression mesh, camera controls, high-altitude avatar tracking and distant terrain. Detailed requirements live in `../design/v0.7/SPEC.md`.

## v0.6 new original model pack

- All geometry generated from standalone source `../original-assets/original-models.mjs`: 3 humanoids, 3 tree variants, boulder, hut, 4 tools.
- `render.mjs` now uses `buildOriginalModel()` for the three avatar variants. It assigns each original mesh to an existing semantic pivot from `rig.mjs`; the existing action animations keep working.
- Environment objects: original trees, stone models and upgraded colored wooden hut meshes replace placeholder primitives. Bounded CPU mesh batching still limits vegetation to protect mobile performance.
- Runtime selection `#avatar-style` swaps all segment meshes and persists the selected avatar in the existing explorer save data, using "pioneer" as the default for legacy saves.
- `../original-assets/export.mjs` exports glTF 2.0 GLB binaries with `COLOR_0`, normals, joint-node hierarchy and five in-place animation clips for avatars (walk, jump, sword, axe, build). These are **rigid node animations** and do not contain skinned meshes.
- GLB files also stored at `../original-assets/models/<id>.glb`; editable OBJ export in Model Lab is static (no rig/animation/colors). Original assets metadata is CC0-1.0; generator code MIT.
- `../model-lab/` is a separate browser viewer/editor entrypoint. No external asset requests or dependencies.
- Known limits: no animation blending in GLB viewer, skeletal skin weighting, texture maps, facial morphs or third-party formats such as FBX. Visual QA in Blender and actual iPhone browsers has not been done.

## v0.5 large-screen viewport and asset pipeline

- Main stage uses a wide container (up to 1700px), a viewport with minimum heights, and CSS dynamic viewport height (72dvh desktop, 76dvh mobile). Canvas drawing-buffer dimensions continue to follow the actual element CSS box via the current renderer resize path.
- The new `#fullscreen-toggle` button toggles `Element.requestFullscreen()` where supported; if unavailable or rejected, `.view-panel.immersive` is positioned fixed across the visual viewport, while `body.immersive` prevents page scroll. Both layouts retain HUD, joystick and action palette.
- Clicking again restores the page. Escape exits the CSS fallback and native browser Escape exits native fullscreen. No screen orientation lock is requested.
- This is a browser-dependent fullscreen UI, not a promise of guaranteed device-level immersion. On iOS Safari, native fullscreen for ordinary page elements may be unavailable; the CSS fallback displays within Safari's available viewport.
- Commercial asset candidates and license-source links are recorded in [ASSET_CANDIDATES.md](ASSET_CANDIDATES.md); the engine does not fetch or bundle these remote assets.
- A separate asset integration phase must implement glTF/GLB loading, texture upload, skeleton/bind-pose data, vertex skinning and animation playback/retargeting or switch to a reviewed WebGL library adapter. Current rig remains available as fallback.
- `tests/viewport.test.mjs` checks the toggle, responsive enlargement, fallback CSS/JS, and continued presence of controls. Browser visual/device tests remain outstanding.

## v0.4 拡張仕様：関節・アクション・UI

### アニメーション階層
`rig.mjs` に頭/首/胴/腰と左右の肩・肘・手首・手・股関節・膝・足首・足の21ピボットを保持。各ピボットの4x4階層行列を前方運動学で積算し、16種類の独立した低ポリゴン身体パーツに対応づける。

- `samplePose({phase,moving,jumpHeight,action,progress})` は待機・歩行・ジャンプ・剣・斧・採掘・建築の関節角度を生成する。
- 歩行位相は実歩行距離を基に計算。停止中に足踏みしない。腕と脚は概ね逆位相。
- ジャンプは`ExplorerController.jump()`による初速5.6m/s、惑星`gravity`による落下。接地まで再ジャンプ不可。
- `render.mjs` は各身体パーツ・工具のGPUメッシュを初期化して使い回し、毎フレーム関節行列を更新する。専用アセットやスキニングは不要。

### 操作方法
- 移動モード`stick`：画面左下の仮想スティックで前後左右、右のアクションボタンでジャンプ/剣/斧/採掘/建築。
- 移動モード`tap`：Canvasタップのポインター位置から逆ビュー射影行列でレイを生成し、地面三角形との交点を取得。350m以内の目標へ旋回して自動歩行。手動キー入力で自動移動は解除。ドラッグ操作で旋回。
- PCでは両モードともWASDで手動操作、Q/Eで旋回。従来の方向ボタンも残す。
- 地上操作は着陸高度12m以下で有効。モード選択とアクションはUI上で状態を表示。

### 建築と資源
- `actions.mjs` は有限時間の行動を管理。`sword`は演出のみ、`axe`と`mine`は仮の素材増加、`build`は4.3秒の金槌モーションと建築進捗。
- 初期資源：木12・石8。小屋一棟は木4・石2。建築位置はプレイヤー前方6.5m、着工時に水域/傾斜と建物の重複を検証。
- 小屋は土台・壁・屋根を進捗に応じて表示。惑星の緯度経度で保存するため、地上原点を変更しても既存建物を別の位置へ移さない。
- この段階では木を一本ずつ伐る衝突判定、資源採掘地点、剣の命中/ダメージ、住人による自律建築などは未実装。

### 保存とテスト
- `ExplorerController.snapshot`に`jumpY`、`jumpV`、`moveTarget`を追加。旧セーブの不足フィールドは既定値へフォールバック。
- `Actions.snapshot()`は資材・建物の地理位置と進捗・行動中モーションを保持。
- `tests/interaction.test.mjs`で関節、歩行/ジャンプ、タップ自動移動、描画モック、資材と建築の保存・復元を検証。
- 実機WebGL2/Pointer Eventsの視覚E2Eとマルチプレイヤー同期は未検証。

## マルチバース同期と時間

`Multiverse`内の独立`SimulationWorld` (id `terra-nova`) に`solar-time`システムを登録。時間経過は惑星だけに反映される。モジュールはDOM非依存、アプリだけが画面や端末保存を扱う。セーブは `{format:"ue/explorer-demo",version:1,planet,explorer,universe,actions}`。復元時は登録関数を再登録する。

## テスト

`node --test tests/explorer.test.mjs`：
1. 球面単位法線
2. 球面オフセットと逆変換（センチメートル精度）
3. 日付変更線
4. 高緯度
5. 陸上着陸地点
6. 全球と地上メッシュの同じ標高
7. 隣接メッシュの標高の一致
8. 歩行と緯度経度整合
9. 高度補間
10. 高度とズームの入力検証
11. 水域・急斜面の衝突
12. 保存復元
13. カメラ行列
14. WebGL2模擬環境で球体・地形の三角形描画

従来の `npm test` は `tests/*.test.mjs` で全シリーズを実行。

## v0.4候補

球面/地上のジオメトリを本当に途切れず連続LODにする、地表チャンクの段差解消、地形テクスチャ、海洋・河川流路、人間/動物自律AI、衝突体と重力、ログ/保存移行、群衆・植生の成長システム、マルチプレイヤー。
