/**
 * Universal Engine — Multiverse Core v0.1
 * Dependency-free ECMAScript module for browsers and Node.js.
 * No connection to Frontier World or Kamoku Monitor.
 */
export const ENGINE_VERSION = "0.1.0";
export const SNAPSHOT_VERSION = 1;

function requireId(value, field = "id") {
  if (typeof value !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,79}$/.test(value)) {
    throw new TypeError(field + " must be a 1-80 character safe identifier.");
  }
  return value;
}
function finite(value, field, minimum = -Infinity) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum) {
    throw new TypeError(field + " must be a finite number >= " + minimum);
  }
  return value;
}
function integer(value, field, minimum = 0, maximum = 100000) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new TypeError(field + " must be an integer between " + minimum + " and " + maximum);
  }
  return value;
}
function jsonCopy(input) {
  const ancestors = new Set();
  function visit(value) {
    if (value === null || typeof value === "string" || typeof value === "boolean") return;
    if (typeof value === "number") { finite(value, "JSON number"); return; }
    if (typeof value !== "object") throw new TypeError("Only JSON-safe values are supported.");
    if (ancestors.has(value)) throw new TypeError("Circular data is not supported.");
    if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) {
      throw new TypeError("Only plain JSON objects and arrays are supported.");
    }
    ancestors.add(value);
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        if (!(i in value)) throw new TypeError("Sparse arrays are not supported.");
        visit(value[i]);
      }
    } else {
      for (const [key, item] of Object.entries(value)) {
        if (key === "__proto__" || key === "constructor" || key === "prototype") {
          throw new TypeError("Reserved JSON object key: " + key);
        }
        visit(item);
      }
    }
    ancestors.delete(value);
  }
  visit(input);
  return JSON.parse(JSON.stringify(input));
}

export class EventBus {
  constructor() { this.listeners = new Map(); }
  on(type, handler) {
    if (type !== "*") requireId(type, "event type");
    if (typeof handler !== "function") throw new TypeError("Event handler must be a function.");
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    const handlers = this.listeners.get(type);
    handlers.add(handler);
    return () => {
      handlers.delete(handler);
      if (!handlers.size && this.listeners.get(type) === handlers) this.listeners.delete(type);
    };
  }
  emit(type, detail = null) {
    requireId(type, "event type");
    const payload = jsonCopy(detail);
    for (const handler of [...(this.listeners.get(type) || [])]) handler(payload, type);
    for (const handler of [...(this.listeners.get("*") || [])]) handler(payload, type);
  }
  clear() { this.listeners.clear(); }
}

export class SimulationClock {
  constructor({ tickSeconds = 1, timeScale = 1, paused = false, maxTicksPerAdvance = 200 } = {}) {
    this.tickSeconds = finite(tickSeconds, "tickSeconds", Number.EPSILON);
    this.timeScale = finite(timeScale, "timeScale", 0);
    if (typeof paused !== "boolean") throw new TypeError("paused must be boolean");
    this.paused = paused;
    this.maxTicksPerAdvance = integer(maxTicksPerAdvance, "maxTicksPerAdvance", 1, 100000);
    this.tick = 0;
    this.accumulator = 0;
  }
  get timeSeconds() { return this.tick * this.tickSeconds; }
  pause() { this.paused = true; }
  resume() { this.paused = false; }
  setTimeScale(scale) { this.timeScale = finite(scale, "timeScale", 0); }
  step(count = 1, onTick = () => {}) {
    integer(count, "count", 0);
    if (typeof onTick !== "function") throw new TypeError("onTick must be a function.");
    for (let n = 0; n < count; n++) {
      this.tick++;
      onTick(this.tickSeconds, this.tick);
    }
    return count;
  }
  advance(realSeconds, onTick = () => {}) {
    finite(realSeconds, "realSeconds", 0);
    if (this.paused || this.timeScale === 0) return 0;
    this.accumulator += realSeconds * this.timeScale;
    let steps = 0;
    while (this.accumulator + Number.EPSILON >= this.tickSeconds && steps < this.maxTicksPerAdvance) {
      this.accumulator -= this.tickSeconds;
      if (this.accumulator < 0) this.accumulator = 0;
      this.step(1, onTick);
      steps++;
    }
    return steps;
  }
  snapshot() {
    return {
      tickSeconds: this.tickSeconds, timeScale: this.timeScale,
      paused: this.paused, maxTicksPerAdvance: this.maxTicksPerAdvance,
      tick: this.tick, accumulator: this.accumulator
    };
  }
  static fromSnapshot(data) {
    if (!data || typeof data !== "object") throw new TypeError("Invalid clock snapshot.");
    const clock = new SimulationClock(data);
    clock.tick = integer(data.tick, "tick", 0, Number.MAX_SAFE_INTEGER);
    clock.accumulator = finite(data.accumulator, "accumulator", 0);
    return clock;
  }
}

