import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {LawSystem,GUARD_POSTS} from "../planet-explorer/law-system.mjs";
import {BattleTest} from "../planet-explorer/battle-test.mjs";
import {RailwaySecurity,railwaySafeExit,isRailRestricted,RAIL_BAIL_FINE,RAIL_CHALLENGE_SECONDS}
 from "../planet-explorer/railway-security.mjs";
const player={x:0,z:0,yaw:0,altitudeM:2.5,jumpY:0};
const stationId="tower",railX=0,railZ=-94;
function issueRailWarrant(security){
 security.advance(.1,{stationId,x:railX,z:railZ});
 for(let i=0;i<90&&!security.wanted;i++)security.advance(.1,{stationId,x:railX,z:railZ});
 assert.equal(security.wanted,true);
}
test("defenders engage a spawned enemy squad and squad enemies retaliate without criminalizing player",()=>{
 const law=new LawSystem(),battle=new BattleTest();
 const spawned=battle.spawnUnit(player,"raiders");
 assert.equal(spawned.ok,true);assert.ok(spawned.count>=10);
 let guardAttacks=0,enemyAttacks=0;
 for(let t=0;t<180;t++){
  const events=law.advance(.1,{settlementId:"capital",day:1,x:player.x,z:player.z,hostiles:battle.enemies});
  for(const event of events.filter(e=>e.type==="guardAttack")){
   const enemy=battle.enemies.find(e=>e.id===event.targetId&&e.hp>0);
   if(enemy){battle.damage(enemy,event.damage);guardAttacks++;}
  }
  battle.advance(.1,player,null,null,{
   guardTargets:law.guardTargets("capital"),
   onGuardHit:(id,damage)=>law.damageGuard("capital",id,damage,{source:"enemy"})
  });
  enemyAttacks+=battle.consumeEnemyHits().filter(hit=>hit.guardId).length;
 }
 assert.ok(guardAttacks>0,"guards must defend the town with real HP damage");
 assert.ok(enemyAttacks>0,"enemies must retaliate against actual guards");
 assert.equal(law.level("capital"),0,"enemy assaults must never be charged to the player");
 const state=law.district("capital");
 assert.ok(state.current+state.deployed.length<=GUARD_POSTS.capital.max);
});
test("guard defense target and attack cooldown survive save slots",()=>{
 const law=new LawSystem();
 law.advance(.1,{settlementId:"capital",day:1,hostiles:[{id:13,name:"敵",hp:50,x:16,z:19}]});
 const restored=new LawSystem(law.snapshot()),guards=restored.guardTargets("capital");
 assert.ok(guards.some(g=>g.mode==="defend"&&g.defenseTargetId===13));
 assert.ok(guards.every(g=>g.strikeCooldown>=0));
});
test("rail trespass warnings lead to confrontation, not immediate handcuffing",()=>{
 const sec=new RailwaySecurity();issueRailWarrant(sec);
 let challenged=false;
 for(let i=0;i<65&&!challenged;i++){
  const events=sec.advance(.1,{stationId,x:railX,z:railZ,eligible:true});
  challenged=events.some(e=>e.type==="challenge");
 }
 assert.equal(challenged,true);
 assert.equal(sec.jailed,null,"guard must offer choice before arrest");
 assert.equal(sec.state,"challenged");
 assert.ok(sec.challengeRemaining>0&&sec.challengeRemaining<=RAIL_CHALLENGE_SECONDS);
 const restored=new RailwaySecurity(sec.snapshot());
 assert.equal(restored.state,"challenged");
 const jailed=restored.respond("surrender");
 assert.equal(jailed.type,"jailed");assert.equal(restored.state,"jailed");
 assert.equal(jailed.fine,RAIL_BAIL_FINE);
 const sentence=restored.serveSentence();
 assert.equal(sentence.ok,true);assert.ok(sentence.days>=1);
 assert.equal(restored.state,"clear");
});
test("railway safe exit uses walking route and remains outside restricted fence",()=>{
 assert.ok(isRailRestricted(stationId,railX,railZ));
 const exit=railwaySafeExit(stationId,railX,railZ);
 assert.ok(exit);assert.equal(isRailRestricted(stationId,exit.x,exit.z),false);
 const sec=new RailwaySecurity();
 assert.equal(sec.respond("comply").action,"exit");
});
test("escape route and non-lethal resistance produce different police outcomes",()=>{
 const escape=new RailwaySecurity();issueRailWarrant(escape);
 assert.equal(escape.respond("flee").action,"flee");
 let evaded=false;
 for(let i=0;i<80;i++){
  const events=escape.advance(.2,{stationId,x:999,z:999,eligible:true});
  if(events.some(e=>e.type==="evaded")){evaded=true;break;}
 }
 assert.ok(evaded);assert.equal(escape.jailed,null);
 const resistance=new RailwaySecurity();issueRailWarrant(resistance);
 assert.equal(resistance.respond("resist").action,"resist");
 let hit=false;
 for(let i=0;i<100&&!hit;i++){
  const events=resistance.advance(.1,{stationId,x:railX,z:railZ,eligible:true,stamina:100});
  hit=events.some(e=>e.type==="securityHit");
 }
 assert.ok(hit,"resistance triggers stamina and HP suppression, not instant bail");
 assert.equal(resistance.jailed,null);
 const caught=resistance.advance(.1,{stationId,x:railX,z:railZ,eligible:true,stamina:0});
 assert.ok(caught.some(e=>e.type==="jailed"));
 assert.ok(resistance.jailed.fine>RAIL_BAIL_FINE);
});
test("rail settlement only removes trespass charge, leaving unrelated assault",()=>{
 const law=new LawSystem();
 law.reportCrime("tower","trespass");
 law.reportCrime("tower","assault");
 law.settleRailTrespass("tower");
 assert.equal(law.district("tower").heat,32);
 assert.equal(law.level("tower"),1);
});
test("published application wires defense and railway choice buttons into actual systems",()=>{
 const base=new URL("../planet-explorer/",import.meta.url);
 const app=readFileSync(new URL("app.mjs",base),"utf8");
 const html=readFileSync(new URL("index.html",base),"utf8");
 assert.match(app,/hostiles:battle\.enemies/);
 assert.match(app,/onGuardHit:/);
 assert.match(app,/securityHit/);
 assert.match(app,/railwaySafeExit/);
 for(const id of ["railway-comply","railway-surrender","railway-flee","railway-resist","railway-bail","railway-serve"])
  assert.ok(html.includes('id="'+id+'"'),id);
});

