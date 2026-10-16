import test from "node:test";
import assert from "node:assert/strict";
import {Actions} from "../planet-explorer/actions.mjs";
import {HUT,HutAccess,closestDoor,hutDoor,inHut} from "../planet-explorer/buildings.mjs";

const make=()=>{
 const actions=new Actions();
 actions.structures=[{id:1,kind:"hut",x:10,z:20,lat:28,lon:42,height:100,progress:1}];
 const actor={x:10,z:23.3,lat:28,lon:42,blocked:false,moving:true,moveTarget:null,
  locationAt:(x,z)=>({lat:x,lon:z}),clearMoveTarget(){this.moveTarget=null;}};
 return {actions,actor,door:new HutAccess(actions)};
};
const advance=(access,actor,z,x=actor.x)=>{
 const before={x:actor.x,z:actor.z,lat:actor.lat,lon:actor.lon};
 actor.x=x;actor.z=z;actor.lat=x;actor.lon=z;
 return access.guard(before,actor);
};
test("unfinished buildings do not expose interactive doors",()=>{
 const {actions}=make();assert.equal(closestDoor(actions.structures,10,23),actions.structures[0]);
 actions.structures[0].progress=.9;
 assert.equal(closestDoor(actions.structures,10,23),null);
});
test("door is centered on +Z side and cabin bounds match the doorway",()=>{
 const {actions}=make(),b=actions.structures[0];
 assert.deepEqual(hutDoor(b),{x:10,z:22.53});
 assert.equal(inHut(b,10,20),true);
 assert.equal(inHut(b,10,22.6),false);
 assert.equal(HUT.doorHalfWidth<1,true);
});
test("closed walls block movement and do not corrupt geographic coordinates",()=>{
 const {door,actor}=make();actor.z=23.0;actor.lat=28;actor.lon=42;
 assert.equal(advance(door,actor,22.51),"blocked");
 assert.equal(actor.z,23);assert.equal(actor.lat,28);assert.equal(actor.lon,42);
 assert.equal(door.insideId,null);
});
test("open doorway supports gradual physical entry and exit",()=>{
 const {actions,door,actor}=make(),hut=actions.structures[0];
 actor.z=23;assert.equal(door.toggle(hut,actor).ok,true);
 assert.equal(advance(door,actor,22.51),null); // doorway approach corridor
 assert.equal(advance(door,actor,22.20),"enter");
 assert.equal(door.insideId,1);
 assert.equal(advance(door,actor,21.25),null);
 assert.equal(advance(door,actor,22.73),"exit");
 assert.equal(door.insideId,null);
});
test("inside room blocks walls, closed exit, and non-doorway movement",()=>{
 const {actions,door,actor}=make(),hut=actions.structures[0];
 hut.doorOpen=true;assert.equal(door.enter(hut,actor).ok,true);
 assert.equal(door.insideId,1);
 assert.equal(advance(door,actor,20,12.8),"blocked");
 assert.equal(door.insideId,1);
 assert.equal(door.toggle(hut,actor).ok,true);
 assert.equal(advance(door,actor,22.6),"blocked");
 assert.equal(door.exit(actor).ok,false);
});
test("UI entry/exit and round trip door state through action snapshots",()=>{
 const {actions,door,actor}=make(),hut=actions.structures[0];
 assert.equal(door.enter(hut,actor).ok,false);
 assert.equal(door.toggle(hut,actor).ok,true);
 assert.equal(door.enter(hut,actor).ok,true);
 const saved=actions.snapshot(),indoor=door.snapshot();
 const restored=Actions.fromSnapshot(saved);
 const next=new HutAccess(restored,indoor);
 assert.equal(next.insideId,1);assert.equal(restored.structures[0].doorOpen,true);
 assert.equal(next.exit(actor).ok,true);
 assert.equal(next.insideId,null);
});
