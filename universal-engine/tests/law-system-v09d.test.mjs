import test from "node:test";
import assert from "node:assert/strict";
import {LawSystem,GUARD_POSTS,wantedLevel} from "../planet-explorer/law-system.mjs";

test("witnessed offenses raise faction-local GTA-style level, unseen ones do not",()=>{
 const law=new LawSystem();
 assert.equal(law.reportCrime("capital","theft",{witnessed:false}).reported,false);
 assert.equal(law.level("capital"),0);
 law.reportCrime("capital","theft");
 assert.equal(law.level("capital"),1);
 assert.equal(law.level("port"),0);
 law.reportCrime("capital","assault");
 assert.equal(law.level("capital"),2);
 assert.equal(wantedLevel(300),5);
});

test("guards deploy from finite post pool and do not spawn without crime",()=>{
 const law=new LawSystem();
 assert.deepEqual(law.advance(.1,{day:1,settlementId:"capital"}),[]);
 const calm=law.district("capital");
 assert.equal(calm.deployed.length,2); // Guards visibly patrol even during peace.
 assert.equal(calm.current+calm.deployed.length,GUARD_POSTS.capital.max);
 law.reportCrime("capital","murder");
 law.reportCrime("capital","murder");
 const events=law.advance(.1,{day:1,settlementId:"capital",x:200,z:200});
 assert.ok(events.some(e=>e.type==="dispatch"));
 const g=law.district("capital");
 assert.equal(g.deployed.length+g.current,GUARD_POSTS.capital.max);
 const first=g.deployed[0].id;
 law.attackGuard("capital",first,{defeat:true});
 assert.equal(g.deployed.some(x=>x.id===first),false);
 assert.ok(g.deployed.length+g.current<GUARD_POSTS.capital.max);
 law.advance(.1,{day:2,settlementId:"capital",x:200,z:200});
 assert.ok(g.deployed.length+g.current<=GUARD_POSTS.capital.max);
});

test("escaping to another jurisdiction stops active pursuit but not the bounty",()=>{
 const law=new LawSystem();
 law.reportCrime("capital","assault");
 law.advance(.1,{day:1,settlementId:"capital"});
 law.advance(.1,{day:1,settlementId:"port"});
 assert.equal(law.district("capital").pursuit,false);
 assert.equal(law.level("capital"),1);
 assert.equal(law.level("port"),0);
});

test("refusal provokes attacks; surrender detains and fine clears local heat",()=>{
 const law=new LawSystem();
 law.reportCrime("tower","theft");
 const guard=law.dispatch("tower")[0];
 assert.ok(guard);
 const result=law.respond("tower","refuse");
 assert.equal(result.ok,true);
 const events=law.advance(2,{day:1,settlementId:"tower",x:guard.x,z:guard.z});
 assert.ok(events.some(e=>e.type==="guardHit"));
 const arrest=law.respond("tower","surrender");
 assert.equal(arrest.type,"detained");
 assert.equal(law.custody.faction,"tower");
 const snapshot=new LawSystem(law.snapshot());
 assert.ok(snapshot.custody);
 assert.equal(snapshot.payFine("tower",()=>false).ok,false);
 assert.equal(snapshot.payFine("tower",()=>true).ok,true);
 assert.equal(snapshot.level("tower"),0);
});

test("an occupied outpost needs zero defenders and an assigned companion",()=>{
 const law=new LawSystem();
 assert.equal(law.occupyPost("forest",["scout"]).ok,false);
 const post=law.district("forest");
 post.current=0;
 assert.equal(law.occupyPost("forest",[]).ok,false);
 assert.equal(law.occupyPost("forest",["scout"]).ok,true);
 assert.equal(law.district("forest").owner,"player");
 law.advance(.1,{day:7,settlementId:"forest"});
 assert.equal(law.district("forest").current,0);
});

test("death retains world/estate history and requires an eligible successor",()=>{
 const law=new LawSystem();
 law.reportCrime("capital","theft");
 assert.equal(law.designateHeir({id:"scout",name:"後継者",estate:300}).ok,true);
 const heirs=law.die();
 assert.equal(heirs.length,1);
 assert.equal(law.pendingDeath,true);
 const restored=new LawSystem(law.snapshot());
 assert.equal(restored.activePersonId,null);
 assert.equal(restored.succeed("scout").ok,true);
 assert.equal(restored.people.find(p=>p.id==="founder").alive,false);
 assert.equal(restored.people.find(p=>p.id==="scout").estate,300);
 assert.equal(restored.level("capital"),1);
 assert.equal(restored.history.some(e=>e.type==="succession"),true);
 const solitary=new LawSystem();
 assert.deepEqual(solitary.die(),[]);
 assert.equal(solitary.gameOver,true);
});

