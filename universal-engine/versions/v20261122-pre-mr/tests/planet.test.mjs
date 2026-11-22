import test from "node:test";
import assert from "node:assert/strict";
import { Multiverse } from "../core.mjs";
import { Planet, TAU, noise3, normalAt } from "../planet/planet-core.mjs";
import { Terrain } from "../planet/terrain-engine.mjs";
import { Weather } from "../planet/weather-engine.mjs";
import { Ecology } from "../planet/ecology-engine.mjs";
import { Ballistics } from "../planet/physics-engine.mjs";

const setup = (seed = 77) => {
  const planet = new Planet({ id: "test-planet", seed });
  const terrain = new Terrain(planet), weather = new Weather(planet);
  return { planet, terrain, weather };
};

test("planet rotates 360 degrees in one rotational day", () => {
  const planet = new Planet({ rotationHours: 24, orbitDays: 365 });
  const start = planet.rotationAngle;
  planet.advance(1);
  assert.ok(Math.abs(start - planet.rotationAngle) < 1e-12);
  assert.ok(Math.abs(planet.orbitAngle - TAU / 365) < 1e-12);
});

test("sunlit and dark points can coexist on the same planet", () => {
  const p = new Planet({ axialTiltDeg: 0 });
  const noon = p.illumination(0, 180);
  const midnight = p.illumination(0, 0);
  assert.ok(noon > 0.99);
  assert.equal(midnight, 0);
});

test("planet snap restores orbit and gravity", () => {
  const p = new Planet({ gravity: 3.7, timeDays: 123.5, seed: 61 });
  const copy = Planet.fromSnapshot(p.snapshot());
  assert.deepEqual(copy.snapshot(), p.snapshot());
  assert.equal(copy.gravity, 3.7);
  assert.throws(() => new Planet({ gravity: -3 }), /gravity/);
  assert.throws(() => Planet.fromSnapshot({}), /Unsupported/);
});

test("spherical noise is reproducible and seam-free", () => {
  const { terrain } = setup();
  assert.equal(noise3(.22, -.35, 8, 15), noise3(.22, -.35, 8, 15));
  assert.ok(Math.abs(terrain.sample(15, -180).elevationM - terrain.sample(15, 180).elevationM) < 1e-7);
  const n = normalAt(70, 35);
  assert.ok(Math.abs(Math.hypot(n.x, n.y, n.z) - 1) < 1e-12);
});

test("terrain generates both ocean and land at broad world samples", () => {
  const { terrain } = setup();
  const seen = new Set();
  for (let lat = -70; lat <= 70; lat += 14) {
    for (let lon = -175; lon < 180; lon += 17) {
      const s = terrain.sample(lat, lon);
      seen.add(s.water ? "water" : "land");
      assert.ok(Number.isFinite(s.elevationM));
      assert.ok(s.elevationM < 12000);
      assert.ok(s.elevationM > -6000);
    }
  }
  assert.ok(seen.has("land"));
  assert.ok(seen.has("water"));
});

test("local terrain defines a fish-bearing stream and dry habitat", () => {
  const { terrain } = setup();
  assert.equal(terrain.sampleLocal(145, 0).water, true);
  assert.equal(terrain.sampleLocal(-100, 0).water, false);
  assert.ok(terrain.resourceAvailability(-100, 0).soil > 0);
  assert.ok(terrain.resourceAvailability(145, 0).water > 0);
});

test("temperature drops with altitude at identical coordinates/time", () => {
  const { weather } = setup();
  const sea = weather.sample(35, 25, 0, 10);
  const mountain = weather.sample(35, 25, 2400, 10);
  assert.ok(mountain.temperatureC <= sea.temperatureC - 15);
  assert.ok(sea.cloudCover >= 0 && sea.cloudCover <= 1);
  assert.ok(["rain", "snow", "none"].includes(mountain.precipitation));
});

test("rain and snow classification are controlled by temperature", () => {
  const { weather } = setup();
  let found = null;
  for (let lat = -75; lat <= 75 && !found; lat += 5) {
    for (let lon = -175; lon <= 175; lon += 5) {
      const hot = weather.sample(lat, lon, 0, 55);
      if (hot.precipitation === "rain") {
        const cold = weather.sample(lat, lon, 5500, 55);
        if (cold.precipitation === "snow") { found = { hot, cold }; break; }
      }
    }
  }
  assert.ok(found, "expected at least one rainy coordinate that turns snowy at altitude");
});

