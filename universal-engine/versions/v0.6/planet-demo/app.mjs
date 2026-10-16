import { Multiverse } from "../core.mjs";
import { Planet } from "../planet/planet-core.mjs";
import { Terrain } from "../planet/terrain-engine.mjs";
import { Weather } from "../planet/weather-engine.mjs";
import { Ecology } from "../planet/ecology-engine.mjs";
import { Ballistics } from "../planet/physics-engine.mjs";
import { drawPlanet, drawOrbit, drawEcology, drawBallistics } from "../planet/rendering.mjs";

const $ = (id) => document.getElementById(id);
const SAVE_KEY = "universal-engine:planet-sandbox:v1";
let planet, terrain, weather, ecology, ballistics, multiverse, engineWorld;
let running = true, cameraLongitude = 0, cameraLatitude = 0;
let lastFrame = 0, lastGlobe = 0, lastUI = 0;
let daysPerRealSecond = 0.12, manualWeather = "auto";
let lastLandings = new Set();

function createEnvironment({ planetSnapshot = null, ecologySnapshot = null,
  physicsSnapshot = null, worldSnapshot = null } = {}) {
  planet = planetSnapshot ? Planet.fromSnapshot(planetSnapshot) :
    new Planet({ name: "Terra Nova", seed: 77, timeDays: 0.49 });
  terrain = new Terrain(planet);
  weather = new Weather(planet);
  ecology = ecologySnapshot ?
    Ecology.fromSnapshot(ecologySnapshot, { terrain, weather }) :
    new Ecology({ terrain, weather, seed: 31206 });
  ballistics = physicsSnapshot ? Ballistics.fromSnapshot(physicsSnapshot) :
    new Ballistics({ gravity: planet.gravity });
  multiverse = worldSnapshot ? Multiverse.fromSnapshot(worldSnapshot) : new Multiverse();
  engineWorld = multiverse.getWorld("planet-sandbox") ||
    multiverse.createWorld({ id: "planet-sandbox", name: planet.name, clock: { tickSeconds: 0.05, maxTicksPerAdvance: 15 } });
  // Tick callbacks are not persisted. Re-register after restoring the world.
  engineWorld.addSystem("planet:orbit-climate-ecology", (_world, delta) => {
    const days = delta * daysPerRealSecond;
    planet.advance(days);
    ecology.advance(days * 10);
  });
  engineWorld.clock.paused = !running;
  lastLandings = new Set(ballistics.projectiles.filter(p => p.landed).map(p => p.id));
  $("gravity").value = String(planet.gravity);
  $("speed").value = String(Math.round(daysPerRealSecond * 100));
  $("temperature-site").value = "32";
  updateSliderText();
}

function log(message) {
  const el = document.createElement("li");
  el.textContent = message;
  $("events").prepend(el);
  while ($("events").children.length > 9) $("events").lastElementChild.remove();
}