test("wanted NPC bounty is one-time and recorded",()=>{
 const law=new LawSystem();
 assert.equal(law.registerWantedNPC({id:"bandit",name:"盗賊",faction:"port",reward:120}),true);
 assert.equal(law.collectBounty("bandit",{captured:true}).reward,120);
 assert.equal(law.collectBounty("bandit").ok,false);
 assert.equal(new LawSystem(law.snapshot()).coins,120);
});

test("peaceful 3D guards walk a reproducible loop, then challenge suspects",()=>{
 const law=new LawSystem();
 law.advance(.1,{day:1,settlementId:"tower",x:600,z:600});
 const g=law.district("tower").deployed[0];
 const start={x:g.x,z:g.z};
 for(let i=0;i<40;i++)law.advance(.1,{day:1,settlementId:"tower",x:600,z:600});
 assert.ok(Math.hypot(g.x-start.x,g.z-start.z)>1);
 assert.equal(g.mode,"patrol");
 law.reportCrime("tower","theft");
 const events=law.advance(.1,{day:1,settlementId:"tower",x:g.x,z:g.z});
 assert.ok(events.some(e=>e.type==="challenge"));
 assert.ok(["warning","chase"].includes(g.mode));
});

test("high-level crimes deploy a finite knight-class guard",()=>{
 const law=new LawSystem();
 for(let i=0;i<6;i++)law.reportCrime("capital","assault");
 law.advance(.1,{day:1,settlementId:"capital",x:0,z:0});
 assert.ok(law.level("capital")>=4);
 assert.ok(law.guardTargets("capital").some(g=>g.kind==="knight"));
 const g=law.guardTargets("capital")[0],before=law.district("capital").current;
 const result=law.damageGuard("capital",g.id,600);
 assert.equal(result.defeated,true);
 assert.equal(law.district("capital").current,before);
 assert.ok(law.level("capital")>=4);
});

test("actual guard hits use HP rather than panel instant kills, and persist through save",()=>{
 const law=new LawSystem();
 law.advance(.1,{day:1,settlementId:"forest",x:100,z:100});
 const first=law.guardTargets("forest")[0];
 assert.equal(law.damageGuard("forest",first.id,10,{attackerX:999,attackerZ:999}).ok,false);
 assert.equal(law.level("forest"),0);
 const result=law.damageGuard("forest",first.id,15,{attackerX:first.x,attackerZ:first.z});
 assert.equal(result.ok,true);
 assert.equal(result.defeated,false);
 assert.equal(law.level("forest"),2); // assaulting a guard is serious
 const reload=new LawSystem(law.snapshot());
 assert.equal(reload.guardTargets("forest")[0].hp,first.hp-15);
 assert.ok(reload.district("forest").hostile);
});

test("permanent paper warrant is issued on a witnessed crime, live chase is temporary",()=>{
 const law=new LawSystem();
 assert.equal(law.warrant("capital"),null);
 law.reportCrime("capital","theft");
 const posted=law.warrant("capital");
 assert.equal(posted.name,"開拓者");
 assert.ok(posted.reward>0);
 law.advance(.1,{day:1,settlementId:"port"});
 assert.equal(law.warrant("capital").livePursuit,false);
 assert.equal(law.warrant("capital").reward,posted.reward);
 const revived=new LawSystem(law.snapshot());
 assert.equal(revived.warrant("capital").reward,posted.reward);
});

test("serious wanted crimes authorize lethal force, but depleted HP takes priority over detention",()=>{
 const law=new LawSystem();
 law.reportCrime("capital","murder");
 law.advance(.1,{day:1,settlementId:"capital",x:16,z:18});
 assert.ok(law.district("capital").hostile);
 const hits=law.advance(2,{day:1,settlementId:"capital",x:16,z:18,stamina:0,hp:0});
 assert.equal(hits.some(x=>x.type==="detained"),false);
 assert.equal(law.custody,null);
});