test("railway officer has physical HP, player assault transfers pursuit to territorial law",()=>{
 const rail=new RailwaySecurity(),law=new LawSystem();
 issueRailWarrant(rail);
 law.reportCrime("tower","trespass");
 const guard=rail.guard;
 assert.equal(guard.hp,100);
 const far=rail.damageGuard(18,{attackerX:999,attackerZ:999});
 assert.equal(far.ok,false);assert.equal(rail.guard.hp,100);
 const strike=rail.damageGuard(22,{attackerX:guard.x,attackerZ:guard.z});
 assert.equal(strike.ok,true);
 assert.equal(strike.hp,78);assert.equal(rail.resisting,true);
 law.reportCrime("tower","attackGuard");
 const finished=rail.damageGuard(100,{attackerX:guard.x,attackerZ:guard.z});
 assert.equal(finished.defeated,true);
 law.reportCrime("tower","killGuard");
 assert.equal(rail.wanted,false);
 assert.equal(rail.guard,null);
 assert.equal(rail.jailed,null);
 assert.ok(law.level("tower")>=3);
 assert.equal(law.district("tower").hostile,true);
 const restored=new LawSystem(law.snapshot());
 assert.equal(restored.level("tower"),law.level("tower"));
});

test("low-level rail warning speaks and compliance clears surveillance",()=>{
 const rail=new RailwaySecurity();
 const warning=rail.advance(.1,{stationId:"tower",x:0,z:-94});
 assert.equal(warning[0].type,"warning");
 assert.match(warning[0].speech,/線路内は立入禁止/);
 assert.equal(warning[0].speakerId,"railway-security:tower");
 assert.ok(rail.sentry);
 const events=rail.advance(.1,{stationId:"tower",x:10,z:-94});
 assert.ok(events.some(e=>e.type==="complied"&&e.speech==="それでいい。"));
 assert.equal(rail.warningCount,0);
 assert.equal(rail.state,"clear");
 assert.ok(rail.sentryUntil>rail.elapsed);
});

test("arrest warrant is a choice, never a timed automatic jail even after a minute",()=>{
 const rail=new RailwaySecurity();
 issueRailWarrant(rail);
 let challenge=null;
 for(let i=0;i<80&&!challenge;i++){
  const events=rail.advance(.1,{stationId:"tower",x:0,z:-94,eligible:true});
  challenge=events.find(e=>e.type==="challenge");
 }
 assert.ok(challenge);
 assert.match(challenge.speech,/逮捕状/);
 for(let i=0;i<650;i++)
  rail.advance(.1,{stationId:"tower",x:0,z:-94,eligible:true,stamina:0});
 assert.equal(rail.jailed,null);
 assert.equal(rail.state,"challenged");
 const surrendered=rail.respond("surrender");
 assert.equal(surrendered.type,"jailed");
 assert.ok(rail.jailed);
});

