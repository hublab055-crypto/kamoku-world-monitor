import test from "node:test";
import assert from "node:assert/strict";
import {ShipModelingBench,MODELING_BENCH as b,validBenchPart} from "./ship-modeling-bench.mjs";
const p=(x,y,z=0,yaw=0)=>({x:b.x+x,y:b.top+.005+y,z:b.z+z,yaw});
const setup=()=>{const m=new ShipModelingBench();assert.equal(m.add({shape:"cube",x:0,y:0,z:0,width:.3,height:.2,depth:.3,rotation:0}).ok,true);return m;};
const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-9);
test("two-hand uniform scale, single-hand rebase and yaw",()=>{
 const m=setup();assert.ok(m.grab("left",p(-.1,.1)));assert.ok(m.grab("right",p(.1,.1)));
 assert.ok(m.moveGrips({left:p(-.2,.1),right:p(.2,.1)}));close(m.parts[0].width,.6);close(m.parts[0].height,.4);
 const x=m.parts[0].x;assert.ok(m.releaseGrip("right"));assert.ok(m.moveGrip("left",p(-.2,.1)));close(m.parts[0].x,x);
 assert.ok(m.moveGrip("left",p(-.2,.1,0,.3)));close(m.parts[0].rotation,.3);assert.ok(m.releaseGrip("left"));assert.equal(m.grip,null);
});
test("top face push and pull, bounds, reload",()=>{
 const m=setup();assert.ok(m.grab("right",p(0,.2),"face"));assert.ok(m.moveGrip("right",p(0,.35)));close(m.parts[0].height,.35);
 assert.ok(m.moveGrip("right",p(0,.1)));close(m.parts[0].height,.1);
 assert.ok(m.moveGrip("right",p(0,-100)));close(m.parts[0].height,.001);assert.ok(m.releaseAll());
 assert.ok(validBenchPart(m.parts[0]));assert.deepEqual(new ShipModelingBench(m.snapshot()).snapshot(),m.snapshot());
});
test("invalid poses and extreme scaling cannot corrupt geometry",()=>{
 const m=setup();assert.equal(m.grab("left",p(NaN,.1)),false);
 assert.ok(m.grab("left",p(-.1,.1)));assert.equal(m.grab("right",p(-.1,.1)),false);assert.ok(m.grab("right",p(.1,.1)));
 assert.ok(m.moveGrips({left:p(-100,.1),right:p(100,.1)}));assert.ok(validBenchPart(m.parts[0]));
 assert.equal(m.moveGrip("right",p(Infinity,.1)),false);assert.ok(m.releaseAll());assert.equal(m.grip,null);
});
