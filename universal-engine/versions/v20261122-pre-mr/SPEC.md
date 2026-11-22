# Universal Engine v0.1 — Core specification

Date: 2026-10-15 | Stage: independent multiverse prototype | Scope: \`universal-engine/\` only.

## Design principles

1. **Multiverse as the top-level object:** every simulated world has its own identity and independent state. A world is not the entire universe engine.
2. **No implicit bridge:** simulated worlds are isolated by default. Any future inter-world travel or sharing must use an explicit, audited adapter.
3. **Reality is not gameplay state:** Kamoku Monitor is an external projection of actual observations, **not** a simulated world to mutate. Its repository files and data pipelines must stay intact and unchanged. An optional future integration would be read-only and require separate design and authorization.
4. **Compatible evolution:** Frontier World is an existing standalone game. Do not migrate its save format or modify its code as part of this initial core milestone.
5. **Platform neutrality:** no direct DOM or network dependency in \`core.mjs\`; the UI/demo is a separate browser adapter.

## Components

| Component | Responsibilities | Important API |
| --- | --- | --- |
| \`Multiverse\` | world registry; per-frame dispatch; persistence | \`createWorld\`, \`getWorld\`, \`listWorlds\`, \`removeWorld\`, \`advance\`, \`snapshot\`, \`fromSnapshot\` |
| \`SimulationWorld\` | entity registry; systems; local events; local clock | \`addEntity\`, \`getEntity\`, \`listEntities\`, \`setComponent\`, \`removeEntity\`, \`addSystem\`, \`step\`, \`advance\`, \`snapshot\` |
| \`SimulationClock\` | independent fixed-tick timing and speed | \`advance\`, \`step\`, \`pause\`, \`resume\`, \`setTimeScale\`, \`snapshot\` |
| \`EventBus\` | synchronous typed notifications per world | \`on\`, \`emit\`, \`clear\` |

## Data contracts

- IDs: ASCII letters/digits first, then ASCII letters/digits/underscore/hyphen/colon/period; 1–80 characters. Duplicates within the same namespace fail.
- Entity: \`{ id, kind, components }\`; \`components\` must be a plain JSON object, with arbitrary JSON-safe nested values and no cyclic references.
- Systems: registered functions \`(world, deltaSeconds) => void\`; lower \`priority\` executes earlier, equal priority preserves registration order.
- Clock: \`tickSeconds > 0\`; \`timeScale >= 0\`; \`paused\` affects real-time \`advance\`, not explicit \`step\`. \`maxTicksPerAdvance\` is 200 by default; unprocessed accumulated time remains queued.
- Events: \`entity:created\`, \`entity:updated\`, \`entity:removed\`, \`world:tick\`. Local buses do not forward to other worlds. Listener exceptions propagate to the caller (fail-fast).
- Data mutation: get/list returns JSON-cloned values. Modify via \`setComponent\`, which emits updates. No mutable component references are exposed.
- Snapshot root: \`{format:"universal-engine/multiverse",schemaVersion:1,engineVersion:"0.1.0",worlds:[...]}\`.
- World snapshot: \`{format:"universal-engine/world",schemaVersion:1,id,name,clock,entities}\`.
- A loaded world has no registered systems or listeners; application installs them after \`fromSnapshot\`.

## Demo acceptance criteria

- Two fictional worlds created with separate clocks; speeds ×2 and ×4.
- Automatic advance, global pause, per-world pause, chosen-world +1, all-worlds +10.
- Distinct per-world simulation rules and independent counters/actors/resources.
- Save and reload from dedicated browser key, preserving clocks and entity state.
- No references to the existing game save keys or monitor data APIs.
- Browser demo uses canvas drawing as a replaceable rendering layer; engine can run headless.
- Tests cover API behavior, isolation, timing, defensive cloning, snapshot roundtrips, malformed inputs.

## Limitations / next milestones

- No server synchronization, multiplayer rooms, network calls, portal transfers, shared market, account permissions, spatial/physics solver, entity archetypes, or AI planners.
- A callback throwing during a tick interrupts stepping; automatic transactional rollback is not implemented.
- JSON snapshot version is fixed at 1; migrations and cross-version determinism have not yet been implemented.
- The demo is an illustrative toy simulation, not a playable Frontier World conversion.
- Node test suite verifies engine behavior, but real browser/iPhone Safari visual and touch E2E still require manual validation.
