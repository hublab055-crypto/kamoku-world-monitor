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
