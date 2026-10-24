# WebXR v0.9n — VR INVALID_FRAMEBUFFER_OPERATION (0x0506) recovery

## Field report (2026-10-24)
- VR display completely black.
- `VR診断：追跡あり／2眼／WebGLエラー 0x506／90フレーム` and same at 300.
- The XR pose system and binocular XRView creation therefore function, but framebuffer rendering reports `INVALID_FRAMEBUFFER_OPERATION`.
- The exact root cause **cannot be proven from those logs alone**. A WebXR opaque XRWebGLLayer framebuffer is only guaranteed to be complete *inside its own XRSession.requestAnimationFrame callback*. A failing framebuffer or its unsupported configuration may produce this error.

## Changes
- Check `gl.checkFramebufferStatus(gl.FRAMEBUFFER)` on the currently bound opaque XRWebGLLayer **inside the active XR session's animation-frame callback**. Do not attempt to inspect or replace the browser-controlled depth/color attachments.
- Record framebuffer status, size, stereo eye count and the stage of an error separately.
- Present a small, color-only clear before the large game scene in each eye; distinguish `eye1 clear` from `eye1 scene` failures.
- If the framebuffer is incomplete or VR clear/render returns WebGL error, recreate XRWebGLLayer, first with `antialias:false` + `depth:true` at 0.75 size. If that fails, use `antialias:false` + `depth:false` at 0.65 size as an **emergency visibility diagnostic**.
- Layer changes are requested through `XRSession.updateRenderState({baseLayer})`, and the renderer waits for the new layer to become active.
- Prevent infinite fallback attempts, preserve the diagnostic text after exiting XR, keep MR/RTS and game saves unchanged.

## Test on the headset
1. Reload Planet Explorer after the GitHub Pages deployment, then enter VR.
2. Look for the blue frame, a small green calibration globe and/or landscape.
3. After ~90 and ~300 frames, exit and copy the newest `VR診断` lines, especially `FB=...`, `layer=0/1/2`, and `eye1/eye2 clear/scene`.
4. If layer 2 is needed, the image may not have correct 3D occlusion because the last fallback has no depth buffer. That is diagnostic, not a final quality setting.
5. If VR still appears black even with `FB=complete`, rendering might be blocked by the session compositor, browser GPU or scene projection. The new log separates most of these cases.

## Technical references
- https://developer.mozilla.org/en-US/docs/Web/API/XRWebGLLayer/framebuffer
- https://immersive-web.github.io/webxr/explainer.html

## Compatibility
- No snapshot/save/schema modifications.
- No rendering changes to regular desktop, iOS, TPV, RTS, or MR model placement/controls.
- XR framebuffer resource changes apply to immersive VR only and are session-local.
- Real headset verification is still required.
