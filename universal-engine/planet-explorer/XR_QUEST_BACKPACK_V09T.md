# Quest 3S VR — carrying, physical tools and backpack (v0.9t)

## What is implemented
- **Moving:** Left Touch stick continues to walk forward/back and strafe. Character walking (also desktop's normal walking) now uses the already-existing `FrontierBridge.loadKg("player")` inventory cargo mass; under 12 kg = full 5 m/s, 18 kg ≈88%, 30 kg≈64%, 42+ kg min 40%.
- **Backpack:** The existing wardrobe "bag" selection is the source of truth. A visible brown backpack with shoulder straps appears when bag is enabled. In VR, use the outfit setting to choose satchel/toolbag; without a bag the user cannot stow ground pickups.
- **Gear:** Existing left-shoulder bow, right-shoulder quiver and left-waist sword/sheath are retained. New physical equipment positions: right belt/right grip = axe; right shoulder/right grip (when no bow arrow is being drawn) = pickaxe; left belt/left grip = hammer; left rear strap/left grip = fishing rod. Each uses the standard equipment inventory API, and their procedural meshes follow Quest controller tracking.
- **Actions:** Controller trigger uses the equipped hand and invokes existing melee/building/mining/fishing/archery commands. A hammer is introduced to shared equipment, mapped to the existing `build` action. Tool models and holsters are visual; detailed continuous physics for each tool head is not yet a rigid-body collision system.
- **Pick up:** Hold a Touch hand within ~0.43m of a world Frontier resource pickup or an embedded recoverable arrow; press grip. The object is visibly carried in that hand (not added to inventory yet).
- **Stow:** Bring the holding hand near the backpack's front strap at chest height or behind the right shoulder. It is stowed automatically, updating the real Frontier resource node's quantity (or recovering the actual arrow). Duplicate/outdated object detection and 55kg resource load capacity are enforced.
- **Persistence:** Inventory uses the existing life journal and saved game snapshot; permanent resource node depletion is included in normal save slots. Unstowed objects are not consumed from the world.
- **Compatibility:** Regular VR bow draw / sword swing, MR and camera/RTS controls, and old saved-game schemas remain unchanged.

## Practical Quest 3S walkthrough
1. Put on a satchel or toolbag in the normal wardrobe customization and enter immersive VR on the surface.
2. Look down: torso, hands, legs, backpack and its straps are present.
3. Move the left stick in any direction. Look at the avatar load meter; walking slows as weight rises.
4. Reach the right belt with right grip to pull out an axe, or the right shoulder to pull out a pickaxe. Left belt is hammer, left rear strap is fishing rod. Press the corresponding hand's trigger to use it; reach the same zone again to holster.
5. For loose pickups, physically approach the visible resource pile (wood/stone/fiber/food/water) or recoverable arrow; bend and press grip near it.
6. Bring the occupied hand to your chest strap to store the item. The real inventory and load meter update.
7. Save your game in an existing slot to retain depleted world nodes, then reload to verify.

## Current limitations
- Actual Quest 3S hardware testing is still needed. Hand-position tolerance may require calibration for standing/sitting users; WebXR grip poses are controllers, not finger tracking.
- Currently pickup applies to *existing Frontier resource nodes and recoverable arrows*, not arbitrary mesh objects, indoor furniture, animals or every dropped loot type.
- This is a staged grab-and-stow interaction rather than full dynamic rigid-body simulation or physics of a held stone.
- In-game source nodes continue to be spawned through the existing Frontier resource generation logic. It does not spawn items free of that existing system.
- Heavy loads reduce movement speed but do not yet consume stamina at different rates.
