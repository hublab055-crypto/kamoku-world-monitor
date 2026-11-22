/** Local tangent-plane projectile physics. SI units; +y is up, +x is range.
 * The planet supplies local gravitational acceleration; no artificial parabola
 * animation. Air drag uses a simple linear acceleration model for arrows.
 */
export class Ballistics {
  constructor({ gravity = 9.81, groundY = 0, maxFlightSeconds = 35 } = {}) {
    if (!Number.isFinite(gravity) || gravity < 0 ||
      !Number.isFinite(groundY) || !Number.isFinite(maxFlightSeconds) || maxFlightSeconds <= 0) {
      throw new TypeError("Invalid physics parameters.");
    }
    this.gravity = gravity;
    this.groundY = groundY;
    this.maxFlightSeconds = maxFlightSeconds;
    this.projectiles = [];
    this.nextId = 1;
  }
  launch({ kind = "stone", speed = 24, angleDeg = 48, height = 1.6 } = {}) {
    if (!["stone", "arrow"].includes(kind) ||
      ![speed, angleDeg, height].every(Number.isFinite) ||
      speed <= 0 || speed > 400 || angleDeg < -89 || angleDeg > 89 || height < this.groundY) {
      throw new RangeError("Invalid launch parameters.");
    }
    const rad = angleDeg * Math.PI / 180;
    const p = {
      id: this.nextId++, kind, x: 0, y: height,
      vx: speed * Math.cos(rad), vy: speed * Math.sin(rad),
      elapsed: 0, landed: false, impactX: null, trail: [[0, height]]
    };
    this.projectiles.push(p);
    if (this.projectiles.length > 15) this.projectiles.shift();
    return p;
  }
  /**
   * Semi-implicit Euler with 0.01s steps and segment-ground interpolation.
   * For zero drag, maximum trajectory integration error is bounded by step size.
   */
  advance(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0 || seconds > 10) throw new RangeError("Invalid physics step.");
    let remaining = seconds;
    while (remaining > 1e-10) {
      const dt = Math.min(0.01, remaining);
      remaining -= dt;
      for (const p of this.projectiles) {
        if (p.landed) continue;
        const oldX = p.x, oldY = p.y;
        const linearDrag = p.kind === "arrow" ? 0.012 : 0.005;
        p.vx -= linearDrag * p.vx * dt;
        p.vy -= (this.gravity + linearDrag * p.vy) * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.elapsed += dt;
        if (p.y <= this.groundY) {
          const fraction = (oldY - this.groundY) / (oldY - p.y || 1);
          p.x = oldX + (p.x - oldX) * Math.max(0, Math.min(1, fraction));
          p.y = this.groundY;
          p.landed = true;
          p.impactX = p.x;
        }
        if (p.elapsed >= this.maxFlightSeconds || p.x > 30000) {
          p.landed = true;
          p.impactX = p.x;
        }
        p.trail.push([p.x, p.y]);
        if (p.trail.length > 650) p.trail.shift();
      }
    }
    return this.projectiles;
  }
  static idealRange(speed, angleDeg, gravity = 9.81) {
    if (!Number.isFinite(speed) || speed < 0 || !Number.isFinite(gravity) || gravity <= 0) throw new TypeError("Invalid ideal range parameters");
    return speed * speed * Math.sin(2 * angleDeg * Math.PI / 180) / gravity;
  }
  snapshot() {
    return JSON.parse(JSON.stringify({
      format: "ue/ballistics", version: 1,
      gravity: this.gravity, groundY: this.groundY,
      maxFlightSeconds: this.maxFlightSeconds, nextId: this.nextId,
      projectiles: this.projectiles
    }));
  }
  static fromSnapshot(data) {
    if (data?.format !== "ue/ballistics" || data.version !== 1 ||
      !Array.isArray(data.projectiles)) throw new Error("Invalid ballistics snapshot.");
    const result = new Ballistics(data);
    result.nextId = data.nextId;
    result.projectiles = JSON.parse(JSON.stringify(data.projectiles));
    return result;
  }
}