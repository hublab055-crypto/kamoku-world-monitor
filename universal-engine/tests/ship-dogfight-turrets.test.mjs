import test from 'node:test';
import assert from 'node:assert/strict';
import {ShipJourney} from '../planet-explorer/ship-journey.mjs';
import {SpaceCombat,shipEncounterPosition,shipContactPosition,shipPointToEncounter,encounterPointToShip} from '../planet-explorer/space-combat.mjs';
import {normalizeTurrets,aimTurret} from '../planet-explorer/ship-turrets.mjs';
const journey=(data={})=>new ShipJourney({originId:'terra',destinationId:'cinder',status:'cruise',seated:true,autopilot:false,throttle:0,...data});
const projection=id=>({id,u:.5,v:.5,onScreen:true});

test('integrated voyage translation and pitch move contacts in the same encounter frame',()=>{
 const v=journey({routeAlong:.4,crossTrack:.03,routeVertical:.02});
 assert.deepEqual(shipEncounterPosition(v),[360,240,4800]);
 const c=new SpaceCombat();c.advance(.1,v);
 assert.ok(c.targets[0].distance<300,'encounter spawns near ship at current route position');
 const before=shipContactPosition(c.targets[0],v);v.crossTrack+=.01;
 const after=shipContactPosition(c.targets[0],v);
 assert.ok(Math.abs(after[0]-before[0]+120)<1e-8);
 c.advance(.1,v);assert.ok(c.shipVelocity[0]>1000,'integrated route velocity feeds interception');
});
test('combined yaw and pitch transform muzzle coordinates reversibly',()=>{
 const v=journey({routeAlong:.35,attitudeYawDeg:73,pitchDeg:31});
 const local=[-9,4,-7],world=shipPointToEncounter(local,v);
 const back=encounterPointToShip(world.map((n,i)=>n-shipEncounterPosition(v)[i]),v);
 back.forEach((n,i)=>assert.ok(Math.abs(n-local[i])<1e-8));
});
test('pirate attack runs break away and re-enter rather than parking at a fixed offset',()=>{
 const v=journey(),c=new SpaceCombat(),states=new Set();
 for(let i=0;i<250;i++){c.advance(.1,v);states.add(c.targets[0].aiState);}
 assert.ok(states.has('breakaway'));assert.ok(states.has('intercept'));
 assert.ok(c.targets.every(t=>t.position.every(Number.isFinite)));
});
test('orbit permits manual forward and vertical maneuvering without starting a transfer',()=>{
 const v=journey({status:'origin-orbit',throttle:1,pitchDeg:30});
 for(let i=0;i<20;i++)v.tick(.1);
 assert.ok(v.routeAlong>0);assert.ok(v.routeVertical>0);assert.equal(v.status,'origin-orbit');
});
test('turret traverses over time and automatic fire waits for alignment',()=>{
 const v=journey(),c=new SpaceCombat();c.advance(.1,v);
 const target=c.targets[0];target.position=[260,0,0];target.velocity=[0,0,0];
 c.visible.add(target.id);c.acquire(target.id);c.autoFire=true;
 c.syncVisibility([projection(target.id)],.01,{voyage:v});
 assert.equal(c.projectiles.filter(p=>!p.enemy).length,0);
 for(let i=0;i<20;i++)c.syncVisibility([], .1,{voyage:v});
 assert.ok(c.projectiles.some(p=>!p.enemy)||c.targets[0].shield<100);
 assert.deepEqual(c.locked,[target.id],'offscreen target remains tracked');
});
test('disabled or misaligned mounts do not consume missile ammunition',()=>{
 const v=journey(),c=new SpaceCombat();c.advance(.1,v);c.setWeapon('missile');
 c.visible.add('pirate-alpha');c.acquire('pirate-alpha');
 c.turrets.forEach(m=>m.enabled=false);
 assert.equal(c.fire().ok,false);assert.equal(c.missiles,12);
});
test('hardpoint preferences are bounded and survive journey saves',()=>{
 const v=journey();v.turrets[0].x=-12.5;v.autoFire=true;
 const restored=ShipJourney.fromSnapshot(v.snapshot());
 assert.equal(restored.turrets[0].x,-12.5);assert.equal(restored.autoFire,true);
 assert.equal(normalizeTurrets([{x:Infinity,y:100,z:-100}])[0].y,8);
 assert.equal(normalizeTurrets([{x:Infinity,y:100,z:-100}])[0].z,-12);
});
test('manual approach enters atmosphere and reaches ground with the pilot still aboard',()=>{
 const v=journey({status:'approach',routeAlong:.98,routeVelocity:{along:.01,cross:0}});
 assert.equal(v.canDirectEntry,true);
 assert.equal(v.setLandingSite({bodyId:'cinder',lat:1,lon:2,yaw:0,padElevationM:50}),true);
 assert.equal(v.enterAtmosphere().ok,true);assert.equal(v.status,'entry');
 for(let i=0;i<250&&v.status!=='landed';i++)v.tick(.1);
 assert.equal(v.status,'landed');assert.equal(v.seated,true);assert.equal(v.hatchOpen,false);
 v.stand();v.interior.x=0;v.interior.z=12;
 assert.equal(v.toggleHatch().ok,true);assert.equal(v.canDisembark(),true);
});
test('off-axis flyby cannot trigger direct entry and old saves default to safe weapon settings',()=>{
 const v=journey({status:'flyby',routeAlong:1,crossTrack:.2});assert.equal(v.canDirectEntry,false);
 const old=v.snapshot();delete old.turrets;delete old.autoFire;
 const restored=ShipJourney.fromSnapshot(old);assert.equal(restored.turrets.length,3);assert.equal(restored.autoFire,false);
});

test('aligned guided launcher supports three locked targets in one salvo',()=>{
 const v=journey(),c=new SpaceCombat();c.advance(.1,v);c.setWeapon('missile');
 c.targets.forEach((t,i)=>{t.position=[0,0,260+i*30];t.velocity=[0,0,0];c.visible.add(t.id);c.acquire(t.id);});
 for(let i=0;i<8;i++)c.updateTurrets(.1,v);
 assert.equal(c.fire().hits.length,3);assert.equal(c.missiles,9);
});
test('pulse fire and enemy fire can miss after evasive motion',()=>{
 const v=journey(),c=new SpaceCombat();c.advance(.1,v);
 const t=c.targets[0];const shield=t.shield;
 c.projectiles.push({id:t.id,weapon:'pulse',seconds:.01,damage:25,impact:[5000,5000,5000]});
 c.projectiles.push({id:t.id,weapon:'enemy',enemy:true,seconds:.01,impact:[5000,5000,5000]});
 c.advance(.1,v);assert.equal(t.shield,shield);assert.equal(c.player.shield,100);
});
