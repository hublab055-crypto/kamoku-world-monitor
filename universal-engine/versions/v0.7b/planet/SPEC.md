# Planet System — Technical specification v0.2

Date: 2026-10-16. Scope: `universal-engine/planet/` and `universal-engine/planet-demo/`. The baseline multiverse remains `universal-engine/core.mjs` version 0.1.0.

## System boundary

This is a **fictional world simulator**. No links or API calls to Kamoku Monitor, which is an observed-reality projection. No modifications to existing Frontier World game code, save formats, online market, pipelines or root dashboard. The new demo is independent; its isolated storage key is `universal-engine:planet-sandbox:v1`.

The `Multiverse` registry hosts the planet demo in a separately named `SimulationWorld`; its update system advances planet time and ecology. The planet module itself has no DOM dependencies. Rendering and UI use the separate browser adapter.

## World scales

| Scale | Model | Units | Implemented |
| --- | --- | --- | --- |
| Space | spherical planet with axial tilt, circular star orbit | m, degree, simulated day | Yes |
| Globe | seamless sampled pseudo-heightmap, climate, ocean | latitude/longitude, m | Yes |
| Local terrain | 440m square sample with synthetic wetland stream | m | Yes, demonstration patch |
| Ecosystem | trees, grass, humans, deer and fish | m, ecological day | Yes, simplified |
| Projectiles | local tangent-plane ballistic physics | m, m/s, m/s² | Yes, simplified |

## Planet module

`new Planet({id,name,seed,radiusM,gravity,rotationHours,orbitDays,axialTiltDeg,oceanLevel,timeDays})`

Defaults: `radiusM=6371000`, `gravity=9.81`, `rotationHours=24`, `orbitDays=365.25`, `axialTiltDeg=23.4`. All are configurable and input-checked.

The circular orbit angle is `2π*timeDays/orbitDays`; axial rotation is `2π*timeDays*24/rotationHours`. A stellar direction vector and rotated unit surface normal determine local solar illumination (`max(0,dot(n,sun))`). This causes real day/night shading without hardcoded time-of-day colours. Illumination near the poles responds to axial tilt and orbit.

This is a **kinematic model**; gravity is represented by local `m/s²`, not yet computed by N-body gravity. Orbital paths are not numerically integrated.

## Terrain

`new Terrain(planet).sample(latitude,longitude)` → `{elevationM,water,river,category}`. Longitude wraps continuously because height sampling uses a normalized 3D unit-vector noise field. Three noise scales generate continents, large islands, coastal terrain, hills and mountains. Sea level separates water from dry land; categories include ocean, coast, valley, plains, forest, highland, mountain, tundra and river. Rivers use deliberately simplified latitude/longitude channels: **not** downhill routed flow, erosion, floodplains or rainfall-driven river volume.

`sampleLocal(x,z)` → local terrain and wetland stream; `resourceAvailability(x,z)` → a resource potential for water, soil, stone, wood, grass. The patch is not topologically joined to planet tessellation yet.

## Weather

`new Weather(planet).sample(lat,lon,elevationM,timeDays)` → `{temperatureC,cloudCover,moisture,precipitation,precipitationIntensity}`.

Temperature approximation is latitude mean minus altitude lapse (`0.0065°C/m`) plus a sinusoidal seasonal term and simple diurnal term. Cloud cover and moisture vary deterministically with location and time; precipitation occurs in suitable cloudy/moist conditions. Temperature at/below approximately 1°C determines snow vs rain. The demo offers rain/snow **visual overrides** for rendering tests, and labels them as forced displays; they do not represent physically consistent climate input to plant growth.

No grid advection, ocean circulation, humidity transport, accumulation, snowpack or runoff.

## Ecology

`new Ecology({terrain,weather,seed,maxPlants})`. Deterministic xorshift RNG; default max 450 plants. Trees and grass are spatial entities with `ageDays`, `kind`, `stage` and location. Parent plants can generate nearby seeds on each ecological day using species-specific range/chance; habitat viability checks dryness, patch extent and nearest-species spacing. Plants mature from seedling to young to adult. Population bounded to protect mobile performance. Tree logging (`gather("wood",n)`) removes adult plants and increments stored wood. Fixed resource stocks for stone, soil, grass and water are placeholders.

There are 1 human, 5 deer-like animals and 9 fish illustrative entities. Animal/fish drift is habitat-constrained, not yet an agent-based metabolism, behavior tree, predator-prey, mating or reproduction system. For visibility, demo plants age ~10 ecological days per planet day: this is **intentional time acceleration**, not natural tree maturation.

`summary()`, `advance(days)`, `snapshot()`, `Ecology.fromSnapshot(snapshot,{terrain,weather})`. Seed state and entity ages persist.

## Projectile physics

`new Ballistics({gravity,groundY,maxFlightSeconds})` and `launch({kind,speed,angleDeg,height})`. Kinematics:
```text
vx += (-drag*vx)*dt
vy += (-g - drag*vy)*dt
x  += vx*dt
y  += vy*dt
```
Semi-implicit Euler integration, maximum step 0.01s; ground interception interpolates within a step. Stone and arrow use different approximate **linear** air-drag coefficients and retain flight traces. The visualization uses metres and traces until landing. It is not a true aerodynamic solver (no drag coefficient by density/velocity squared, spin, launch bow mechanics, target collider, or wind). Curvature/variable gravity are not modeled at orbital distances.

## Rendering

Canvas rasterizer projects a sphere from 3D surface normals; equirectangular terrain and cloud sampling, solar dot-product lighting, drag camera control, pixel-based atmospheric rim. Three independent drawings: globe/orbit, illustrated ecology terrain section, and ballistic height/range chart. Not a GPU-accelerated WebGL mesh; mobile performance depends on browser and may vary.

## Persistent formats

- Planet `{format:"ue/planet",version:1,...}`
- Ecology `{format:"ue/ecology",version:1,...}`
- Ballistics `{format:"ue/ballistics",version:1,...}`
- Planet sandbox `{format:"ue/planet-sandbox",version:1,planet,ecology,ballistics,multiverse,daysPerRealSecond}`

SimulationWorld functions are not serialized. Re-register the system after `Multiverse.fromSnapshot`. External files or upstream save data are never loaded implicitly.

## Acceptance tests and next steps

- Separate planet tick logic in shared multiverse world; numerical rotation/orbit/day-night.
- Spherical longitude seam, mixed land/ocean/elevation, local aquatic habitat.
- Temperature lapse, rain vs snow classification.
- Seed dispersal, plant stages, deterministic save/restore, habitat and resource collection.
- Gravitational ballistic range, projectile impact and trajectory persistence.
- Browser demo loads independently without changing other applications.
- Run `npm test` in `universal-engine/` (Node 20+, no additional dependencies). Manual iPhone Safari render/touch E2E still pending.

Potential v0.3: 3D WebGL terrain chunks with seamless globe-to-ground coordinates; multi-body gravity, terrain-aware collision, water routing and real plant dynamics, human/animal action planner, species metabolism, more efficient regional simulation and LOD. They are **not included** here.
