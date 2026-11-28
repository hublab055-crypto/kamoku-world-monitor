import {carryCelestialInventory} from "../solar-transition.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import {ShipModelingBench,nearModelingBench,MODELING_BENCH} from "../ship-modeling-bench.mjs";
import {ShipInterior} from "../ship-interior.mjs";
import {OwnerWorld} from "../owner-world.mjs";
const part={shape:"cube",x:0,y:0,z:0,width:.3,height:.2,depth:.3,rotation:0};
test("bench stays accessible and blocks walking through tabletop",()=>{const b=MODELING_BENCH,s=new ShipInterior({x:1.6,z:b.z});assert.equal(s.canOccupy(b.x,b.z),false);assert.equal(s.canOccupy(1.6,b.z),true);assert.equal(nearModelingBench(s),true);assert.equal(nearModelingBench({x:0,z:10}),false);});
test("ship-local model edits and restores without planet coordinates",()=>{const m=new ShipModelingBench();assert.ok(m.add(part).ok);assert.ok(m.update({width:.4,rotation:Math.PI/4}).ok);assert.equal(m.parts[0].width,.4);assert.equal(m.update({x:2}).ok,false);const re=new ShipModelingBench(m.snapshot());assert.equal(re.parts[0].rotation,Math.PI/4);const w=new OwnerWorld();assert.ok(w.savePrefabParts("ship work",re.prefabParts()).ok);assert.equal(w.primitives.length,0);});

test("grip moves within work envelope and releases",()=>{const b=MODELING_BENCH,m=new ShipModelingBench();m.add(part);const point={x:b.x,y:b.top+.105,z:b.z};assert.equal(m.grab("right",point),true);assert.equal(m.grab("left",point),false);assert.equal(m.moveGrip("right",{...point,x:point.x+.2}),true);assert.ok(Math.abs(m.parts[0].x-.2)<1e-9);assert.ok(m.moveGrip("right",{...point,x:100}));assert.ok(m.parts[0].x<=.525+1e-9);assert.equal(m.releaseGrip("right"),true);assert.equal(m.moveGrip("right",point),false);});
test("bench output can be stored and carried between planets without copying stale items",()=>{const m=new ShipModelingBench(),w=new OwnerWorld();m.add({...part,width:.1,height:.1,depth:.1});assert.equal(m.storeOutput(w,"heavy").ok,false);assert.ok(m.update({width:.02,height:.02,depth:.02}).ok);assert.ok(m.storeOutput(w,"small").ok);assert.equal(w.cadInventory.length,1);assert.equal(m.parts.length,1);
 const current={actions:{resources:{}},v0_8w:{owner:w.snapshot()}},dest={actions:{},v0_8w:{owner:{version:3,buildings:[{id:1}],roads:[],stamps:[],primitives:[],prefabs:[],cadInventory:[{id:2,name:"stale"}]}}};
 carryCelestialInventory(dest,current);assert.equal(dest.v0_8w.owner.cadInventory.length,1);assert.equal(dest.v0_8w.owner.cadInventory[0].name,"small");assert.equal(dest.v0_8w.owner.cadInventory[0].id,2);
});