function sampleWeather() {
  const latitude = Number($("temperature-site").value);
  const s = terrain.sample(latitude, 34);
  const result = weather.sample(latitude, 34, s.elevationM);
  if (manualWeather !== "auto") {
    return { ...result, precipitation: manualWeather, precipitationIntensity: 0.72 };
  }
  return result;
}
function updateSliderText() {
  $("gravity-value").textContent = Number($("gravity").value).toFixed(2) + " m/s²";
  $("speed-value").textContent = (Number($("speed").value) / 100).toFixed(2) + " 日/秒";
  $("throw-speed-value").textContent = $("throw-speed").value + " m/s";
  $("throw-angle-value").textContent = $("throw-angle").value + "°";
}
function updateUI() {
  const conditions = sampleWeather();
  const info = ecology.summary();
  const degrees = planet.rotationAngle * 180 / Math.PI;
  const year = Math.floor(planet.timeDays / planet.orbitDays) + 1;
  const season = ((planet.season * 4) | 0) + 1;
  $("day").textContent = planet.timeDays.toFixed(1);
  $("year").textContent = String(year);
  $("spin").textContent = degrees.toFixed(1) + "°";
  $("orbit").textContent = (planet.orbitAngle * 180 / Math.PI).toFixed(1) + "°";
  $("season").textContent = "区分 " + season + " / 4";
  $("temperature").textContent = conditions.temperatureC.toFixed(1) + " ℃";
  $("clouds").textContent = Math.round(conditions.cloudCover * 100) + "%";
  $("rainfall").textContent = conditions.precipitation === "none" ? "なし" :
    conditions.precipitation === "rain" ? "雨" : "雪";
  $("trees").textContent = String(info.trees);
  $("saplings").textContent = String(info.saplings);
  $("grasses").textContent = String(info.grasses);
  $("seeds").textContent = String(info.seedsDropped);
  $("creatures").textContent = "人1 / 動物5 / 魚9";
  $("resources").textContent = ["wood", "stone", "soil", "grass", "water"]
    .map(k => ({ wood: "木", stone: "石", soil: "土", grass: "草", water: "水" }[k]) +
      " " + info.resources[k]).join("　");
  $("play").textContent = running ? "⏸ 一時停止" : "▶ 再生";
  const recent = ballistics.projectiles.at(-1);
  $("range").textContent = recent ?
    (recent.landed ? "着弾 " + recent.impactX.toFixed(1) + " m" :
      "飛行中 " + recent.x.toFixed(1) + " m / 高さ " + recent.y.toFixed(1) + " m") :
    "発射待機中";
  drawEcology($("surface"), ecology, conditions, planet);
  drawBallistics($("ballistics"), ballistics);
  drawOrbit($("orbit-map"), planet);
}
function redrawGlobe() {
  drawPlanet($("globe"), planet, terrain, weather, cameraLongitude, cameraLatitude);
}
function launch(kind) {
  try {
    const projectile = ballistics.launch({
      kind, speed: Number($("throw-speed").value),
      angleDeg: Number($("throw-angle").value)
    });
    log((kind === "stone" ? "石" : "矢") + "を発射。初速 " + Math.round(Math.hypot(projectile.vx, projectile.vy)) + " m/s");
    updateUI();
  } catch (error) { log("発射エラー: " + error.message); }
}

