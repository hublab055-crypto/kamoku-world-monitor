import test from "node:test";
import assert from "node:assert/strict";
import {SurfaceStarship} from "../planet-explorer/surface-starship.mjs";
import {ShipJourney} from "../planet-explorer/ship-journey.mjs";
import {geoOffset} from "../planet-explorer/geo.mjs";
import {shipLocalToWorld} from "../planet-explorer/shipboard.mjs";
import {crossingIntoStarship,cabinSurfacePose,starshipRampSupport,cabinMovement,DockedShipCamera} from "../planet-explorer/starship-hatch-portal.mjs";
import {starshipSurfaceExit} from "../planet-explorer/starship-surface-exit.mjs";
import {CABIN_FLOOR_M,RAMP_START_Z,RAMP_END_Z,starshipFloorHeight,cabinYawFromGround,groundYawFromCabin} from "../planet-explorer/starship-layout.mjs";
import {spacecraftGroundGeometry} from "../planet-explorer/spacecraft-ground-geometry.mjs";
import {sharedShipInteriorGeometry} from "../planet-explorer/ship-shared-scene.mjs";
const R=6371000,near=(a,b,e=1e-5)=>assert.ok(Math.abs(a-b)<e,`${a} != ${b}`);
function dock(yaw=.37){
 const origin={lat:28,lon:179.9999},geo=geoOffset(origin.lat,origin.lon,120,-30,R);
 const ship=new SurfaceStarship();ship.place("terra",geo.lat,geo.lon,yaw,400);ship.hatchOpen=true;
 const actor={origin,terrain:{planet:{id:"terra",radiusM:R}},x:0,z:0,yaw:Math.PI+yaw};
 const position=(x,z)=>shipLocalToWorld(120,-30,yaw,x,z);
 return {ship,actor,position};
}
test("walking inward across an open ramp preserves exact endpoint and heading",()=>{
 const {ship,actor,position}=dock(),previous=position(.3,18.7);
 Object.assign(actor,position(.3,18.35));actor.yaw=Math.PI+ship.yaw-.2;
 const before=JSON.stringify({origin:actor.origin,ship:ship.snapshot()});
 const entry=crossingIntoStarship(ship,actor,previous);
 near(entry.x,.3);near(entry.z,18.35);near(entry.yaw,.2);
 const voyage=new ShipJourney({originId:"terra",status:"docked",hatchOpen:true,
  launchSite:ship.snapshot(),interior:{schemaVersion:1,...entry}});
 near(voyage.interior.x,.3);near(voyage.interior.z,18.35);
 const rendered=cabinSurfacePose(ship,actor,voyage.interior);
 near(rendered.x,actor.x);near(rendered.z,actor.z);near(rendered.yaw,actor.yaw);
 assert.equal(JSON.stringify({origin:actor.origin,ship:ship.snapshot()}),before);
});
test("proximity, sideways entry, closed hatches, wrong planets and outward motion cannot board",()=>{
 const {ship,actor,position}=dock();
 Object.assign(actor,position(0,18.35));
 assert.equal(crossingIntoStarship(ship,actor,position(0,18.4)),null,"already inside plane is not a new crossing");
 assert.equal(crossingIntoStarship(ship,actor,position(3,18.7)),null,"diagonal crossing outside doorway rejected");
 ship.hatchOpen=false;assert.equal(crossingIntoStarship(ship,actor,position(0,18.7)),null);
 ship.hatchOpen=true;ship.flight="landing";
 assert.equal(crossingIntoStarship(ship,actor,position(0,18.7)),null);
 ship.flight="parked";actor.terrain.planet.id="selene";
 assert.equal(crossingIntoStarship(ship,actor,position(0,18.7)),null);
 actor.terrain.planet.id="terra";Object.assign(actor,position(0,18.7));
 assert.equal(crossingIntoStarship(ship,actor,position(0,18.4)),null);
});
test("ramp support and cabin support use the same continuous floor profile",()=>{
 const {ship,actor,position}=dock();
 near(starshipFloorHeight(RAMP_START_Z),CABIN_FLOOR_M);
 near(starshipFloorHeight(RAMP_END_Z),0);
 let previous=Infinity;
 for(let z=13;z<=18.7;z+=.05){
  const height=starshipFloorHeight(z);assert.ok(height<=previous+1e-10);previous=height;
  Object.assign(actor,position(0,z));
  const pose=cabinSurfacePose(ship,actor,{x:0,z,yaw:0});
  near(pose.feetM,400+height);
  if(z>=RAMP_START_Z){near(starshipRampSupport(ship,actor),height);}
 }
 Object.assign(actor,position(2,17));assert.equal(starshipRampSupport(ship,actor),null);
});
test("actual walk-through exit has no placement clamp and preserves the region",()=>{
 const {ship,actor,position}=dock();
 const before={...actor.origin},interior={x:.27,z:18.61,yaw:.24};
 const expected=position(interior.x,interior.z);
 const exit=starshipSurfaceExit(ship,actor,interior,{walkThrough:true});
 near(exit.x,expected.x);near(exit.z,expected.z);
 near(exit.yaw,groundYawFromCabin(interior.yaw,ship.yaw));
 assert.deepEqual(actor.origin,before);
 const assisted=starshipSurfaceExit(ship,actor,{x:0,z:12,yaw:0});
 const toe=cabinSurfacePose(ship,actor,{x:0,z:18.6,yaw:0});
 near(assisted.x,toe.x);near(assisted.z,toe.z);
});
test("all cardinal headings agree between cabin look direction and planetary forward",()=>{
 for(const shipYaw of [0,.4,-1.2])for(const yaw of [0,Math.PI/2,Math.PI,-Math.PI/2]){
  const cabinYaw=cabinYawFromGround(yaw,shipYaw);
  const direction=shipLocalToWorld(0,0,shipYaw,Math.sin(cabinYaw),-Math.cos(cabinYaw));
  near(direction.x,Math.sin(yaw));near(direction.z,Math.cos(yaw));
  near(groundYawFromCabin(cabinYaw,shipYaw),yaw);
 }
});
test("held movement is continuous across the portal without doubling keyboard or stick input",()=>{
 const held=new Set(["forward","right","rightTurn"]);
 assert.deepEqual(cabinMovement(held,{forward:1,strafe:1,turn:1}),{forward:1,strafe:-1,turn:-1});
 assert.deepEqual(cabinMovement(new Set(),{forward:.6,strafe:-.2,turn:.4}),{forward:.6,strafe:.2,turn:-.4});
 assert.deepEqual(cabinMovement(new Set(),{forward:NaN}),{forward:0,strafe:0,turn:0});
});
test("external and internal geometry share the same hollow cabin and floor height",()=>{
 for(const open of [false,true]){
  const cabin=sharedShipInteriorGeometry(open),external=spacecraftGroundGeometry(open);
  assert.deepEqual(external.positions.slice(0,cabin.positions.length),
   cabin.positions.map((v,i)=>i%3===1?v+CABIN_FLOOR_M:v));
  assert.deepEqual(external.indices.slice(0,cabin.indices.length),cabin.indices);
  assert.ok(Math.max(...external.indices)<65535);assert.ok(external.positions.every(Number.isFinite));
 }
});
test("docked camera starts transitions at the last world pose, even after render-origin movement",()=>{
 const camera=new DockedShipCamera(),base={eye:[0,7,8],target:[0,1,0],fovDeg:65,marker:true};
 camera.view(base,{cx:100,cz:200,regionKey:"terra",dt:0});
 const cabin={eye:[-110,3,-220],target:[-110,3,-221],fovDeg:75};
 const first=camera.view(base,{cabin,cx:210,cz:420,regionKey:"terra",dt:0});
 near(first.eye[0]+210,100);near(first.eye[2]+420,208);near(first.fovDeg,65);
 let done;
 for(let i=0;i<20;i++)done=camera.view(base,{cabin,cx:210,cz:420,regionKey:"terra",dt:.016});
 assert.deepEqual(done.eye,cabin.eye);near(done.fovDeg,75);
 const exit=camera.view(base,{cx:210,cz:420,regionKey:"terra",dt:0});
 assert.deepEqual(exit.eye,cabin.eye);
 const changed=camera.view(base,{cx:210,cz:420,regionKey:"selene",dt:0});
 assert.deepEqual(changed.eye,base.eye,"another region cannot inherit camera coordinates");
});
