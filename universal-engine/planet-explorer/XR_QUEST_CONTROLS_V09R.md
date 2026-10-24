# Universal Engine — Meta Quest 3S VR Touch controls (v0.9r)

This update connects WebXR `xr-standard` controller inputs to the **existing** Explorer / Frontier interactions and tactical squad commands. No save data or MR control scheme is modified.

## In immersive VR (first-person)
| Meta Quest 3S control | Action |
| --- | --- |
| Left thumbstick | Walk forward/back and strafe |
| Right thumbstick | Rotate the character's world heading |
| Right trigger | Use right-hand equipped item: sword, bow, spear, axe, tool, etc. |
| Left trigger | Use left-hand equipped item: off-hand weapon / other equipped item |
| Right grip (squeeze) | Guard with a shield or supported two-handed weapon |
| Left grip (squeeze) | Bow command, including existing volley behavior when RTS+sync |
| A (right primary face button) | Switch immersive VR to/from tabletop tactical RTS |
| B (right secondary face button) | Toggle first-person / third-person VR viewing |
| X (left primary face button) | Jump, where available |
| Y (left secondary face button) | Cycle action/deck slots |
| Right stick press while in RTS | Select the whole squad |
| Left stick press while in RTS | Toggle squad synchronous action |

## In VR tabletop RTS
The world appears as a model in front of the user. Right trigger on an ally selects it; right trigger on the ground orders the currently selected units to move, using the existing squad pathfinding and movement rules. The right stick rotates the model. Left trigger uses left-hand equipment. Left grip executes the bow command. Left stick movement is disabled in tactical mode to prevent simultaneous unintended avatar walking.

The tabletop render deliberately **retains the immersive-vr WebXR compositor backend**. It reuses MR's miniature transformation, ray hit detection, and selection rings without requesting an immersive-ar session.

## Combat behavior
Aimed right-/left-trigger combat translates the controller pointing direction to the existing character yaw. Melee hits and arrows continue through existing game combat processing, including weapon, inventory, ammo and cooldown checks. Current v0.9r is *button-operated combat*; it **does not yet implement physical hand-tracked blade collisions, pulling a bowstring between two tracked hands, or visible in-world Touch controller models**. Those require separately coordinated avatar rig animations and tracked pose hitboxes.

## QA
Regression tests cover stick deadzones, standard button edges, VR vs. tactical mode, per-hand equip, existing attack/defense APIs, avatar visibility, VR ray hits, MR regression and cache invalidation.

Hardware behavior must still be verified on a Quest 3S: the automated tests are not a substitute for actual Touch controller testing.
