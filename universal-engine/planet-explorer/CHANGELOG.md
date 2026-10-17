## 2026-10-17 — v0.7u 両手武器（長槍・両手剣）

- 🔱 長槍と⚔️ 両手剣を基本装備に追加。右手・左手のいずれかに装備すると両手を占有し、盾や片手装備は同時装備不可。外すと両手とも空き、既存スロット保存と旧セーブ復元に対応。
- ⚙️ 5つの行動デッキから選択可能。剣系の突き・薙ぎ払い・振り下ろし・連続攻撃に接続。槍は長い突き（最大4.7m）、両手剣は広い薙ぎ払い・高ダメージを特徴とする暫定バランス。
- 両腕の肩・肘・手首を動かす専用モーションとオリジナルの簡易3D武器形状を追加。両手で1つの武器を持つため、手首に同じメッシュが重複表示されない処理を導入。
- RTSシンクロ時の「薙ぎ払う」「突く」から複数選択者に同期近接指示。NPCの命中判定もアニメーションの衝撃フレーム単位で反映。盾防御より控えめな両手武器ガードに対応。
- 10モジュールの構文チェック、主要17項目の実ロジック検証は通過。Node単体テストを追加。GitHub Actions全テストとSafari実機の表示・操作は未確認。手の厳密なIK把持は今後の改善対象。

## 2026-10-17 — v0.7t シンクロ射撃と回収可能な矢

- RTSの複数選択で「🔗 シンクロON」を有効にすると「🏹 射る」または「🏹 一斉射撃」で選択人物に同期射撃を指示。弓を実際に装備し矢筒残数がある人物だけ参加し、人物ごとに矢を1本消費。準備不足や動作中の人物はスキップ。
- 射出は「自動・直射・曲射」を選択可能。飛翔中の矢を独立した3Dメッシュとして描画、重力を考慮した放物線と連続的な衝突判定。自動は近距離直射／遠距離曲射を切替。
- 地表、樹木／岩、完成小屋、練習用の的、敵への着弾を判定。的は前方9mに設置、タップして狙える。敵のHP減少は弓を引いた時点でなく実際の命中時だけ発生。敵に刺さった矢は敵の移動に追従。
- 着弾した矢は3D空間に残り、タップで接近・回収。矢筒残数に1本を戻し、同じ矢の二重回収を防ぐ。3D矢・的の保存／復元は既存の v0.7i セーブに後方互換の v0_7t セクションを追加して保持。
- 単体モジュールの構文確認と飛翔・木／建物／敵／的・回収のロジック確認を実施。iPhone Safari と GitHub Actions の全テスト結果は未確認。

## 2026-10-17 — v0.7s RTS / TPV 共通タッチ操作

- RTS / TPVともに1本指ドラッグで視点回転、2本指ピンチでカメラ拡大・縮小。RTS俯瞰は約8mまで接近可能。肩越し視点にもズーム距離を反映。
- 敵を1回タップして手動ターゲットに指定。弓の「🏹 射る」で射撃。RTSの仲間も選択した敵への射撃・命中判定を矢の放出タイミングに実行。
- 地表の木・岩を1回タップすると選択人物が接近して伐採・採掘。地面のダブルタップでRTSの選択部隊またはTPVプレイヤーが目的地へ移動開始。既存の人物・家具・扉タップを優先し、予期しない移動指示を防止。
- 自動条件行動中のRTS手動移動指示が失われる問題を修正。ジェスチャーとNPC弓の回帰テストを追加。
- 従来のセーブ形式・過去バージョンへの復帰を保持。スマホ Safari 実機の操作試験は未実施。

## 2026-10-16 — v0.7k 右手/左手の個別装備

- 画面右に左右の使用ボタン、持ち物画面で右手/左手に装備。
- 所持数に基づく装備可否・消耗・贈り物の使用、人物別の保存。
- 5枠クイック操作を維持し、左右手首の道具表示とRTSでの左手アクションに接続。
- v0.7iのセーブ形式と互換。実機UIは未検証。

## 2026-10-16 — v0.7j Frontier GLB GPUモーション

- GLB skeleton/skin/clip/FaceIdle/FaceTalking取り込み、GPU関節と口・まぶたのモーフ、基本埋込テクスチャ描画。
- 歩行・作業・会話/プレゼントに応じてキャラクター別再生。フォールバックと合成GLBテスト追加。
- v0.7iセーブ形式と互換。実高精細GLB・iPhone Safari描画は未検証。

## 2026-10-16 — Frontier World 第1段階の統合

3D惑星上の個人スタミナ・重量・所持品、有限資源採集、家への帰還とチェスト収納、8枠IF/THEN優先順位を連動。

