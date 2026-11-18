# WORLD TABLET v1: browser media + game command terminal

2026-11-19 / Universal Engine / planet-explorer

## Scope of this PR (real, not mock UI)

- A new "▣" icon in the compact game bar, entries in quick menu and toolbar, and Alt+T shortcut (non-editable focus only).
- One draggable tablet window in the game viewport. It can switch between compact hand position and enlarged 2D "wall display" overlay; the current page/player stays mounted when repositioned.
- YouTube watch, youtu.be, shorts, live, and embed links: accepts an official 11-character video ID, creates a privacy-enhanced YouTube iframe, retains the normal player UI and branding. No extraction, downloading, ad suppression, or WebGL texture scraping.
- A direct HTTPS iframe browser, no implicit browsing history persistence, no JavaScript/data/file/http or URL credentials, sandboxed iframe, and an explicit "open external browser" fallback for CSP/X-Frame-Options restrictions.
- ChatGPT official site external opener. An optional, same-origin HTTPS \`/api/*\` server endpoint can enable an in-tablet text conversation. This frontend never stores an OpenAI key. Set \`<meta name="universal-engine-chat-endpoint" content="/api/universal-engine-chat">\` only when a protected backend is deployed. POST JSON: \`{"messages":[{"role":"user","content":"..."}]}\`. Successful responses must be JSON with a \`reply\` string. Backend MUST enforce authentication, quotas, input validation and CSRF protection; no unrestricted public proxy.
- Existing action bridges: camera follow/tactical; display preferences; main settings; avatar modifier; XR motion actor panel, arm and JSON copy; RTS camera, group management, select all, assemble and stop.
- No new save schema. Chat contents and browser URL are only in component memory; existing video/media state is not included in the game save.

## Known technical limits / next phase

**This change does not create a physical 3D prop, WebGL texture, tracked VR controller grip, multiplayer synchronized broadcast, or an actual 3D wall projection.** These require a separate renderer/input stage. The 2D wall placement is a usable first-stage visual prototype, not a 3D claim.

A normal cross-origin web iframe cannot be painted onto the engine's WebGL canvas. YouTube media pixels must not be scraped or re-encoded to simulate this. For immersive WebXR, DOM overlays depend on platform support and are not a generic positional tablet/wall solution.

Next work:
1. Give the tablet a physical object and two-hand/one-hand grips using existing Quest controller transforms, with 3D UI hit tests and a fallback controller-attached HUD.
2. For embedded external media in XR, use permitted platform/browser overlay mechanisms, or a separately controlled native browser panel if the host provides it. Confirm Quest 3S behavior on device before claiming video playback on 3D surfaces.
3. 3D wall/projector attachment: authorize placement on buildings/ship panels, persist wall anchor coordinates in local-world space, detach to tablet, and coordinate UI occlusion/line of sight. Do not attempt unauthorized cross-origin pixel capture.
4. Add responsive browser bookmarks (opt-in), display size/pointer interactions, and controlled content filtering by world.
5. Add ChatGPT server endpoint with user authentication and per-user usage controls; expose explicit consent before sending game state, XR motion JSON or player conversations.
6. Tablet XR motion recording: show recorder state, record/stop UI in VR, preview captured hand/head movements on avatars. Existing motion actor captures HMD and controllers only and does not infer physical feet as directly measured.
7. Tactical table: map/command renderer anchored to tablet, unit selection via raycasts and command confirmation with existing squad API. For now, this tablet routes to the working tactical camera and buttons.

## Local tests

\`cd universal-engine && npm test\`

Supplemental:
\`node --test planet-explorer/world-tablet.test.mjs\`
\`node --check planet-explorer/world-tablet.mjs\`

Existing: \`test-universal-engine.yml\` CI runs \`npm test\` on pushes and pull requests.

## YouTube検索・URL登録（2026-11-19追加）

画面操作：`▣ タブレット → ▶ 動画`

- URL（YouTube watch / youtu.be / shorts / live / embed、または動画ID）を入力し、「再生」でYouTube公式埋め込みプレーヤーを開く。
- 「登録名（任意）」を入力して「☆ URL登録」を押すと、同一ブラウザの localStorage `universal-engine:youtube-urls:v1` に動画ID、登録名、登録日時を保存。最大100件、同一動画は重複させず登録名を更新。リストには「再生」「URLをコピー」「削除」を用意する。動画コンテンツや認証情報は保存しない。保存は機器・ブラウザごとに独立する。
- YouTube動画をキーワード検索。認証された同一オリジンの検索APIが構成されていればタブレット内に検索結果が表示され、結果から直接再生・登録できる。未構成時は公式YouTube検索ページを新規タブで開き、見つけた動画URLをタブレットで登録できる。
- YouTube埋め込みの公開・年齢制限・埋め込み禁止は尊重する。ゲーム内WebGL壁テクスチャへの配信はこの段階に含まれない。
- URL文字列と検索結果テキストは検証し、ユーザー提供のHTMLとして実行しない。検索APIキーはブラウザに公開しない。

### 任意のゲーム内検索サーバの仕様

静的サイトだけでは公式YouTube検索結果を取得できない。ゲーム内に検索結果を表示するには、YouTube Data API v3の`search.list`を呼ぶ認証・レート制限付きのバックエンドが必要。APIキーはサーバの秘密環境変数に保存し、認証、アクセス制限、使用量制限、キャッシュ、結果検証を実装してから公開HTMLに下記を設定する。

```html
<meta name="universal-engine-youtube-search-endpoint" content="/api/youtube-search">
```

- 要求: 同一オリジン `GET /api/youtube-search?q=<URLエンコード済み検索語>`
- 応答: `{ "results": [{"videoId":"M7lc1UVf-VE","title":"Sample video","channelTitle":"Sample channel"}] }`
- YouTube APIへのサーバ側検索例: `search.list(part=snippet,type=video,q=...,maxResults=10,videoEmbeddable=true)`。Quota costとAPI利用規約を遵守する。
- フロントは上限20件まで表示し、識別子をYouTubeの11文字動画IDとして検証する。
- サーバ未導入時は外部検索フォールバックであり、ゲーム内検索結果が取得できたと表示しない。

## Quest 3S / WebXR: 3D物理タブレット v1.5（2026-11-19）

ワールドタブレット上部の「🥽 3D端末 OFF」を押してONにした後、Quest 3SのVRを開始する。ON/OFF状態は同じブラウザのlocalStorageで記憶する。初期値はOFF。WebXRでは独立したオリジナル形状のWebGL2メッシュを両眼に描画する。

- 手持ち：左Touchコントローラーの実測gripSpaceに追従する。左コントローラーが見失われたときは、実測値だと偽らず、頭部追従のフォールバック表示にする。
- 右トリガー：3Dメニューの9ボタンをレイと平面の交差で判定。動画、Web、ChatGPT、設定、モーション、RTS、WALL、HAND、OFF。押したVRタブレットのボタンは通常の射撃やコックピットの操作に流さない。
- WALL：VR開始中の現在空間で、視線の前方約1.65mに3Dスクリーンを固定。頭を動かしても追従しない。HANDで左手追従に戻す。再XRセッション時には位置をクリア。
- RTS：既存XR RTS指揮モードのON/OFFに接続。既存のコントローラーレイを使った部隊選択・移動は従来どおり。
- 動画/Web/ChatGPT/設定/モーション：既存ブラウザタブレットの各パネルを開く。**これはVR 3Dサーフェス上の実際のWebサイト表示・動画描画ではない**。Questの没入セッションでブラウザDOMが見える保証はない。
- 「OFF」でVR立体端末を無効にする。武器やHOTASの競合回避のためオプトインにしている。

### この段階では実装していない機能

1. YouTube動画ピクセルを3Dスクリーンにリアルタイム描画すること。YouTubeのクロスオリジンiframeからWebGLテクスチャへフレームを取得することはできず、その制約を回避する実装は行わない。
2. 建物の実際の壁の面をレイキャストして、スクリーンを幾何形状に吸着すること。WALLはあくまでXRルーム空間の浮遊固定スクリーンであり、壁との物理衝突・建築保存・多人同期はまだない。
3. WebXR DOM OverlayによるブラウザUIのQuest 3S没入セッション表示保証。Chrome/Questブラウザの実機確認が必要。
4. タブレットの両手把持・掴み判定・触覚フィードバック・動的動画テクスチャ・部隊ミニマップ。

### 確認方法

通常のブラウザでゲームを開き「▣ タブレット → 🥽 3D端末 ON」を選択し、QuestのVRモードを開始。左コントローラーの動きに端末が追従するか、右トリガーでVIDEO/RTS/WALL/HAND/OFFが反応するかを確認する。

ノードの幾何・座標・入力テスト：`cd universal-engine && node --test planet-explorer/world-tablet-spatial.test.mjs`。
表示・入力のQuest実機検証はCIでは行えない。
