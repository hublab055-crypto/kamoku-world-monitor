import { clamp, noise3, normalAt } from "./planet-core.mjs";

/** Lightweight climate approximation. Values are illustrative, not meteorological forecasts. */
export class Weather {
  constructor(planet) { this.planet = planet; }
  sample(latitude, longitude, elevationM = 0, timeDays = this.planet.timeDays) {
    if (![latitude, longitude, elevationM, timeDays].every(Number.isFinite)) throw new TypeError("Invalid climate coordinates.");
    const n = normalAt(latitude, longitude);
    const phase = timeDays / this.planet.orbitDays * 2 * Math.PI;
    const seasonal = Math.sin(phase) * Math.sign(latitude || 1) * 12 *
      Math.sin(Math.abs(latitude) * Math.PI / 180);
    const mean = 30 - Math.abs(latitude) * 0.62 -
      Math.max(0, elevationM) * 0.0065 + seasonal;
    // Approximate local solar hour, differing by longitude and planetary rotation.
    const timeOfDay = (timeDays * 24 / this.planet.rotationHours + longitude / 360) % 1;
    const diurnal = 5 * Math.cos(2 * Math.PI * (timeOfDay - 0.58));
    const temperatureC = Math.round((mean + diurnal) * 10) / 10;
    const drift = timeDays * 0.12;
    const cloudNoise = noise3(n.x * 5 + drift, n.y * 5 + drift * .3, n.z * 5 - drift * .55, this.planet.seed + 200);
    const cloudCover = clamp(0.55 + cloudNoise * 0.65, 0, 1);
    const moisture = clamp(1 - Math.abs(latitude) / 105 + noise3(n.x * 3, n.y * 3, n.z * 3, this.planet.seed + 401) * .5, 0, 1);
    const precipitation = cloudCover > .68 && moisture > .36
      ? (temperatureC <= 1 ? "snow" : "rain") : "none";
    return { temperatureC, cloudCover, moisture, precipitation,
      precipitationIntensity: precipitation === "none" ? 0 : clamp((cloudCover - .67) * 3, 0, 1) };
  }
  conditionsAtLocal(x, z, timeDays = this.planet.timeDays) {
    const latitude = 32 + z * .00007, longitude = 34 + x * .00007;
    const state = this.sample(latitude, longitude, 300, timeDays);
    return state;
  }
}