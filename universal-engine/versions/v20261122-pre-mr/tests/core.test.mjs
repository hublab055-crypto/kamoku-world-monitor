import test from "node:test";
import assert from "node:assert/strict";
import {
  ENGINE_VERSION, EventBus, SimulationClock, SimulationWorld, Multiverse
} from "../core.mjs";

test("version is explicit", () => {
  assert.equal(ENGINE_VERSION, "0.1.0");
});

test("event listeners receive ordered messages and unsubscribe", () => {
  const bus = new EventBus(), received = [];
  const unsubscribe = bus.on("story:open", ({ index }) => received.push("a" + index));
  bus.on("*", ({ index }, type) => received.push(type + ":" + index));
  bus.emit("story:open", { index: 1 });
  unsubscribe();
  bus.emit("story:open", { index: 2 });
  assert.deepEqual(received, ["a1", "story:open:1", "story:open:2"]);
});

test("event payload is cloned before listeners mutate it", () => {
  const bus = new EventBus();
  const original = { nested: { score: 2 } };
  bus.on("data", payload => { payload.nested.score = 99; });
  bus.emit("data", original);
  assert.equal(original.nested.score, 2);
});

test("fixed-step advancement respects fractional frame time", () => {
  const clock = new SimulationClock({ tickSeconds: 0.25 });
  let updates = 0;
  assert.equal(clock.advance(0.1, () => updates++), 0);
  assert.equal(clock.advance(0.4, () => updates++), 2);
  assert.equal(clock.tick, 2);
  assert.equal(clock.timeSeconds, 0.5);
  assert.equal(updates, 2);
});

test("time scale and pause apply to automatic advance but not manual step", () => {
  const clock = new SimulationClock({ timeScale: 3 });
  clock.advance(1);
  assert.equal(clock.tick, 3);
  clock.pause();
  assert.equal(clock.advance(100), 0);
  clock.step(2);
  assert.equal(clock.tick, 5);
  clock.resume();
  clock.setTimeScale(0);
  assert.equal(clock.advance(10), 0);
});

test("catch-up limit prevents a huge single-frame simulation", () => {
  const clock = new SimulationClock({ maxTicksPerAdvance: 3 });
  assert.equal(clock.advance(10), 3);
  assert.equal(clock.tick, 3);
  assert.equal(clock.advance(0), 3);
  assert.equal(clock.tick, 6);
});

test("clock snapshot roundtrip retains partial accumulation", () => {
  const source = new SimulationClock({ tickSeconds: 0.5, timeScale: 2 });
  source.advance(0.6);
  const copy = SimulationClock.fromSnapshot(JSON.parse(JSON.stringify(source.snapshot())));
  assert.deepEqual(copy.snapshot(), source.snapshot());
  assert.equal(copy.advance(0.4), 2);
});

test("entity data cannot be mutated from outside world", () => {
  const world = new SimulationWorld({ id: "alpha" });
  const input = { hunger: { value: 20 } };
  world.addEntity({ id: "npc-1", kind: "actor", components: input });
  input.hunger.value = 90;
  const output = world.getEntity("npc-1");
  output.components.hunger.value = 999;
  assert.equal(world.getEntity("npc-1").components.hunger.value, 20);
  assert.equal(world.listEntities("actor").length, 1);
});

test("entity operations emit events and remove idempotently", () => {
  const world = new SimulationWorld({ id: "alpha" });
  const events = [];
  world.events.on("*", (_, type) => events.push(type));
  world.addEntity({ id: "a" });
  world.setComponent("a", "health", 5);
  assert.equal(world.removeEntity("a"), true);
  assert.equal(world.removeEntity("a"), false);
  assert.deepEqual(events, ["entity:created", "entity:updated", "entity:removed"]);
});

test("system execution uses priority then insertion order", () => {
  const world = new SimulationWorld({ id: "alpha" });
  const sequence = [];
  world.addSystem("late", () => sequence.push("late"), { priority: 2 });
  world.addSystem("first", () => sequence.push("first"), { priority: -1 });
  world.addSystem("second", () => sequence.push("second"), { priority: -1 });
  world.step();
  assert.deepEqual(sequence, ["first", "second", "late"]);
});

