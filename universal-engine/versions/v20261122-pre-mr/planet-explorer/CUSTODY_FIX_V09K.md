# Universal Engine v0.9k — Arrest presentation and horse custody fixes

## Reproduced behavior
- Territory law's `detain()` deleted every deployed guard, returning them to the outpost. That removed the actual arresting guard from the 3D world.
- Railway law cleared the active arresting guard as soon as custody began, and the renderer switched into the jail camera before the player could see any capture motion.
- A rider could enter railway or town custody without dismounting; the avatar continued to use the +1.15-metre saddle render offset. Upon release the rider was teleported but the horse was still considered mounted at the previous world location, creating a floating avatar and seemingly invisible horse.

## Changes
1. **Stun animation (visual only, 3.35 seconds).** The avatar tips from standing into a prone posture in the direction they're facing. Three golden five-point stars rotate around the head for the duration of the knockout sequence. The animation's timer keeps advancing while the game clock is paused. Only after the visual sequence does railway custody switch to the jail interior camera or town custody show the bail/sentence panel. The same animation works through the existing GLB and procedural avatar rendering paths; no external images, models or font files.
2. **Persistent arresting guards.** Town arrest no longer clears `deployed` or refunds guards into `current`; it simply ends hostile pursuit and returns living guards to patrol state, preserving their individual IDs, health, location and finite force budget. Railway arrest retains the officer throughout the world animation; the jail interior already includes a visible guard.
3. **Automatic dismount and horse recovery.** Both legal systems call one shared custody handler. When arrested on a horse, it clears `mountId`, stores the original horse's ID in the existing backwards-compatible v1 fauna snapshot, parks the horse, cancels jump and saddle offset, and pauses controls. On either bail or a completed prison sentence it restores the player to ground height, moves the *same* horse to a safe point approximately three metres from the release gate and leaves it dismounted. Tack, taming status, stamina and other horse properties remain unchanged. The horse is not deleted or replaced. If the nearby ground is unsafe the horse remains impounded and can be returned on the next safe opportunity.
4. **Legacy saves.** A saved jailed rider is migrated into the same safe impounded-horse state. The new optional `custodyMountId` property does not change the fauna schema version, old save slots and all unrelated world state.
5. **Cache busting.** Incremented the app, renderer and fauna module query strings so Safari cannot keep the old capture/horse logic.

## Tests
`node --test tests/custody-animation-mount-v09i.test.mjs` checks the visible guard roster, law and railway custody transitions, three 3D stars, actor prone pose timing, preservation of gear/stamina and the same horse's identity across save/load and safe release, unsafe-return deferral, and the two browser rendering paths.

The full legacy suite has **14 known failures in baseline tests unrelated to the new feature**. Verify current Actions failures against main; do not call red full-suite CI passing.

## Remaining visual limitations
The avatar's fall is a procedural whole-body rotation rather than a motion-captured ragdoll; the stars are small hand-built meshes. Physical guard handcuff/grapple motions and transfer to a common town jail interior remain later development work.
