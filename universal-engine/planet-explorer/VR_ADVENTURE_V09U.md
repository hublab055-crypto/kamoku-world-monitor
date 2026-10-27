# v0.9u — VR outdoor adventure and portable cross-device saves (experimental)

## What to try

- On Quest 3S open Universal Engine in Quest Browser and use **🥽 VRで地表を冒険**. If currently in orbit, this chooses the *already-selected settlement* (or pioneer if none) and enters its surface without deleting previous saves. During custody the button explains that release is required; it cannot bypass the law system. Standard **VR・現在の視点** remains unchanged.
- While VR is immersive: **left stick** walks and strafes, **right stick** turns; Quest grip and trigger physical weapon/tool interactions use the pre-existing wearable inventory, bow, quiver, sword, axe, pickaxe, hammer, fishing rod and backpack systems. **A** switches VR tabletop RTS, **B** toggles first/third-person, **X** jumps, **Y** switches action deck. **Left stick click** now toggles VR planet overview while outside RTS. In the VR planet mode, the **right trigger** selects a point and a second press at the same point requests landing; this keeps the immersive VR session active. When RTS is active, the left stick click still toggles sync as before.
- For phone / PC / Quest continuity: open **💾 セーブスロット → 📱 PC・スマホ・Questへセーブを引継ぐ**, export the JSON from the source device, transfer the file using a trusted file-sharing method, and import it on the destination device. The imported game becomes the current state and quick save after confirmation; existing five named slots are not overwritten. Keep backups. Current planet, avatar position, inventory, construction, ownership and journals embedded in captureGame(), and the VR wearable inventory are included.
- On the exploration panel watch **徒歩累計**, **周回数**, and the spherical distance to the next city. Walking increments the independent VoyageLog only when the outdoor player actually moves on foot. Teleporting and vehicles do not credit walking distance, and the existing geodesic dateline logic avoids false longitude jumps.

## Limitations and next engineering steps

1. **True planet-wide walkable continuity is NOT completed.** Current render, squad, buildings, railway locations and towns still depend on a local origin; the engine does not yet rebase every coordinate safely during a many-kilometre walk. Distant cities are currently far apart, oceans/steep terrain can block an all-on-foot path, and the nearest-city status is a distance indicator, not a navigable foot path. Next implement atomic origin rebasing for all dependent local systems, persistent terrain streaming and LOD, bridges/ferries/paths, and automated city-entry lifecycle without teleporting. Test dateline, poles, save/restore and multiplayer authority separately.
2. **Automatic online cross-save is NOT completed.** JSON export/import is an opt-in offline cross-device handoff, not cloud sync. For automatic synchronization, add authenticated per-user cloud storage and server-side authorization/RLS, versioning, conflict control and offline reconciliation. Never store a service-role key in a web client or publish game saves.
3. **WebXR immersion switching:** VR ground / VR tabletop RTS / VR planet operate within one `immersive-vr` session. Browser WebXR currently exposes VR (`immersive-vr`) and passthrough MR (`immersive-ar`) as different session types; switching between them still requires ending one session and requesting the other with a fresh user gesture. The avatar's game state survives. A no-blackout VR↔MR switch cannot be promised on Quest Browser without platform support.
4. **Hardware validation still needed:** Quest 3S controller grip/trigger poses and inputSources, VR render quality, walking while carrying a bag, mobile Safari import/export, Quest Browser file upload permissions, and long walking stability remain unverified. Use a copy of a save and test on the feature branch first.

## Minimal test matrix

1. Quest: enter surface VR; four stick directions are correct, HUD movement is nonzero; backpack and bow/tools can be drawn and used.
2. Quest: press A to tabletop RTS, then A back, then L3 for planet, select and land with right trigger twice, then B to third person and back.
3. Phone/PC: save at a recognizable location with items; export JSON; on another device import after confirmation, verify same location, equipped items, building/ownership state. After Quest imports, test grip interactions.
4. Cross the ±180° longitude seam in a simulation test; save and load the foot-journal data.
5. Regression: arrest still blocks outdoor teleport; historic save slots and MR overlay continue to work; PR CI Node tests pass.
