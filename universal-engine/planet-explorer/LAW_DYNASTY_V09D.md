# Universal Engine v0.9e — Territorial Law, 3D Guards & Dynasty (prototype)

## Purpose
Modular territorial-law and multi-generation simulation, loosely inspired by escalating police pursuit in GTA-style games and the surrender/fines/bounty role-play loop in Skyrim-style games. All code, dialogue and data here are original; there are no borrowed art/assets or trademarks in the playable UI.

## Player entry
Open Planet Explorer and select **🚨 治安・手配** in the viewport toolbar. Peaceful patrols and guard outposts are now drawn in the 3D world. Tap a nearby guard for their interaction panel. Wanted stars appear at the top-right during an active warrant.

### Implemented in this phase
- Wanted level 0–5 per settlement/faction, increasing on witnessed crimes. Unwitnessed incidents do not immediately create a bounty.
- Distinct pursuit flag. Crossing to another jurisdiction terminates that region's live pursuit but preserves its wanted points.
- A finite post roster with guards deployed from a known post location, limited daily replenishment, and knight-class reinforcements at high levels.
- Local-space pursuit toward the controlled character with a surrender challenge at low wanted levels.
- **投降する / 投降しない / 逃走**, guard attacks against player stamina and HP after refusal, custody at zero stamina, fines paid in the existing town coin currency.
- **v0.9e implemented:** guard tap-to-interact, real melee impact checks at the existing weapon animation strike frame, swept spear/greatsword contacts, physical arrows via the existing projectile collision engine, HP-depletion guard defeat and finite replenishment. Instant-kill panel action has been replaced by **⚔ 武器で戦う**. High-level criminals face aggressive guards without surrender prompts.
- Owner-state capture of a post once its defending roster is empty and living squad companions have been assigned. No random post respawning.
- Persistent warrant records for test NPCs with a one-time bounty payout API, but not yet connected to NPC capture combat.
- Registered companion succession, historical death/birthless-generation chronology, irreversible old-character death within the save, and game over when no successor remains.
- Lives in separate `law-system.mjs` (pure data/logic) + `law-ui.mjs` (UI); existing save slots/quick save include optional `v0_9d`. Legacy saves remain readable. Browser quick-resume journal uses a new namespace.
- Node regression tests for escalation, garrisons, jurisdiction crossing, surrender, custody, occupation, bounties, succession, and snapshot recovery.

### Limitations (not misrepresented as finished)
- **v0.9e implemented:** original, low-poly guards/knights with four procedural marching phases, spear/shield armor variants and physical posts, drawn in the existing shared WebGL2 renderer. Finite peaceful guard patrols follow reproducible loops; guards use a 55 m detection radius, can lose sight, approach, warn, and switch to armed attacks. They reject terrain steps through the existing passability callback but do **not yet have a full obstacle-avoiding route planner (A*)**.
- Crimes in the panel are explicitly test-triggered; **weapon damage to real guards now reports assault / death automatically**, but generic world theft, resident witness reports, handcuff animations, railway-security integration, bounty capture, legal hearings and procedural character genealogy still need gameplay adapters.
- Post conquest still needs physically walkable post/castle models and a full siege/defense loop. The sample current/reserve model is finite; companions are committed by ID, not yet controlled as a dedicated garrison squad.
- Succession transfers selected companion identity/vitals to the playable slot and preserves current world/estate data. Detailed genealogy, marriage/children, testament, political legitimacy, cross-faction inheritance, NPC relationship inheritance and explicit property-title transfer need separate systems.
- There is currently no server-authoritative multiplayer law or cross-player arrest permission system.

### Technical behavior
`law.advance(dt, {day,settlementId,x,z,stamina,hp,eligible})` returns actions/events; the host applies HP/stamina, logs, renders UI, controls pause/custody and writes saves. No changes to `core.mjs`, Frontier World, or Kamoku Monitor.

### 3D performance and compatibility
The guard meshes, four walking poses per kind and outpost banners are constructed once per renderer and reused every frame. No instantiation or mesh allocation during guard movement. The independent save field remains `v0_9d`; old saved games load with default patrols. Both app and render module query versions were advanced to avoid stale iPhone Safari cache.

**CI baseline on main (Oct 23):** 491 tests, 14 pre-existing failures. The v0.9e feature branch adds law/visual/weapon tests with all new tests passing; the same 14 historical failures remain. Do not interpret a red overall CI status as proof that the guard additions regressed those tests, but do not claim the entire suite passed.

### Regression checks
From `universal-engine/` run `node --test tests/law-system-v09d.test.mjs` (Node 20+), or `npm test` for the full suite.
