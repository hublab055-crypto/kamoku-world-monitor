import test from "node:test";
import assert from "node:assert/strict";
import {WristWatchTime,watchClockDisplay} from "./wrist-watch-time.mjs";

test("watch clocks show game local time independently of live real time",()=>{
 const d=watchClockDisplay({timeDays:1.5,longitude:90,
  realNow:new Date("2026-11-22T00:15:30.000Z"),timeZone:"UTC"});
 assert.equal(d.local,"18:00:00");
 assert.equal(d.real,"00:15:30");
 assert.equal(d.gameHands.hour,180);
 assert.equal(d.realHands.minute,90+3);
});
test("universe may freeze world while its player frame continues",()=>{
 const t=new WristWatchTime({storage:null});
 assert.deepEqual(t.command("speed",5).ok,false);
 assert.equal(t.worldDelta(.02),.02);
 assert.equal(t.command("pause").ok,true);
 assert.equal(t.worldDelta(.02),0);
 assert.equal(t.command("pause").ok,true);
 assert.equal(t.worldDelta(.02),.02);
});
test("creative speed and rewind restore only captured non-player state",()=>{
 let day=5,enemy=9,player=100;
 const t=new WristWatchTime({storage:null,getTimeDays:()=>day,
  captureWorld:()=>({day,enemy}),restoreWorld:s=>{day=s.day;enemy=s.enemy;}});
 assert.equal(t.setMode("creative"),true);
 for(let n=0;n<12;n++){
  day+=.00001;enemy+=1;
  t.afterWorldFrame(.5);
 }
 const before=day;
 player=200;
 const result=t.command("rewind",3);
 assert.equal(result.ok,true);
 assert.ok(day<before);
 assert.ok(enemy<21);
 assert.equal(player,200);
 assert.equal(t.speed,0);
});
test("multiverse rejects all watch time writes",()=>{
 const t=new WristWatchTime({storage:null});
 assert.equal(t.setMode("multiverse"),false);
 assert.equal(t.setMode("multiverse",{trusted:true}),true);
 assert.equal(t.command("pause").ok,false);
 assert.equal(t.command("speed",5).ok,false);
 assert.equal(t.command("rewind",5).ok,false);
 assert.equal(t.worldDelta(.03),.03);
 assert.equal(t.setMode("creative"),false);
});
