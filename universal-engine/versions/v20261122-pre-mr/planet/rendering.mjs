import { clamp, noise3, rotateX, rotateY, TAU, dot } from "./planet-core.mjs";

const textures = new WeakMap();
function rgb(r, g, b) { return [r | 0, g | 0, b | 0]; }
function surfaceColor(sample, tempC) {
  if (sample.water) {
    const deep = clamp(-sample.elevationM / 4500, 0, 1);
    return rgb(15 + 15 * (1 - deep), 101 - 53 * deep, 151 - 48 * deep);
  }
  if (sample.river) return rgb(61, 139, 169);
  if (sample.elevationM > 2600 || tempC < -4) return rgb(231, 234, 228);
  if (sample.category === "mountain") return rgb(119, 123, 121);
  if (sample.category === "highland") return rgb(133, 143, 116);
  if (sample.category === "coast") return rgb(209, 191, 139);
  if (sample.category === "tundra") return rgb(178, 179, 146);
  if (sample.category === "forest") return rgb(48, 109, 65);
  if (sample.category === "valley") return rgb(80, 144, 73);
  return rgb(112, 159, 83);
}
function textureFor(terrain, weather) {
  if (textures.has(terrain)) return textures.get(terrain);
  const width = 360, height = 180;
  const base = new Uint8Array(width * height * 3);
  const clouds = new Uint8Array(width * height);
  for (let j = 0; j < height; j++) {
    const latitude = 90 - (j + .5);
    for (let i = 0; i < width; i++) {
      const longitude = i - 180 + .5;
      const s = terrain.sample(latitude, longitude);
      const temp = weather.sample(latitude, longitude, s.elevationM, 0).temperatureC;
      const color = surfaceColor(s, temp);
      const k = j * width + i;
      base[k * 3] = color[0]; base[k * 3 + 1] = color[1]; base[k * 3 + 2] = color[2];
      const latitudeR = latitude * Math.PI / 180, longitudeR = longitude * Math.PI / 180;
      const x = Math.cos(latitudeR) * Math.cos(longitudeR);
      const y = Math.sin(latitudeR), z = Math.cos(latitudeR) * Math.sin(longitudeR);
      clouds[k] = Math.round(255 * clamp(
        (noise3(x * 6 + 4, y * 6, z * 6 - 1, terrain.planet.seed + 910) + .16) * 1.3, 0, 1));
    }
  }
  const texture = { width, height, base, clouds };
  textures.set(terrain, texture);
  return texture;
}
let bufferCanvas = null;
function backdrop(ctx, width, height, time) {
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#071123"); gradient.addColorStop(1, "#132c4a");
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#d8ecff";
  for (let i = 0; i < 85; i++) {
    const x = (i * 167 + 51) % width, y = (i * 101 + 19) % height;
    ctx.globalAlpha = .25 + .55 * ((i * 29 % 11) / 11);
    ctx.fillRect(x, y, i % 9 === 0 ? 2 : 1, i % 9 === 0 ? 2 : 1);
  }
  ctx.globalAlpha = 1;
}
export function drawPlanet(canvas, planet, terrain, weather, cameraLongitude = 0, cameraLatitude = 0) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const width = canvas.width, height = canvas.height;
  backdrop(ctx, width, height, planet.timeDays);
  const tex = textureFor(terrain, weather);
  const dim = 276;
  if (!bufferCanvas) bufferCanvas = document.createElement("canvas");
  if (bufferCanvas.width !== dim || bufferCanvas.height !== dim) {
    bufferCanvas.width = dim; bufferCanvas.height = dim;
  }
  const bctx = bufferCanvas.getContext("2d");
  const frame = bctx.createImageData(dim, dim);
  const pixels = frame.data;
  const radius = dim / 2 - 2;
  const sun = planet.solarDirection;
  const tilt = planet.axialTiltDeg * Math.PI / 180;
  const spin = planet.rotationAngle + cameraLongitude;
  const observerTilt = cameraLatitude;
  for (let y = 0; y < dim; y++) {
    const ny = ((dim / 2 - y) / radius);
    for (let x = 0; x < dim; x++) {
      const nx = ((x - dim / 2) / radius);
      const rr = nx * nx + ny * ny;
      if (rr > 1) continue;
      const normalView = { x: nx, y: ny, z: Math.sqrt(1 - rr) };
      const normalWorld = rotateX(normalView, observerTilt);
      const local = rotateX(rotateY(normalWorld, -spin), -tilt);
      const lat = Math.asin(clamp(local.y, -1, 1)) * 180 / Math.PI;
      const lon = Math.atan2(local.z, local.x) * 180 / Math.PI;
      const i = ((Math.floor(lon + 180) % tex.width) + tex.width) % tex.width;
      const j = clamp(Math.floor(90 - lat), 0, tex.height - 1);
      const k = j * tex.width + i;
      const sunlight = Math.max(0, dot(normalWorld, sun));
      const ambient = .16 + Math.pow(sunlight, .7) * .92;
      const cloudDrift = Math.floor(planet.timeDays * 5) % tex.width;
      const cloudI = (i + cloudDrift + tex.width) % tex.width;
      const c = tex.clouds[j * tex.width + cloudI] / 255;
      const cloudAlpha = Math.max(0, c - .33) * .65;
      const border = clamp((Math.sqrt(1 - rr) + .04) * 5, 0, 1);
      const pos = (y * dim + x) * 4;
      for (let channel = 0; channel < 3; channel++) {
        const base = tex.base[k * 3 + channel];
        const tinted = base * (1 - cloudAlpha) + (channel === 2 ? 243 : 238) * cloudAlpha;
        pixels[pos + channel] = clamp(tinted * ambient * border + (channel === 2 ? 18 : 3) * (1 - border), 0, 255);
      }
      pixels[pos + 3] = 255;
    }
  }
  bctx.putImageData(frame, 0, 0);
  const diameter = Math.min(width - 34, height - 35);
  const px = (width - diameter) / 2, py = (height - diameter) / 2;
  const halo = ctx.createRadialGradient(width / 2, height / 2, diameter * .42, width / 2, height / 2, diameter * .55);
  halo.addColorStop(0, "#7cd7fa73"); halo.addColorStop(1, "#66baff00");
  ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(width / 2, height / 2, diameter * .57, 0, TAU); ctx.fill();
  ctx.drawImage(bufferCanvas, px, py, diameter, diameter);
  ctx.save();
  ctx.fillStyle = "#d7e8f7"; ctx.font = "13px system-ui";
  ctx.fillText("自転 " + (planet.rotationAngle * 180 / Math.PI).toFixed(0) + "°", 17, height - 14);
  ctx.textAlign = "right";
  ctx.fillText("公転 " + (planet.orbitAngle * 180 / Math.PI).toFixed(0) + "°", width - 17, height - 14);
  ctx.restore();
}
export function drawOrbit(canvas, planet) {
  const ctx = canvas.getContext("2d"); if (!ctx) return;
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  const cx = w / 2, cy = h / 2, rx = w * .39, ry = h * .33;
  ctx.strokeStyle = "#587894"; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU); ctx.stroke();
  ctx.shadowColor = "#f6c45f"; ctx.shadowBlur = 18;
  ctx.fillStyle = "#ffcc69"; ctx.beginPath(); ctx.arc(cx, cy, 12, 0, TAU); ctx.fill(); ctx.shadowBlur = 0;
  const a = planet.orbitAngle, px = cx + rx * Math.cos(a), py = cy + ry * Math.sin(a);
  ctx.fillStyle = "#58c0e0"; ctx.beginPath(); ctx.arc(px, py, 7, 0, TAU); ctx.fill();
  ctx.fillStyle = "#b7d7ea"; ctx.font = "12px system-ui"; ctx.fillText("恒星", cx + 17, cy + 4);
  ctx.fillText("惑星", px + 12, py - 6);
}
function drawTree(ctx, x, y, scale, stage) {
  ctx.lineWidth = Math.max(1, 4 * scale);
  ctx.strokeStyle = "#614c31";
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 28 * scale); ctx.stroke();
  ctx.fillStyle = stage === "seedling" ? "#abd17f" : "#447d4f";
  for (const [dx, dy, r] of [[-8,-29,14],[9,-26,13],[0,-38,14]]) {
    ctx.beginPath(); ctx.arc(x + dx * scale, y + dy * scale, r * scale, 0, TAU); ctx.fill();
  }
}
export function drawEcology(canvas, ecology, weatherState, planet) {
  const ctx = canvas.getContext("2d"); if (!ctx) return;
  const w = canvas.width, h = canvas.height;
  const light = planet.illumination(32, 34);
  const night = light < .12;
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, night ? "#0c1937" : "#7aaaca");
  sky.addColorStop(1, night ? "#405568" : "#deeddf");
  ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = night ? "#344859" : "#92ab9c";
  ctx.beginPath(); ctx.moveTo(0, h * .69);
  for (let x = 0; x <= w + 12; x += 12) ctx.lineTo(x, h * (.47 + .06 * Math.sin(x / 65) + .045 * Math.cos(x / 21)));
  ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.fill();
  ctx.fillStyle = night ? "#354d3c" : "#719b64";
  ctx.fillRect(0, h * .72, w, h * .28);
  function groundX(v) { return ((v + 210) / 420) * w; }
  ctx.fillStyle = night ? "#215d80" : "#5db6c8";
  const waterStart = groundX(112);
  ctx.fillRect(waterStart, h * .75, w - waterStart, h * .25);
  ctx.strokeStyle = "#c9eaf0"; ctx.lineWidth = 2;
  for (let k = 0; k < 6; k++) {
    const px = waterStart + 24 + k * 40;
    ctx.beginPath(); ctx.moveTo(px, h * .81 + k%2 * 8); ctx.lineTo(px + 19, h * .81 + k%2 * 8); ctx.stroke();
  }
  const sorted = [...ecology.plants].sort((a, b) => b.z - a.z);
  for (const p of sorted) {
    const x = groundX(p.x), y = h * (.78 + p.z / 200 * .12);
    if (p.kind === "tree") drawTree(ctx, x, y, p.stage === "adult" ? 1.05 : p.stage === "young" ? .65 : .3, p.stage);
    else {
      ctx.strokeStyle = "#b3d982"; ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.moveTo(x, y);
      ctx.lineTo(x - 4, y - (p.stage === "adult" ? 14 : 6));
      ctx.moveTo(x, y); ctx.lineTo(x + 4, y - (p.stage === "adult" ? 12 : 5)); ctx.stroke();
    }
  }
  for (const c of ecology.creatures) {
    const x = groundX(c.x), y = h * (.78 + c.z / 200 * .12);
    if (c.kind === "fish") {
      ctx.fillStyle = "#ecbb63"; ctx.beginPath(); ctx.ellipse(x, Math.max(h * .8, y + 6), 9, 4, 0, 0, TAU); ctx.fill();
    } else if (c.kind === "animal") {
      ctx.fillStyle = "#a27347"; ctx.beginPath(); ctx.ellipse(x, y - 8, 12, 6, 0, 0, TAU); ctx.fill();
      ctx.fillRect(x - 8, y - 7, 3, 11); ctx.fillRect(x + 6, y - 7, 3, 11);
    } else {
      ctx.fillStyle = "#f5c69c"; ctx.beginPath(); ctx.arc(x, y - 24, 7, 0, TAU); ctx.fill();
      ctx.fillStyle = "#345a80"; ctx.fillRect(x - 5, y - 18, 10, 17);
    }
  }
  const intensity = weatherState.precipitationIntensity;
  if (intensity > 0) {
    const snow = weatherState.precipitation === "snow";
    const count = Math.round(intensity * 85);
    for (let i = 0; i < count; i++) {
      const x = (i * 137 + planet.timeDays * (snow ? 130 : 600)) % w;
      const y = (i * 71 + planet.timeDays * (snow ? 210 : 1300)) % h;
      ctx.strokeStyle = snow ? "#e7f3ff" : "#aed7ec";
      ctx.fillStyle = "#e7f3ff";
      if (snow) { ctx.beginPath(); ctx.arc(x, y, 1.7, 0, TAU); ctx.fill(); }
      else { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 5, y + 10); ctx.stroke(); }
    }
  }
  ctx.fillStyle = night ? "#edf3fa" : "#244354"; ctx.font = "bold 14px system-ui";
  ctx.fillText("湿地テスト区画 · 人 / シカ / 魚 / 樹木 / 草", 15, 25);
}
export function drawBallistics(canvas, ballistics) {
  const ctx = canvas.getContext("2d"); if (!ctx) return;
  const w = canvas.width, h = canvas.height;
  ctx.fillStyle = "#ecf4fa"; ctx.fillRect(0, 0, w, h);
  const originX = 37, floor = h - 35;
  const maxRange = 230, maxHeight = 85;
  const sx = (w - 62) / maxRange, sy = (h - 75) / maxHeight;
  ctx.strokeStyle = "#b4c6cf"; ctx.lineWidth = 1;
  for (let x = 0; x <= maxRange; x += 25) {
    const xp = originX + x * sx;
    ctx.beginPath(); ctx.moveTo(xp, 24); ctx.lineTo(xp, floor); ctx.stroke();
    ctx.fillStyle = "#5b7280"; ctx.font = "10px system-ui"; ctx.fillText(x + "m", xp - 9, h - 15);
  }
  ctx.strokeStyle = "#477e57"; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(15, floor); ctx.lineTo(w-12, floor); ctx.stroke();
  for (const p of ballistics.projectiles) {
    ctx.strokeStyle = p.kind === "stone" ? "#88633d" : "#ae5274";
    ctx.lineWidth = 2.5; ctx.beginPath();
    p.trail.forEach(([x, y], i) => {
      const px = originX + x * sx, py = floor - y * sy;
      if (!i) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    });
    ctx.stroke();
    ctx.fillStyle = p.kind === "stone" ? "#926d48" : "#c84f6a";
    ctx.beginPath(); ctx.arc(originX + p.x * sx, floor - p.y * sy, 4, 0, TAU); ctx.fill();
  }
  ctx.fillStyle = "#31566c"; ctx.font = "13px system-ui";
  ctx.fillText("重力 " + ballistics.gravity.toFixed(2) + " m/s²　　石=茶 / 矢=赤", 15, 19);
}