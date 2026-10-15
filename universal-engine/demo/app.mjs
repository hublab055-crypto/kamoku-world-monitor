import { ENGINE_VERSION, Multiverse } from "../core.mjs";

const SAVE_KEY = "universal-engine:multiverse-demo:v1";
const $ = (id) => document.getElementById(id);
const cardsHost = $("world-cards");
const logHost = $("event-log");
const statusHost = $("status");
const cardRefs = new Map();
let multiverse;
let playing = false;
let previousFrame = null;
let lastRender = 0;

$("engine-version").textContent = ENGINE_VERSION;

function setStatus(message) { statusHost.textContent = message; }
function log(message) {
  const entry = document.createElement("li");
  entry.textContent = message;
  logHost.prepend(entry);
  while (logHost.children.length > 14) logHost.lastElementChild.remove();
}
function makeUniverse() {
  const universe = new Multiverse();
  const pioneer = universe.createWorld({
    id: "pioneer", name: "開拓者の世界", clock: { tickSeconds: 1, timeScale: 2 }
  });
  pioneer.addEntity({
    id: "explorer", kind: "person",
    components: { position: { x: 30, y: 70 }, stamina: 80, gathered: 0 }
  });
  pioneer.addEntity({
    id: "grove", kind: "resource",
    components: { position: { x: 70, y: 36 }, stock: 45 }
  });

  const orbital = universe.createWorld({
    id: "orbital", name: "軌道採掘の世界", clock: { tickSeconds: 1, timeScale: 4 }
  });
  orbital.addEntity({
    id: "probe", kind: "machine",
    components: { angle: 0, charge: 60, collected: 0 }
  });
  orbital.addEntity({
    id: "asteroid", kind: "resource", components: { stock: 80 }
  });
  attachDemoBehavior(universe);
  return universe;
}
function attachDemoBehavior(universe) {
  for (const world of universe.worlds.values()) {
    world.events.on("world:tick", ({ tick }) => {
      if (tick % 20 === 0) log(world.name + " : " + tick + " ticks");
    });
    if (world.id === "pioneer") {
      world.addSystem("pioneer:daily-work", (w) => {
        const tick = w.clock.tick;
        const person = w.getEntity("explorer").components;
        const grove = w.getEntity("grove").components;
        const work = tick % 2 === 0 && grove.stock > 0;
        const eating = person.stamina < 20 && person.gathered > 0;
        w.setComponent("explorer", "position", {
          x: Math.round(50 + 31 * Math.sin(tick * 0.13)),
          y: Math.round(51 + 24 * Math.cos(tick * 0.1))
        });
        w.setComponent("explorer", "stamina",
          eating ? Math.min(100, person.stamina + 25) : Math.max(0, person.stamina - 1));
        if (eating) w.setComponent("explorer", "gathered", person.gathered - 1);
        if (work) {
          w.setComponent("grove", "stock", grove.stock - 1);
          w.setComponent("explorer", "gathered", (eating ? person.gathered - 1 : person.gathered) + 1);
        }
        if (tick % 7 === 0) {
          const next = w.getEntity("grove").components.stock;
          w.setComponent("grove", "stock", Math.min(45, next + 2));
        }
      });
    }
    if (world.id === "orbital") {
      world.addSystem("orbital:drilling", (w) => {
        const tick = w.clock.tick;
        const probe = w.getEntity("probe").components;
        const asteroid = w.getEntity("asteroid").components;
        const harvest = tick % 3 === 0 && asteroid.stock > 0 && probe.charge > 0;
        w.setComponent("probe", "angle", (probe.angle + 10) % 360);
        w.setComponent("probe", "charge",
          Math.min(100, Math.max(0, probe.charge - (harvest ? 2 : 0) + (tick % 5 === 0 ? 4 : 0))));
        if (harvest) {
          w.setComponent("asteroid", "stock", asteroid.stock - 1);
          w.setComponent("probe", "collected", probe.collected + 1);
        }
      });
    }
  }
}

