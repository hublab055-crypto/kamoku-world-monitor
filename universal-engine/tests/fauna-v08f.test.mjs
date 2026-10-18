import test from "node:test";
import assert from "node:assert/strict";
import {FaunaWorld,WILD_SPECIES,HORSE_GAITS,TACK} from "../planet-explorer/fauna.mjs";
import {faunaGeometry} from "../planet-explorer/fauna-geometry.mjs";

const actor=()=>({x:16,z:13,yaw:0,altitudeM:2.5,jumpY:0,moving:false,
 lat:20,lon:30,moveTarget:null,clearMoveTarget(){this.moveTarget=null;},
 locationAt(x,z){return {lat:20+z*.001,lon:30+x*.001};}});
const tameHorse=(world,player)=>{
 const horse=world.animals.find(a=>a.kind==="horse");
 for(let i=0;i<3;i++)assert.equal(world.tame(horse.id,player).ok,true);
 assert.equal(horse.tame,true);
 return horse;
};
test("seven wild animal ancestor types, population and unique IDs",()=>{
 const w=new FaunaWorld();
 assert.deepEqual(Object.keys(WILD_SPECIES),["horse","cattle","sheep","goat","chicken","dog","cat"]);
 assert.equal(w.animals.length,13);
 assert.equal(new Set(w.animals.map(a=>a.id)).size,13);
 assert.equal(w.animals.every(a=>!a.tame),true);
});
test("only an adjacent, tamed and equipped horse can be ridden",()=>{
 const w=new FaunaWorld(),player=actor(),horse=w.animals[0];
 assert.equal(w.board(horse.id,player).ok,false);
 assert.equal(w.tame(horse.id,{...player,x:400}).ok,false);
 for(let i=1;i<=3;i++){
  assert.equal(w.tame(horse.id,player).ok,true);
  assert.equal(horse.trust,i);
 }
 assert.equal(w.board(horse.id,player).ok,false);
 const resources={wood:12,fiber:12,metal:5};
 for(const part of ["bit","reins","saddle"])assert.equal(w.equip(horse.id,part,player,resources).ok,true);
 assert.deepEqual(resources,{wood:10,fiber:8,metal:4});
 assert.equal(w.board(horse.id,player).ok,true);
 assert.equal(w.mountId,horse.id);
 assert.equal(player.x,horse.x);
 assert.equal(w.speed(),HORSE_GAITS.trot);
 assert.equal(w.setGait("gallop"),true);
 assert.equal(w.speed(),HORSE_GAITS.gallop);
 assert.equal(w.setGait("teleport"),false);
 assert.equal(w.dismount(player,()=>false).ok,false);
 assert.equal(w.mountId,horse.id);
 assert.equal(w.dismount(player,()=>true).ok,true);
 assert.equal(w.mountId,null);
 assert.ok(Math.hypot(player.x-horse.x,player.z-horse.z)>2);
 assert.equal(w.speed(),5);
});
test("horse tack consumes resources once; metal horseshoes are optional",()=>{
 const w=new FaunaWorld(),p=actor(),horse=tameHorse(w,p),bag={wood:2,fiber:4,metal:3};
 assert.equal(w.equip(horse.id,"bit",p,bag).ok,true);
 assert.equal(w.equip(horse.id,"reins",p,bag).ok,true);
 assert.equal(w.equip(horse.id,"saddle",p,bag).ok,true);
 assert.equal(w.canMount(horse),true);
 assert.equal(w.equip(horse.id,"horseshoes",p,bag).ok,true);
 assert.deepEqual(bag,{wood:0,fiber:0,metal:0});
 assert.equal(w.equip(horse.id,"horseshoes",p,bag).ok,true);
 assert.deepEqual(bag,{wood:0,fiber:0,metal:0});
 assert.ok(Object.keys(TACK).length===4);
});
test("mounted horse follows the rider and absorbs travel fatigue",()=>{
 const w=new FaunaWorld(),p=actor(),horse=tameHorse(w,p);
 for(const part of ["bit","reins","saddle"])assert.equal(w.equip(horse.id,part,p,{wood:10,fiber:10,metal:10}).ok,true);
 w.board(horse.id,p);w.setGait("gallop");
 p.moving=true;p.x+=5;p.z+=4;
 w.advance(.1,p,()=>true);
 assert.equal(horse.x,p.x);assert.equal(horse.z,p.z);
 assert.ok(horse.stamina<100);
 horse.stamina=8;
 assert.equal(w.speed(),HORSE_GAITS.walk);
});
test("tamed summoned horse follows, but wild animals cannot be called",()=>{
 const w=new FaunaWorld(),p=actor();
 assert.equal(w.call(w.animals[3].id,p).ok,false);
 const horse=tameHorse(w,p);
 horse.x=-20;horse.z=-20;
 assert.equal(w.call(horse.id,p).ok,true);
 const oldDistance=w.range(horse,p);
 w.advance(.1,p,()=>true);
 assert.ok(w.range(horse,p)<oldDistance);
});
test("save/restore keeps ownership, gear, stamina, gait and rider",()=>{
 const w=new FaunaWorld(),p=actor(),horse=tameHorse(w,p);
 for(const part of ["bit","reins","saddle"])assert.equal(w.equip(horse.id,part,p,{wood:10,fiber:10,metal:10}).ok,true);
 w.board(horse.id,p);w.setGait("walk");horse.stamina=44;
 const restored=new FaunaWorld(JSON.parse(JSON.stringify(w.snapshot())));
 assert.equal(restored.mountId,horse.id);
 assert.equal(restored.mount.stamina,44);
 assert.equal(restored.mount.gear.saddle,true);
 assert.equal(restored.speed(),HORSE_GAITS.walk);
});
test("each wild ancestor has valid self-contained WebGL geometry",()=>{
 for(const k of Object.keys(WILD_SPECIES)){
  const m=faunaGeometry(k);
  assert.ok(m.positions.length>0,k);
  assert.equal(m.positions.length,m.normals.length,k);
  assert.equal(m.positions.length,m.colors.length,k);
  assert.ok(m.indices.every(i=>i>=0&&i<m.positions.length/3),k);
 }
 const plain=faunaGeometry("horse"),equipped=faunaGeometry("horse",
  {bit:true,reins:true,saddle:true,horseshoes:true});
 assert.ok(equipped.indices.length>plain.indices.length);
});
