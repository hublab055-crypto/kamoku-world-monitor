import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {WorldFeedback,GameConsole} from "../planet-explorer/world-feedback.mjs";
import {samplePose} from "../planet-explorer/rig.mjs";
import {SmoothAnimator} from "../planet-explorer/animator.mjs";

test("damage, resources and dialogue anchor to correct actor/enemy",()=>{
 const feedback=new WorldFeedback();
 const enemy=feedback.emit({kind:"damage",enemyId:7,text:"−18"});
 const wood=feedback.emit({kind:"gain",actorId:"player",text:"+2 🪵 木材"});
 const speak=feedback.speech("scout","こんにちは！");
 const placed=feedback.layout({
  actors:[{id:"player",u:.5,v:.67,onScreen:true},{id:"scout",u:.7,v:.43,onScreen:true}],
  enemies:[{id:7,u:.33,v:.5,onScreen:true}],width:500,height:300
 });
 assert.equal(placed.length,3);
 assert.deepEqual(placed.map(x=>x.id),[enemy.id,wood.id,speak.id]);
 assert.ok(placed[0].screenX<placed[1].screenX);
 assert.ok(placed[2].screenX>placed[1].screenX);
 assert.equal(placed[2].kind,"speech");
 assert.ok(placed.every(x=>Number.isFinite(x.screenY)&&Number.isFinite(x.opacity)));
});
test("screen effects have capped lifetimes, bounded memory and safe text",()=>{
 const fx=new WorldFeedback({limit:5});
 for(let i=0;i<20;i++)fx.emit({kind:"gain",actorId:"player",text:"+"+i,duration:1});
 assert.equal(fx.events.length,5);
 assert.equal(fx.events[0].text,"+15");
 const t=fx.emit({kind:"speech",actorId:"scout",text:"a".repeat(500)});
 assert.equal(t.text.length,180);
 for(let i=0;i<100;i++)fx.advance(.1);
 assert.equal(fx.events.length,0);
 fx.emit({kind:"damage",enemyId:1,text:"-5"});
 fx.clear();
 assert.equal(fx.events.length,0);
 assert.throws(()=>fx.advance(-.1),TypeError);
});
test("offscreen effects are hidden, numbers stay in viewport bounds",()=>{
 const fx=new WorldFeedback();
 fx.emit({kind:"damage",enemyId:3,text:"−30"});
 let layout=fx.layout({enemies:[{id:3,u:-.4,v:.5,onScreen:false}],width:320,height:200});
 assert.equal(layout.length,0);
 layout=fx.layout({enemies:[{id:3,u:.005,v:.005,onScreen:true}],width:320,height:200});
 assert.equal(layout.length,1);
 assert.ok(layout[0].screenX>=34&&layout[0].screenY>=38);
});
test("console categorizes, searches and evicts oldest entries",()=>{
 const c=new GameConsole(20);
 c.append("木材 +2","resource",1000);
 c.append("敵に 18 ダメージ","combat",1001);
 c.append("こんにちは","social",1002);
 assert.equal(c.filter("resource").length,1);
 assert.equal(c.filter("combat").length,1);
 assert.equal(c.filter("all","こんにちは").length,1);
 for(let i=0;i<30;i++)c.append("event"+i,"info",2000+i);
 assert.equal(c.lines.length,20);
 assert.equal(c.lines[0].message,"event10");
 c.clear();assert.equal(c.lines.length,0);
});
test("hit pose recoils and recovers without moving world position",()=>{
 const at=.5,impact=samplePose({action:"hit",progress:at});
 assert.ok(impact.torsoX<-.3);
 assert.ok(impact.leftShoulderX>.3&&impact.rightShoulderX>.4);
 assert.ok(impact.headX<-.16);
 assert.equal(impact.tool,null);
 const idle=samplePose({action:"hit",progress:1});
 assert.ok(Math.abs(idle.torsoX)<.0001);
 const a=new SmoothAnimator();
 for(let i=0;i<10;i++)a.update(.02,{action:"hit",progress:.5});
 assert.equal(a.state,"hit");
 assert.ok(a.pose.torsoX<-.1);
});
test("browser wiring creates optional console, popup layer and collects damage/harvest/speech",()=>{
 const page=readFileSync(new URL("../planet-explorer/index.html",import.meta.url),"utf8");
 for(const id of ["viewport-console-toggle","game-console","game-console-head","game-console-lines",
  "game-console-command-form","game-console-command","world-fx-layer","world-hit-flash"]){
  assert.ok(page.includes('id="'+id+'"'),id);
 }
 assert.match(page,/V0\.7r/);
 assert.match(page,/app\.mjs\?v=0\.7r/);
 const app=readFileSync(new URL("../planet-explorer/app.mjs",import.meta.url),"utf8");
 assert.match(app,/worldUI\?\.float\(\{kind:"hurt"/);
 assert.match(app,/worldUI\?\.float\(\{kind:"gain"/);
 assert.match(app,/resourceNames/);
 assert.match(app,/worldUI\?\.frame\(/);
 assert.match(app,/playerHitSeconds/);
 const social=readFileSync(new URL("../planet-explorer/frontier-interaction-ui.mjs",import.meta.url),"utf8");
 assert.match(social,/showSpeech\(to\.id,/);
 const skin=readFileSync(new URL("../planet-explorer/frontier-animated.mjs",import.meta.url),"utf8");
 assert.match(skin,/"hit"\]\.includes\(action\)/);
 const consoleUI=readFileSync(new URL("../planet-explorer/world-feedback-ui.mjs",import.meta.url),"utf8");
 assert.match(consoleUI,/pointerdown/);
 assert.match(consoleUI,/game-console-search/);
 assert.ok(!/\beval\s*\(/.test(consoleUI),"no arbitrary code execution");
});
