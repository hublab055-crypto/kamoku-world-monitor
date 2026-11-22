import test from "node:test";
import assert from "node:assert/strict";
import {mrAvatarPlacement,MRAvatarPresence} from "./mr-avatar-presence.mjs";
const head=[1,0,0,0,0,1,0,0,0,0,1,0,0,1.65,0,1];
test("spawn faces headset, stands on floor and persists its anchor",()=>{
 const p=mrAvatarPlacement(head);assert.ok(p.z<0);assert.equal(p.y,0);
 const world=new MRAvatarPresence();assert.equal(world.place("navigator",head).ok,true);
 assert.equal(world.get("navigator").x,0);
 assert.equal(world.actors.length,1);
 world.place("navigator",head);assert.equal(world.actors.length,1);
});
test("placement honors nearby floor hit but rejects wall hit",()=>{
 const p=mrAvatarPlacement(head,{hit:[...head.slice(0,12),1,0,-2,1]});
 assert.equal(p.x,1);assert.equal(p.z,-2);
 const wall=mrAvatarPlacement(head,{hit:[...head.slice(0,12),1,1.4,-2,1]});
 assert.equal(wall.x,0);
});
test("roster validation, cap and gesture lifecycle",()=>{
 const w=new MRAvatarPresence(1);
 assert.equal(w.place("invalid",head).ok,false);
 assert.equal(w.place("navigator",head).ok,true);
 assert.equal(w.place("engineer",head).ok,false);
 assert.equal(w.action("navigator","salute").ok,true);
 for(let i=0;i<40;i++)w.tick(head,.07);
 assert.equal(w.get("navigator").motion,"idle");
 assert.equal(w.remove("navigator"),true);
 assert.equal(w.actors.length,0);
});
test("follow moves with limited speed without entering viewer personal space",()=>{
 const w=new MRAvatarPresence();
 w.place("companion",head);
 w.action("companion","follow");
 const far=[...head];far[14]=10;
 w.tick(far,.1);
 assert.ok(w.get("companion").z<0&&w.get("companion").z>-1.8);
 for(let i=0;i<300;i++)w.tick(far,.07);
 assert.ok(Math.hypot(far[12]-w.get("companion").x,far[14]-w.get("companion").z)>=1.54);
});
