# VR wrist command console and live avatar tablet

Quest 3/3S left Touch controller anchors a 3D wrist console. Right controller trigger points at TAB (tablet toggle), SHIP (existing navigator-controlled real flight and safe recall), AVTR (live avatar editing), and REC (explicit local motion capture).

The 3D tablet retains VIDEO, WEB, CHAT, SET, RTS, WALL, HAND, OFF; adds SHIP, AVTR and REC. Avatar page adjusts player eye, brow, mouth, torso width and leg length by 3% per press; SAVE persists the V10 roster. Motion page records, stops, plays, and clears locally. The 2D tablet also exposes fine sliders and a full-avatar-editor shortcut.

Recording uses tracked head and two Touch controllers only (not feet), max 25 seconds, memory-only. No automatic upload or cross-origin frame sampling. Restricted wardrobe behavior and existing crew avatars are unaffected. XR ship recall is allowed for grounded VR only; existing landing safety, shipboard, MR, custody, and interplanetary constraints stay active.

Run:
`node --test universal-engine/planet-explorer/{xr-wrist-device,avatar-live-control,world-tablet-spatial}.test.mjs`

Quest hardware QA remains necessary: inspect wrist visibility and right-ray hitboxes, tune button reach, confirm tablet page labels in stereo, save/reload avatar, play back recorded gesture, recall ship on open terrain, check cockpit controls are not accidentally pressed.

## Two-hand NPC joint motion editor (2026-11-20)

1. Open the wrist tablet in Quest VR, select MOTION, then **POSE**. An independent V10 preview of the navigator appears approximately one metre in front of the headset, facing the player. The mesh is skinned with the regular avatar-v10 asset; if the model is still loading, interactive joint markers remain visible.
2. Touch a blue marker on the preview with either Quest Touch controller and hold that controller's physical **grip/squeeze**. The nearest eligible marker becomes orange while held. Use the **left and right grips simultaneously** to manipulate separate joints. Releasing a grip keeps the edited pose; gripping a joint already held by the other hand is rejected.
3. Selectable markers: head, both elbows, both wrists/hands, both knees and both ankles/feet. V10's existing skeletal arm IK and new leg IK convert the dragged world-space targets into bone rotations, respecting actual upper/lower limb lengths. Coordinates are a local preview in metres; touch-controller tracking is measured, pelvis and full-body kinematics are inferred.
4. **NPC** switches between navigator, engineer and companion, discarding the prior unsaved editing session (only if not currently recording). **REC** samples up to 25 seconds / 500 frames at roughly 20 Hz; **KEY** captures an explicit pose; **STOP** completes the clip; **PLAY** previews it on the selected NPC avatar; **RESET** restores the neutral pose; **SAVE** exports local JSON. The 2D world tablet's Motion tab provides copy and download controls after leaving VR.
5. This is an *isolated local authoring preview*, not direct manipulation of living NPCs in the shared game world. No gameplay NPC transform or game save schema is mutated. The exported clip can be used for future authored emotes or animation workflows after an explicit apply feature is built.
6. Safety: while POSE editing is active, grip-based inventory, climbing, crew handshake/hug, HOTAS, firing, button bindings and joystick locomotion are suppressed. Seated pilots, custodial modes and RTS cannot enter the editor. Controller tracking loss freezes joint positions. Exiting the VR session releases both grips.
7. New tests: `xr-avatar-pose-editor.test.mjs` checks grip independence, target switching, time-sampled recording, tracking loss and playback. `avatar-v10-joint-editor.test.mjs` checks arm/leg IK on a deterministic synthetic rig. All four related suites run under `npm test`.

Quest 3S headset acceptance still requires manual review of controller reach, V10 rig alignment, stereo redraw, role switching and download prompts. A browser may block downloads while immersed, so users can export JSON from the ordinary tablet after leaving VR.
