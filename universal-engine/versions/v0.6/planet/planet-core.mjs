/**
 * Universal Engine - planet foundations. Units: m, s, and simulated Earth-days.
 * No DOM, network, or dependency on any existing game or Kamoku Monitor.
 */
export const TAU = Math.PI * 2;
export const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export function hash3(x, y, z, seed = 1) {
  let h = Math.imul((x | 0) ^ (seed | 0), 374761393);
  h = Math.imul(h ^ Math.imul(y | 0, 668265263), 2246822519);
  h = Math.imul(h ^ Math.imul(z | 0, 1274126177), 3266489917);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
export function noise3(x, y, z, seed = 1) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = x - ix, fy = y - iy, fz = z - iz;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
  function a(az) {
    const a0 = lerp(hash3(ix, iy, az, seed), hash3(ix + 1, iy, az, seed), u);
    const a1 = lerp(hash3(ix, iy + 1, az, seed), hash3(ix + 1, iy + 1, az, seed), u);
    return lerp(a0, a1, v);
  }
  return lerp(a(iz), a(iz + 1), w) * 2 - 1;
}
export function normalAt(latitude, longitude) {
  const lat = latitude * Math.PI / 180, lon = longitude * Math.PI / 180;
  return { x: Math.cos(lat) * Math.cos(lon), y: Math.sin(lat), z: Math.cos(lat) * Math.sin(lon) };
}
export function rotateY(p, angle) {
  const c = Math.cos(angle), s = Math.sin(angle);
  return { x: c * p.x + s * p.z, y: p.y, z: -s * p.x + c * p.z };
}
export function rotateX(p, angle) {
  const c = Math.cos(angle), s = Math.sin(angle);
  return { x: p.x, y: c * p.y - s * p.z, z: s * p.y + c * p.z };
}
export function dot(a, b) { return a.x * b.x + a.y * b.y + a.z * b.z; }
function valid(value, name, min = 0) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min) {
    throw new TypeError(name + " must be finite and >= " + min);
  }
  return value;
}
export class Planet {
  constructor({ id = "terra", name = "Terra Nova", seed = 42,
    radiusM = 6371000, gravity = 9.81, rotationHours = 24,
    orbitDays = 365.25, axialTiltDeg = 23.4, oceanLevel = 0,
    timeDays = 0 } = {}) {
    if (typeof id !== "string" || !/^[a-z][a-z0-9_-]{0,39}$/.test(id)) throw new TypeError("Invalid planet ID.");
    if (!Number.isSafeInteger(seed)) throw new TypeError("Invalid seed.");
    valid(radiusM, "radiusM", 1);
    valid(gravity, "gravity");
    valid(rotationHours, "rotationHours", 0.001);
    valid(orbitDays, "orbitDays", 0.001);
    valid(timeDays, "timeDays");
    if (!Number.isFinite(axialTiltDeg) || Math.abs(axialTiltDeg) > 90) throw new TypeError("Invalid axial tilt.");
    if (!Number.isFinite(oceanLevel)) throw new TypeError("Invalid ocean level.");
    Object.assign(this, { id, name: String(name), seed, radiusM, gravity, rotationHours, orbitDays,
      axialTiltDeg, oceanLevel, timeDays });
  }
  get rotationAngle() { return (this.timeDays * 24 / this.rotationHours * TAU) % TAU; }
  get orbitAngle() { return (this.timeDays / this.orbitDays * TAU) % TAU; }
  get season() { return (this.timeDays / this.orbitDays) % 1; }
  get solarDirection() {
    // Star at the origin; planet centre at (+cos orbit, 0, +sin orbit).
    return { x: -Math.cos(this.orbitAngle), y: 0, z: -Math.sin(this.orbitAngle) };
  }
  surfaceNormal(latitude, longitude) {
    return rotateY(rotateX(normalAt(latitude, longitude), this.axialTiltDeg * Math.PI / 180), this.rotationAngle);
  }
  illumination(latitude, longitude) {
    return Math.max(0, dot(this.surfaceNormal(latitude, longitude), this.solarDirection));
  }
  advance(days) { valid(days, "days"); this.timeDays += days; return this.timeDays; }
  snapshot() {
    return {
      format: "ue/planet", version: 1, id: this.id, name: this.name, seed: this.seed,
      radiusM: this.radiusM, gravity: this.gravity, rotationHours: this.rotationHours,
      orbitDays: this.orbitDays, axialTiltDeg: this.axialTiltDeg,
      oceanLevel: this.oceanLevel, timeDays: this.timeDays
    };
  }
  static fromSnapshot(data) {
    if (data?.format !== "ue/planet" || data.version !== 1) throw new Error("Unsupported planet snapshot.");
    return new Planet(data);
  }
}