# Planet Explorer — Change Log

## v0.7h — コンパクト操作 HUD (2026-10-16)

- スマホのプレイ画面を占有していた縦8個の操作ボタンを、常時表示の「⛶」と「☰ 操作」だけに整理。後者を開いたときのみカメラ切替・移動方式・RTS指揮・自動行動・読書・家具クラフト・詳細メニューが現れる（2列グリッド、タッチしやすい高さ42px）。
- 画面右下は「ジャンプ」と「⚒ 道具」の小型2ボタンに変更。剣・斧・採掘・建築は道具メニュー内に統合。小屋の入口は状況依存の「🚪 ドア」1ボタンから開閉・出入り・本棚操作を展開。
- 左下の仮想スティックを小型化し、半透明の操作レイヤーを整理。安全領域（iOS Safari safe-area）、縦横持ち表示とフルスクリーン切替に対応。
- メニュー外のタップまたはEscで閉じる。メニューの開閉状態はaria-expandedに反映し、既存のイベントリスナーと各種操作ボタンのIDを保持。カメラ・移動モードの切替は展開中に連続操作可能。
- **既存のロジック・セーブは無変更**：v0.7g の家具・野営・書籍、v0.7dのRTSと自動行動、旧版への復帰はそのまま。新しい保存データ形式は追加しない。
- テスト `compact-hud-v07h.test.mjs` で既存コマンドの所在・初期折りたたみ・キー／タップ操作・セーフエリアを確認。iPhone Safari実機での操作性チェックはこれから。

## v0.7g — Furniture / Craft / Kitchen / Portable Camp (2026-10-16)

- 新「🛠️ 生活・クラフト」メニューをゲーム画面とツールバーに追加。クラフト／持ち物／屋内家具／野営の4タブ、所持素材・体力・空腹・清潔・暖かさ・知識のHUDを提供。
- 屋内に配置できる家具：ベッド、椅子、机、暖炉、キッチン、本棚、ランプ、チェスト。木・石・繊維・粘土・金属からレシピに応じてクラフト。2Dフロアマップで位置（0.25mずつ）と向き（90°単位）を調節して設置・回収。扉・壁・他の家具と重なる位置を禁止。
- 以前のv0.7e/fの小屋のベッド・チェスト・机・椅子・ランプ・本棚を、各小屋の実際に操作可能な家具へ初回移行。完成後の小屋にも同じ基本家具のデモセットを自動生成（将来は空家モードも検討）。家具と建物の状態は別レイヤーで管理。
- ベッド（睡眠・休息）、椅子（座る・立つ）、机（本を読む・皿に配膳・食事）、暖炉（薪を使った点火・消火・保温・料理）、キッチン（調理・水汲み・食器洗い）、本棚（前版の本文読書）、ランプ（点灯・消灯）。着座・睡眠・調理・食事・読書など関節ポーズを追加。
- 皿、椀、コップ、鍋、スプーンを個別アイテム化。鍋と食材・薪で料理を作り、机で皿に盛って食べ、使用後の汚れた皿をキッチンで洗って再利用できる。椀＋料理とスプーンの食事、水とコップの飲用・洗浄にも対応。食器と料理は実際に3D机・キッチンに表示。
- 携帯式のテントとベッドロールを「アイテム兼建築」としてクラフト。野外で設置するとオリジナル3Dテント／ベッドロールを生成し、テントに入る・出る・寝る、ベッドロールで寝る、たたんで持ち物へ戻すことが可能。地形の水域・既存建物との近接をチェックし、アイテム数量を保持。
- 木を切ると繊維、採掘すると粘土・金属も得られる。屋外で簡易食材採集が可能。材料・料理・家具・携帯設備・人物状態を含む `v0_7g` データを保存。新セーブキー `universal-engine:explorer:v0.7g` は以前の `v0.7d` と分離、旧セーブ読み取り用ボタンを追加。生活アイテムは別の端末ローカル自動セーブも持つ。
- `lifestyle.mjs`、`lifestyle-geometry.mjs`、`lifestyle-ui.mjs`、`tests/lifestyle-v07g.test.mjs` を追加。既存の描画・RTS・読み書きと共存する回帰テストをCIで実行。
- **MVPの制約:** 携帯テントは簡易Aフレームでドア鍵や風雨物理は未実装。料理は簡易レシピで素材もデモ採集。ランプは光色の強弱表現のみ（周辺を照らす動的光源は未実装）。家具使用は室内メニューからも実行可能（実物までの歩行経路・手の物理接触は今後）。商業利用可能なオリジナル形状で構成。

