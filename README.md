# Universal Engine — Independent Multiverse Core

**Status:** v0.1.0 core prototype (2026-10-15)

Universal Engine is a dependency-free, general-purpose simulation kernel for a **multiverse**: many isolated simulated worlds sharing the same engine APIs, while each has its own entities, clock, events, and systems.

It is **not** Kamoku Monitor. Kamoku Monitor is a projection of observed reality and is intentionally not imported, edited, linked, or migrated here. Frontier World is likewise left untouched: future integration is optional and must be incremental.

## Run

- **Browser demo:** open `/universal-engine/demo/` through GitHub Pages, or serve the repository locally using `python3 -m http.server 8000` and browse `http://localhost:8000/universal-engine/demo/`.
- **Automated tests:** from `universal-engine/` run `npm test` (Node.js 20+; no npm install required). Equivalent: `node --test tests/*.test.mjs`.
- No build step, server backend, or third-party runtime dependency.

## Directory

```text
universal-engine/
  core.mjs            # EventBus, SimulationClock, SimulationWorld, Multiverse
  demo/
    index.html        # static, mobile-friendly browser entry point
    style.css         # isolated demo styling
    app.mjs           # two toy worlds, controls, local demo saves
  tests/
    core.test.mjs     # Node built-in test runner
  package.json
  README.md
  SPEC.md
  CHANGELOG.md
```

## Minimal use

```js
import { Multiverse } from "./core.mjs";

const multiverse = new Multiverse();
const worldA = multiverse.createWorld({ id: "forest", name: "Forest" });
const worldB = multiverse.createWorld({
  id: "orbit", name: "Orbit", clock: { timeScale: 4 }
});

worldA.addEntity({ id: "actor", kind: "person", components: { energy: 5 } });
worldA.addSystem("energy", (world) => {
  const current = world.getEntity("actor").components.energy;
  world.setComponent("actor", "energy", current - 1);
});
worldA.events.on("world:tick", ({ tick }) => console.log("Forest tick:", tick));

multiverse.advance(1); // Forest: 1 tick; Orbit: 4 ticks
const saved = JSON.stringify(multiverse.snapshot());
const restored = Multiverse.fromSnapshot(JSON.parse(saved));
// Re-register behavior callbacks explicitly after loading:
restored.getWorld("forest").addSystem("energy", (world) => {
  const current = world.getEntity("actor").components.energy;
  world.setComponent("actor", "energy", current - 1);
});
```

## Guarantees and boundaries

- Worlds are **separate instances**; no shared entity registry, event stream, system registry, or clock.
- Simulation clock uses fixed steps and a per-advance catch-up limit; manual stepping also works when paused.
- Entities are JSON data, exposed through defensive copies. Changing a returned object never changes world state.
- Ordered systems run by numeric priority, then registration order. Events are synchronous, with unsubscribe functions.
- Saves include a format identifier and schema version. Snapshot values are JSON, not executable code. Systems/listeners are intentionally **not serialized**, and must be reattached by their owning application.
- This prototype is **not multiplayer**, **not physics-accurate**, **not a deterministic replay protocol across engine versions**, and does not implement persistence across devices, permissions, or server authorization.
- Demo data goes to the dedicated `universal-engine:multiverse-demo:v1` browser storage key. It does not read or write Frontier World saves or any Kamoku Monitor data.

## Roadmap

1. Stable APIs and versioned migrations with performance benchmarks.
2. Entity components and systems split into packages; entity queries and large-population batching.
3. Explicit inter-world portals/transfers with consent and data migration policy (no implicit sharing).
4. AI actions, autonomous agents, terrain/physics, economy, societies, rendering adapters.
5. Multiplayer/synchronization, server-authoritative state, content editors.
6. **Optional read-only observation adapter**: if ever authorized, map external reality-projection data into distinct observed-world views without sending changes back to Kamoku Monitor. The present version has no such adapter.

See [SPEC.md](SPEC.md) for contracts and [CHANGELOG.md](CHANGELOG.md) for history.
