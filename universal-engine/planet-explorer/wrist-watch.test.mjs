import test from "node:test";
import assert from "node:assert/strict";
import {WATCH_ACTIONS,WristWatch,WristTimeline,watchClocks,watchSpeed} from "./wrist-watch.mjs";

test("dual clock uses device local time and wraps planetary days",()=>{
 const d=new Date(2026,10,21,22,4,5);
 const c=watchClocks(2.5,d);
 assert.equal(c.real,"22:04:05");
 assert.equal(c.world,"12:00:00");
 assert.equal(c.worldDay,3);
 assert.equal(watchClocks(-.25,d).world,"18:00:00");
 assert.equal(watchSpeed(-1),1);
 assert.ok(WATCH_ACTIONS.includes("tablet"));
});
test("single player may stop others; multiplayer cannot control time",()=>{
 const calls=[];
 const watch=new WristWatch({onPause:v=>calls.push(v)});
 assert.equal(watch.setPause(true),true);
 assert.equal(watch.paused,true);
 watch.setMode("multiverse");
 assert.equal(watch.paused,false);
 assert.equal(watch.setPause(true),false);
 assert.deepEqual(calls,[true,false]);
 assert.equal(watch.setSpeed(60),false);
});
test("creative rewind restores recorded non-player state without guessing",()=>{
 let npc=1,restored=null;
 const watch=new WristWatch({mode:"creative",
  capture:()=>({contextKey:"planet-a",npc}),
  restore:state=>{restored=state;npc=state.npc;return true;}
 });
 watch.tick(1000);npc=2;watch.tick(2000);npc=3;watch.tick(3000);
 assert.equal(watch.rewind(3500,2),true);
 assert.equal(npc,1);assert.equal(restored.contextKey,"planet-a");
 assert.equal(watch.paused,true);
 assert.equal(watch.rewind(3500,20),false);
 watch.setMode("multiverse");
 assert.equal(watch.rewind(5000,1),false);
});
test("timeline bounds history and disallows cross-scene snapshots",()=>{
 const timeline=new WristTimeline({maxSeconds:3,intervalMs:500});
 timeline.capture(0,{contextKey:"a",v:0});
 timeline.capture(1000,{contextKey:"a",v:1});
 timeline.capture(2000,{contextKey:"b",v:2});
 timeline.capture(4000,{contextKey:"a",v:4});
 assert.equal(timeline.rewind(4000,3,"a").v,1);
 assert.equal(timeline.rewind(4000,2,"b"),null);
});
