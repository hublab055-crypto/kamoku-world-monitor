import {test} from "node:test";
import assert from "node:assert/strict";
import {SHARED_TOWN_ROOMS,sharedRoom,sharedDoor,sharedDoorNear,sharedExteriorStep,sharedWalkStep} from "./town-shared-world.mjs";
import {sharedTownFurnitureGeometry} from "./town-shared-geometry.mjs";
import {sharedTownShellGeometry,sharedTownRoofGeometry} from "./scenery-geometry.mjs";
import {hallWorldPoint,hallLocalPoint,syncHallActorWorld,isSharedHallRoom} from "./music-hall-world.mjs";
import {TownLife} from "./town-life.mjs";
import {settlementLayout} from "./settlements.mjs";
const townId="capital",layout=settlementLayout(townId);
function location(type){
 const index=layout.buildings.findIndex(b=>b.type===type);
 assert.ok(index>=0,"missing "+type);
 return {...layout.buildings[index],id:"village-"+index};
}
function actor(x=0,z=0){
 return {x,z,yaw:0,nearGround:true,travelMode:"walk",origin:{lat:28,lon:42},
 lat:28+z/100000,lon:42+x/100000,locationAt(x,z){return {lat:28+z/100000,lon:42+x/100000}},
 clearMoveTarget(){this.target=null;}};
}
test("six existing ordinary town kinds have stable reusable shared shells",()=>{
 assert.deepEqual(Object.keys(SHARED_TOWN_ROOMS).sort(),
 ["barn","cabin","granary","lodge","stable","workshop"]);
 for(const type of Object.keys(SHARED_TOWN_ROOMS)){
  const site=location(type);
  assert.ok(sharedRoom(type));
  assert.ok(isSharedHallRoom({type}));
  assert.ok(sharedDoor(site).z>site.z);
 }
 assert.equal(sharedRoom("market"),null);
 assert.equal(isSharedHallRoom({type:"market"}),false);
});
test("ordinary town doors open only from nearby walking actors",()=>{
 for(const type of Object.keys(SHARED_TOWN_ROOMS)){
  const site=location(type),door=sharedDoor(site),town=new TownLife();
  assert.equal(sharedDoorNear(site,{x:door.x,z:door.z}),true);
  assert.equal(town.toggleHallDoor(townId,site.id,actor(site.x,site.z+30)).ok,false);
  assert.equal(town.toggleHallDoor(townId,site.id,actor(door.x,door.z+.3)).ok,true);
  assert.equal(town.hallDoorOpen(townId,site.id),true);
 }
});
test("closed ordinary walls block entrance, open doors make one crossing portal",()=>{
 const site=location("lodge"),door=sharedDoor(site);
 const previous={x:door.x,z:door.front+.47},after={x:door.x,z:door.front+.18};
 assert.equal(sharedExteriorStep(previous,after,[site],()=>false).blocked,true);
 const open=sharedExteriorStep(previous,after,[site],()=>true);
 assert.equal(open.portal?.id,site.id);
 assert.equal(open.blocked,false);
 assert.equal(sharedExteriorStep({x:site.x+7,z:site.z},{x:site.x+6,z:site.z},[site],()=>true).blocked,true);
});
test("doorway crossing maintains the world point and geographic origin",()=>{
 const site=location("workshop"),door=sharedDoor(site),town=new TownLife();
 const a=actor(door.x+.3,door.front+.46);
 const oldOrigin={...a.origin};
 assert.equal(town.toggleHallDoor(townId,site.id,a).ok,true);
 const previous={x:a.x,z:a.z};a.z=door.front+.17;
 assert.equal(town.hallStep(townId,previous,a).entered,true);
 const before={x:a.x,z:a.z};
 assert.equal(syncHallActorWorld(town,a),true);
 assert.ok(Math.abs(a.x-before.x)<1e-8);
 assert.ok(Math.abs(a.z-before.z)<1e-8);
 assert.deepEqual(a.origin,oldOrigin);
 assert.equal(a.lat,28+a.z/100000);
 assert.equal(town.inside.buildingId,site.id);
});
test("a walkable indoor room preserves geographic position and can exit on foot",()=>{
 const site=location("cabin"),door=sharedDoor(site),town=new TownLife(),a=actor(door.x,door.z);
 town.toggleHallDoor(townId,site.id,a);
 assert.equal(town.enter(townId,site.id,a).ok,true);
 assert.equal(syncHallActorWorld(town,a),true);
 const originalZ=a.z;
 assert.equal(town.walk(.1,{forward:-1}),true);
 syncHallActorWorld(town,a);
 assert.ok(a.z<originalZ);
 town.inside.pose.z=sharedRoom("cabin").halfZ-.77;
 assert.equal(town.walk(.1,{forward:1}),true);
 assert.equal(town.portalExitRequested,true);
 assert.equal(town.portalExit(a).ok,true);
 assert.equal(town.inside,null);
 assert.ok(a.z>door.front);
});
test("manual exit returns outside the actual building without altering origin",()=>{
 const site=location("granary"),door=sharedDoor(site),town=new TownLife(),a=actor(door.x,door.z);
 town.toggleHallDoor(townId,site.id,a);
 assert.equal(town.enter(townId,site.id,a).ok,true);
 syncHallActorWorld(town,a);const saved={...a.origin};
 assert.equal(town.leave(a).ok,true);
 assert.ok(a.z>door.front);
 assert.equal(a.lat,28+a.z/100000);
 assert.deepEqual(a.origin,saved);
});
test("walls and workbenches block walking, center aisle remains traversable",()=>{
 assert.equal(sharedWalkStep("workshop",{x:0,z:-1.5},0,-1.7).blocked,false);
 assert.equal(sharedWalkStep("workshop",{x:0,z:-1.5},-1.7,-1.5).blocked,true);
 assert.equal(sharedWalkStep("cabin",{x:0,z:0},5,0).blocked,true);
 assert.equal(sharedWalkStep("lodge",{x:0,z:2},0,1.75).blocked,false);
});
test("ordinary exteriors stay unrotated just like baked scenery",()=>{
 const site=location("cabin"),point={x:1.2,z:2.3,yaw:.4};
 const p=hallWorldPoint(site,point),q=hallLocalPoint(site,p);
 assert.deepEqual({x:p.x,z:p.z},{x:site.x+1.2,z:site.z+2.3});
 assert.ok(Math.abs(q.x-point.x)<1e-9&&Math.abs(q.z-point.z)<1e-9);
});
test("distinct shell/roof/furniture geometry is well formed for six kinds",()=>{
 for(const type of Object.keys(SHARED_TOWN_ROOMS)){
  const site=location(type),world={...site,localX:site.x,localZ:site.z,elevationM:180};
  for(const g of [sharedTownShellGeometry(world),sharedTownRoofGeometry(world),sharedTownFurnitureGeometry(type)]){
   assert.ok(g.indices.length>0);
   assert.equal(g.positions.length,g.normals.length);
   assert.equal(g.positions.length,g.colors.length);
   assert.ok(g.indices.every(i=>i>=0&&i<g.positions.length/3));
  }
 }
});
test("unmodified buildings retain their original indoor mode and cannot toggle a new door",()=>{
 const t=new TownLife(),site=location("market"),a=actor(site.x,site.z);
 assert.equal(t.toggleHallDoor(townId,site.id,a).ok,false);
 assert.equal(t.enter(townId,site.id,a).ok,true);
 assert.ok(t.inside);
 assert.equal(isSharedHallRoom({type:"market"}),false);
 assert.equal(t.leave(a).ok,true);
});
