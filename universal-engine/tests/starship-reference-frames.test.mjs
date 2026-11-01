import test from "node:test";
import assert from "node:assert/strict";
import {createCelestialPlanet,orbitalPosition,AU_M} from "../planet-explorer/solar-system.mjs";
import {geoOffset,geoToWorld} from "../planet-explorer/geo.mjs";
import {bodyFrame,rigidFrame,toParent,fromParent,relativePoint,tangentFrame,
 surfaceLocalOffset,orbitalVelocityMps} from "../planet-explorer/reference-frames.mjs";
import {regionAnchor,LegacyRegionAdapter} from "../planet-explorer/region-anchor.mjs";
import {SurfaceStarship} from "../planet-explorer/surface-starship.mjs";
import {starshipSurfaceExit,starshipSurfaceLanding} from "../planet-explorer/starship-surface-exit.mjs";
import {savedSurfaceLocation,prepareShipArrivalTerrain} from "../planet-explorer/ship-arrival-terrain.mjs";
import {findStarshipPad} from "../planet-explorer/surface-starship-landing.mjs";
import {planWorldScenery} from "../planet-explorer/world-scenery.mjs";
import {railwayRoutePosition} from "../planet-explorer/railway-world.mjs";
import {ShipJourney} from "../planet-explorer/ship-journey.mjs";
const R=6371000;
const near=(a,b,epsilon=1e-6)=>assert.ok(Math.abs(a-b)<=epsilon,`${a} != ${b} within ${epsilon}`);
const vectorNear=(a,b,epsilon=1e-6)=>a.forEach((v,i)=>near(v,b[i],epsilon));
const copy=v=>JSON.parse(JSON.stringify(v));

test("body transforms match the existing planet's spin and axial-tilt convention",()=>{
 for(const id of ["terra","selene","cinder","nix"]){
  const planet=createCelestialPlanet(id,41.375),frame=bodyFrame(planet);
  for(const [lat,lon] of [[0,0],[28,42],[89.999,179.999],[-75,-179.99]]){
   const n=planet.surfaceNormal(lat,lon);
   const local=geoToWorld(lat,lon,230,planet.radiusM),p=toParent(frame,local).position;
   vectorNear(p.map((v,i)=>(v-frame.origin[i])/(planet.radiusM+230)),[n.x,n.y,n.z],1e-9);
   vectorNear(fromParent(frame,p).position,local,.001);
  }
 }
});

test("body frame centres and analytic velocities include parent motion of the moon",()=>{
 for(const id of ["terra","cinder","selene","nix"]){
  const day=123.45,planet=createCelestialPlanet(id,day),frame=bodyFrame(planet);
  const centre=orbitalPosition(id,day);
  vectorNear(frame.origin,[centre.x*AU_M,centre.y*AU_M,centre.z*AU_M]);
  const before=orbitalPosition(id,day-1/86400),after=orbitalPosition(id,day+1/86400);
  vectorNear(orbitalVelocityMps(id,day),["x","y","z"].map(k=>(after[k]-before[k])*AU_M/2),.001);
 }
});

test("position and velocity survive a rotating body to stellar frame round trip",()=>{
 const frame=bodyFrame(createCelestialPlanet("terra",.24));
 const p=[R+500,30,-50],v=[3,-4,7],world=toParent(frame,p,v);
 const restored=fromParent(frame,world.position,world.velocity);
 vectorNear(restored.position,p,.001);vectorNear(restored.velocity,v,1e-7);
 const stationary=toParent(frame,[R,0,0]);
 assert.ok(Math.hypot(...stationary.velocity.map((n,i)=>n-frame.velocity[i]))>400,
  "a surface-attached body includes rotational velocity");
 const at=bodyFrame(createCelestialPlanet("terra",.24+1/86400));
 const future=toParent(at,p).position;
 vectorNear(future.map((n,i)=>n-world.position[i]),toParent(frame,p).velocity,2,
  "world velocity agrees with one-second displacement");
});

