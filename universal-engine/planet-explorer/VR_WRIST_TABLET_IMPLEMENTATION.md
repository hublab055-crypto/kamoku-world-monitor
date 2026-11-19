# VR wrist command console and live avatar tablet

Quest 3/3S left Touch controller anchors a 3D wrist console. Right controller trigger points at TAB (tablet toggle), SHIP (existing navigator-controlled real flight and safe recall), AVTR (live avatar editing), and REC (explicit local motion capture).

The 3D tablet retains VIDEO, WEB, CHAT, SET, RTS, WALL, HAND, OFF; adds SHIP, AVTR and REC. Avatar page adjusts player eye, brow, mouth, torso width and leg length by 3% per press; SAVE persists the V10 roster. Motion page records, stops, plays, and clears locally. The 2D tablet also exposes fine sliders and a full-avatar-editor shortcut.

Recording uses tracked head and two Touch controllers only (not feet), max 25 seconds, memory-only. No automatic upload or cross-origin frame sampling. Restricted wardrobe behavior and existing crew avatars are unaffected. XR ship recall is allowed for grounded VR only; existing landing safety, shipboard, MR, custody, and interplanetary constraints stay active.

Run:
`node --test universal-engine/planet-explorer/{xr-wrist-device,avatar-live-control,world-tablet-spatial}.test.mjs`

Quest hardware QA remains necessary: inspect wrist visibility and right-ray hitboxes, tune button reach, confirm tablet page labels in stereo, save/reload avatar, play back recorded gesture, recall ship on open terrain, check cockpit controls are not accidentally pressed.
