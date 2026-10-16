import {noise3} from "../planet/planet-core.mjs";

/** Coordinates and terrain queries shared by orbital and ground views.
 * Native planet latitude/longitude and metres; all render-scale decisions are adapters.
 */
export const DEG = Math.PI / 180;
export const RAD = 180 / Math.PI;
export const EARTH_RADIUS_M = 6371000;
export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const wrapLon = lon => ((((lon + 180) % 360) + 360) % 360) - 180;
export function geoNormal(lat, lon) {
  const a = lat * DEG, b = lon * DEG;
  return [Math.cos(a) * Math.cos(b), Math.sin(a), Math.cos(a) * Math.sin(b)];
}
export function eastNorthUp(lat, lon) {
  const a = lat * DEG, b = lon * DEG;
  return {
    east: [-Math.sin(b), 0, Math.cos(b)],
    north: [-Math.sin(a)*Math.cos(b), Math.cos(a), -Math.sin(a)*Math.sin(b)],
    up: geoNormal(lat, lon)
  };
}
export function geoToWorld(lat, lon, altitudeM, planetRadiusM = EARTH_RADIUS_M) {
  if (![lat,lon,altitudeM,planetRadiusM].every(Number.isFinite) || Math.abs(lat)>90 || planetRadiusM<=0) throw new RangeError("Invalid geo coordinate");
  const n = geoNormal(lat, lon), r = planetRadiusM + altitudeM;
  return n.map(v=>v*r);
}
export function geoOffset(lat, lon, eastM, northM, radiusM = EARTH_RADIUS_M) {
  if (![lat,lon,eastM,northM,radiusM].every(Number.isFinite) || Math.abs(lat)>90 || radiusM<=0) throw new RangeError("Invalid geo offset");
  // Exact great-circle exponential map, stable at high latitude and dateline.
  const basis = eastNorthUp(lat,lon), distance = Math.hypot(eastM,northM);
  if (distance === 0) return { lat, lon: wrapLon(lon) };
  const theta = distance / radiusM, ne = eastM/distance, nn = northM/distance;
  const v = basis.up.map((c,i)=>c*Math.cos(theta)+(basis.east[i]*ne+basis.north[i]*nn)*Math.sin(theta));
  return {lat: Math.asin(clamp(v[1],-1,1))*RAD, lon: wrapLon(Math.atan2(v[2],v[0])*RAD)};
}
export function geoLocal(originLat, originLon, lat, lon, radiusM=EARTH_RADIUS_M) {
  const center=geoNormal(originLat,originLon), end=geoNormal(lat,lon), basis=eastNorthUp(originLat,originLon);
  const theta=Math.acos(clamp(center.reduce((s,v,i)=>s+v*end[i],0),-1,1));
  if(theta<1e-12) return {eastM:0,northM:0};
  const tangent=end.map((v,i)=>v-center[i]*Math.cos(theta));
  const mag=Math.hypot(...tangent);
  return {eastM:radiusM*theta*tangent.reduce((s,v,i)=>s+v*basis.east[i],0)/mag,
    northM:radiusM*theta*tangent.reduce((s,v,i)=>s+v*basis.north[i],0)/mag};
}
export function findLand(terrain, lat=28,lon=42) {
  // One deterministic target near the requested starting region, no arbitrary teleport during movement.
  for(let ring=0; ring<=18; ring++) {
    for(let i=0; i<48;i++){
      const latitude=clamp(lat+Math.sin(i*2*Math.PI/48)*ring*3.3,-79,79);
      const longitude=wrapLon(lon+Math.cos(i*2*Math.PI/48)*ring*5.2);
      const v=terrain.sample(latitude,longitude);
      if(!v.water && !v.river && v.elevationM>120 && v.elevationM<1700)
        return {lat:latitude,lon:longitude,elevationM:v.elevationM};
    }
  }
  throw new Error("No suitable land found; change seed or starting location.");
}
/** One authoritative height sampler for both sphere and high-detail ground meshes.
 * Fine details are spherical noise: no seam at the longitude wrap or tile border.
 */
export function terrainSurface(terrain,lat,lon){
  const base=terrain.sample(lat,lon);
  if(base.water)return {...base,elevationM:0};
  const n=geoNormal(lat,lon),seed=terrain.planet.seed;
  const detail=noise3(n[0]*16000,n[1]*16000,n[2]*16000,seed+207)*9 +
    noise3(n[0]*76000,n[1]*76000,n[2]*76000,seed+318)*1.2;
  const taper=clamp(base.elevationM/35,0,1);
  return {...base,elevationM:Math.max(.1,base.elevationM+detail*taper)};
}
export function samplePatch(terrain, lat, lon, radiusM, resolution=48) {
  if(!Number.isFinite(radiusM)||radiusM<15||radiusM>150000||!Number.isSafeInteger(resolution)||resolution<4||resolution>128) throw new RangeError("Invalid patch resolution or radius");
  const vertices=[], colors=[], normals=[], indices=[], heights=[];
  const R=terrain.planet.radiusM;
  for(let j=0;j<=resolution;j++){
    const northM=radiusM*(1-2*j/resolution);
    for(let i=0;i<=resolution;i++){
      const eastM=radiusM*(2*i/resolution-1);
      const geo=geoOffset(lat,lon,eastM,northM,R);
      const s=terrainSurface(terrain,geo.lat,geo.lon);
      const h=s.water ? 0 : s.elevationM;
      vertices.push(eastM,h,northM); heights.push(h);
      const c=s.water?[0.09,0.36,0.62] :
        s.elevationM>2400?[0.85,0.86,0.83] :
        s.elevationM>1550?[0.47,0.46,0.41] :
        s.elevationM<85?[0.75,0.70,0.48] :
        s.category==="forest"?[0.16,0.40,0.20] :
        s.category==="valley"?[0.36,0.56,0.26]:[0.33,0.50,0.27];
      colors.push(...c);
    }
  }
  const d=2*radiusM/resolution;
  for(let j=0;j<=resolution;j++){
    for(let i=0;i<=resolution;i++){
      const idx=j*(resolution+1)+i;
      const hL=heights[j*(resolution+1)+Math.max(i-1,0)];
      const hR=heights[j*(resolution+1)+Math.min(i+1,resolution)];
      const hN=heights[Math.max(j-1,0)*(resolution+1)+i];
      const hS=heights[Math.min(j+1,resolution)*(resolution+1)+i];
      const nx=(hL-hR)/(2*d), nz=(hS-hN)/(2*d);
      const len=Math.hypot(nx,1,nz);
      normals.push(nx/len,1/len,nz/len);
    }
  }
  for(let j=0;j<resolution;j++) for(let i=0;i<resolution;i++){
    const a=j*(resolution+1)+i,b=a+1,c=a+resolution+1,e=c+1;
    // Indices are two-sided in ground view (culling disabled).
    indices.push(a,c,b,b,c,e);
  }
  return {vertices:new Float32Array(vertices),normals:new Float32Array(normals),
    colors:new Float32Array(colors), indices:new Uint16Array(indices),
    center:{lat,lon},radiusM,resolution,vertexCount:vertices.length/3};
}
