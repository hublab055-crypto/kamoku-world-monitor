# Planet Explorer — Change Log

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