## v0.7f — 読書可能な本・本棚・しおり (2026-10-16)

- 『いろは歌とことば』（古典本文全文＋オリジナル解説）、オリジナル物語『開拓者の手記 ― 最初の灯』、図鑑『テラ・ノヴァ自然観察帳』、生活書『炉辺の暮らし ― 食卓と道具』の全4冊を収録。外部通信不要の本物の本文として、章とページを閲覧できる。
- 小屋の内部に本の背表紙を並べた3D本棚を描画。「📚 本棚」ボタン、棚の3Dモデルタップ、画面右の「📖 読書」、画面メニューの「📚 本棚・読書」から読書画面へ。
- 読書画面は日本語組版に配慮した紙面色、章見出し、前後ページ操作、文字サイズ調整（15〜26px）。プレイヤー移動は読書中停止。PCの左右矢印・Escapeにも対応。
- 本は小屋の本棚から持ち出して所持品とし、野外で読むことができる。持ち物から本棚へ戻すことも可能。初期の完成小屋には4冊を収蔵。
- しおり・所持本・文字サイズは読書のたびに端末ローカルへ自動保存。ゲームの従来のv0.7dセーブにも任意データ `v0_7f` を保存し、本棚の在庫は既存の建物データと一緒に保存。旧セーブも読み込める。
- 著作権に配慮し、いろは歌は伝承パブリックドメイン作品、説明とほか3冊は新規のオリジナル文章。商用作品や未許諾の文章は含まない。
- `books.mjs` と `tests/books-v07f.test.mjs` を追加。本文の完全性、ページ分割、出し入れ、復元、UIの自動検証を追加。iPhone Safariでの実機視覚確認は未実施。既存の家具クラフト・読書レベル連動は今後。

## v0.7e — 小屋のドアと屋内への出入り (2026-10-16)

- 完成した小屋の壁に実際の開口部を設け、独立した蝶番付きドアを作成。3D画面でドアをタップするか、入口に近づいて「🚪 開ける／閉める」を押すとドアが回転して開閉する。
- 開いた入口をアバターが徒歩で通過可能。閉じたドア・小屋の外壁では衝突を判定し、壁抜けを防ぐ。「🏠 中に入る」「🌿 外に出る」でも出入りできる。
- 入室時に屋根を非表示にして、木床、ベッド、チェスト、机、椅子、照明器具の簡易3D室内と室内俯瞰カメラに切り替える。家具操作・所有権・部屋の自由編集は次の段階。
- 既存のv0.7d保存キーを維持し、任意の `v0_7e.insideId` を加えて屋内状態を保存。小屋のドア開閉は `actions.structures[].doorOpen` で復元する。旧版の読込機能・v0.6/0.7a/0.7bアーカイブはそのまま。
- `buildings.mjs` と `tests/interiors-v07e.test.mjs` を追加。GitHub ActionsでJS構文と全Nodeテストを実行し、既存v0.7dと旧v0.7cキーの共存も回帰検証する。
- **制約:** これは小屋の簡易内装とドア開閉の試験実装。室内のオブジェクト選択・ドア鍵・自由家具配置・他NPC追従・モバイル実機の描画品質検査は今後対応。

## v0.7d — RTS squad + conditional automation (2026-10-16)

- Three independently moving on-planet avatars (pioneer, scout, artisan) share a geographical origin and render with selection rings and differentiated companion colors. The old player controls remain available.
- New ⚓ RTS overhead mode: tap one character to select; select all or toggle multi-select to command several; tap land to move the selected squad in loose formation; set a rally point or stop (which also disables AI). Direct camera mode transitions and existing movement modes are preserved.
- 🤔 In-view automatic action panel: eight ordered IF-condition / THEN-action slots **per avatar**, each individually enabled, plus a per-person automation master toggle. Metrics: wood, stone, finished huts, idle flag, distance from leader and walked metres. Operators: <, <=, >, >=, ==, !=. Actions: gather wood/stone, build a demo hut, move to rally, follow, patrol, or wait.
- Per-character autonomous gathering and movement with manual override. This is a **small single-player demonstration**, not multi-device RTS networking or simulated economics/production chains. Existing building rules reuse the demo's globally shared resource/action state.
- Independent current save key `universal-engine:explorer:v0.7d`. Old v0.7c is read-only import; v0.7b/v0.7a/v0.6 archives and keys are unchanged. Frozen pre-RTS code branch: `universal-engine-v0.7c-before-rts`.
- Adds condition, select/order, schema and persistence tests; desktop/iPhone WebGL E2E and full repository npm tests must be verified in a runnable environment.

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