export class SimulationWorld {
  constructor({ id, name, clock = {} } = {}) {
    this.id = requireId(id, "world id");
    this.name = typeof name === "string" && name.trim() ? name.trim() : this.id;
    this.clock = clock instanceof SimulationClock ? clock : new SimulationClock(clock);
    this.events = new EventBus();
    this.entities = new Map();
    this.systems = new Map();
    this._systemOrder = 0;
  }
  addEntity({ id, kind = "object", components = {} } = {}) {
    requireId(id, "entity id");
    requireId(kind, "entity kind");
    if (this.entities.has(id)) throw new Error("Entity already exists: " + id);
    const clean = jsonCopy(components);
    if (!clean || Array.isArray(clean) || typeof clean !== "object") {
      throw new TypeError("Entity components must be a JSON object.");
    }
    const entity = { id, kind, components: clean };
    this.entities.set(id, entity);
    this.events.emit("entity:created", { worldId: this.id, entityId: id });
    return jsonCopy(entity);
  }
  getEntity(id) {
    const entity = this.entities.get(id);
    return entity ? jsonCopy(entity) : null;
  }
  listEntities(kind = null) {
    if (kind !== null) requireId(kind, "entity kind");
    return [...this.entities.values()]
      .filter((entity) => kind === null || entity.kind === kind)
      .map(jsonCopy);
  }
  setComponent(entityId, componentName, value) {
    requireId(componentName, "component name");
    const entity = this.entities.get(entityId);
    if (!entity) throw new Error("Unknown entity: " + entityId);
    entity.components[componentName] = jsonCopy(value);
    this.events.emit("entity:updated", { worldId: this.id, entityId, componentName });
    return this.getEntity(entityId);
  }
  removeEntity(id) {
    const existed = this.entities.delete(id);
    if (existed) this.events.emit("entity:removed", { worldId: this.id, entityId: id });
    return existed;
  }
  addSystem(id, update, { priority = 0 } = {}) {
    requireId(id, "system id");
    if (typeof update !== "function") throw new TypeError("System update must be a function.");
    finite(priority, "priority");
    if (this.systems.has(id)) throw new Error("System already exists: " + id);
    this.systems.set(id, { update, priority, order: this._systemOrder++ });
    return () => this.removeSystem(id);
  }
  removeSystem(id) { return this.systems.delete(id); }
  _tick(deltaSeconds) {
    const ordered = [...this.systems.entries()].sort((a, b) =>
      a[1].priority - b[1].priority || a[1].order - b[1].order);
    for (const [, system] of ordered) system.update(this, deltaSeconds);
    this.events.emit("world:tick", {
      worldId: this.id, tick: this.clock.tick, timeSeconds: this.clock.timeSeconds
    });
  }
  step(count = 1) { return this.clock.step(count, (delta) => this._tick(delta)); }
  advance(realSeconds) { return this.clock.advance(realSeconds, (delta) => this._tick(delta)); }
  snapshot() {
    return {
      format: "universal-engine/world", schemaVersion: SNAPSHOT_VERSION,
      id: this.id, name: this.name, clock: this.clock.snapshot(),
      entities: this.listEntities()
    };
  }
  static fromSnapshot(snapshot) {
    if (!snapshot || snapshot.format !== "universal-engine/world" || snapshot.schemaVersion !== SNAPSHOT_VERSION) {
      throw new Error("Unsupported world snapshot format/version.");
    }
    if (!Array.isArray(snapshot.entities)) throw new TypeError("Invalid entities.");
    const world = new SimulationWorld({
      id: snapshot.id, name: snapshot.name,
      clock: SimulationClock.fromSnapshot(snapshot.clock)
    });
    for (const entity of snapshot.entities) world.addEntity(entity);
    return world;
  }
}

export class Multiverse {
  constructor() { this.worlds = new Map(); }
  createWorld(options) {
    const world = new SimulationWorld(options);
    if (this.worlds.has(world.id)) throw new Error("World already exists: " + world.id);
    this.worlds.set(world.id, world);
    return world;
  }
  getWorld(id) { return this.worlds.get(id) || null; }
  listWorlds() {
    return [...this.worlds.values()].map(world => ({
      id: world.id, name: world.name, tick: world.clock.tick,
      timeSeconds: world.clock.timeSeconds, paused: world.clock.paused,
      entityCount: world.entities.size
    }));
  }
  removeWorld(id) { return this.worlds.delete(id); }
  advance(realSeconds) {
    finite(realSeconds, "realSeconds", 0);
    const counts = {};
    for (const world of this.worlds.values()) counts[world.id] = world.advance(realSeconds);
    return counts;
  }
  snapshot() {
    return {
      format: "universal-engine/multiverse", schemaVersion: SNAPSHOT_VERSION,
      engineVersion: ENGINE_VERSION,
      worlds: [...this.worlds.values()].map(world => world.snapshot())
    };
  }
  static fromSnapshot(snapshot) {
    if (!snapshot || snapshot.format !== "universal-engine/multiverse" ||
        snapshot.schemaVersion !== SNAPSHOT_VERSION || !Array.isArray(snapshot.worlds)) {
      throw new Error("Unsupported multiverse snapshot format/version.");
    }
    const result = new Multiverse();
    for (const item of snapshot.worlds) {
      const world = SimulationWorld.fromSnapshot(item);
      if (result.worlds.has(world.id)) throw new Error("Duplicate world in snapshot: " + world.id);
      result.worlds.set(world.id, world);
    }
    return result;
  }
}