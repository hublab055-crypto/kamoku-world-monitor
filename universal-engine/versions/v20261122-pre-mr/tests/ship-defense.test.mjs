import test from 'node:test';
import assert from 'node:assert/strict';
import {SpaceCombat,SHIP_WEAPONS} from '../planet-explorer/space-combat.mjs';
const v={active:true,seated:true,status:'cruise',routeAlong:0,crossTrack:0,routeVertical:0};
const missile=(c,d=250)=>{const t=c.targets[0];t.position=[0,0,d];c.launchEnemyMissile(t,v);return c.projectiles.at(-1);};
test('identified enemy can be locked from exterior tap without a stale visibility projection',()=>{
 const c=new SpaceCombat();assert.equal(c.visible.size,0);
 assert.equal(c.lockContact('pirate-alpha',v),true);assert.deepEqual(c.locked,['pirate-alpha']);
 assert.equal(c.lockContact('trade-caravan',v),false);
 c.targets[1].position=[0,0,2000];assert.equal(c.lockContact('pirate-beta',v),false);
});
test('enemy guided missile damages the player when defenses are off',()=>{
 const c=new SpaceCombat();c.ciwsEnabled=false;const m=missile(c);
 for(let i=0;i<30&&m.seconds>0;i++)c.advanceDefense(.1,v);
 assert.equal(m.seconds,0);assert.equal(c.player.shield,70);
});
test('automatic CIWS consumes ammunition and destroys an incoming missile in a small blast',()=>{
 const c=new SpaceCombat(),m=missile(c);
 c.advanceDefense(.1,v);assert.equal(m.hp,6);
 c.advanceDefense(.1,v);assert.equal(m.seconds,0);assert.equal(c.ciwsAmmo,594);
 assert.equal(c.player.shield,100);assert.equal(c.defenseBursts.length,1);assert.ok(c.defenseTraces.length>0);
});
test('depleted or disabled CIWS does not intercept',()=>{
 for(const disabled of [true,false]){
  const c=new SpaceCombat();c.ciwsEnabled=!disabled;c.ciwsAmmo=disabled?600:0;
  const m=missile(c);c.advanceDefense(.1,v);assert.equal(m.hp,12);
 }
});
test('flares divert nearby seekers, use a charge, and enforce cooldown',()=>{
 const c=new SpaceCombat();c.ciwsEnabled=false;const m=missile(c,300);
 assert.equal(c.deployFlares(v).ok,true);assert.equal(c.flareAmmo,7);assert.equal(c.deployFlares(v).ok,false);
 for(let i=0;i<100&&m.seconds>0;i++)c.advanceDefense(.1,v);
 assert.ok(m.decoy);assert.equal(c.player.shield,100);assert.equal(m.seconds,0);
});
test('defense stores and settings persist and rapid gun is a selectable fast weapon',()=>{
 const c=new SpaceCombat();c.ciwsAmmo=12;c.flareAmmo=2;c.ciwsEnabled=false;
 const restored=new SpaceCombat(c.systemSnapshot());assert.equal(restored.ciwsAmmo,12);assert.equal(restored.flareAmmo,2);assert.equal(restored.ciwsEnabled,false);
 assert.equal(c.setWeapon('rapid'),true);assert.ok(SHIP_WEAPONS.rapid.cooldown<SHIP_WEAPONS.pulse.cooldown);
});

test('fire control locks a visible hostile without firing by itself',()=>{
 const c=new SpaceCombat();
 c.fireControl=true;
 c.syncVisibility([{id:'pirate-alpha',onScreen:true,u:.5,v:.5}],0,{voyage:v});
 assert.deepEqual(c.locked,['pirate-alpha']);
 assert.equal(c.projectiles.length,0);
});
test('enemy fighter diverts player missiles and battleship CIWS destroys them',()=>{
 const c=new SpaceCombat();
 const shotFor=id=>{
  const t=c.targets.find(target=>target.id===id);
  return {id,origin:t.position.map((n,i)=>n+(i===2?-100:0)),seconds:.25,total:1};
 };
 const fighter=shotFor('pirate-alpha');
 assert.equal(c.interceptPlayerMissile(fighter),false);
 assert.ok(fighter.decoy);
 const battleship=shotFor('pirate-beta');
 assert.equal(c.interceptPlayerMissile(battleship),true);
 assert.equal(battleship.seconds,0);
 assert.equal(c.defenseBursts.length,1);
});
