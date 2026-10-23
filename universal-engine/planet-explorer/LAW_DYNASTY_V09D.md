# Universal Engine v0.9d — Territorial Law & Dynasty (prototype)

## Purpose
Modular territorial-law and multi-generation simulation, loosely inspired by escalating police pursuit in GTA-style games and the surrender/fines/bounty role-play loop in Skyrim-style games. All code, dialogue and data here are original; there are no borrowed art/assets or trademarks in the playable UI.

## Player entry
Open Planet Explorer and select **🚨 治安・手配** in the viewport toolbar.

### Implemented in this phase
- Wanted level 0–5 per settlement/faction, increasing on witnessed crimes. Unwitnessed incidents do not immediately create a bounty.
- Distinct pursuit flag. Crossing to another jurisdiction terminates that region's live pursuit but preserves its wanted points.
- A finite post roster with guards deployed from a known post location, limited daily replenishment, and knight-class reinforcements at high levels.
- Local-space pursuit toward the controlled character with a surrender challenge at low wanted levels.
- **投降する / 投降しない / 逃走**, guard attacks against player stamina and HP after refusal, custody at zero stamina, fines paid in the existing town coin currency.
- Prototype combat interaction for guard attack/defeat through the law panel. These actions have explicit test labels when defeat is instantaneous; they are not yet integrated with 3D attack hitboxes.
- Owner-state capture of a post once its defending roster is empty and living squad companions have been assigned. No random post respawning.
- Persistent warrant records for test NPCs with a one-time bounty payout API, but not yet connected to NPC capture combat.
- Registered companion succession, historical death/birthless-generation chronology, irreversible old-character death within the save, and game over when no successor remains.
- Lives in separate `law-system.mjs` (pure data/logic) + `law-ui.mjs` (UI); existing save slots/quick save include optional `v0_9d`. Legacy saves remain readable. Browser quick-resume journal uses a new namespace.
- Node regression tests for escalation, garrisons, jurisdiction crossing, surrender, custody, occupation, bounties, succession, and snapshot recovery.

### Limitations (not misrepresented as finished)
- Guards are simulated in local x/z coordinates and shown as numbers/dialogue, **not yet rendered as animated 3D characters**, nor do they navigate around obstacles.
- Crimes in the panel are explicitly test-triggered; generic world theft, resident witness reports, sword collision with actual guards, NPC handcuff animations, arrests from the railway-security subsystem, bounty capture, and legal hearings require gameplay adapters.
- Post conquest still needs physically walkable post/castle models and a full siege/defense loop. The sample current/reserve model is finite; companions are committed by ID, not yet controlled as a dedicated garrison squad.
- Succession transfers selected companion identity/vitals to the playable slot and preserves current world/estate data. Detailed genealogy, marriage/children, testament, political legitimacy, cross-faction inheritance, NPC relationship inheritance and explicit property-title transfer need separate systems.
- There is currently no server-authoritative multiplayer law or cross-player arrest permission system.

### Technical behavior
`law.advance(dt, {day,settlementId,x,z,stamina,hp,eligible})` returns actions/events; the host applies HP/stamina, logs, renders UI, controls pause/custody and writes saves. No changes to `core.mjs`, Frontier World, or Kamoku Monitor.

### Regression checks
From `universal-engine/` run `node --test tests/law-system-v09d.test.mjs` (Node 20+), or `npm test` for the full suite.
