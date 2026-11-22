import test from 'node:test';
import assert from 'node:assert/strict';
import {installShipViewGestures,pickShipContact} from '../planet-explorer/ship-view-gestures.mjs';
import {SpaceCombat} from '../planet-explorer/space-combat.mjs';
function harness(roaming=true){
 const target=new EventTarget(),combat=new SpaceCombat(),orbit=[],taps=[],legacy=[];
 const voyage={active:true,seated:true,status:'cruise',routeAlong:0,crossTrack:0};
 const rect={left:35,top:60,width:844,height:390},projected=[{id:'pirate-alpha',u:.5,v:.5,onScreen:true}];
 installShipViewGestures(target,{isActive:()=>true,isRoaming:()=>roaming,getInterior:()=>({turn:(...args)=>orbit.push(args)}),ownerWindow:null,
  onOrbit:(...args)=>orbit.push(args),onZoom:()=>{},onTap:(x,y)=>{const hit=pickShipContact(projected,rect,x,y);if(hit){taps.push(hit.id);combat.lockContact(hit.id,voyage);}}});
 // Production registration order: orbit capture was installed before combat.
 target.addEventListener('pointerdown',()=>legacy.push('down'),true);
 const send=(type,x=457,y=255)=>{const e=new Event(type,{cancelable:true});Object.assign(e,{pointerId:1,isPrimary:true,button:0,clientX:x,clientY:y});target.dispatchEvent(e);};
 return {send,combat,orbit,taps,legacy};
}
test('exterior enemy tap locks through the earlier camera capture listener',()=>{
 const h=harness();h.send('pointerdown');h.send('pointerup');
 assert.equal(h.legacy.length,0,'camera owner consumed pointerdown before combat, reproducing old obstruction');
 assert.deepEqual(h.taps,['pirate-alpha']);assert.deepEqual(h.combat.locked,['pirate-alpha']);assert.equal(h.orbit.length,0);
});
test('small touch jitter remains a tap without rotating the camera',()=>{
 const h=harness();h.send('pointerdown');h.send('pointermove',460,257);h.send('pointerup',460,257);
 assert.deepEqual(h.combat.locked,['pirate-alpha']);assert.equal(h.orbit.length,0);
});
test('dragging over a ship or returning to the starting pixel never locks',()=>{
 const h=harness();h.send('pointerdown');h.send('pointermove',490,255);h.send('pointermove',457,255);h.send('pointerup');
 assert.ok(h.orbit.length>0);assert.equal(h.combat.locked.length,0);
});
test('cancelled and lost-capture gestures never lock',()=>{
 for(const type of ['pointercancel','lostpointercapture']){const h=harness();h.send('pointerdown');h.send(type);h.send('pointerup');assert.equal(h.taps.length,0);}
});
test('picking uses canvas offset and ignores invisible targets',()=>{
 assert.equal(pickShipContact([{id:'a',u:.5,v:.5,onScreen:false}],{left:35,top:60,width:844,height:390},457,255),null);
});

test('cabin tap reaches enemy lock after pointer capture, without looking away',()=>{
 const h=harness(false);h.send('pointerdown');h.send('pointermove',460,256);h.send('pointerup',460,256);
 assert.deepEqual(h.combat.locked,['pirate-alpha']);assert.equal(h.orbit.length,0);assert.equal(h.legacy.length,0);
});
test('cabin drag changes view without selecting the enemy underneath',()=>{
 const h=harness(false);h.send('pointerdown');h.send('pointermove',480,255);h.send('pointerup',480,255);
 assert.ok(h.orbit.length>0);assert.equal(h.combat.locked.length,0);
});

test('walking up the cabin aisle reaches a seat, and a cabin tap then locks an enemy',async()=>{
 const {ShipJourney}=await import('../planet-explorer/ship-journey.mjs');
 const voyage=new ShipJourney({originId:'terra',status:'origin-orbit',interior:{schemaVersion:1,x:0,z:10,yaw:0}});
 for(let i=0;i<100&&!voyage.isNearSeat();i++)voyage.interior.walk(1,0,.12);
 assert.ok(voyage.interior.canOccupy(voyage.interior.x,voyage.interior.z));
 assert.equal(voyage.sit().ok,true);
 const target=new EventTarget(),combat=new SpaceCombat();
 installShipViewGestures(target,{isActive:()=>true,isRoaming:()=>false,getInterior:()=>voyage.interior,ownerWindow:null,
  onOrbit:()=>{},onZoom:()=>{},onTap:()=>combat.lockContact('pirate-alpha',voyage)});
 for(const type of ['pointerdown','pointerup']){
  const event=new Event(type,{cancelable:true});
  Object.assign(event,{pointerId:1,isPrimary:true,button:0,clientX:400,clientY:200});
  target.dispatchEvent(event);
 }
 assert.deepEqual(combat.locked,['pirate-alpha']);
 assert.equal(voyage.stand().ok,true);
 assert.ok(voyage.interior.canOccupy(voyage.interior.x,voyage.interior.z));
});

test('the front of the chair exposes the helm action and permits sitting',async()=>{
 const {ShipJourney}=await import('../planet-explorer/ship-journey.mjs');
 const voyage=new ShipJourney({originId:'terra',status:'origin-orbit',interior:{schemaVersion:1,x:0,z:-12.4,yaw:0}});
 assert.ok(voyage.interior.nearStations().some(station=>station.id==='helm'));
 assert.equal(voyage.sit().ok,true);
});
