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

test('a surface departure stays in controllable atmospheric flight until the pilot climbs to space',()=>{
 const v=ship({destinationId:null,status:'docked',hatchOpen:false,airAltitude:0,airSpeed:0});
 assert.equal(v.launch().ok,true);
 assert.equal(v.status,'atmosphere');
 v.tick(.1);
 assert.ok(v.airNorth>0);
 assert.equal(v.airAltitude,5);
 v.pitch(90);
 for(let i=0;i<800&&v.status==='atmosphere';i++)v.tick(.1);
 assert.equal(v.status,'origin-orbit');
 assert.equal(v.chooseDestination('cinder',18).ok,true);
 assert.equal(v.startTransfer().ok,true);
});
test('planet gravity pulls an unpowered ship down, while powered stabilization holds it level',()=>{
 const terra=ship({destinationId:null,originId:'terra',airAltitude:500,fuel:0,airSpeed:0});
 const selene=ship({originId:'terra',destinationId:'selene',airAltitude:500,fuel:0,airSpeed:0});
 const hovering=ship({destinationId:null,airAltitude:500,airSpeed:0,throttle:0});
 for(let i=0;i<10;i++){terra.tick(.1);selene.tick(.1);hovering.tick(.1);}
 assert.ok(terra.airAltitude<selene.airAltitude);
 assert.ok(selene.airAltitude<500);
 assert.equal(hovering.airAltitude,500);
 const restored=ShipJourney.fromSnapshot(terra.snapshot());
 assert.equal(restored.airVerticalVelocity,terra.airVerticalVelocity);
});
test('a landed ship can take off again from its destination planet',()=>{
 const v=ship({status:'landed',hatchOpen:false});
 v.landingSite={bodyId:'cinder',lat:28,lon:42,yaw:0,padElevationM:600};
 assert.equal(v.launch().ok,true);
 assert.equal(v.flightBodyId,'cinder');
 assert.equal(v.originId,'cinder');
 assert.equal(v.destinationId,null);
 assert.equal(v.status,'atmosphere');
 assert.equal(v.launchSite.padElevationM,600);
});

test('independent VOL thrust levels the ship during flight and moves vertically in space',()=>{
 const v=ship({destinationId:null,pitchDeg:45,throttle:0,airAltitude:500});
 v.horizon=true;v.volThrottle=1;
 for(let i=0;i<10;i++)v.tick(.1);
 assert.ok(Math.abs(v.pitchDeg)<1);
 assert.ok(v.airAltitude>505);
 v.status='origin-orbit';v.autopilot=false;v.pitchDeg=0;
 v.tick(.1);
 assert.ok(v.routeVertical>0);
 assert.equal(v.routeAlong,0);
 assert.equal(ShipJourney.fromSnapshot(v.snapshot()).volThrottle,1);
});

test('landing gear defaults to automatic and manual retraction blocks VTOL landing',()=>{
 const v=ship();
 assert.equal(v.gearMode,'auto');
 assert.equal(v.gearDown,false);
 v.cycleGear();assert.equal(v.gearDown,true);
 v.cycleGear();assert.equal(v.beginVTOL().ok,false);
 v.cycleGear();assert.equal(v.beginVTOL().ok,true);
 assert.equal(v.gearDown,true);
});
