import test from "node:test";
import assert from "node:assert/strict";
import {
 SpaceCombat,shipEncounterPosition,shipContactPosition,shipContactDistance,
 missileTrailPoint
} from "../planet-explorer/space-combat.mjs";
import {shipSensorContacts} from "../planet-explorer/ship-space-visuals.mjs";

const flight={active:true,status:"cruise",seated:true,attitudeYawDeg:0,pitchDeg:0,throttle:0,
 transferX:0,transferY:0,transferZ:0};

test("all four contact types use shared physical positions and ranges",()=>{
 const combat=new SpaceCombat();
 combat.advance(.1,flight);
 const contacts=shipSensorContacts(flight,combat);
 for(const c of contacts.filter(c=>c.id!=="planet")){
  const target=combat.allContacts.find(t=>t.id===c.id);
  assert.ok(target);
  assert.deepEqual(c.position,shipContactPosition(target,flight));
  assert.ok(Math.abs(c.rangeM-shipContactDistance(target,flight))<1e-9);
  assert.equal(c.estimate,false);
 }
 const tags=contacts.filter(c=>c.id!=="planet").map(c=>c.icon);
 assert.ok(tags.includes("🔹")&&tags.includes("🟢")&&tags.includes("♦")&&tags.includes("🔸"));
});
test("ships rotate on yaw, but their ranges cannot change when only the camera turns",()=>{
 const combat=new SpaceCombat();
 const target=combat.targets[0];
 const a=shipContactPosition(target,flight);
 const d=shipContactDistance(target,flight);
 const turned={...flight,attitudeYawDeg:35,pitchDeg:20};
 const b=shipContactPosition(target,turned);
 assert.ok(Math.hypot(...a.map((n,i)=>n-b[i]))>50);
 assert.equal(shipContactDistance(target,turned),d);
});
test("ship transfer frame changes metric range by exactly the projected 3D offset",()=>{
 const combat=new SpaceCombat();const target=combat.targets[0];
 const moved={...flight,transferX:.005};
 assert.deepEqual(shipEncounterPosition(moved),[60,0,0]);
 const position=shipContactPosition(target,moved);
 assert.ok(Math.abs(Math.hypot(position[0],position[1]-2,position[2])-
  shipContactDistance(target,moved))<1e-8);
});
test("friendly and resource contacts are never weapon-locked",()=>{
 const combat=new SpaceCombat();
 combat.syncVisibility(combat.allContacts.map((t,i)=>({id:t.id,u:.3,v:.4,onScreen:true})));
 for(const c of combat.nonHostiles)assert.equal(combat.acquire(c.id),false);
 assert.equal(combat.acquire("pirate-alpha"),true);
});
test("guided missile path curves, has a visible trail and still reaches the target",()=>{
 const start=[0,2,-7],end=[165,38,-390],seed=2.4;
 assert.deepEqual(missileTrailPoint(start,end,0,seed),start);
 const mid=missileTrailPoint(start,end,.50,seed);
 assert.ok(mid[1]>(start[1]+end[1])/2+1);
 const finish=missileTrailPoint(start,end,1,seed);
 assert.ok(Math.hypot(...finish.map((x,i)=>x-end[i]))<1e-9);
 for(let i=0;i<=100;i++){
  assert.ok(missileTrailPoint(start,end,i/100,seed).every(Number.isFinite));
 }
});
test("incoming pirate warning, ceasefire, surrender demand and damage cause radio events",()=>{
 const combat=new SpaceCombat();
 combat.advance(.08,flight);
 assert.ok(combat.radioEvents.some(e=>e.kind==="warning"));
 assert.equal(combat.demandSurrender("pirate-alpha").ok,false);
 assert.equal(combat.requestCeasefire().ok,false);
 const foe=combat.targets[0];foe.shield=0;foe.hp=42;
 combat.advance(.08,flight);
 assert.ok(combat.radioEvents.some(e=>e.kind==="offer"));
 assert.equal(combat.respondSurrender("pirate-alpha",true).ok,true);
 assert.equal(foe.surrendered,true);
 assert.equal(combat.combatTargets.some(x=>x.id===foe.id),false);
});
test("player surrender halts weapon fire; retreat restores it",()=>{
 const combat=new SpaceCombat();
 combat.syncVisibility([{id:"pirate-alpha",u:.5,v:.5,onScreen:true}]);
 assert.equal(combat.acquire("pirate-alpha"),true);
 assert.equal(combat.offerSurrender().ok,true);
 assert.equal(combat.fire().ok,false);
 assert.ok(combat.playerSurrendered);
 assert.equal(combat.offerSurrender().ok,true);
 assert.equal(combat.playerSurrendered,false);
});
test("destroyed ship generates persistent debris effects and is removed from scan",()=>{
 const combat=new SpaceCombat(),enemy=combat.targets[0];
 enemy.shield=0;enemy.hp=12;
 const impact=combat.applyDamage(enemy,25,enemy.id);
 assert.equal(impact.destroyed,true);
 assert.equal(combat.explosions[0].seconds,2.4);
 assert.equal(combat.allContacts.some(t=>t.id===enemy.id),false);
 combat.advance(.1,flight);
 assert.ok(combat.explosions[0]?.seconds<2.4);
 assert.ok(combat.radioEvents.some(e=>e.kind==="destroyed"));
});