test("ecology grows seedlings from locally dropped seeds", () => {
  const { terrain, weather } = setup();
  const eco = new Ecology({ terrain, weather, seed: 1234 });
  const initial = eco.summary();
  eco.advance(18);
  const next = eco.summary();
  assert.ok(next.seedsDropped > 0);
  assert.ok(next.trees + next.grasses >= initial.trees + initial.grasses);
  assert.ok(next.trees + next.grasses <= eco.maxPlants);
  assert.ok(eco.plants.some(p => p.stage === "seedling" || p.stage === "young"));
});

test("species obey land and water habitats", () => {
  const { terrain, weather } = setup();
  const eco = new Ecology({ terrain, weather, seed: 99 });
  eco.advance(12);
  for (const p of eco.plants) assert.equal(terrain.sampleLocal(p.x, p.z).water, false);
  for (const c of eco.creatures) {
    if (c.kind === "fish") assert.equal(terrain.sampleLocal(c.x, c.z).water, true);
    if (c.kind === "animal") assert.equal(terrain.sampleLocal(c.x, c.z).water, false);
  }
});

test("wood can be collected without mutating other resources", () => {
  const { terrain, weather } = setup();
  const eco = new Ecology({ terrain, weather });
  const before = eco.summary();
  const result = eco.gather("wood", 3);
  assert.equal(result, 3);
  assert.equal(eco.summary().trees, before.trees - 3);
  assert.equal(eco.resources.wood, 3);
  assert.equal(eco.resources.stone, before.resources.stone);
});

test("ecology seeds, entities and movement survive save roundtrip", () => {
  const { terrain, weather } = setup();
  const eco = new Ecology({ terrain, weather, seed: 8888 });
  eco.advance(8);
  const restored = Ecology.fromSnapshot(eco.snapshot(), { terrain, weather });
  assert.deepEqual(restored.snapshot(), eco.snapshot());
  eco.advance(4);
  restored.advance(4);
  assert.deepEqual(restored.snapshot(), eco.snapshot());
});

test("lower gravity yields longer ballistic range", () => {
  const low = new Ballistics({ gravity: 3.7 });
  const high = new Ballistics({ gravity: 15 });
  low.launch({ speed: 30, angleDeg: 45 });
  high.launch({ speed: 30, angleDeg: 45 });
  low.advance(10); low.advance(10); high.advance(10);
  assert.ok(low.projectiles[0].landed && high.projectiles[0].landed);
  assert.ok(low.projectiles[0].impactX > high.projectiles[0].impactX * 2);
});

test("stone and arrow follow curved, ground-colliding trajectories", () => {
  const p = new Ballistics({ gravity: 9.81 });
  const stone = p.launch({ kind: "stone", speed: 32, angleDeg: 42, height: 1.6 });
  const arrow = p.launch({ kind: "arrow", speed: 32, angleDeg: 42, height: 1.6 });
  p.advance(10);
  for (const item of [stone, arrow]) {
    assert.equal(item.landed, true);
    assert.equal(item.y, 0);
    assert.ok(item.impactX > 40);
    assert.ok(item.trail.some(([, y]) => y > 10));
  }
  assert.ok(Math.abs(stone.impactX - arrow.impactX) > .01);
});

test("ballistics snapshot restores position, velocity and trace", () => {
  const physics = new Ballistics({ gravity: 8.2 });
  physics.launch({ kind: "arrow", speed: 30 });
  physics.advance(.35);
  const copy = Ballistics.fromSnapshot(physics.snapshot());
  assert.deepEqual(copy.snapshot(), physics.snapshot());
  physics.advance(.2); copy.advance(.2);
  assert.deepEqual(copy.snapshot(), physics.snapshot());
});

test("planet simulation can live in an isolated Universal Engine world", () => {
  const mv = new Multiverse();
  const first = mv.createWorld({ id: "terra" });
  const second = mv.createWorld({ id: "other", clock: { timeScale: 3 } });
  const p = new Planet({ seed: 17 });
  first.addSystem("planet", (_world, dt) => p.advance(dt));
  mv.advance(1);
  assert.equal(first.clock.tick, 1);
  assert.equal(second.clock.tick, 3);
  assert.equal(p.timeDays, 1);
  assert.equal(second.listEntities().length, 0);
});

test("invalid physics, ecology and weather inputs fail instead of silently corrupting state", () => {
  const { planet, terrain, weather } = setup();
  assert.throws(() => terrain.sample(100, 0), /Latitude/);
  assert.throws(() => weather.sample(NaN, 0, 0), /Invalid/);
  assert.throws(() => new Ballistics({ gravity: -1 }), /Invalid/);
  assert.throws(() => new Ballistics().launch({ speed: -10 }), /Invalid/);
  assert.throws(() => new Ecology({ terrain, weather }).advance(-1), /Invalid/);
  assert.throws(() => new Planet({ rotationHours: 0 }), /rotationHours/);
});