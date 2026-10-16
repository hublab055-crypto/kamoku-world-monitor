# Frontier World 3D Avatar / RTS Bridge v1.0

## 目的

2D版『フロンティアワールド』を残したまま、同じゲーム状態（プレイヤー・NPCの位置、行動状態）を任意で3D表示します。

- **🌐 3D視点**: ゲーム左上のボタンで2D/3Dを切り替える。初期状態は2D。
- **追従 / ⚓ 上空RTS / 自由視点**: カメラ切替。ドラッグで視点回転、ピンチ・スクロールでズーム。
- **NPCの選択**: アバターをタップして選択し、地面をタップすると選択キャラクターに移動指示。PCはShift、スマホは「複数選択」で追加選択。
- **停止 / 🤖 自動**: 選択したNPCの手動指示を停止、または従来のNPC AIへ復帰。3Dを閉じた時も従来のAIへ復帰。
- **♂/♀ 外見**: 選択したアバターの男女モデルを変更。選択がない場合は操作中キャラクターを変更。
- **歩行・生活モーション**: 実際の移動・NPCの状態文字列とGLBのWalk / Idle / Sit / Talk / Chopを連動。
- **GLB / ZIPの読み込み**: 既存のオリジナル3Dモデルパックから男性・女性の実モデルを取り込み。読み込んだモデルは端末のIndexedDBに保存。

## オリジナルの男女GLBを利用する手順

1. 事前に制作した frontier_world_3d_avatars_v1.zip を保存します。
2. ゲームの「🌐 3D視点」を押します。
3. 画面下の「📦 GLB読込」からZIPファイルを選択します。ZIP対応が不安定なブラウザではZIPを展開して frontier_male_mobile.glb と frontier_female_mobile.glb の2ファイルを選択します。
4. 読み込み成功後、男女のオリジナルリグ付きモデルが表示されます。以降同じブラウザでは端末キャッシュを利用できます。

**重要**: この版ではGLB実ファイルはGitHubリポジトリにまだ同梱していません。未インポートの初期状態はコード生成の仮3Dアバターを表示します。初回から正式モデルを配信するには、下記パスへバイナリを追加する必要があります。

    frontier-world/assets/avatars/frontier_male_mobile.glb
    frontier-world/assets/avatars/frontier_female_mobile.glb

同名で配置すると追加操作なしでGLTFLoaderがロードできます。ユーザーのブラウザー側でキャッシュ済みの場合はキャッシュが優先されます。

## 技術設計

- frontier-world/index.html: 既存ゲームのブリッジに setPlayerMove3D(x,y) と canMove3D(x,y) を追加。3DライブラリとJSの読み込みを追加。
- frontier-world/avatar-3d.js: Three.js scene / OrbitControls / GLTFLoader / SkeletonUtils、レンダリング、NPC同期、RTSクリック指示、キャラ別AnimationMixer、IndexedDBキャッシュ。
- 既存ゲームの window.__fwFrontierBridge.state を読み取り、独立したワールド状態を作らない。
- 手動NPC指示中だけブリッジの updateNPC アクセサ経由で移動を処理し、自動復帰時には元の関数へ委譲する。
- 既存のCanvas 2D描画、セーブ処理、バージョン切替、他のウィジェットへの変更は最小限。

## 確認済み・未確認

- **確認済み**: JSの構文解析、GitHubへのコード更新、オリジナルGLB 4ファイルのjoint/triangle/animation構造検査。
- **未確認**: GitHub Pages実端末でのWebGL動作、iOS Safari・メモリ性能、タップ移動の障害物回避、複数端末同期。
- **未実装**: A*経路探索、障害物回避、遠距離LOD、装備の3D連動、モーションブレンドの詳細制御、3D屋内家具、すべての行動スロットの3D化、サーバー共有のモデル保管。
- スマホで処理が重い場合、画面上部のボタンでいつでも元の2D描画に戻せます。

## 変更履歴

- 2026-10-16 v1.0: オプション3D視点、男女アバター、カメラ切替、NPC単体・複数指示、通常AI復帰、モーション切替、GLB/ZIP読込、セッション越えキャッシュ。