test("ship and body frames preserve the same world pose and velocity at handoff",()=>{
 const body=bodyFrame(createCelestialPlanet("selene",19));
 const ship=rigidFrame({id:"ship:player-1",origin:[700,300,1200],
  axes:[[0,0,-1],[0,1,0],[1,0,0]],velocity:[8,1,0],angularVelocity:[0,.1,0]});
 const onboard=toParent(ship,[.4,1.6,17.8],[0,0,2]);
 const world=toParent(body,onboard.position,onboard.velocity);
 const ground=fromParent(body,world.position,world.velocity);
 const back=fromParent(ship,ground.position,ground.velocity);
 // Absolute AU-scale round trips lose micrometres in Number precision;
 // a spinning cabin converts that position error into a small velocity error.
 vectorNear(back.position,[.4,1.6,17.8],.001);vectorNear(back.velocity,[0,0,2],1e-5);
});

test("camera-relative coordinates retain millimetres at AU-sized centres",()=>{
 const origin=[AU_M*5,AU_M,-AU_M*2];
 const source=rigidFrame({id:"body:test",origin});
 const camera=rigidFrame({id:"render:camera",origin});
 const relative=relativePoint(source,[.001,-.002,.003],camera);
 vectorNear(relative,[.001,-.002,.003],1e-15);
 vectorNear([...new Float32Array(relative)],[.001,-.002,.003],1e-9);
 const turned=rigidFrame({id:"render:turned",origin,axes:[[0,0,-1],[0,1,0],[1,0,0]]});
 vectorNear(relativePoint(source,[1,2,3],turned),[-3,2,1]);
});

test("tangent frames use east/up/north and retain surface elevation",()=>{
 const frame=tangentFrame({id:"region:test",lat:0,lon:0,radiusM:R,elevationM:100});
 vectorNear(toParent(frame,[10,2,20]).position,[R+102,20,10]);
 vectorNear(fromParent(frame,[R+102,20,10]).position,[10,2,20]);
});

test("legacy logarithmic/exponential maps agree across dateline and at high latitude",()=>{
 for(const origin of [{lat:28,lon:42},{lat:0,lon:179.9999},{lat:89.999,lon:-179.99},{lat:-89.999,lon:179.99}]){
  for(const [x,z] of [[.001,0],[0,.001],[300,-500],[-900,350]]){
   const point=geoOffset(origin.lat,origin.lon,x,z,R);
   const local=surfaceLocalOffset(origin,point.lat,point.lon,R);
   near(local.eastM,x,.001);near(local.northM,z,.001);
  }
 }
 assert.throws(()=>surfaceLocalOffset({lat:0,lon:0},0,180,R),/Antipodal/);
});

test("immutable legacy anchors retain their generator address and unique entity identity",()=>{
 const origin={lat:28,lon:42};
 const anchor=regionAnchor({bodyId:"terra",regionId:"pioneer",origin,seed:77});
 const region=new LegacyRegionAdapter(anchor,R);
 const before=region.surfacePoint(120,300,400);
 origin.lat=-10;origin.lon=150;
 assert.deepEqual(region.surfacePoint(120,300,400),before);
 assert.equal(region.anchor.legacyOrigin.lat,28);
 assert.ok(Object.isFrozen(region.anchor.legacyOrigin));
 const remote=new LegacyRegionAdapter(regionAnchor({bodyId:"selene",regionId:"pioneer",origin,seed:331}),1737000);
 assert.notEqual(region.entityId("resident-1"),remote.entityId("resident-1"));
 assert.throws(()=>{region.anchor.legacyOrigin.lat=0;},TypeError);
 assert.throws(()=>region.entityId(""),TypeError);
});

test("a nearby ship across the longitude seam remains reachable and its snapshot unchanged",()=>{
 const origin={lat:0,lon:179.99998},location=geoOffset(origin.lat,origin.lon,10,0,R);
 assert.ok(location.lon<0);
 const ship=new SurfaceStarship();ship.place("terra",location.lat,location.lon,0,20);
 const before=ship.snapshot(),offset=ship.offsetFromCoords(origin,10,17.2,R);
 near(offset.x,10,.001);near(offset.z,0,.001);near(offset.distanceM,0,.001);
 assert.deepEqual(ship.snapshot(),before);
 assert.deepEqual(SurfaceStarship.fromSnapshot(before).snapshot(),before);
});

