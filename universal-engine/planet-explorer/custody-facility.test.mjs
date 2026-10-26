import test from "node:test";
import assert from "node:assert/strict";
import {newCustodyFacility,advanceCustodyFacility,walkCustodyFacility,custodyFacilitySnapshot,custodyFacilityInteract,custodyPhase} from "./custody-facility.mjs";
import {custodyFacilityGeometry,custodyFacilityDoorGeometry} from "./custody-facility-geometry.mjs";

const advance=(state,seconds)=>{for(let i=0;i<seconds*10;i++)advanceCustodyFacility(state,.1);};
const move=(state,input,frames)=>{for(let i=0;i<frames;i++)walkCustodyFacility(state,input,.1);};

test("the compact upstairs cell is locked until the meal escort opens it",()=>{
 const s=newCustodyFacility();move(s,{forward:1},30);
 assert.ok(s.player.z < -6.2);assert.equal(s.door,0);
 advance(s,19);assert.equal(s.phase,"breakfast");
 assert.ok(s.door>.88);
 move(s,{forward:1},10);
 assert.ok(s.player.z > -6.15,"player can walk through the opened door");
});

test("second floor gallery protects against falls, east staircase reaches dining floor",()=>{
 const s=newCustodyFacility();advance(s,20);
 move(s,{forward:1},40); // through cell gate to the inner handrail
 assert.ok(s.player.z >= -4.81&&s.player.z <= -4.79);
 assert.equal(s.player.y,3.8);
 move(s,{strafe:1},35); // east gallery, never across the atrium
 assert.ok(s.player.x>8.3&&s.player.x<9.2);
 move(s,{forward:1},51); // down twenty steps
 assert.ok(s.player.y<=.4,"reaches ground floor");
 assert.ok(s.player.z>5);
});

test("other inmates walk from their cells to dining room and back at night",()=>{
 const s=newCustodyFacility();advance(s,85);
 assert.ok(s.inmates.every(n=>n.y<.25),"all inmates downstairs at breakfast");
 advance(s,200);
 assert.ok(s.inmates.every(n=>n.y>3.5&&n.z<-6.5),"all inmates back in cells");
 assert.ok(s.door<.1,"door closes for sleep");
});

test("guard uses the real stairs instead of teleporting between floors",()=>{
 const s=newCustodyFacility();advance(s,32);
 assert.ok(s.guard.y>0&&s.guard.y<3.8,"escort on the staircase");
 advance(s,40);
 assert.ok(s.guard.y<.5,"guard on first floor");
 advance(s,214);
 assert.ok(s.guard.y>3.5,"guard returned upstairs");
});

test("food and sleep are only usable near the correct furnishings",()=>{
 const s=newCustodyFacility();
 assert.equal(custodyFacilityInteract(s,"eat").ok,false);
 assert.equal(custodyFacilityInteract(s,"rest").ok,true);
 advance(s,80);
 s.player={...s.player,x:1,z:1.7,y:0};
 assert.equal(custodyFacilityInteract(s,"eat").ok,true);
 assert.equal(s.mealCount,1);
});

test("facility poses and NPC schedules survive save and reload",()=>{
 const s=newCustodyFacility();advance(s,45);
 move(s,{forward:1},9);
 const saved=custodyFacilitySnapshot(s),restored=newCustodyFacility(saved);
 assert.equal(restored.elapsed,s.elapsed);
 assert.equal(restored.player.z,s.player.z);
 assert.equal(restored.guard.y,s.guard.y);
 assert.equal(restored.inmates[0].step,s.inmates[0].step);
 assert.ok(restored.door>.88);
});

test("procedural geometry is WebGL Uint16-index-safe and aligned",()=>{
 for(const g of [custodyFacilityGeometry(),custodyFacilityDoorGeometry()]){
  assert.ok(g.positions.length>0);
  assert.equal(g.positions.length,g.normals.length);
  assert.equal(g.positions.length,g.colors.length);
  assert.ok(g.positions.length/3<65535);
  assert.equal(g.indices.length,g.positions.length/3);
  assert.ok(g.indices.every(i=>i<65535));
 }
});

test("phase boundaries include unlocked group escorts and locked nighttime",()=>{
 assert.equal(custodyPhase(14),"wake");
 assert.equal(custodyPhase(15),"breakfast");
 assert.equal(custodyPhase(90),"work");
 assert.equal(custodyPhase(180),"dinner");
 assert.equal(custodyPhase(235),"return");
 assert.equal(custodyPhase(270),"sleep");
});