test("legacy auto-jail is released on upgrade while confirmed new custody survives",()=>{
 const legacy=new RailwaySecurity({schemaVersion:1,jailed:{stationId:"tower",fine:120},elapsed:15});
 assert.equal(legacy.jailed,null);
 const current=new RailwaySecurity();issueRailWarrant(current);
 current.respond("surrender");
 const loaded=new RailwaySecurity(current.snapshot());
 assert.ok(loaded.jailed);
 assert.equal(loaded.state,"jailed");
});

test("town guard warns about equipped weapons before criminalizing a peaceful player",()=>{
 const law=new LawSystem(),near={day:1,settlementId:"capital",x:16,z:18};
 const events=law.advance(.1,{...near,armedWeapons:["sword","axe"]});
 const warning=events.find(e=>e.type==="territoryWarning");
 assert.ok(warning);
 assert.equal(warning.kind,"weapon");
 assert.match(warning.speech,/武器をしまいなさい/);
 assert.equal(law.level("capital"),0);
 assert.equal(law.respondWarning("capital","comply").action,"stow");
 const calm=law.advance(.1,{...near,armedWeapons:[]});
 assert.ok(calm.some(e=>e.type==="complied"&&e.speech==="それでいい。"));
 assert.equal(law.level("capital"),0);
 const renewed=law.advance(.1,{...near,armedWeapons:["bow"]});
 assert.ok(renewed.some(e=>e.type==="territoryWarning"));
 const refusal=law.respondWarning("capital","refuse");
 assert.equal(refusal.ok,true);
 assert.equal(law.level("capital"),1);
 assert.ok(law.advance(.1,{...near,stamina:0,armedWeapons:["bow"]}).some(e=>e.type==="challenge"));
 assert.equal(law.custody,null,"refusing a warning creates a warrant, not an automatic jail");
});

test("peaceful trespass warning ends with speech on exiting a guard outpost",()=>{
 const law=new LawSystem(),at={day:1,settlementId:"tower",x:20,z:12};
 const warning=law.advance(.1,{...at,restrictedZone:true,armedWeapons:[]}).find(e=>e.type==="territoryWarning");
 assert.ok(warning);assert.equal(warning.kind,"restricted");
 const response=law.respondWarning("tower","comply");
 assert.equal(response.action,"leave");
 const clear=law.advance(.1,{...at,x:31,restrictedZone:false});
 assert.ok(clear.some(e=>e.type==="complied"&&e.speech==="それでいい。"));
 assert.equal(law.level("tower"),0);
});

test("even high wanted level cannot detain or hit the player before warrant refusal",()=>{
 const law=new LawSystem(),at={day:1,settlementId:"capital",x:16,z:18};
 law.reportCrime("capital","murder");
 const challenge=law.advance(.1,{...at,stamina:0}).find(e=>e.type==="challenge");
 assert.ok(challenge);assert.match(challenge.speech,/逮捕状/);
 for(let i=0;i<40;i++){
  const events=law.advance(.1,{...at,stamina:0});
  assert.equal(events.some(e=>e.type==="detained"||e.type==="guardHit"),false);
 }
 assert.equal(law.custody,null);
 assert.equal(law.respond("capital","refuse").ok,true);
 assert.ok(law.level("capital")>=3);
 const events=law.advance(.1,{...at,stamina:0});
 assert.ok(events.some(e=>e.type==="detained"),"resisting after warning can lead to detention");
});

test("wanted UI uses ❌ crosses and speech overlay includes visible guard actor anchors",()=>{
 const base=new URL("../planet-explorer/",import.meta.url);
 const ui=readFileSync(new URL("law-ui.mjs",base),"utf8");
 const feedback=readFileSync(new URL("world-feedback-ui.mjs",base),"utf8");
 const app=readFileSync(new URL("app.mjs",base),"utf8");
 assert.match(ui,/"❌"\.repeat\(level\)/);
 assert.match(ui,/openEncounter/);
 assert.match(ui,/▶ 投降しない/);
 assert.match(feedback,/actors:\[\.\.\.renderer\.screenActors,\.\.\.\(renderer\.screenGuards\|\|\[\]\)\]/);
 assert.match(app,/onWarningCompliance:/);
 assert.match(app,/worldUI\?\.speak\(event\.speakerId/);
});