function node(tag, className, content) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (content !== undefined) el.textContent = content;
  return el;
}
function rebuildCards() {
  cardsHost.replaceChildren();
  cardRefs.clear();
  const selected = $("step-world").value;
  $("step-world").replaceChildren();
  for (const world of multiverse.worlds.values()) {
    const option = node("option", "", world.name);
    option.value = world.id;
    $("step-world").appendChild(option);

    const card = node("article", "world-card");
    const heading = node("div", "world-heading");
    heading.appendChild(node("h2", "", world.name));
    const pause = node("button", "small-button", "この世界を停止");
    pause.type = "button";
    pause.addEventListener("click", () => {
      world.clock.paused ? world.clock.resume() : world.clock.pause();
      render();
    });
    heading.appendChild(pause);
    const metadata = node("div", "metrics");
    const canvas = node("canvas", "world-scene");
    canvas.width = 640;
    canvas.height = 260;
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", world.name + " の簡易図");
    const entities = node("div", "entity-details");
    card.append(heading, metadata, canvas, entities);
    cardsHost.appendChild(card);
    cardRefs.set(world.id, { metadata, canvas, entities, pause });
  }
  if ([...multiverse.worlds.keys()].includes(selected)) $("step-world").value = selected;
}

function drawScene(world, canvas) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = canvas.width, h = canvas.height;
  const orbital = world.id === "orbital";
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = orbital ? "#0b162f" : "#e9f1da";
  ctx.fillRect(0, 0, w, h);
  if (!orbital) {
    ctx.fillStyle = "#badfa9";
    ctx.beginPath(); ctx.ellipse(200, 245, 330, 135, 0, 0, 2 * Math.PI); ctx.fill();
    ctx.fillStyle = "#6f8e4a";
    for (let n = 0; n < 9; n++) {
      const x = 285 + n * 29;
      const y = 85 + Math.sin(n * 4) * 42;
      ctx.beginPath(); ctx.arc(x, y, 22, 0, Math.PI * 2); ctx.fill();
    }
    const person = world.getEntity("explorer").components;
    const grove = world.getEntity("grove").components;
    ctx.strokeStyle = "#9d753e"; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(0, 210); ctx.quadraticCurveTo(255, 75, 640, 205); ctx.stroke();
    const x = 55 + person.position.x * 4.4, y = 55 + person.position.y * 1.5;
    ctx.fillStyle = "#3b5174"; ctx.fillRect(x - 9, y + 12, 18, 22);
    ctx.fillStyle = "#f0b57c"; ctx.beginPath(); ctx.arc(x, y, 13, 0, 2 * Math.PI); ctx.fill();
    ctx.fillStyle = "#1d2f29"; ctx.font = "18px sans-serif";
    ctx.fillText("資源 " + grove.stock, 20, 30);
  } else {
    for (let i = 0; i < 35; i++) {
      ctx.fillStyle = "#c2d2ed";
      ctx.fillRect((i * 137 + 29) % 640, (i * 71 + 53) % 260, 2, 2);
    }
    const probe = world.getEntity("probe").components;
    ctx.strokeStyle = "#3d6287"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(320, 130, 185, 95, 0, 0, 2 * Math.PI); ctx.stroke();
    ctx.fillStyle = "#84735e"; ctx.beginPath(); ctx.arc(320, 130, 53, 0, 2 * Math.PI); ctx.fill();
    const a = probe.angle * Math.PI / 180;
    const x = 320 + 185 * Math.cos(a), y = 130 + 95 * Math.sin(a);
    ctx.fillStyle = "#83d9f3"; ctx.fillRect(x - 22, y - 7, 44, 14);
    ctx.fillStyle = "#e1edf9"; ctx.fillRect(x - 8, y - 12, 16, 24);
    ctx.font = "18px sans-serif"; ctx.fillText("採掘 " + probe.collected, 20, 30);
  }
}

