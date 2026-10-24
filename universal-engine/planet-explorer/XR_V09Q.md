# Quest 3S WebXR VR startup fix — v0.9q

## Reproduced failure report
`Failed to execute 'updateRenderState' on 'XRSession': Can't use baseLayer with layers feature requested`.
The UI showed `VR診断：未開始`, because the exception occurred during session setup, before the first headset frame.

## Why
An XRSession that has enabled the optional WebXR `layers` feature on Quest Browser rejects `updateRenderState({baseLayer})`. This startup error was introduced when the previous release requested `layers` but still unconditionally initialized an old `XRWebGLLayer` through the `baseLayer` property.

## Changes
- When immersive VR supports `XRWebGLBinding`, immediately attempt `XRProjectionLayer` setup through `updateRenderState({layers:[projectionLayer]})`.
- When `XRWebGLLayer` is needed, install it with one of **mutually exclusive** render states: `{layers:[legacyLayer]}` if layers were granted (or are preferred), otherwise `{baseLayer:legacyLayer}`. A rejection tries the other path, never both at once.
- During animation, detect the active legacy layer from `session.renderState.baseLayer` **or** `session.renderState.layers`, since Quest sets `baseLayer=null` when using Layers API.
- Use the same feature-aware path for retrying legacy configurations.
- Only request the optional `layers` feature if `XRWebGLBinding` is supported for VR; MR stays on its prior successful `baseLayer` setup.
- Keep WebXR diagnostic progress, headset log, gameplay and saves unchanged.

## Retest on Meta Quest 3S
1. After GitHub Pages deploys the main branch, reload the page so the `v09q` cache key takes effect.
2. Start VR. A `baseLayer with layers feature` initialization error should no longer occur.
3. Look for the blue calibration background / green globe or terrain.
4. If it remains black, return the **first** `VR診断` report containing `XRProjectionLayer` or `VR 3D描画エラー` and the visible screen result.

This is a source-level correction; headset imagery is **not yet proven working**.

Reference: https://developer.mozilla.org/en-US/docs/Web/API/XRSession/updateRenderState
