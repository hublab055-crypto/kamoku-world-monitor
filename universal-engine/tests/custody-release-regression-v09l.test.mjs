import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {LawSystem,GUARD_POSTS} from "../planet-explorer/law-system.mjs";
import {RailwaySecurity} from "../planet-explorer/railway-security.mjs";
import {FaunaWorld} from "../planet-explorer/fauna.mjs";
import {WorldFeedback} from "../planet-explorer/world-feedback.mjs";
import {capturePose,captureStars} from "../planet-explorer/custody-effects.mjs";

const source=name=>readFileSync(new URL("../planet-explorer/"+name,import.meta.url),"utf8");

test("paying a railway case clears trespass and the related flight, not unrelated crimes",()=>{
 const law=new LawSystem();
 law.reportCrime("tower","trespass",{reporter:"railway-security"});
 law.reportCrime("tower","escape",{reporter:"railway-security"});
 law.reportCrime("tower","assault",{reporter:"resident"});
 assert.equal(law.district("tower").heat,12+15+32);
 assert.equal(law.district("tower").railCasePoints,27);
 const saved=new LawSystem(law.snapshot());
 const released=saved.settleRailTrespass("tower");
 assert.deepEqual({ok:released.ok,points:released.points,level:released.level},
  {ok:true,points:27,level:1});
 assert.equal(saved.district("tower").heat,32);
 assert.equal(saved.settleRailTrespass("tower").points,0,
  "retrying release cannot pardon a separate assault");
 assert.equal(saved.district("tower").heat,32);
 assert.equal(new LawSystem(saved.snapshot()).district("tower").railCasePoints,0);
});

test("old saves without railway-case ledger calculate unsettled rail charges from history",()=>{
 const law=new LawSystem();
 law.reportCrime("port","trespass",{reporter:"railway-security"});
 law.reportCrime("port","escape",{reporter:"railway-security"});
 const old=law.snapshot();
 delete old.factions.port.railCasePoints;
 const recovered=new LawSystem(old);
 assert.equal(recovered.district("port").railCasePoints,27);
 assert.equal(recovered.settleRailTrespass("port").points,27);
 assert.equal(recovered.level("port"),0);
 assert.equal(recovered.warrant("port"),null);
});

test("rail bail and sentence carry the settlement key for corresponding charge cleanup",()=>{
 for(const verb of ["payFine","serveSentence"]){
  const rail=new RailwaySecurity({schemaVersion:1,interactionVersion:2,elapsed:18,
   wanted:true,challenged:true,caseReported:true,
   guard:{stationId:"capital",x:16,z:18,hp:100}});
  const law=new LawSystem();
  law.reportCrime("capital","trespass",{reporter:"railway-security"});
  law.reportCrime("capital","escape",{reporter:"railway-security"});
  assert.equal(rail.respond("surrender").type,"jailed");
  const result=verb==="payFine"?rail.payFine(()=>true):rail.serveSentence();
  assert.equal(result.ok,true);
  assert.equal(result.settleReport,true);
  assert.equal(result.stationId,"capital");
  law.settleRailTrespass(result.stationId);
  assert.equal(law.level("capital"),0);
  assert.equal(rail.state,"clear");
 }
});

test("local fine releases arresting patrol with its same persistent member IDs",()=>{
 const law=new LawSystem();
 const args={day:1,settlementId:"capital",x:500,z:500,stamina:100,hp:100};
 law.advance(.1,args);
 const prior=law.district("capital");
 const ids=prior.deployed.map(x=>x.id);
 law.reportCrime("capital","theft");
 law.respond("capital","surrender");
 assert.deepEqual(law.district("capital").deployed.map(x=>x.id),ids);
 assert.equal(law.advance(.1,args).length,0,"simulation law is paused during detention");
 assert.equal(law.payFine("capital",()=>true).ok,true);
 assert.equal(law.custody,null);
 assert.equal(law.level("capital"),0);
 assert.equal(law.district("capital").hostile,false);
 const patrol=law.district("capital").deployed[0],before=[patrol.x,patrol.z];
 for(let t=0;t<20;t++)law.advance(.1,args);
 assert.deepEqual(law.district("capital").deployed.map(x=>x.id),ids);
 assert.ok(Math.hypot(patrol.x-before[0],patrol.z-before[1])>0.25,
  "patrols must move again following lawful release");
 assert.ok(law.district("capital").current+law.district("capital").deployed.length<=GUARD_POSTS.capital.max);
});

test("patrol steers around an initially blocked track instead of freezing",()=>{
 const law=new LawSystem();
 const args={day:1,settlementId:"tower",x:800,z:800,
  passable:(fx,fz,tx,tz)=>!(tx>fx&&tz>fz)};
 law.advance(.1,args);
 const patrol=law.district("tower").deployed[0];
 const start={x:patrol.x,z:patrol.z};
 for(let i=0;i<30;i++)law.advance(.1,args);
 assert.ok(Math.hypot(patrol.x-start.x,patrol.z-start.z)>0.25);
 assert.ok(patrol.walkPhase>0);
});

test("damage numbers and speech are short-lived even when simulation is paused",()=>{
 const effects=new WorldFeedback();
 effects.emit({kind:"hurt",actorId:"player",text:"-12 HP",duration:1.25});
 effects.speech("capital:guard:1","止まりなさい",2.0);
 for(let i=0;i<40;i++)effects.advance(.08);
 assert.equal(effects.events.length,0);
});

test("arrest and release coordinate mount preservation, stun stars, HUD cleanup and simulation resume",()=>{
 const app=source("app.mjs"),render=source("render.mjs");
 assert.match(app,/function beginCustody\(kind/);
 assert.match(app,/worldUI\?\.clear\(\)/);
 assert.match(app,/worldUI\?\.frame\(dt\)/);
 assert.ok(!app.includes("worldUI?.frame(running?dt:0)"));
 const end=app.slice(app.indexOf("function finishCustody()"),app.indexOf("function releaseRailwayCustody("));
 assert.match(end,/running=true/);
 assert.match(end,/simWorld\.clock\.paused=false/);
 assert.match(end,/fauna\.releaseCustodyMount\(controller/);
 assert.match(end,/renderer\?\.clearCapture\(\)/);
 assert.match(render,/if\(capture\?\.stars\)/);
 assert.equal(captureStars(1.3).length,3);
 assert.equal(capturePose(4).finished,true);
 const herd=new FaunaWorld(),horse=herd.get("fauna-1");
 horse.tame=true;horse.gear={bit:true,reins:true,saddle:true,horseshoes:false};
 const player={x:horse.x,z:horse.z,yaw:0,jumpY:0,jumpV:0,mountRiding:true,clearMoveTarget(){}};
 assert.equal(herd.board(horse.id,player).ok,true);
 assert.equal(herd.impoundMount(player).ok,true);
 player.x=103;player.z=115;player.jumpY=1.2;
 assert.equal(herd.releaseCustodyMount(player,()=>true).ok,true);
 assert.equal(player.mountRiding,false);
 assert.equal(player.jumpY,0);
 assert.equal(herd.mount,null);
 assert.equal(herd.animals.filter(a=>a.id===horse.id).length,1);
 assert.ok(Math.hypot(horse.x-player.x,horse.z-player.z)<13);
});
