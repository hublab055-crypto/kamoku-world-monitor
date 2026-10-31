import {test} from "node:test";
import assert from "node:assert/strict";
import {createCelestialPlanet} from "../planet-explorer/solar-system.mjs";
import {Terrain} from "../planet/terrain-engine.mjs";
import {terrainSurface,samplePatch} from "../planet-explorer/geo.mjs";
import {surfaceShipFrame} from "../planet-explorer/unified-space-frame.mjs";
import {planetRenderPose,shipTerrainTier,curvedShipTerrainGeometry,
 shipSiteRenderFrame,shipPlanetSurfaceGeometry} from "../planet-explorer/ship-planet-view.mjs";

const near=(a,b,tolerance=1e-3)=>assert.ok(Math.abs(a-b)<=tolerance,`${a} ≈ ${b}`);
const same=(a,b,tolerance=1e-3)=>a.forEach((n,i)=>near(n,b[i],tolerance));
const finiteMesh=g=>{
 assert.ok(g.positions.length>0&&g.indices.length>0);
 assert.equal(g.positions.length,g.normals.length);
 assert.equal(g.positions.length,g.colors.length);
 assert.ok(Math.max(...g.indices)<65535);
 assert.ok(Array.from(g.positions).every(Number.isFinite));
};
test("planet angular radius is independent of camera-distance compression",()=>{
 const a=surfaceShipFrame("terra",.24,28,42,120000,0);
 const b=surfaceShipFrame("terra",.24,28,42,300000,0);
 const p=planetRenderPose(a,"terra",.24);
 const q=planetRenderPose(b,"terra",.24);
 near(p.radiusM/Math.hypot(...p.position),Math.sin(p.angularRadiusRad),1e-10);
 near(q.radiusM/Math.hypot(...q.position),Math.sin(q.angularRadiusRad),1e-10);
 assert.ok(q.angularRadiusRad<p.angularRadiusRad);
 const dirA=p.position.map(x=>x/Math.hypot(...p.position));
 assert.ok(dirA[1]<-.99,"own planet is beneath a level ship, not fixed in the forward view");
});
test("near-surface and orbital terrain LOD depend on physical altitude, not stage progress",()=>{
 assert.equal(shipTerrainTier(0).radiusM,650);
 assert.equal(shipTerrainTier(500).radiusM,1850);
 assert.equal(shipTerrainTier(2800).radiusM,6500);
 assert.equal(shipTerrainTier(12000).radiusM,22000);
 assert.equal(shipTerrainTier(60000).radiusM,85000);
 assert.equal(shipTerrainTier(120000),null);
});
test("curved terrain and frame align the actual landing point without height teleport",()=>{
 const planet=createCelestialPlanet("terra",.24), terrain=new Terrain(planet);
 const lat=28,lon=42,s=terrainSurface(terrain,lat,lon);
 const site={bodyId:"terra",lat,lon,yaw:.3,padElevationM:s.elevationM};
 const frame=surfaceShipFrame("terra",.24,lat,lon,s.elevationM+2,.3);
 const m=shipSiteRenderFrame(frame,site,.24);
 same([m[12],m[13],m[14]],[0,0,0],.001);
 const radius=15000,resolution=16;
 const mesh=curvedShipTerrainGeometry(terrain,site,radius,resolution);
 finiteMesh(mesh);
 const planar=samplePatch(terrain,lat,lon,radius,resolution);
 const index=(resolution/2)*(resolution+1)+resolution/2;
 near(mesh.positions[index*3+1],planar.vertices[index*3+1]-s.elevationM-2,.01);
 const edge=resolution/2*(resolution+1);
 const d=radius, R=planet.radiusM,h=planar.vertices[edge*3+1];
 near(mesh.positions[edge*3+1],(R+h)*Math.cos(d/R)-(R+s.elevationM+2),.01);
});
test("high-altitude globe samples the exact same terrain and returns indexed 3D geometry",()=>{
 const planet=createCelestialPlanet("terra",.24), terrain=new Terrain(planet);
 const globe=shipPlanetSurfaceGeometry(terrain,{latSteps:12,lonSteps:24});
 finiteMesh(globe);
 assert.equal(globe.positions.length/3,13*25);
 const polarY=globe.positions[1];
 near(polarY,-1,1e-6);
 assert.ok(globe.colors.some(v=>v<.25));
 assert.ok(globe.colors.some(v=>v>.55));
});