function render() {
  if (!multiverse) return;
  $("run").textContent = playing ? "⏸ 全体停止" : "▶ 全体再生";
  for (const world of multiverse.worlds.values()) {
    const card = cardRefs.get(world.id);
    if (!card) continue;
    card.pause.textContent = world.clock.paused ? "この世界を再開" : "この世界を停止";
    card.metadata.textContent = "Tick " + world.clock.tick +
      "　|　シミュレーション時間 " + world.clock.timeSeconds.toFixed(0) + " 秒" +
      "　|　速度 ×" + world.clock.timeScale +
      (world.clock.paused ? "　|　停止中" : "");
    if (world.id === "pioneer") {
      const p = world.getEntity("explorer").components;
      const r = world.getEntity("grove").components;
      card.entities.textContent = "開拓者の体力 " + p.stamina +
        "　·　収集資源 " + p.gathered + "　·　森林資源 " + r.stock;
    } else if (world.id === "orbital") {
      const p = world.getEntity("probe").components;
      const r = world.getEntity("asteroid").components;
      card.entities.textContent = "探査機電力 " + p.charge +
        "　·　採掘量 " + p.collected + "　·　残鉱量 " + r.stock;
    }
    drawScene(world, card.canvas);
  }
}
function reset() {
  playing = false;
  multiverse = makeUniverse();
  rebuildCards();
  log("2つの独立した世界を生成しました。");
  setStatus("初期化完了。Kamoku Monitor / Frontier Worldには接続していません。");
  render();
}
$("run").addEventListener("click", () => {
  playing = !playing;
  previousFrame = null;
  setStatus(playing ? "マルチバースの時間を進めています。" : "全体進行を停止しました。");
  render();
});
$("step").addEventListener("click", () => {
  try {
    const id = $("step-world").value;
    multiverse.getWorld(id)?.step(1);
    setStatus("選択した世界だけ1ステップ進めました。");
    render();
  } catch (error) { setStatus(error.message); }
});
$("step-all").addEventListener("click", () => {
  try {
    for (const world of multiverse.worlds.values()) world.step(10);
    setStatus("全世界をそれぞれ10ステップ進めました。");
    render();
  } catch (error) { setStatus(error.message); }
});
$("save").addEventListener("click", () => {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(multiverse.snapshot()));
    log("このデモ専用の保存領域に記録しました。");
    setStatus("ブラウザ内に保存しました。既存ゲームのセーブには影響しません。");
  } catch (error) { setStatus("保存できませんでした: " + error.message); }
});
$("load").addEventListener("click", () => {
  try {
    const content = localStorage.getItem(SAVE_KEY);
    if (!content) { setStatus("保存データが見つかりません。"); return; }
    const restored = Multiverse.fromSnapshot(JSON.parse(content));
    if (!restored.getWorld("pioneer") || !restored.getWorld("orbital")) {
      throw new Error("このデモが必要とする世界がありません。");
    }
    attachDemoBehavior(restored);
    playing = false;
    multiverse = restored;
    rebuildCards();
    log("独立した2世界と各時計を復元しました。");
    setStatus("復元完了。シミュレーション処理を再登録しました。");
    render();
  } catch (error) { setStatus("読み込み失敗: " + error.message); }
});
$("reset").addEventListener("click", reset);

function animationFrame(timestamp) {
  if (previousFrame === null) previousFrame = timestamp;
  const seconds = Math.min(0.25, (timestamp - previousFrame) / 1000);
  previousFrame = timestamp;
  if (playing) {
    try { multiverse.advance(seconds); }
    catch (error) {
      playing = false;
      setStatus("実行エラー: " + error.message);
    }
  }
  if (timestamp - lastRender > 100) { lastRender = timestamp; render(); }
  requestAnimationFrame(animationFrame);
}

reset();
requestAnimationFrame(animationFrame);