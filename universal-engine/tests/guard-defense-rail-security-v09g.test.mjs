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