test("sub-metre hatches are not rounded to the origin and invalid frames fail closed",()=>{
 const ship=new SurfaceStarship(),origin={lat:28,lon:42};
 const point=geoOffset(origin.lat,origin.lon,.01,.02,R);
 ship.place("terra",point.lat,point.lon);
 const local=ship.offsetFromCoords(origin,0,0,R);
 near(local.x,.01,.0001);near(local.z,.02,.0001);
 assert.equal(new SurfaceStarship().offsetFromCoords(origin,0,0,R),null);
 assert.equal(ship.offsetFromCoords({lat:NaN,lon:42},0,0,R),null);
 ship.place("terra",0,180);
 assert.equal(ship.offsetFromCoords({lat:0,lon:0},0,0,R),null);
});

test("exit commits only player pose in the existing region; no origin or companion reset",()=>{
 const planet=createCelestialPlanet("terra",.24),origin={lat:28,lon:42};
 const at=geoOffset(origin.lat,origin.lon,127,-81,R),ship=new SurfaceStarship();
 ship.place("terra",at.lat,at.lon,.37,400);
 const controller={origin,terrain:{planet},x:0,z:0,moveTarget:{x:20,z:20},totalDistanceM:250};
 const snapshot=copy({origin,ship:ship.snapshot(),controller:{x:0,z:0,moveTarget:controller.moveTarget,totalDistanceM:250}});
 const pose=starshipSurfaceExit(ship,controller,{x:.4,z:18,yaw:.6});
 near(pose.x,127+Math.cos(.37)*.4+Math.sin(.37)*18,.001);
 near(pose.z,-81-Math.sin(.37)*.4+Math.cos(.37)*18,.001);
 near(pose.yaw,.97);
 assert.deepEqual(geoOffset(origin.lat,origin.lon,pose.x,pose.z,R),{lat:pose.lat,lon:pose.lon});
 assert.deepEqual({origin,ship:ship.snapshot(),controller:{x:controller.x,z:controller.z,
  moveTarget:controller.moveTarget,totalDistanceM:controller.totalDistanceM}},snapshot);
 assert.throws(()=>starshipSurfaceExit(ship,{...controller,terrain:{planet:{...planet,id:"selene"}}},{x:0,z:18,yaw:0}));
});

test("surface exit preserves scenery cells, town residents, buildings and railway route",()=>{
 const planet=createCelestialPlanet("terra",.24),origin={lat:28,lon:42};
 const region=new LegacyRegionAdapter(regionAnchor({bodyId:"terra",regionId:"tower",origin,seed:77}),R);
 const options={settlementId:"tower",radius:250,groundAt:()=>400,
  biomeAt:()=>({water:false,river:false,category:"forest",elevationM:400})};
 const before=region.generate(planWorldScenery,options);
 assert.ok(before.trees.length&&before.buildings.length&&before.people.length);
 const terrain={planet,sample:()=>({water:false,river:false,category:"forest",elevationM:400})};
 const places=[{id:"tower",lat:28,lon:42},{id:"port",lat:28.5,lon:43}];
 const rail=railwayRoutePosition(terrain,places,"tower","port",.2);
 const at=geoOffset(origin.lat,origin.lon,30,60,R),ship=new SurfaceStarship();
 ship.place("terra",at.lat,at.lon);
 const controller={origin,terrain,x:0,z:0};
 for(let i=0;i<100;i++){
  const exit=starshipSurfaceExit(ship,controller,{x:0,z:18,yaw:0});
  Object.assign(controller,exit);
 }
 assert.deepEqual(region.generate(planWorldScenery,options),before);
 assert.deepEqual(railwayRoutePosition(terrain,places,"tower","port",.2),rail);
 assert.deepEqual(controller.origin,{lat:28,lon:42});
});

test("old grounded and in-flight journey save contracts remain readable",()=>{
 const ship=new SurfaceStarship();ship.place("terra",28,42,.2,400);
 const region=regionAnchor({bodyId:"terra",regionId:"pioneer",origin:{lat:28,lon:42},seed:77});
 const voyage=new ShipJourney({originId:"terra",status:"docked",launchSite:ship.snapshot()});
 const saved=copy({ship:ship.snapshot(),voyage:voyage.snapshot(),region});
 assert.deepEqual(SurfaceStarship.fromSnapshot(saved.ship).snapshot(),saved.ship);
 assert.deepEqual(ShipJourney.fromSnapshot(saved.voyage).snapshot(),saved.voyage);
 assert.deepEqual(new LegacyRegionAdapter(saved.region,R).anchor,region);
});

