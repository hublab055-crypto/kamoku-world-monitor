# Universal Engine — 3D Surface Video Streaming (v0.9p)

Designed: 2026-10-24. Status: **opt-in PRIVATE prototype + PUBLIC transport contract**.
No existing saves, media inventory, localStorage keys, world schemas or custom
WebGL scene programs were replaced. Source code is in `planet-explorer/`.

## Actual renderer / differences from original proposal

This explorer uses a custom **WebGL2** renderer, not Three.js. Adding a second
Three.WebGLRenderer would break existing depth/scene behavior. Instead
`video-texture-renderer.mjs` is equivalent to a VideoTexture draw pass using
`texImage2D(..., HTMLVideoElement)` and the **same depth buffer** as the world.
Ground, mountains, avatars and buildings can occlude supported direct streams.

The player for YouTube/Vimeo/Dailymotion is a normal official iframe. This engine
does not load Three.CSS3DRenderer; `css3d-embed-renderer.mjs` computes a
perspective CSS matrix for the projected monitor's touch surface. To avoid
falsely claiming WebGL depth occlusion for DOM iframes, the iframe opens in an
overlay instead of on the 3D mesh. Official embeds are loaded **only on tap**.
YouTube in particular has iframe sizing and playback restrictions.

## Modules

| File | Responsibility |
| --- | --- |
| `video-provider-adapters.mjs` | Canonical official HTTPS embed IDs, strict direct-host opt-in, extension validation, extensible code-only adapters |
| `private-playback-controller.mjs` | Ephemeral sessions, Safari inline playback, HLS native first, optional injected `hlsFactory`, error explanation, resource release |
| `public-sync-controller.mjs` | Whitelisted serialized public wire data, verified authoritative transport, permissions callback, clock-offset adjustment |
| `video-texture-renderer.mjs` | Native WebGL2 streamed texture quads, depth testing, aspect-preserving letterbox/pillarbox, GPU cleanup |
| `css3d-embed-renderer.mjs` | Four-corner perspective CSS3D placement for touch controls, official iframe fallback |
| `surface-video-ui.mjs`, `surface-video.css` | Separate opt-in screen controls, one-session temporary placement, local building anchors |

## How to use this demo

1. Go to `universal-engine/planet-explorer/` on HTTPS.
2. Land on the planet. Open **📺 3D動画配信** in the toolbar or quick controls.
3. Paste a supported official YouTube, Vimeo or Dailymotion video URL, or a
   direct HTTPS MP4/WebM/m3u8 link. For direct video only, explicitly check
   the temporary host opt-in box. This does not bypass server CORS.
4. Choose free-standing 3m forward or near owner's building (within 15m).
   Choose physical width and aspect ratio and press **PRIVATEモニターを設置**.
5. Tap the 3D touch target. Direct videos play in the existing WebGL2 world.
   For embeds, an official embedded player opens in an overlay. Click × to close.
6. Remove a monitor from the same panel. Page reload clears these streams,
   including URLs; they are never injected into save-slot snapshots.

Existing *media artworks* (YouTube item / local film / record / painting) still
use the legacy media inventory and local save, independently of this opt-in feature.

## PRIVATE trust boundary

- Stream URL, title, viewing position/history, and provider playback objects
  are retained only in memory and DOM for the current page session.
- There is no `snapshot()` on the PRIVATE controller or UI. No addition to
  `app.mjs` save serialization or the media library format.
- No multiuser socket, shared DB, telemetry, or localStorage call from
  the PRIVATE streaming modules. No URL in console logs.
- A remote video request still reaches that video provider/CDN, and the provider
  may see viewer network metadata. PRIVATE is not an anonymity proxy.
- People on another multiplayer client would see a default/unconfigured
  placeholder once shared physical television objects are implemented;
  private playback is not distributed.

## PUBLIC is deliberately off until real multiplayer exists

The current planet-explorer has **no real multiplayer server**. PUBLIC needs:
1. a server-authoritative screen registry + shared world IDs / transforms;
2. authenticated publishing privilege and approved-provider/domain policy;
3. verified `ue-public-video` packets with server timestamps;
4. an injected `transport`, `policy`, and `authorize` callback.

`PublicSyncController` validates and serializes only the fields
`{version,screenId,provider,id,action,position}`; it strips private fields,
requires server validation, and will not connect without a public transport.
An actual server still must enforce source restrictions, account identity,
permissions, replay/rate limits, and event ordering. Browser `verified=true`
flags alone are not authentication; **the transport implementation must
set it only after validating its server source**. Shared playback, PUBLIC screen
placement, multiuser timing and permission administration are **not claimed
to be live** in this offline demo.

### Known limitations

- Some direct videos can play normally in a video element but cannot be uploaded
  as WebGL textures due to CORS/DRM; this is not bypassed.
- HLS uses Safari native playback first. Other browsers need a compatible
  `hlsFactory` (hls.js) explicitly supplied; the project does not yet vendor
  that third-party runtime.
- iOS may require user taps again after switching apps or changing visibility.
  Viewport-hidden videos are paused, not auto-resumed.
- Only ground-mode non-XR surfaces are enabled; WebXR per-eye integration is
  separate work. The building anchor currently tracks the owner's building
  origin, position and yaw, with an approximate front face offset; bespoke
  arbitrary-wall mesh UV placement / exact wall geometry fitting is not yet
  exposed in the owner editor.
- Only up to 2 direct streams on iPhone/iPad or 4 on desktop are allowed.
- DOM official-embed controls do not have true 3D occlusion. The official
  iframe is shown in an overlay, not as a WebGL texture.
- YouTube/Vimeo/Dailymotion embeds can be disabled by the video owner, region,
  login requirements, or provider policy.

## iPhone Safari verification

1. Open the HTTPS page in Safari (not `file://`) and load an earlier save slot.
   Check that world, building and avatar controls remain normal.
2. Open 📺 3D動画配信 and try a public CORS-enabled H.264 MP4 link from a
   trusted host. Check temporary host allow, place a screen, tap to start.
   Confirm inline (not forced fullscreen) playback and correct 16:9 aspect.
3. Move behind a building/terrain ridge: the MP4 image should be depth-occluded;
   return to the front and verify playback can be restarted manually.
4. Repeat with a native HLS `.m3u8` source. If codec/CORS unsupported, verify
   a clear message and no forced DRM or authentication workaround.
5. Place an official YouTube URL. Tap the perspective control; an official
   player must open, play only when permitted, and close without leaving audio.
6. Switch Safari tabs, background the app, go far from the screen, return.
   Check pause and deliberate user-resume behavior, no hidden autoplay.
7. Remove a screen and reload the page. The PRIVATE URL and session should be
   gone; saved world/owner/media inventory and previous save slots should still
   load. Confirm Developer Web Inspector shows no PRIVATE URL in app save JSON.
8. Try malicious HTTP/userinfo/javascript URLs and unsupported sites. Check
   validation errors and no iframe injection.

Unit checks: `cd universal-engine && npm test` (includes
`tests/surface-video-v09p.test.mjs`).