$("play").addEventListener("click", () => {
  running = !running; engineWorld.clock.paused = !running;
  lastFrame = 0; updateUI();
});
$("advance-day").addEventListener("click", () => {
  planet.advance(1);
  ecology.advance(10);
  engineWorld.step(1); // explicit manual step, even if simulation is paused
  redrawGlobe(); updateUI();
  log("手動で約1日進めました。");
});
$("advance-month").addEventListener("click", () => {
  planet.advance(30);
  ecology.advance(300);
  redrawGlobe(); updateUI();
  log("30日間を早送りしました（生態系は加速成長）。");
});
$("reset").addEventListener("click", () => {
  running = false;
  createEnvironment();
  redrawGlobe(); updateUI();
  log("惑星・植生・重力を初期化しました。");
});
$("gravity").addEventListener("input", () => {
  planet.gravity = Number($("gravity").value);
  ballistics.gravity = planet.gravity;
  updateSliderText();
});
$("speed").addEventListener("input", () => {
  daysPerRealSecond = Number($("speed").value) / 100;
  updateSliderText();
});
for (const id of ["throw-speed", "throw-angle"]) $(id).addEventListener("input", updateSliderText);
$("temperature-site").addEventListener("change", updateUI);
$("weather-mode").addEventListener("change", () => {
  manualWeather = $("weather-mode").value;
  updateUI();
});
$("throw-stone").addEventListener("click", () => launch("stone"));
$("shoot-arrow").addEventListener("click", () => launch("arrow"));
$("clear-trails").addEventListener("click", () => {
  ballistics.projectiles = []; lastLandings.clear(); updateUI();
});
$("collect-wood").addEventListener("click", () => {
  const count = ecology.gather("wood", 3);
  log("成木を伐採して木材 " + count + " を回収しました。");
  updateUI();
});
$("plant-tree").addEventListener("click", () => {
  let plant = null;
  for (let n = 0; n < 60 && !plant; n++) {
    const p = ecology.point();
    plant = ecology.addPlant("tree", p.x, p.z, 0);
  }
  log(plant ? "苗木を1本植えました。" : "空き地が見つかりませんでした。");
  updateUI();
});
$("save").addEventListener("click", () => {
  try {
    const snapshot = {
      format: "ue/planet-sandbox", version: 1,
      planet: planet.snapshot(), ecology: ecology.snapshot(),
      ballistics: ballistics.snapshot(), multiverse: multiverse.snapshot(),
      daysPerRealSecond
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(snapshot));
    log("このデモ専用の保存領域に記録しました。");
  } catch (error) { log("保存に失敗しました: " + error.message); }
});
$("load").addEventListener("click", () => {
  try {
    const saved = localStorage.getItem(SAVE_KEY);
    if (!saved) throw new Error("保存データがありません。");
    const s = JSON.parse(saved);
    if (s?.format !== "ue/planet-sandbox" || s.version !== 1) throw new Error("対応していないセーブ形式です。");
    running = false;
    daysPerRealSecond = Number.isFinite(s.daysPerRealSecond) && s.daysPerRealSecond >= .01 &&
      s.daysPerRealSecond <= 2 ? s.daysPerRealSecond : .12;
    createEnvironment({
      planetSnapshot: s.planet, ecologySnapshot: s.ecology,
      physicsSnapshot: s.ballistics, worldSnapshot: s.multiverse
    });
    redrawGlobe(); updateUI();
    log("惑星と植生・投射物を復元しました。");
  } catch (error) { log("読み込みエラー: " + error.message); }
});

// Drag with a mouse or finger to orbit the virtual planet view.
const globe = $("globe");
let pointer = null;
globe.addEventListener("pointerdown", e => {
  pointer = { id: e.pointerId, x: e.clientX, y: e.clientY };
  globe.setPointerCapture?.(e.pointerId);
});
globe.addEventListener("pointermove", e => {
  if (!pointer || pointer.id !== e.pointerId) return;
  cameraLongitude += (e.clientX - pointer.x) * .01;
  cameraLatitude = Math.max(-1.15, Math.min(1.15, cameraLatitude + (e.clientY - pointer.y) * .007));
  pointer = { ...pointer, x: e.clientX, y: e.clientY };
  redrawGlobe();
});
globe.addEventListener("pointerup", () => { pointer = null; });
globe.addEventListener("pointercancel", () => { pointer = null; });

function animate(timestamp) {
  if (lastFrame === 0) lastFrame = timestamp;
  const elapsed = Math.max(0, Math.min(.08, (timestamp - lastFrame) / 1000));
  lastFrame = timestamp;
  if (running) {
    try {
      multiverse.advance(elapsed);
      ballistics.advance(elapsed);
      for (const p of ballistics.projectiles) {
        if (p.landed && !lastLandings.has(p.id)) {
          lastLandings.add(p.id);
          log((p.kind === "stone" ? "石" : "矢") + "が " + p.impactX.toFixed(1) + "m に着弾。");
        }
      }
    } catch (error) {
      running = false;
      engineWorld.clock.pause();
      log("実行エラー: " + error.message);
    }
  }
  if (timestamp - lastGlobe >= 160) { redrawGlobe(); lastGlobe = timestamp; }
  if (timestamp - lastUI >= 160) { updateUI(); lastUI = timestamp; }
  requestAnimationFrame(animate);
}

createEnvironment();
log("架空惑星 Terra Nova を生成しました。既存作品・現実監視データとは未接続です。");
redrawGlobe();
updateUI();
requestAnimationFrame(animate);