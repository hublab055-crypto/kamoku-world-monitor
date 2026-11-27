import test from "node:test";
import assert from "node:assert/strict";
import {ShipModelingBench,nearModelingBench,MODELING_BENCH} from "../ship-modeling-bench.mjs";
import {ShipInterior} from "../ship-interior.mjs";
import {OwnerWorld} from "../owner-world.mjs";
const part={shape:"cube",x:0,y:0,z:0,width:.3,height:.2,depth:.3,rotation:0};
test("bench stays accessible and blocks walking through tabletop",()=>{const b=MODELING_BENCH,s=new ShipInterior({x:1.6,z:b.z});assert.equal(s.canOccupy(b.x,b.z),false);assert.equal(s.canOccupy(1.6,b.z),true);assert.equal(nearModelingBench(s),true);assert.equal(nearModelingBench({x:0,z:10}),false);});
test("ship-local model edits and restores without planet coordinates",()=>{const m=new ShipModelingBench();assert.ok(m.add(part).ok);assert.ok(m.update({width:.4,rotation:Math.PI/4}).ok);assert.equal(m.parts[0].width,.4);assert.equal(m.update({x:2}).ok,false);const re=new ShipModelingBench(m.snapshot());assert.equal(re.parts[0].rotation,Math.PI/4);const w=new OwnerWorld();assert.ok(w.savePrefabParts("ship work",re.prefabParts()).ok);assert.equal(w.primitives.length,0);});
