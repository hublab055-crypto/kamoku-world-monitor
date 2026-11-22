# Universal Engine Planet Sandbox v0.2

A separate fictional-planet extension of the **Universal Engine multiverse**, implemented only under `universal-engine/`. The existing Frontier World game and Kamoku Monitor reality-projection application are **not connected or modified**.

**Browser demo:** [Planet Sandbox](../planet-demo/) — publish via GitHub Pages:
`https://hublab055-crypto.github.io/kamoku-world-monitor/universal-engine/planet-demo/`

**Tests:** from `universal-engine/`, execute `npm test` using Node.js 20+ (existing package script automatically includes `tests/planet.test.mjs`).

### New modules

- `planet-core.mjs` — sphere radius, gravity, axis tilt, self-rotation, circular orbit and solar illumination. Works in 3D vectors and SI units.
- `terrain-engine.mjs` — seeded seamless spherical continent/ocean/island and elevation sampling, mountain/valley/river/biome categories; local wetland microterrain.
- `weather-engine.mjs` — approximate temperature (latitude, height, seasons, diurnal phase), cloud cover and precipitation type.
- `ecology-engine.mjs` — bounded seeded plant population. Trees and grasses disperse seeds locally, produce seedlings and mature, compete for terrestrial space; illustrative human/deer/fish movement, gathering resources.
- `physics-engine.mjs` — stone and arrow projectiles; gravity acceleration, approximate linear air drag, ground interpolation, range/trail.
- `rendering.mjs` — dependency-free Canvas 2D rasterizer for a **3D-projected rotating sphere** with sunlight shading, clouds, procedural terrain colours, orbit schematic, surface illustration and ballistic traces.
- `../planet-demo/` — separate mobile-friendly demo with clock control, time skip, drag-to-orbit view, resource interactions, gravity/launch sliders and local storage snapshots.

The core engine itself (`../core.mjs`) stays unchanged. This is a **new, separate sandbox**. Its unique localStorage key is `universal-engine:planet-sandbox:v1`.

### Launch without build tools

From the repository root:

```sh
python3 -m http.server 8000
```

Then visit: `http://localhost:8000/universal-engine/planet-demo/`.

A local static HTTP server is needed for ES module loading; do not open the HTML with a `file://` URL.

### Design caveats

The globe is genuinely **sphere-projected from 3D vectors**, but is rendered with a custom Canvas rasterizer instead of a WebGL scene graph. Planet-wide terrain is a sampled height field, not editable 3D terrain geometry. The river classifications are stylized channels, not a proper drainage simulation. The local wetland is a demonstration patch rather than a continuous mapping to globe geography. Water and snow are indicative weather visuals; there is no full hydrological cycle, atmosphere fluid dynamics, or ecological food chain yet. Persons, animals and fish are placeholder agents rather than full autonomous AI.

Ballistics uses local flat tangent-plane approximations (`g` is constant in that demo). It does not use universal gravitation at orbital altitudes or test collisions against arbitrary meshes. The low-level engine is suitable for later replacement of these models without introducing dependencies into Kamoku Monitor.

See [SPEC.md](SPEC.md) for APIs, units, limitations, save formats, and acceptance criteria.