test("system handles can be detached", () => {
  const world = new SimulationWorld({ id: "alpha" });
  let hits = 0;
  const stop = world.addSystem("increment", () => hits++);
  world.step();
  stop();
  world.step();
  assert.equal(hits, 1);
});

test("two independent worlds do not share clocks, entities, or event listeners", () => {
  const multiverse = new Multiverse();
  const slow = multiverse.createWorld({ id: "slow", clock: { timeScale: 1 } });
  const fast = multiverse.createWorld({ id: "fast", clock: { timeScale: 5 } });
  slow.addEntity({ id: "resident", components: { food: 2 } });
  fast.addEntity({ id: "resident", components: { food: 50 } });
  let emittedBySlow = 0;
  slow.events.on("entity:updated", () => emittedBySlow++);
  fast.setComponent("resident", "food", 45);
  multiverse.advance(1);
  assert.equal(slow.clock.tick, 1);
  assert.equal(fast.clock.tick, 5);
  assert.equal(slow.getEntity("resident").components.food, 2);
  assert.equal(emittedBySlow, 0);
});

test("world save/restore retains entities but not callback systems", () => {
  const world = new SimulationWorld({ id: "earthlike", name: "Fictional Planet" });
  world.addEntity({ id: "town", components: { people: 4 } });
  world.addSystem("aging", w => w.setComponent("town", "people", w.getEntity("town").components.people + 1));
  world.step();
  const restored = SimulationWorld.fromSnapshot(JSON.parse(JSON.stringify(world.snapshot())));
  assert.deepEqual(restored.snapshot(), world.snapshot());
  restored.step();
  assert.equal(restored.getEntity("town").components.people, 5);
  assert.equal(restored.systems.size, 0);
});

test("multiverse save/restore retains separately named worlds", () => {
  const m = new Multiverse();
  m.createWorld({ id: "one", name: "Pioneer" }).step(2);
  m.createWorld({ id: "two", name: "Orbit", clock: { paused: true } });
  const snapshot = JSON.parse(JSON.stringify(m.snapshot()));
  const restored = Multiverse.fromSnapshot(snapshot);
  assert.deepEqual(restored.snapshot(), snapshot);
  assert.equal(restored.listWorlds().length, 2);
});

test("duplicate IDs, unsupported versions, and unsafe data are rejected", () => {
  const m = new Multiverse();
  m.createWorld({ id: "same" });
  assert.throws(() => m.createWorld({ id: "same" }), /already exists/);
  assert.throws(() => m.createWorld({ id: "../bad" }), /identifier/);
  const world = m.getWorld("same");
  assert.throws(() => world.addEntity({ id: "oops", components: { n: NaN } }), /finite/);
  assert.throws(() => world.addEntity({ id: "oops", components: { n: undefined } }), /JSON-safe/);
  const cyclic = {};
  cyclic.loop = cyclic;
  assert.throws(() => world.addEntity({ id: "oops", components: cyclic }), /Circular/);
  const snapshot = m.snapshot();
  snapshot.schemaVersion = 999;
  assert.throws(() => Multiverse.fromSnapshot(snapshot), /Unsupported/);
});

test("read-only listing excludes internal callbacks and mutable objects", () => {
  const m = new Multiverse();
  const w = m.createWorld({ id: "data" });
  w.addEntity({ id: "x" });
  const summary = m.listWorlds();
  summary[0].name = "Tampered";
  assert.equal(w.name, "data");
  assert.equal(summary[0].entityCount, 1);
});

test("invalid timing inputs fail fast", () => {
  assert.throws(() => new SimulationClock({ tickSeconds: 0 }), /finite/);
  assert.throws(() => new SimulationClock({ timeScale: -1 }), /finite/);
  const clock = new SimulationClock();
  assert.throws(() => clock.advance(-0.1), /finite/);
  assert.throws(() => clock.step(-1), /integer/);
});