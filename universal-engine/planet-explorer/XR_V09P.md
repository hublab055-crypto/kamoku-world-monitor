# Universal Engine WebXR v0.9p — live VR frame diagnostics

## Report
A headset displayed only **「VR診断：セッション開始、映像フレーム待機中」**.
In v0.9n the diagnostic was only refreshed at frame 90/300 *if* successful
rendering reached the end of the XR callback. Any early return (no pose, no
layer, unfinished layer replacement, or no callback) could leave the initial
text indefinitely. Therefore that text was not evidence that no frame arrived.

## Correction
- The XR callback counter is incremented at **the very beginning** of
  `XRSession.requestAnimationFrame`'s callback, before early returns.
- First callback, tracking pose, opaque framebuffer, stereo viewport, render
  completion and stage-specific errors are separately reported.
- The visible diagnostic includes **XRコールバック=**, **描画完了=**,
  **追跡=**, **可視状態=**, and the framebuffer status such as
  `FB=complete ...／layer=0`.
- One-shot browser timer watchdogs (4.5s, 11s) indicate **XR描画コールバック未受信**,
  **XR映像描画未完了**, or (if frames stopped) **XR描画コールバックが停止**.
  Timers **never** operate on the opaque XR framebuffer and may be throttled
  when the browser is in an immersive session, so the authoritative summary is
  also written on XR exit.
- `visibilitychange` events record WebXR `visible`, `visible-blurred`,
  or `hidden`. A `hidden` session may legitimately stop XR frame callbacks.
- XR exit **always** preserves a final diagnostic, even with zero callbacks.
- Distinguishes zero received frames from received frames with no successful
  stereo render. Scene frames are counted only when every required viewport
  actually rendered successfully.
- Browser module cache version updated to force the headset to load the new
  logic.

## Hardware retest
After GitHub Pages deployment, refresh in the headset and activate VR. Stay
in VR for several seconds if comfortable, then press XR終了 or the system's
exit control. Copy the final **🥽 VR診断** line or log entry:
- `XRコールバック=0`: XRSession callback not received (or session hidden).
- `XRコールバック>0／描画完了=0`: callback received, rendering blocked.
- `FB=unsupported` / `layer=1`: compositor/framebuffer incompatibility or fallback.
- `描画完了>0` but black view: rendering reports success; investigate
  headset compositor, camera transforms, or occlusion next.

## Compatibility
Legacy 3D, MR, gameplay RTS, save state and WebXR fallback layers preserved.

## Reference
WebXR spec: https://www.w3.org/TR/webxr/
