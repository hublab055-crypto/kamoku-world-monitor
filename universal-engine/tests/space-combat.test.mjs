import test from "node:test";
import assert from "node:assert/strict";
import {SpaceCombat,SHIP_WEAPONS,shipContactPosition,combatEligible} from "../planet-explorer/space-combat.mjs";

const onScreen=(id,u=.5,v=.5)=>({id,u,v,onScreen:true});
const flight={active:true,status:"cruise",seated:true,attitudeYawDeg:0,pitchDeg:0};
const targets=["pirate-alpha","pirate-beta","pirate-gamma"];

test("cockpit combat disallows walk/landing, supports both ship voyage variants",()=>{
 assert.equal(combatEligible(flight),true);
 assert.equal(combatEligible({...flight,seated:false}),false);
 assert.equal(combatEligible({...flight,status:"entry"}),false);
 assert.equal(combatEligible({...flight,status:"landed"}),false);
 assert.equal(combatEligible({...flight,seated:undefined,interior:{mode:"cockpit"}}),true);
});

test("ship yaw moves stationary targets across the nose rather than ship translation",()=>{
 const target={bearing:0,pitch:0,distance:260};
 const a=shipContactPosition(target,flight);
 assert.ok(Math.abs(a[0])<1e-8&&Math.abs(a[2]+260)<1e-8);
 const b=shipContactPosition(target,{...flight,attitudeYawDeg:90});
 assert.ok(b[0]<-259&&Math.abs(b[2])<1e-8);
});

test("single tap lock is immediate, and a target leaving the view is unlocked",()=>{
 const c=new SpaceCombat();
 c.syncVisibility(targets.map((id,i)=>onScreen(id,.3+i*.2)));
 assert.equal(c.acquire("pirate-alpha"),true);
 assert.equal(c.acquire("pirate-beta"),true);
 assert.deepEqual(c.locked,["pirate-beta"],"pulse gun replaces first lock");
 c.syncVisibility([onScreen("pirate-beta",1.2)]);
 assert.deepEqual(c.locked,[]);
 assert.equal(c.fire().ok,false);
});

test("VR gaze holds for 0.85 s, switches target, and drops lock beyond screen",()=>{
 const c=new SpaceCombat();
 for(let i=0;i<7;i++)c.syncVisibility([onScreen("pirate-alpha")],.1,{vr:true});
 assert.deepEqual(c.locked,[]);
 for(let i=0;i<2;i++)c.syncVisibility([onScreen("pirate-alpha")],.1,{vr:true});
 assert.deepEqual(c.locked,["pirate-alpha"]);
 c.syncVisibility([onScreen("pirate-alpha",1.01)],.1,{vr:true});
 assert.deepEqual(c.locked,[]);
});

test("missiles can lock three visible enemies and fire one salvo",()=>{
 const c=new SpaceCombat();
 assert.equal(SHIP_WEAPONS.missile.locks,3);
 c.setWeapon("missile");
 c.syncVisibility(targets.map((id,i)=>onScreen(id,.30+i*.15)));
 for(const id of targets)assert.equal(c.acquire(id),true);
 assert.deepEqual(c.locked,targets);
 const shot=c.fire();
 assert.equal(shot.ok,true);
 assert.equal(shot.hits.length,3);
 assert.equal(c.missiles,9);
 assert.equal(c.fire().ok,false,"cooldown prevents rapid fire");
 assert.deepEqual(c.targets.map(t=>t.hp),[35,35,10]);
 for(let i=0;i<11;i++)c.syncVisibility(targets.map(id=>onScreen(id)),.12);
 const next=c.fire();
 assert.equal(next.hits.length,3);
 assert.equal(c.missiles,6);
 assert.ok(c.targets.every(t=>t.hp===0));
 assert.deepEqual(c.locked,[]);
});

test("ammo bounds salvos and invisible targets cannot receive damage",()=>{
 const c=new SpaceCombat();c.setWeapon("missile");
 c.missiles=1;c.syncVisibility(targets.map(id=>onScreen(id)));
 for(const id of targets)c.acquire(id);
 const shot=c.fire();
 assert.equal(shot.hits.length,1);
 assert.equal(c.missiles,0);
 assert.equal(c.targets[1].hp,100);
 for(let i=0;i<12;i++)c.syncVisibility(targets.map(id=>onScreen(id)),.12);
 assert.equal(c.fire().ok,false);
 c.syncVisibility([]);
 assert.deepEqual(c.locked,[]);
});
