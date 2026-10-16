# Planet Explorer — Change Log

## v0.7c mobile viewport patch — 2026-10-16

- On first visit from a small touch device, launch the 3D scene in reversible CSS immersive mode. A visible in-scene button exits to all settings and older-version links; the manual choice lasts only within that browser tab.
- Add in-scene quick actions for fullscreen/return, six-camera cycling, joystick/tap movement, and an expandable tools drawer for saving, time controls and landing/orbit controls.
- Adapt the viewport and floating controls to dynamic iPhone Safari height, portrait/landscape and safe-area insets. No claim that a web page can remove Safari chrome or external platform UI.
- Give the ground view a daylight atmospheric sky through transparent WebGL clearing. Opaque orbital/space rendering remains unchanged. This is **not** yet distant mountain/ocean geometry.
- Keep the v0.7c save schema unchanged and the v0.7b/v0.7a/v0.6 runtime archives intact. Create GitHub rollback branch `universal-engine-v0.7c-before-mobile`.
- Add mobile viewport tests and update the fullscreen regression test. Browser/GPU visual checks on iPhone are still required.

## v0.7c — 2026-10-16 (experimental)

- Added six camera modes: legacy, following, over-shoulder, detached free, actor orbit and high tactical view.
- Added camera settings, drag rotation, free movement controlled by stick/WASD, actor portrait button and beacon.
- Added persistent independent v0.7c save, manual read-only import of v0.7b/v0.7a/v0.6.
- Archived whole v0.7b runtime and models at a separate URL; source rollback branches retained.
- Added camera projection/controls tests and save UI tests. Long-distance terrain and interiors remain future tasks.

## v0.7b — 2026-10-16 (experimental)

- Added ten original clothing presets, adjustable hats, capes, bags, hairstyles and independent fabric/hair dyes for three existing avatar bodies.
- Added seven expressive states, gaze, blink, eyebrows, eye and mouth meshes tied to v2 face pivots.
- Added UI settings panel and separate v0.7b saves, including explicit read-only import from v0.7a and v0.6.
- Archived v0.7a as a complete self-contained playable version and retained v0.6 archive and branches.
- Added wardrobe/expression regression tests; camera, far terrain and interiors remain future work.

## v0.7a — 2026-10-16 (experimental)
- Saved full v0.6 executable engine/demos/models under `versions/v0.6/`, plus independent GitHub branch for source-level rollback.
- Added direct two-way version navigation between v0.6 and v0.7a.
- Changed only the new version's localStorage key; import old v0.6 data read-only with explicit button.
- Added 60 semantic anatomical joints with exact old 21 pivot compatibility, smooth gait/action transitions, joint fillers and finger pieces.
- Added 11 v0.7a regression tests; old simulation, build, models and terrain tests remain valid.
- **Not a full v0.7 release:** expression/wardrobe/camera/distant terrain remain on the issue roadmap.

## v0.6 — 2026-10-16
- 12 unique original 3D models and self-contained binary GLB files; 3 avatar variants with rigid hierarchy and five GLB animation clips.
- Procedural model generation, GLB and OBJ exporters, interactive preview studio.
- Explorer's custom WebGL rendering upgraded to original avatar/environment/tool/building meshes, with avatar style switching and persisted selection.
- Model geometry/export regression tests, sources and model license documentation.
- Existing Frontier World and Kamoku Monitor files remain untouched.

## v0.5 — 2026-10-16
- Expanded the desktop and phone world viewport and widened the page layout.
- Added a fullscreen button with native Fullscreen API and CSS immersive fallback for iPhone Safari.
- Kept touch joystick, action palette, land-and-tap movement and HUD visible in expanded mode.
- Documented original-creator CC0 model/animation packs, free-tier details, integration steps and license cautions; no external assets imported.
- Added viewport regression tests. Existing simulators and Kamoku Monitor are untouched.

## v0.4 (2026-10-16)
- 関節21点（頭・首・手・腰・太腿・脛・足など）と独立低ポリゴン16身体部位、歩行/ジャンプ/剣/斧/採掘/建築のポーズ。
- 惑星重力によるジャンプ・着地。
- 画面左下の仮想スティック、地面タップのレイキャスト移動、アクションボタン。
- 採取資材（木/石）、段階的な小屋建築、建造物の惑星緯度経度保存。
- 保存形式の後方互換性と新しい操作系テストを追加。
- 変更は`universal-engine/`内に限定。

## v0.3 (2026-10-16)
- 新規 `planet-explorer/` に独立したブラウザ標準WebGL2の3D球体＋地面表示。
- 全球と局所で共通の地形標高・緯度経度・局所メートルを利用。
- 高度による描画LOD、宇宙⇄地表のズーム、アバターの歩行と簡易通行判定。
- マウス/タッチ回転、PCキー操作、スマホ方向ボタン、惑星時間停止・早送り。
- 別名前空間で保存・復元可能。
- ジオメトリ／描画モックを含む14項目の自動テスト、仕様書を追加。
- Universal Engineの入口を、v0.1〜v0.3デモのハブへ変更。
- Kamoku Monitor、Frontier Worldとそのデータは一切変更しない。
