import test from 'node:test';
import assert from 'node:assert/strict';
import {ShipJourney} from '../planet-explorer/ship-journey.mjs';
import {SpaceCombat} from '../planet-explorer/space-combat.mjs';
import {shipSensorContacts,projectShipHudTarget} from '../planet-explorer/ship-space-visuals.mjs';
const ship=(data={})=>new ShipJourney({originId:'terra',destinationId:'cinder',status:'atmosphere',seated:true,throttle:1,...data});
test('pitch can pass vertical and make a complete loop while flight follows the nose',()=>{
 const v=ship({airSpeed:100,airAltitude:500});v.pitch(100);assert.equal(v.pitchDeg,100);
 v.tick(.1);assert.ok(v.airNorth<0);assert.ok(v.airAltitude>500);
 v.pitch(260);assert.equal(v.pitchDeg,0);
 const copy=ShipJourney.fromSnapshot(v.snapshot());assert.equal(copy.pitchDeg,0);
});
test('nose-down flight can reach the ground approach altitude',()=>{
 const v=ship({airAltitude:25,airSpeed:150,pitchDeg:-90});
 for(let i=0;i<4;i++)v.tick(.1);
 assert.equal(v.airAltitude,2);assert.ok(Math.abs(v.airNorth)<1e-8);
});
test('fuel reserves and repeatable rescue prevent a permanent fuel soft lock',()=>{
 const c=new SpaceCombat(),v=ship({fuel:0});
 assert.equal(c.refuel(v).ok,true);assert.equal(v.fuel,35);assert.equal(c.supplies.fuel,2);
 v.fuel=0;c.supplies.fuel=0;assert.equal(c.refuel(v,true).ok,true);assert.equal(v.fuel,20);
 v.fuel=0;assert.equal(c.refuel(v,true).ok,false);
 const restored=new SpaceCombat(c.systemSnapshot());assert.equal(restored.refuel(v,true).ok,false);
 for(let i=0;i<1201;i++)restored.advance(.1,v);
 assert.equal(restored.refuel(v,true).ok,true);
});
test('shield waits after impact then regenerates, and destroyed generator needs user repair',()=>{
 const c=new SpaceCombat(),v=ship();c.applyDamage(c.player,40,'player');
 for(let i=0;i<70;i++)c.advance(.1,v);assert.equal(c.player.shield,60);
 for(let i=0;i<30;i++)c.advance(.1,v);assert.ok(c.player.shield>60);
 c.parts.shield=0;const shield=c.player.shield;c.advance(.1,v);assert.equal(c.player.shield,shield);
 assert.equal(c.repairPart('shield').ok,true);assert.equal(c.parts.shield,35);c.advance(.1,v);assert.ok(c.player.shield>shield);
});
test('hull damage is localized and repaired explicitly with persistent kits',()=>{
 const c=new SpaceCombat();c.player.shield=0;c.applyDamage(c.player,20,'player');
 const key=Object.keys(c.parts).find(k=>c.parts[k]<100);assert.ok(key);
 const damaged=c.parts[key];assert.equal(c.repairPart(key).ok,true);assert.ok(c.parts[key]>damaged);
 const copy=new SpaceCombat(c.systemSnapshot());assert.deepEqual(copy.parts,c.parts);assert.equal(copy.supplies.kits,11);
});
test('friendly and mineral contacts survive the final hostile, with offscreen direction projection',()=>{
 const c=new SpaceCombat(),v=ship({status:'cruise'});c.targets.forEach(t=>t.hp=0);
 const contacts=shipSensorContacts(v,c);assert.ok(contacts.some(t=>t.faction==='friendly'));assert.ok(contacts.some(t=>t.faction==='resource'));
 const point=projectShipHudTarget([100,2,100],{eye:[0,2,0],target:[0,2,-1],fovDeg:108},844,390);
 assert.equal(point.visible,false);assert.equal(point.behind,true);assert.ok(Number.isFinite(point.angleDeg));
});
test('saved seated pilot is placed next to front window',()=>{
 const v=ship();assert.equal(v.interior.z,-11.25);assert.equal(ShipJourney.fromSnapshot(v.snapshot()).interior.z,-11.25);
});
