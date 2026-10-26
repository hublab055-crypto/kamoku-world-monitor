# VR Wearable Equipment — Quest 3S prototype (2026-10-26)

## Purpose
Physical interactions are part of the gameplay: garments provide pockets and bags, and existing weapon and ammunition systems remain authoritative. This is an additive WebXR feature branch, preserving the original TPV/RTS/MR pathways.

## Implemented
- XR body sockets follow the headset's estimated torso yaw/height; coat presets place the note at a chest pocket and other outfits use the trouser pocket.
- Right or left controller grip at the visible pocket: pull the field notebook out; grip at its original pocket to return it.
- Grip at chest strap when wearing a bag: open; a following grip deposits the held notebook; another grip retrieves it, or closes the empty bag.
- Garment bag types: satchel **9 L / 8 kg**, toolbag **14 L / 15 kg**, no bag disables access while preserving the contents.
- A tracked 3D notebook, fabric pocket flap, bag flap, sword/sheath and bow/quiver display are rendered for the Quest stereo pass; clothing colors reflect the wardrobe.
- Arrow shafts displayed in the quiver come from **Frontier World real ammunition counts**. There is no duplicate synthetic arrow/weapon inventory in the live VR equipment core.
- Saves the new notebook/bag state in `localStorage` under `universal-engine:explorer:vr-wearables:v1`; auto-loads it at startup. It is currently **device-local and not part of the named game save slots**.
- The original sword, bow, quiver authorization, trigger/attack and game inventory logic remains in place.

## Test steps on a real Quest 3S
1. Open the **feature branch preview** in an HTTPS WebXR-capable browser (the production main branch is not changed by this PR).
2. Start VR, choose the traveler or merchant outfit, reach to the right chest pocket and grip; confirm the notebook appears attached to the controller.
3. Grip the chest strap once to open the satchel, then again to place the notebook inside. Grip again to retrieve it.
4. Grip the same pocket to stow. Switch to pioneer and verify the pocket moves down to the right trouser pocket.
5. Equip the hunter bow and retrieve an arrow from the right shoulder; verify that the quiver display reflects owned ammunition and shooting reduces it.
6. Remove the bag in wardrobe, exit/re-enter VR, and confirm bag contents are inaccessible until a bag is re-equipped.

## Important limitations
- The field notebook is a proof-of-concept wearable item, not yet a readable book or the canonical RPG item catalog.
- Physical grip detection is based on inferred torso position from headset pose (Quest 3S does not track waist or pockets directly).
- The game’s legacy resource-pickup backpack weight limit is not yet reconciled with these per-bag litre limits; the wearable bag's volume constraints currently govern wearable items only.
- A controller haptic hint, full hand pose animation, user-editable gear attachment points, and named-save-slot integration are future tasks.
- No Quest hardware test or automated GitHub Actions workflow has run; JavaScript syntax and inventory logic were checked without a headset.

## Developer validation
- `node universal-engine/planet-explorer/tests/wearable-inventory.test.mjs`
- `wearable-inventory.mjs` exports `WearableInventory`, `starterWearables` and `pocketSocketForOutfit`.
- Preserve the original weapon inventory as the single source of truth. The wearable factory defaults to synthetic equipment **only for isolated tests**; XR instantiates it with `{combatDemo:false}`.
