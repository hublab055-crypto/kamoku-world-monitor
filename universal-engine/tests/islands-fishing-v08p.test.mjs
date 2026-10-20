import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {Planet} from "../planet/planet-core.mjs";
import {Terrain} from "../planet/terrain-engine.mjs";
import {islandCenters,islandHeight} from "../planet/island-archipelago.mjs";
import {globeIslandGeometry} from "../planet-explorer/island-visuals.mjs";
import {MarineWorld} from "../planet-explorer/marine.mjs";
import {ShipFishing} from "../planet-explorer/ship-life.mjs";
import {samplePose} from "../planet-explorer/rig.mjs";

const planet=new Planet({seed:77,name:"Terra Nova"}),terrain=new Terrain(planet);
test("island chain is deterministic, rare, physical, and geographically consistent",()=>{
 const centers=islandCenters(planet.seed),repeat=islandCenters(planet.seed);
 assert.deepEqual(centers,repeat);
 assert.ok(centers.length>50&&centers.length<550,centers.length);
 const inhabitable=centers.filter(i=>terrain.sample(i.lat,i.lon).category==="island");
 assert.ok(inhabitable.length>5,inhabitable.length);
 const site=inhabitable[0],land=terrain.sample(site.lat,site.lon);
 assert.equal(land.water,false);
 assert.equal(land.river,false);
 assert.ok(land.elevationM>0);
 assert.ok(islandHeight(planet.seed,site.lat,site.lon,planet.radiusM)>0);
 assert.equal(islandHeight(planet.seed,site.lat,site.lon+15,planet.radiusM),0);
});
test("global orbital island mesh uses exactly the walkable island positions",()=>{
 const globe=globeIslandGeometry(terrain,600);
 assert.ok(globe.indices.length>100);
 assert.equal(globe.positions.length,globe.colors.length);
 assert.equal(globe.positions.length,globe.normals.length);
 assert.ok(globe.indices.every(i=>i>=0&&i<globe.positions.length/3));
 assert.ok(globe.positions.every(Number.isFinite));
});
test("island radar detects buildable island when standing on it, without spawning ships",()=>{
 const site=islandCenters(planet.seed).find(s=>terrain.sample(s.lat,s.lon).category==="island");
 const m=new MarineWorld(),c={lat:site.lat,lon:site.lon,terrain};
 assert.equal(m.findNearestIsland(c,terrain).ok,true);
 assert.equal(m.findNearestIsland(c,terrain).distanceM,0);
 assert.equal(m.boats.length,0);
 assert.ok(m.ownedGear.includes("scuba"));
 assert.equal(m.diveGear,"none","the aqualung is initially held, not worn");
 const restored=new MarineWorld(m.snapshot());
 assert.ok(restored.ownedGear.includes("scuba"));
});
test("cast-power gauge changes fishing distance and fish visibly approaches before hit",()=>{
 const low=new ShipFishing(),high=new ShipFishing();
 assert.equal(low.cast({aboard:true,power:.1}).ok,true);
 assert.equal(high.cast({aboard:true,power:1}).ok,true);
 assert.ok(high.lineOutM>low.lineOutM+15);
 assert.equal(low.cast({aboard:true}).ok,false);
 low.advance(1,77);assert.ok(low.approach>0);
 const prior=low.approach;low.advance(1,77);
 assert.ok(low.approach>prior);
 assert.ok(low.castMotion>0);
});
test("dial retrieves an empty line without a hooked fish, never grants fish",()=>{
 const f=new ShipFishing(),bag={fish:0};
 assert.ok(f.cast({water:true,power:.1}).ok);
 let result=null;
 for(let i=0;i<20&&f.casting;i++)result=f.turnReel(Math.PI*2,bag);
 assert.equal(result?.kind,"empty");
 assert.equal(bag.fish,0);
 assert.equal(f.caught,0);
 assert.equal(f.casting,false);
});
test("dial catches one real hooked fish and persists reel state",()=>{
 const fish=new ShipFishing(),bag={fish:0};
 assert.ok(fish.cast({aboard:true,power:.6}).ok);
 let evt=null;
 for(let i=0;i<250&&!evt;i++)evt=fish.advance(.1,77);
 assert.equal(evt?.kind,"bite");
 const saved=new ShipFishing(fish.snapshot());
 assert.ok(saved.hook);
 let caught=null;
 for(let i=0;i<40&&fish.casting;i++){
  const r=fish.turnReel(Math.PI*2,bag);
  if(r.ok&&r.kind!=="reeling")caught=r;
 }
 assert.ok(caught?.ok);
 assert.equal(bag.fish,1);
 assert.equal(fish.caught,1);
 assert.equal(fish.turnReel(Math.PI,bag).ok,false);
});
test("rod-casting and reeling joint animation differs from idle",()=>{
 const idle=samplePose();
 const cast=samplePose({action:"fish",progress:.5});
 const crank=samplePose({action:"fish",progress:2});
 assert.notEqual(cast.rightShoulderX,idle.rightShoulderX);
 assert.notEqual(crank.leftElbowX,idle.leftElbowX);
});
test("island radar, casting gauge, reel dial, starter aqualung and globe renderer are wired",()=>{
 const root=new URL("../planet-explorer/",import.meta.url);
 const html=readFileSync(new URL("index.html",root),"utf8");
 const app=readFileSync(new URL("app.mjs",root),"utf8");
 const render=readFileSync(new URL("render.mjs",root),"utf8");
 const marine=readFileSync(new URL("marine.mjs",root),"utf8");
 for(const id of ["marine-island-status","marine-find-island","marine-fish-power",
  "marine-fish-power-label","marine-reel-dial","marine-fish-distance","marine-fish-phase"]){
  assert.ok(html.includes('id="'+id+'"'),id);
  assert.ok(app.includes('"'+id+'"'),id+" app");
 }
 assert.match(render,/globeIslandGeometry/);
 assert.match(render,/drawMesh\(this\.globeIslands/);
 assert.match(marine,/\["none","scuba"/);
});
