import { clamp, noise3, normalAt } from "./planet-core.mjs";
import {islandHeight} from "./island-archipelago.mjs?v=0.8p-islands";

/** Sampled procedural terrain. Height is relative to mean sea level, in metres. */
export class Terrain {
  constructor(planet) {
    if (!planet || !Number.isSafeInteger(planet.seed)) throw new TypeError("A Planet is required.");
    this.planet = planet;
  }
  sample(latitude, longitude) {
    if (!Number.isFinite(latitude) || Math.abs(latitude) > 90 || !Number.isFinite(longitude)) {
      throw new RangeError("Latitude must be -90..90 and longitude finite.");
    }
    const p = normalAt(latitude, longitude), seed = this.planet.seed;
    const a = noise3(p.x * 2.1 + 3.4, p.y * 2.1, p.z * 2.1 - 1.8, seed);
    const b = noise3(p.x * 4.5, p.y * 4.5 + 7, p.z * 4.5, seed + 7);
    const c = noise3(p.x * 11 + 4, p.y * 11, p.z * 11, seed + 29);
    const continent = a * 0.85 + b * 0.29 + 0.14 * Math.cos(longitude * Math.PI / 115) -
      0.045 - this.planet.oceanLevel;
    let heightM;
    if (continent <= 0) {
      heightM = -60 - Math.min(1, -continent) * 4700;
    } else {
      const mountains = Math.pow(Math.abs(c), 1.8) * Math.max(0, continent - 0.035) * 7000;
      const hill = b * 270 + c * 180;
      heightM = Math.max(2, continent * 2400 + hill + mountains);
    }
    // Real additional land: the same sample drives walking, construction and orbital art.
    const islandM=heightM<0?islandHeight(seed,latitude,longitude,this.planet.radiusM):0;
    if(islandM>0)heightM=islandM;
    const water = heightM < 0;
    // Stylized drainage indicator, not full river flow/erosion routing.
    const channel = Math.min(
      Math.abs((((longitude - (-120 + 11 * Math.sin((latitude + 9) * 0.08)) + 540) % 360) - 180)),
      Math.abs((((longitude - (48 + 13 * Math.sin((latitude - 20) * 0.045)) + 540) % 360) - 180))
    );
    const river = !water && islandM===0 && Math.abs(latitude) < 49 && heightM < 1600 && channel < 0.7;
    const polar = Math.abs(latitude);
    const category = water ? "ocean" :
      islandM>0 ? "island" :
      river ? "river" :
      heightM > 2300 ? "mountain" :
      heightM > 1300 ? "highland" :
      polar > 66 ? "tundra" :
      heightM < 100 ? "coast" :
      c < -0.19 ? "valley" : (a + b > 0.12 ? "forest" : "plains");
    return { latitude, longitude, elevationM: heightM, water, river, category };
  }
  /**
   * Small, playable terrain patch in local metres. An example wetland stream crosses
   * the eastern portion. It is a demonstration microhabitat, not a planet-wide mesh.
   */
  sampleLocal(x, z) {
    if (!Number.isFinite(x) || !Number.isFinite(z)) throw new TypeError("Local coordinates must be finite.");
    const streamX = 145 + 19 * Math.sin(z / 92);
    const river = Math.abs(x - streamX) < 32;
    const seed = this.planet.seed;
    const y = noise3(x / 145 + 3, z / 145, 2, seed + 111) * 9 +
      noise3(x / 42, z / 42, 4, seed + 72) * 2 +
      0.015 * (x + z);
    return { x, z, elevationM: river ? Math.min(y, -2) : y, water: river,
      category: river ? "river" : y > 8 ? "hill" : "plain" };
  }
  resourceAvailability(x, z) {
    const s = this.sampleLocal(x, z);
    return {
      water: s.water ? 100 : 0,
      soil: s.water ? 8 : 75,
      stone: s.water ? 0 : clamp(Math.round(12 + s.elevationM * 2), 0, 100),
      wood: s.water ? 0 : 65,
      grass: s.water ? 0 : 85
    };
  }
}