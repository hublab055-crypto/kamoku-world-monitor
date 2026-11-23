import test from "node:test";
import assert from "node:assert/strict";
import {MRRoomLayout,MR_FLOOR_POSES,MR_CHAIR_POSES,MR_SOFA_POSES,MR_STAND_POSES} from "./mr-room-layout.mjs";
import {MRAvatarPresence} from "./mr-avatar-presence.mjs";
import {MRLivingSocial} from "./mr-living-social.mjs";
const head=[1,0,0,0,0,1,0,0,0,0,1,0,0,1.65,0,1];
const room=()=>{const r=new MRRoomLayout({version:1,width:8,depth:8});r.setOrigin(0,0);return r;};
test("MR Living exposes floor five, chair four, sofa four and stand five poses",()=>{
 assert.equal(MR_FLOOR_POSES.length,5);assert.equal(MR_CHAIR_POSES.length,4);
 assert.equal(MR_SOFA_POSES.length,4);assert.equal(MR_STAND_POSES.length,5);
});
test("floor zabuton is an explicit seat with a configurable floor pose",()=>{
 const r=room();
 assert.equal(r.nearestSeat(0,-2),null);
 const zabuton=r.addCushion({x:0,z:-2},{pose:"floor_seiza"});
 assert.equal(zabuton.surface,"floor");
 assert.equal(r.nearestSeat(0,-2).pose,"floor_seiza");
 assert.equal(r.setCushionPose(zabuton.id,"floor_side_sit"),true);
 assert.equal(r.setCushionPose(zabuton.id,"chair_upright"),false);
 const a=new MRAvatarPresence();assert.equal(a.place("navigator",head).ok,true);
 assert.equal(a.action("navigator","sit",{room:r}).ok,true);
 for(let i=0;i<70;i++)a.tick(head,.06,r);
 assert.equal(a.get("navigator").motion,"Seated");
 assert.equal(a.get("navigator").seatPose,"floor_side_sit");
 assert.equal(a.setPose("navigator","floor_knees_up").ok,true);
 assert.equal(a.get("navigator").seatPose,"floor_knees_up");
 assert.equal(a.action("navigator","stand",{room:r}).ok,true);
 assert.equal(a.get("navigator").seatId,null);
 assert.equal(a.setPose("navigator","stand_arms_crossed").ok,true);
});
test("sofa seats require individual cushions and cannot be shared",()=>{
 const r=room();
 const sofa=r.add("sofa",{x:0,z:-2},{width:2,depth:.8,seatY:.43});
 assert.equal(r.seatWorld().length,0);
 const c0=r.addCushion({x:-.65,z:-2},{furnitureId:sofa.id,seatIndex:0});
 const c1=r.addCushion({x:0,z:-2},{furnitureId:sofa.id,seatIndex:1});
 assert.ok(c0&&c1);assert.equal(r.seatWorld().length,2);
 assert.equal(r.addCushion({x:0,z:-2},{furnitureId:sofa.id,seatIndex:1}),null);
 const people=new MRAvatarPresence();
 people.place("navigator",head);people.place("engineer",head);people.place("companion",head);
 assert.equal(people.action("navigator","sit",{room:r}).ok,true);
 assert.equal(people.action("engineer","sit",{room:r}).ok,true);
 assert.notEqual(people.get("navigator").seatId,people.get("engineer").seatId);
 assert.equal(people.action("companion","sit",{room:r}).ok,false);
 const removed=r.removeLastCushion();
 people.tick(head,.06,r);
 const affected=people.actors.find(a=>a.seatId===removed.id);
 assert.equal(affected,undefined,"removed seat cannot remain occupied");
});
test("saved cushions are relative to room origin and follow furniture removal",()=>{
 const r=room();const chair=r.add("chair",{x:.2,z:-2.1});
 r.addCushion({x:.2,z:-2.1},{furnitureId:chair.id});
 r.addCushion({x:-1,z:-1.2},{pose:"floor_crosslegged"});
 const restored=new MRRoomLayout(r.snapshot());
 assert.equal(restored.ready,false);restored.setOrigin(3,4,.2);
 assert.equal(restored.seatWorld().length,2);
 restored.removeLast();
 assert.equal(restored.seatWorld().length,1);
 assert.equal(restored.seatWorld()[0].surface,"floor");
});
test("social comfort distance responds to affinity without implied touch consent",()=>{
 const s=new MRLivingSocial();
 s.register("a",{affinity:-30});
 s.register("b",{affinity:90});
 assert.ok(s.comfort("a")>s.comfort("b"));
 assert.equal(s.offer("a","hug"),false);
 assert.equal(s.offer("b","hug"),true);
 assert.equal(s.consume("b","hug"),true);
 assert.equal(s.consume("b","hug"),false);
 assert.equal(s.consume("b","chest"),false);
});
test("repeated sensitive contact warns, reports, and eventually defends",()=>{
 const events=[];const s=new MRLivingSocial({onEvent:e=>events.push(e)});
 s.register("a",{affinity:20,allies:["b"]});s.register("b",{affinity:60});
 s.touch("a","pelvis");for(let i=0;i<12;i++)s.advance(.12);s.touch("a","chest");
 for(let i=0;i<12;i++)s.advance(.12);s.touch("a","pelvis");
 assert.ok(events.some(e=>e.type==="warning"));
 assert.ok(events.some(e=>e.type==="report"));
 assert.ok(events.some(e=>e.type==="defend"));
 assert.ok(s.get("b").affinity<60);
});
test("creative mode never triggers game-over defense",()=>{
 const events=[];const s=new MRLivingSocial({mode:"creative",onEvent:e=>events.push(e)});
 s.register("a");
 for(let i=0;i<4;i++){s.touch("a","pelvis");s.advance(1.3);}
 assert.equal(events.some(e=>e.type==="defend"),false);
});
test("social restore preserves affinity/anger but not temporary consent",()=>{
 const s=new MRLivingSocial();s.register("a",{affinity:70});
 assert.equal(s.offer("a","hug"),true);
 const t=new MRLivingSocial({saved:s.snapshot()});
 assert.equal(t.get("a").affinity,70);
 assert.equal(t.consume("a","hug"),false);
});
