# Universal Engine — Quest 3S 6DoF VR body and physical gear (v0.9s)

Meta Quest 3S movement support and VR stereo rendering (v0.9r) are preserved.
This adds a **first-person procedural body** in physical XR reference meters,
independent from the existing avatar's desktop third-person animation.

## Controls and state
- **Look down** to see torso, waist, shoulders, upper/forearms, tracked hands,
  two legs and boots. No obstructing head mesh is placed at the viewer camera.
- **Left shoulder + left grip**: take bow in left hand, equipping the *actual*
  Frontier World bow via the shared inventory API.
- **Right shoulder + right grip**: take one arrow from quiver. This requires
  an equipped left-hand bow and at least one arrow in the standard inventory.
  The user must bring the right hand close to the left bow hand to **nock**.
- **Right trigger press** while nocked: begin drawing bow.
  The displayed bowstring follows the right hand, draw power updates from
  tracked controller separation and a **+ crosshair** appears along the left
  controller's pointing direction.
- **Right trigger release** when draw power >=18%: invoke the existing
  `shoot` command, which validates arrow type, ammo, stamina, target and
  normal animation/projectile rules. An under-drawn arrow is not fired.
- **Right hand at left hip + right grip**: unsheathe an owned sword. The model
  attaches to the right controller; velocity >1.55 m/s over at least 11 cm
  triggers the usual melee sweep with a 650 ms cooldown.
- Repeat **right grip at left hip** to put the sword away.
- Outside physical equipment zones, old grip actions remain usable (right
  guard, left shoot) for accessibility. No squeeze action is duplicated after
  a shoulder/hip grab.
- Both the headset's tracked eyes and hand poses are sampled from the same
  WebXR frame; the body is rendered separately into each XR eye and is not
  serialized.
- **A** toggles VR tabletop RTS, **B** first-/third-person, left stick
  locomotion, right stick turning; MR tabletop and MR globe stay separate.

## Limitations and hardware verification
- Real device movement and grabbing require retesting with Meta Quest 3S.
  Physical shoulder/hip reach targets are approximate and calibrated to
  headset posture, not a full skeletal inverse-kinematics solution.
- Sword motion **initiates the game's existing swept melee action**; the
  entire virtual steel blade is not yet resolved as a separate per-frame
  hand-tracked rigid-body collision shape.
- Bow trigger release **starts the game's established archery animation**;
  the actual projectile emission is still scheduled by that animation.
- The plus sight follows left controller pointing, while ballistics use the
  existing player's yaw-based world action.
- No force feedback, finger tracking or real-world obstacle checking.
  Remain within the headset's safety boundary.
- If Quest user height or sitting posture is unusual, shoulder/hip distances
  may require sensitivity adjustment.

## Test checkpoints
1. VR start, look downward: body, sleeves, forearms, boots visible; background
   should still show the game world.
2. Reach left shoulder with left grip: left-hand bow appears.
3. Reach right shoulder with right grip: arrow appears in right hand.
4. Bring controllers together: nock confirmation. Pull right trigger, draw
   right hand back, see '+' marker; release once -> a single arrow action.
5. Right grip at left waist -> sword appears. Swing arm through air -> sword
   model follows hand and gameplay attack starts; second gesture within
   cooldown does not double attack.
6. Press A -> VR tabletop RTS; press A to return; MR and normal 2D still work.
7. Exit VR: no tracked pose/body state is saved.
