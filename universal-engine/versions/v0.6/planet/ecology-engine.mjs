import { clamp } from "./planet-core.mjs";

function ensure(value, label, minimum = 0) {
  if (!Number.isFinite(value) || value < minimum) throw new RangeError("Invalid " + label);
  return value;
}
/**
 * Bounded seeded micro-ecosystem in a fictional 440m x 440m wetland.
 * Trees and grasses drop seeds near parents; viable seedlings grow over time.
 * Animals and people are simple moving placeholders (not autonomous agents).
 */
export class Ecology {
  constructor({ terrain, weather, seed = 2026, maxPlants = 450, initialize = true } = {}) {
    if (!terrain || !weather) throw new TypeError("Terrain and Weather required.");
    this.terrain = terrain;
    this.weather = weather;
    this.rngState = (seed | 0) || 1;
    this.maxPlants = Math.max(1, Math.min(2000, Math.floor(ensure(maxPlants, "maxPlants", 1))));
    this.day = 0;
    this.plants = [];
    this.creatures = [];
    this.nextId = 1;
    this.resources = { wood: 0, stone: 110, soil: 280, grass: 45, water: 800 };
    this.observations = { seeds: 0, newTrees: 0, newGrasses: 0 };
    if (initialize) this.seedInitialLife();
  }
  random() {
    let s = this.rngState | 0;
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
    this.rngState = s || 1;
    return (this.rngState >>> 0) / 4294967296;
  }
  point() { return { x: (this.random() - .5) * 400, z: (this.random() - .5) * 390 }; }
  viable(kind, x, z) {
    if (Math.abs(x) > 208 || Math.abs(z) > 208 || this.terrain.sampleLocal(x, z).water) return false;
    const spacing = kind === "tree" ? 12 : 3.2;
    for (const plant of this.plants) {
      if (plant.kind === kind && (plant.x - x) ** 2 + (plant.z - z) ** 2 < spacing ** 2) return false;
    }
    return true;
  }
  addPlant(kind, x, z, ageDays = 0) {
    if (kind !== "tree" && kind !== "grass") throw new RangeError("Unknown plant kind.");
    if (this.plants.length >= this.maxPlants || !this.viable(kind, x, z)) return null;
    const plant = { id: this.nextId++, kind, x, z, ageDays,
      stage: this.stage(kind, ageDays) };
    this.plants.push(plant);
    return plant;
  }
  stage(kind, age) {
    return age < (kind === "tree" ? 14 : 2) ? "seedling" :
      age < (kind === "tree" ? 45 : 7) ? "young" : "adult";
  }
  seedInitialLife() {
    for (const [kind, count, age] of [["tree", 22, 70], ["grass", 85, 15]]) {
      let tries = 0;
      while (this.plants.filter(p => p.kind === kind).length < count && tries++ < count * 25) {
        const { x, z } = this.point();
        this.addPlant(kind, x, z, age + this.random() * 30);
      }
    }
    this.creatures.push({ id: "human-1", kind: "human", x: -30, z: 0 });
    for (let i = 0; i < 5; i++) {
      const p = this.point();
      this.creatures.push({ id: "deer-" + i, kind: "animal", x: -100 + i * 15, z: p.z });
    }
    for (let i = 0; i < 9; i++) this.creatures.push({
      id: "fish-" + i, kind: "fish", x: 145 + i % 3 * 5, z: -190 + i * 43
    });
  }
  updateStep(days) {
    const weather = this.weather.conditionsAtLocal(0, 0, this.weather.planet.timeDays + this.day);
    const survival = clamp((weather.temperatureC + 3) / 19, 0, 1) *
      clamp((weather.moisture + .23) / .75, 0, 1);
    const parents = [...this.plants];
    for (const plant of parents) {
      plant.ageDays += days * (.3 + .7 * survival);
      plant.stage = this.stage(plant.kind, plant.ageDays);
      if (plant.stage !== "adult" || this.plants.length >= this.maxPlants) continue;
      const chancePerDay = plant.kind === "tree" ? .095 : .18;
      if (this.random() > 1 - Math.exp(-chancePerDay * days * survival)) continue;
      const radius = plant.kind === "tree" ? 38 : 13;
      const angle = this.random() * 2 * Math.PI;
      const length = radius * Math.sqrt(this.random());
      const x = plant.x + Math.cos(angle) * length, z = plant.z + Math.sin(angle) * length;
      this.observations.seeds++;
      if (this.addPlant(plant.kind, x, z)) {
        if (plant.kind === "tree") this.observations.newTrees++;
        else this.observations.newGrasses++;
      }
    }
    for (const creature of this.creatures) {
      if (creature.kind === "human") continue;
      const dx = (this.random() - .5) * (creature.kind === "fish" ? 14 : 22) * days;
      const dz = (this.random() - .5) * 19 * days;
      const nextX = clamp(creature.x + dx, -200, 200);
      const nextZ = clamp(creature.z + dz, -200, 200);
      if ((creature.kind === "fish") === this.terrain.sampleLocal(nextX, nextZ).water) {
        creature.x = nextX; creature.z = nextZ;
      }
    }
    this.day += days;
  }
  advance(days) {
    ensure(days, "simulation days");
    if (days > 400) throw new RangeError("Limit ecological catch-up to 400 days.");
    while (days > 0) {
      const step = Math.min(1, days);
      this.updateStep(step);
      days -= step;
      if (days < 1e-9) break;
    }
    return this.summary();
  }
  gather(kind, amount = 1) {
    if (!Object.hasOwn(this.resources, kind)) throw new RangeError("Unknown resource: " + kind);
    ensure(amount, "gather amount", 1);
    if (!Number.isSafeInteger(amount) || amount > 100) throw new RangeError("Gather amount must be integer 1..100");
    if (kind === "wood") {
      let collected = 0;
      for (let i = this.plants.length - 1; i >= 0 && collected < amount; i--) {
        if (this.plants[i].kind === "tree" && this.plants[i].stage === "adult") {
          this.plants.splice(i, 1); collected++;
        }
      }
      this.resources.wood += collected;
      return collected;
    }
    const collected = Math.min(amount, this.resources[kind]);
    this.resources[kind] -= collected;
    return collected;
  }
  summary() {
    const trees = this.plants.filter(p => p.kind === "tree");
    const grasses = this.plants.filter(p => p.kind === "grass");
    return {
      day: this.day, trees: trees.length, saplings: trees.filter(p => p.stage !== "adult").length,
      grasses: grasses.length, creatures: this.creatures.length,
      forestCover: Math.round(clamp(trees.length * 0.55, 0, 100)),
      resources: { ...this.resources }, seedsDropped: this.observations.seeds
    };
  }
  snapshot() {
    return JSON.parse(JSON.stringify({
      format: "ue/ecology", version: 1, rngState: this.rngState,
      maxPlants: this.maxPlants, day: this.day, nextId: this.nextId,
      plants: this.plants, creatures: this.creatures,
      resources: this.resources, observations: this.observations
    }));
  }
  static fromSnapshot(data, { terrain, weather }) {
    if (data?.format !== "ue/ecology" || data.version !== 1 ||
      !Array.isArray(data.plants) || !Array.isArray(data.creatures)) throw new Error("Invalid ecology snapshot.");
    const result = new Ecology({ terrain, weather, seed: data.rngState, maxPlants: data.maxPlants, initialize: false });
    result.day = ensure(data.day, "snapshot day");
    result.nextId = data.nextId;
    result.plants = JSON.parse(JSON.stringify(data.plants));
    result.creatures = JSON.parse(JSON.stringify(data.creatures));
    result.resources = { ...data.resources };
    result.observations = { ...data.observations };
    result.rngState = data.rngState | 0;
    return result;
  }
}