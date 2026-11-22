import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {VoyageLog,seaDistance,planetCircumference} from "../planet-explorer/circumnavigation.mjs";
import {ShipFishing,SHIP_FURNITURE,FISH_CATALOG} from "../planet-explorer/ship-life.mjs";
import {shipCabinGeometry,CABIN_FURNITURE} from "../planet-explorer/ship-cabin-geometry.mjs";
import {MarineWorld} from "../planet-explorer/marine.mjs";
import {ExplorerController} from "../planet-explorer/controller.mjs";
import {geoOffset} from "../planet-explorer/geo.mjs";

const radius=6371000;
function coast(){
 const planet={seed:77,radiusM:radius,gravity:9.8};
 return {planet,sample(lat,lon){
  const water=lon>0;
  return {water,river:false,elevationM:water?0:150,category:water?"ocean":"plain"};
 }};
}
function actor(t=coast()){
 const c=new ExplorerController(t,{startLat:0,startLon:-.01});
 c.altitudeM=2.5;c.targetAltitudeM=2.5;return c;
}
function offshore(t=coast()){
 const c=actor(t),m=new MarineWorld();
 c.setLanding(0,.03,{allowWater:true});
 assert.equal(m.spawnLandingShip(c,t).ok,true);
 return {c,m,t};
}
test("cabin entry attaches to a moving ship, uses furnishings and disallows overboard jumping from bedroom",()=>{
 const {c,m,t}=offshore();
 assert.equal(m.enterCabin().ok,true);
 assert.equal(m.cabinId,m.boardedId);
 for(const key of Object.keys(SHIP_FURNITURE))assert.equal(m.cabinUse(key).ok,true,key);
 assert.equal(m.leave(c,t).ok,false);
 assert.equal(m.castLine(c,t).ok,false,"fishing is a deck activity");
 assert.equal(m.setCruise(true).ok,true);
 assert.equal(m.setSails(.75).ok,true);
 const x=c.x,z=c.z;
 c.boatSpeed=m.sailingSpeed();c.update(.1,{forward:1});
 m.update(.1,c,t);
 assert.ok(Math.hypot(c.x-x,c.z-z)>.2);
 assert.equal(m.cabinId,m.boardedId);
 const restored=new MarineWorld(m.snapshot());
 assert.equal(restored.cabinId,restored.boardedId);
 assert.equal(restored.cabinActivity,"kitchen");
 assert.equal(restored.boarded.cruise,true);
 assert.equal(m.exitCabin().ok,true);
 assert.equal(m.leave(c,t).ok,true);
 assert.equal(m.cabinId,null);
});
test("fishing advances only with supplied simulation dt and gives exactly one fish per reel",()=>{
 const {c,m,t}=offshore();
 assert.equal(m.castLine(c,t).ok,true);
 assert.equal(m.castLine(c,t).ok,false);
 const elapsed=m.fishing.elapsed;
 m.tickFishing(0,77);assert.equal(m.fishing.elapsed,elapsed);
 let bite=null;
 for(let i=0;i<400&&!bite;i++)bite=m.tickFishing(.1,77);
 assert.equal(bite?.kind,"bite");
 assert.ok(Object.hasOwn(FISH_CATALOG,m.fishing.hook));
 const bag={fish:0},catch1=m.reelFish(bag);
 assert.equal(catch1.ok,true);
 assert.equal(bag.fish,1);
 assert.equal(bag[catch1.kind],undefined,"do not credit a duplicate typed fish item");
 assert.equal(m.reelFish(bag).ok,false);
 assert.equal(m.fishing.caught,1);
 const saved=new MarineWorld(m.snapshot());
 assert.equal(saved.fishing.caught,1);
 assert.equal(saved.fishing.lastCatch,catch1.kind);
 assert.equal(saved.fishing.history.length,1);
 assert.equal(saved.fishing.history[0].kind,catch1.kind);
});
test("hooked fish eventually escape unless reeled in and fishing state saves",()=>{
 const f=new ShipFishing();
 assert.ok(f.cast({aboard:true}).ok);
 let bite=null;for(let i=0;i<160&&!bite;i++)bite=f.advance(.1,15);
 assert.equal(bite?.kind,"bite");
 const saved=new ShipFishing(JSON.parse(JSON.stringify(f.snapshot())));
 assert.ok(saved.hook);
 const elapsed=saved.hookLeft;
 saved.advance(0);
 assert.equal(saved.hookLeft,elapsed);
 let lost=null;for(let i=0;i<350&&!lost;i++)lost=saved.advance(.1);
 assert.equal(lost?.kind,"lost");
 assert.equal(saved.reel({fish:0}).ok,false);
 assert.equal(saved.cast({inCabin:true,aboard:true}).ok,false);
});
test("shore casting works but open-water swimmers cannot fish",()=>{
 const t=coast(),c=actor(t),m=new MarineWorld();
 c.setLanding(0,-.00008);
 assert.ok(m.castLine(c,t).ok);
 m.stopFishing();
 c.setLanding(0,.01,{allowWater:true});
 assert.equal(m.castLine(c,t).ok,false);
});
test("ship cabin mesh contains furnishings, all with finite indexed triangles",()=>{
 assert.deepEqual(Object.keys(SHIP_FURNITURE).sort(),
  CABIN_FURNITURE.filter(f=>f.kind!=="lamp").map(f=>f.kind).sort());
 const mesh=shipCabinGeometry();
 assert.ok(mesh.indices.length>100);
 assert.equal(mesh.positions.length,mesh.normals.length);
 assert.equal(mesh.positions.length,mesh.colors.length);
 assert.ok(mesh.positions.every(Number.isFinite));
 assert.ok(mesh.indices.every(i=>i>=0&&i<mesh.positions.length/3));
});
test("geodesic progression crosses +180/-180 cleanly and records an actual planet-wide return",()=>{
 const voyage=new VoyageLog(null,{lat:0,lon:179.3});
 let complete=false;
 const circumference=planetCircumference(radius);
 for(let i=1;i<=1440;i++){
  const next=geoOffset(0,179.3,circumference*i/1440,0,radius);
  if(voyage.advance(next.lat,next.lon,radius))complete=true;
 }
 const p=voyage.progress(radius);
 assert.equal(complete,true);
 assert.equal(p.laps,1);
 assert.ok(Math.abs(p.distanceM-circumference)<2000);
 assert.ok(Math.abs(p.longitudeTurns-1)<1e-6);
 assert.ok(p.fromStartM<100);
 const resumed=new VoyageLog(voyage.snapshot());
 assert.equal(resumed.laps,1);
 assert.ok(Math.abs(resumed.longitudeTurns-1)<1e-6);
 assert.ok(seaDistance({lat:0,lon:179.99},{lat:0,lon:-179.99},radius)<3000);
});
test("full live MarineWorld voyage preserves ship identity through longitude wrap and homecoming",()=>{
 const t=coast(),{c,m}=offshore(t);
 const id=m.boardedId,original={lat:c.lat,lon:c.lon};
 const circumference=planetCircumference(radius);
 let laps=0;
 for(let i=1;i<=1024;i++){
  const next=geoOffset(c.origin.lat,c.origin.lon,circumference*i/1024,0,radius);
  c.x=circumference*i/1024;c.z=0;c.lat=next.lat;c.lon=next.lon;
  m.update(.1,c,t);
  if(m.justCompletedLap)laps++;
 }
 assert.equal(laps,1);
 assert.equal(m.voyage.laps,1);
 assert.equal(m.boardedId,id);
 assert.ok(seaDistance(original,{lat:c.lat,lon:c.lon},radius)<2);
 assert.ok(m.nearby(c,5).some(b=>b.id===id));
});
test("short coastal trips and artificial teleports cannot fake globe circumnavigation",()=>{
 const start={lat:0,lon:10},v=new VoyageLog(null,start);
 for(let i=0;i<100;i++){
  const delta=.0001*(i%2===0?1:0);
  v.advance(0,10+delta,radius);
 }
 assert.equal(v.laps,0);
 assert.ok(v.distanceM<planetCircumference(radius)*.8);
 v.advance(0,-151,radius);
 assert.equal(v.laps,0);
 assert.equal(v.distanceM,0,"teleport resets voyage");
});
test("boats remain nearby after the player travels a full circumference in local metres",()=>{
 const t=coast(),{c,m}=offshore(t);
 const start={lat:c.lat,lon:c.lon},C=planetCircumference(radius);
 c.x=C;c.z=0;
 const p=c.locationAt(c.x,c.z);
 c.lat=p.lat;c.lon=p.lon;
 const boats=m.nearby(c,15);
 assert.equal(boats.length,1);
 assert.ok(boats[0].range<1);
 assert.ok(Math.abs(boats[0].x-c.x)<1);
 assert.ok(Math.abs(c.lon-start.lon)<1e-4);
});
test("game entrypoints expose living quarters, fishing and voyage progress",()=>{
 const base=new URL("../planet-explorer/",import.meta.url);
 const html=readFileSync(new URL("index.html",base),"utf8");
 const app=readFileSync(new URL("app.mjs",base),"utf8");
 const render=readFileSync(new URL("render.mjs",base),"utf8");
 for(const id of ["marine-cabin-controls","marine-cabin-toggle","marine-cabin-furniture",
  "marine-cabin-status","marine-fishing-controls","marine-fish-cast",
  "marine-fish-reel","marine-fish-stop","marine-fishing-status",
  "marine-voyage-controls","marine-voyage-status","marine-voyage-progress"])
  assert.match(html,new RegExp('id="'+id+'"'),id);
 for(const key of ["marine.enterCabin()","marine.exitCabin()","marine.reelFish(actions.resources)",
   "marine.castLine(controller,terrain)","marine.voyage.progress(terrain.planet.radiusM)"])
  assert.ok(app.includes(key),key);
 assert.ok(render.includes("drawShipCabin(vp,light,s,waterY)"));
 assert.ok(render.includes("pickMarineFurniture(clientX,clientY)"));
 assert.ok(render.includes("drawFishingActivity(vp,light,s,waterY)"));
 assert.match(app,/life\.advance\(dt,marine\?\.cabinId\?false:controller\.moving\)/);
});
