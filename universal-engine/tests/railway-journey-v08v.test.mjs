import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {Planet} from "../planet/planet-core.mjs";
import {Terrain} from "../planet/terrain-engine.mjs";
import {settlementDestinations} from "../planet-explorer/settlements.mjs";
import {geoLocal} from "../planet-explorer/geo.mjs";
import {railwayStationCoordinates,railwayRoutePosition,railwayJourneyPose,railwayTrackSamples} from "../planet-explorer/railway-world.mjs";
import {trackGeometry,wheelSpokesGeometry,connectingRodGeometry,steamPuffGeometry,locomotiveMotion}
 from "../planet-explorer/railway-animated-geometry.mjs";
import {trainInteriorGeometry} from "../planet-explorer/railway-geometry.mjs";
import {RailwaySystem,trainState} from "../planet-explorer/railway.mjs";
import {railWalk,railTalk,railwayPassengers,carPose} from "../planet-explorer/railway-car-life.mjs";

const at=(day,hour,minute=0)=>day+(hour*60+minute)/1440;
const setup=()=>{
 const planet=new Planet({seed:77,name:"Terra Nova"}),terrain=new Terrain(planet);
 return {terrain,locations:settlementDestinations(terrain)};
};
test("planetary railway joins real station geocoordinates with aligned platform approach",()=>{
 const {terrain,locations}=setup(),R=terrain.planet.radiusM;
 const start=railwayStationCoordinates(terrain,locations,"tower");
 const end=railwayStationCoordinates(terrain,locations,"meadow");
 const a=railwayRoutePosition(terrain,locations,"tower","meadow",0);
 const b=railwayRoutePosition(terrain,locations,"tower","meadow",1);
 assert.ok(Math.hypot(...Object.values(geoLocal(start.lat,start.lon,a.lat,a.lon,R)))<1);
 assert.ok(Math.hypot(...Object.values(geoLocal(end.lat,end.lon,b.lat,b.lon,R)))<1);
 // Train nose and platform rails are both northbound (+Z) at the termini.
 assert.ok(Math.abs(Math.sin(a.yaw))<.08);
 assert.ok(Math.abs(Math.sin(b.yaw))<.08);
 const mid=railwayRoutePosition(terrain,locations,"tower","meadow",.5);
 assert.ok(Math.abs(mid.lat-a.lat)>.01||Math.abs(mid.lon-a.lon)>.01);
});
test("rails retain physical length even during dwell and eased initial acceleration",()=>{
 const {terrain,locations}=setup();
 for(const progress of [0,.0005,.03,.5,.97,.9995,1]){
  const state={mode:"travel",fromStationId:"tower",nextStationId:"meadow",progress,
   segment:{travelMinutes:82}};
  const pose=railwayJourneyPose(terrain,locations,state,at(0,7));
  const samples=railwayTrackSamples(terrain,locations,pose,{spanM:900,steps:28});
  assert.ok(samples.length>=5,"rails must not collapse at "+progress);
  assert.ok(samples.every(p=>[p.x,p.z,p.y].every(Number.isFinite)));
  const geometry=trackGeometry(samples);
  assert.ok(geometry.indices.length>100);
  assert.ok(Math.max(...geometry.indices)<65536);
 }
});
test("train wheels, crank rods and smoke use speed and rolling distance",()=>{
 const meshes=[wheelSpokesGeometry(),connectingRodGeometry(),steamPuffGeometry()];
 for(const mesh of meshes){
  assert.ok(mesh.indices.length>12);
  assert.equal(mesh.positions.length,mesh.normals.length);
  assert.equal(mesh.positions.length,mesh.colors.length);
 }
 const a=locomotiveMotion(0,0,0),b=locomotiveMotion(2,2,18);
 assert.notEqual(a.phase,b.phase);
 assert.equal(a.rod.length,2);
 assert.equal(a.smoke.length,9);
 assert.ok(b.smoke[0].scale>=a.smoke[0].scale||b.smoke[1].scale>=a.smoke[1].scale);
 assert.ok(b.rod.every(p=>p.length>2&&Number.isFinite(p.angle)));
});
test("passenger corridor walls can be hidden and have open windows",()=>{
 const normal=trainInteriorGeometry("passenger"),hidden=trainInteriorGeometry("passenger",{hideWalls:true});
 assert.ok(normal.indices.length>hidden.indices.length);
 assert.ok(hidden.indices.length>900);
});
test("players can walk inside a carriage, speak nearby, and switch camera without moving stations",()=>{
 const rail=new RailwaySystem();
 assert.equal(rail.board("tower",at(0,6,5),"passenger","aurora-out").ok,true);
 assert.equal(rail.status(at(0,6,6)).camera,"interior");
 rail.walk(.1,{forward:1});assert.ok(rail.boarded.pose.z>0);
 for(let i=0;i<100;i++)rail.walk(.1,{forward:1,strafe:1});
 assert.ok(Math.abs(rail.boarded.pose.x)<=.77);
 assert.ok(Math.abs(rail.boarded.pose.z)<=4.95);
 assert.equal(rail.setCamera("follow").ok,true);
 assert.equal(rail.walk(.1,{forward:1}),false);
 assert.equal(rail.setCamera("fixed").ok,true);
 assert.equal(rail.setCamera("rts").ok,true);
 assert.equal(rail.setCamera("interior").ok,true);
 assert.equal(rail.toggleWalls().ok,true);
 assert.equal(rail.status(at(0,7,0)).hideWalls,true);
 const people=rail.people(["斥候","職人"]);
 assert.ok(people.some(p=>p.kind==="companion"));
 assert.ok(people.some(p=>p.kind==="passenger"));
 const far=rail.talk("rider-merchant",["斥候","職人"]);
 assert.equal(far.ok,false);
 rail.boarded.pose=carPose({x:0,z:-4.1});
 assert.equal(rail.talk("rider-merchant").ok,true);
 const restored=new RailwaySystem(rail.snapshot());
 assert.equal(restored.status(at(0,7)).camera,"interior");
 assert.equal(restored.status(at(0,7)).hideWalls,true);
 assert.equal(restored.boarded.pose.z,-4.1);
 assert.equal(restored.alight(at(0,7)).ok,false);
 assert.equal(restored.alight(at(0,7,53)).ok,true);
});
test("train rendering, camera selectors, station approach and city travel wiring exist",()=>{
 const p=new URL("../planet-explorer/",import.meta.url);
 const html=readFileSync(new URL("index.html",p),"utf8");
 const app=readFileSync(new URL("app.mjs",p),"utf8");
 const render=readFileSync(new URL("render.mjs",p),"utf8");
 for(const id of ["railway-wall-toggle","railway-people","railway-talk","railway-view-controls"])
  assert.ok(html.includes('id="'+id+'"'),id);
 for(const mode of ["interior","follow","fixed","rts"])assert.ok(html.includes('data-rail-camera="'+mode+'"'),mode);
 assert.match(app,/railway\.walk\(/);
 assert.match(app,/railwayJourneyPose/);
 assert.match(render,/renderRailJourney\(/);
 assert.match(render,/drawRailwayVehicle\(/);
 assert.match(render,/railwayStationCoordinates/);
 assert.match(render,/this\.stationTrackMesh/);
 assert.match(render,/samplePatch\(this\.terrain,pose\.lat,pose\.lon/);
});
