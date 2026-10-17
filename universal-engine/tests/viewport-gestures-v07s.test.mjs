import test from "node:test";
import assert from "node:assert/strict";
import {ViewportGestures} from "../planet-explorer/viewport-gestures.mjs";
import {BattleTest} from "../planet-explorer/battle-test.mjs";
import {SquadEngine} from "../planet-explorer/squad.mjs";

const p=(id,x,y,type="touch")=>({pointerId:id,clientX:x,clientY:y,pointerType:type});
test("single tap selects; nearby second tap issues exactly one double-tap",()=>{
 let t=0;const calls=[];
 const g=new ViewportGestures({now:()=>t,onTap:v=>calls.push(["tap",v]),onDoubleTap:v=>calls.push(["double",v])});
 g.down(p(1,20,30));g.up(p(1,20,30));
 assert.equal(calls.length,1);assert.equal(calls[0][0],"tap");
 t=250;
 g.down(p(2,24,34));g.up(p(2,24,34));
 assert.deepEqual(calls.map(c=>c[0]),["tap","double"]);
 t=600;
 g.down(p(3,24,34));g.up(p(3,24,34));
 assert.equal(calls.at(-1)[0],"tap");
});
test("single-finger drag rotates, suppresses click",()=>{
 const log=[];const g=new ViewportGestures({onDrag:(x,y)=>log.push([x,y]),onTap:()=>log.push("tap")});
 g.down(p(1,10,10));
 g.move(p(1,28,18));g.move(p(1,35,20));g.up(p(1,35,20));
 assert.deepEqual(log,[[18,8],[7,2]]);
});
test("two-finger pinch zooms both ways, never rotates or taps",()=>{
 const zoom=[],other=[];
 const g=new ViewportGestures({onPinch:v=>zoom.push(v),onTap:()=>other.push("tap"),onDrag:()=>other.push("drag"),onDoubleTap:()=>other.push("double")});
 g.down(p(1,50,50));g.down(p(2,150,50));
 g.move(p(2,200,50));  // fingers farther apart => zoom in (factor < 1)
 g.move(p(2,125,50));  // fingers closer => zoom out (factor > 1)
 g.up(p(2,125,50));g.move(p(1,70,50));g.up(p(1,70,50));
 assert.equal(zoom.length,2);
 assert.ok(zoom[0]<1&&zoom[1]>1);
 assert.deepEqual(other,[]);
});
test("two taps separated by position or pointer type are independent singles",()=>{
 let clock=0;const calls=[];
 const g=new ViewportGestures({now:()=>clock,onTap:()=>calls.push("tap"),onDoubleTap:()=>calls.push("double")});
 g.down(p(1,10,10));g.up(p(1,10,10));
 clock=100;g.down(p(2,80,90));g.up(p(2,80,90));
 clock=150;g.down(p(3,80,90,"mouse"));g.up(p(3,80,90,"mouse"));
 assert.deepEqual(calls,["tap","tap","tap"]);
});
test("manual target ID can override global target for NPC arrow impact",()=>{
 const b=new BattleTest();
 b.enemies=[
  {id:1,x:0,z:4,radius:.5,hp:40,maxHp:40,anim:"idle",animTime:0},
  {id:2,x:0,z:7,radius:.5,hp:40,maxHp:40,anim:"idle",animTime:0}
 ];
 b.targetId=1;
 const hits=b.hitArrow({x:0,z:0,yaw:0},{targetId:2});
 assert.equal(hits.length,1);
 assert.equal(hits[0].id,2);
 assert.equal(b.enemies[0].hp,40);
});
test("companion bow fires exactly once at the release point",()=>{
 const squad=Object.create(SquadEngine.prototype);
 const player={id:"player",control:{altitudeM:2.5,nearGround:true,update(){}},auto:false,cooldown:0,task:null};
 const scout={id:"scout",control:{altitudeM:2.5,nearGround:true,update(){}},auto:false,cooldown:0,
  task:{kind:"equipped_bow",duration:1.62,remaining:1.62,impacted:false},name:"斥候"};
 squad.agents=[player,scout];squad.actions={resources:{wood:0,stone:0}};
 const impacts=[];squad.onEquippedImpact=(a,task)=>impacts.push([a.id,task.remaining]);
 for(let i=0;i<24;i++)squad.advance(.1);
 assert.equal(impacts.length,1);
 assert.equal(impacts[0][0],"scout");
 assert.ok(impacts[0][1]<=1.62*.19);
});