test("return landing uses the visited region's saved chart without replacing its origin",()=>{
 const planet=createCelestialPlanet("terra",.24),origin={lat:36,lon:53};
 const controller={terrain:{planet},origin,x:0,z:0};
 const target=geoOffset(origin.lat,origin.lon,-250,180,R);
 const pad={bodyId:"terra",...target,yaw:.7};
 const landing=starshipSurfaceLanding(controller,pad);
 near(landing.x,-250,.001);near(landing.z,180,.001);
 assert.equal(landing.lat,pad.lat);assert.equal(landing.lon,pad.lon);
 Object.assign(controller,landing);
 assert.deepEqual(controller.origin,{lat:36,lon:53});
 const ship=new SurfaceStarship();ship.place("terra",pad.lat,pad.lon,pad.yaw,400);
 const exit=starshipSurfaceExit(ship,controller,{x:0,z:18,yaw:0});
 assert.ok(Math.hypot(exit.x+250,exit.z-180)<19);
 assert.deepEqual(controller.origin,{lat:36,lon:53});
 assert.throws(()=>starshipSurfaceLanding(controller,{...pad,bodyId:"selene"}));
});

test("v1 explorer snapshots resolve to their real saved location rather than the default valley",()=>{
 const origin={lat:0,lon:179.99999};
 const snapshot={format:"ue/explorer",version:1,origin,x:450,z:-170};
 const before=copy(snapshot),fallback={lat:28,lon:42};
 assert.deepEqual(savedSurfaceLocation(snapshot,R,fallback),geoOffset(origin.lat,origin.lon,450,-170,R));
 assert.deepEqual(savedSurfaceLocation({...snapshot,lat:28,lon:42},R,fallback),
  savedSurfaceLocation(snapshot,R,fallback),"saved origin+x/z are authoritative");
 assert.deepEqual(savedSurfaceLocation({lat:16,lon:22},R,fallback),{lat:16,lon:22});
 assert.deepEqual(savedSurfaceLocation({origin:{lat:NaN},x:0,z:0},R,fallback),fallback);
 assert.deepEqual(snapshot,before);
});

test("arrival preparation rejects a different planet's saved world instead of displaying it",()=>{
 const wrong={planet:createCelestialPlanet("terra",.24).snapshot()};
 assert.throws(()=>prepareShipArrivalTerrain({destinationId:"selene",visitedSave:wrong}),/一致/);
});

test("real return terrain searches the saved remote location and leaves the visited record intact",()=>{
 const first=prepareShipArrivalTerrain({destinationId:"cinder",days:.24});
 const radius=first.terrain.planet.radiusM;
 const far=geoOffset(first.site.lat,first.site.lon,12000,8000,radius);
 const pad=findStarshipPad(first.terrain,far);
 assert.ok(pad?.safe);
 const saved={planet:first.terrain.planet.snapshot(),explorer:{format:"ue/explorer",version:1,
  origin:{lat:pad.lat,lon:pad.lon},x:0,z:0},
  v0_9v:{schemaVersion:1,scenario:{version:1,mode:"story",generation:4,chapter:"stellar"}}};
 const before=copy(saved);
 const back=prepareShipArrivalTerrain({destinationId:"cinder",visitedSave:saved,days:7});
 const delta=surfaceLocalOffset(saved.explorer.origin,back.site.lat,back.site.lon,radius);
 assert.ok(Math.hypot(delta.eastM,delta.northM)<200,"return pad is near the saved expedition, 14km from starter valley");
 assert.deepEqual(saved,before,"preparing terrain must not reset the saved region or campaign");
});

test("malformed or reflected reference frames are rejected",()=>{
 assert.throws(()=>rigidFrame({id:"bad",origin:[Infinity,0,0]}));
 assert.throws(()=>rigidFrame({id:"bad",axes:[[1,0,0],[1,0,0],[0,0,1]]}));
 assert.throws(()=>rigidFrame({id:"bad",axes:[[1,0,0],[0,1,0],[0,0,-1]]}));
 assert.throws(()=>bodyFrame(createCelestialPlanet("terra"),NaN));
 assert.throws(()=>tangentFrame({id:"bad",lat:0,lon:0}));
 assert.throws(()=>surfaceLocalOffset({lat:91,lon:0},0,0,R));
 assert.throws(()=>regionAnchor({bodyId:"terra",regionId:"pioneer",origin:{lat:0,lon:0},seed:NaN}));
});
