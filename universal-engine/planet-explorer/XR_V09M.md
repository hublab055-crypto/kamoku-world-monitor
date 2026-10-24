# Universal Engine WebXR v0.9m — controller fixes / VR diagnosis

## MR planetary model

1. Open **🥽 XR → MR・惑星模型**.
2. Rotate by the right controller's horizontal thumbstick or **↶ / ↷** controls in supported AR DOM overlays.
3. Point the controller ray at the planet surface and press the trigger: the exact latitude and longitude are previewed using the native game's existing safety checks.
4. Confirm by pressing the trigger **again at the same nearby point within 1.3 seconds**, by controller squeeze, or **↓ 選択地点へ降下** on an available DOM overlay.
5. Only a valid, separately confirmed selection can start descent. After successful landing, the MR session ends and the regular camera resumes.
6. **📍 模型を再配置** activates a one-shot placement mode; normal RTS/planet trigger presses no longer accidentally move the tabletop.

## MR tabletop RTS

1. Open **MR・卓上RTS**. Trigger near an actor to select it; actor picking allows a physical 35mm target at the chosen miniature scale.
2. Trigger an unoccupied ground point to move the selected unit(s). A controller squeeze at a ground point is an alternative.
3. **👥 味方全員を選択** adds whole-squad selection.
4. The game still validates terrain passability, and these operations use the existing SquadSystem rather than simulated mouse taps.
5. Changing tabletop placement requires explicitly pressing the **模型を再配置** action.

## VR black display investigation

- The immersive XR render loop now restores color/depth masks, depth test, and blending state on every frame before rendering each eye.
- If the headset has **no tracked viewer pose**, a neutral blue frame is presented instead of silently showing black. After about 90 frames without pose a diagnostic message is recorded.
- The first 240 rendered VR frames include a green calibration globe about 1.25m in front of the startup viewpoint. It is a diagnostic only, and disappears automatically.
- The **VR診断** status line records tracking pose, number of rendered eyes, frame count and WebGL errors at checkpoints.
- **Important:** headset VR rendering has not been validated on actual hardware. If still black, report whether the green calibration globe or blue frame appeared and provide the VR診断 line after exiting XR.

## Compatibility / limits

No changes to save data. WebXR depends on the headset/browser and a secure origin. DOM overlay is optional: core planet selection, rotation by gamepad and trigger confirmation work without DOM overlay. MR occlusion remains optional, from v0.9j. Old desktop TPV, orbit and RTS gestures remain unchanged.
