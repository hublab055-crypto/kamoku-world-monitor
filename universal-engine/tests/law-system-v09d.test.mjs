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
 assert.equal(law.district("capital").current,GUARD_POSTS.capital.max);
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
