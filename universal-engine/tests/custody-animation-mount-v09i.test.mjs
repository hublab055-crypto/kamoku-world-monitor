import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {FaunaWorld} from "../planet-explorer/fauna.mjs";
import {LawSystem} from "../planet-explorer/law-system.mjs";
import {RailwaySecurity} from "../planet-explorer/railway-security.mjs";
import {capturePose,captureStars,captureStarGeometry,CAPTURE_DURATION_SECONDS}
 from "../planet-explorer/custody-effects.mjs";
const read=name=>readFileSync(new URL("../planet-explorer/"+name,import.meta.url),"utf8");

test("captured patrol guards remain physically deployed and never multiply from a detention",()=>{
 const law=new LawSystem();
 law.advance(.1,{day:1,settlementId:"capital",x:16,z:18});
 law.reportCrime("capital","theft");
 const before=law.district("capital");
 const ids=before.deployed.map(g=>g.id);
 const total=before.current+before.deployed.length;
 const arrest=law.respond("capital","surrender");
 assert.equal(arrest.type,"detained");
 assert.deepEqual(law.district("capital").deployed.map(g=>g.id),ids);
 assert.equal(law.district("capital").current+law.district("capital").deployed.length,total);
 assert.ok(law.district("capital").deployed.every(g=>g.mode==="patrol"));
 const saved=new LawSystem(law.snapshot());
 assert.deepEqual(saved.district("capital").deployed.map(g=>g.id),ids);
 assert.ok(saved.custody);
 assert.equal(saved.payFine("capital",()=>true).ok,true);
 assert.deepEqual(saved.district("capital").deployed.map(g=>g.id),ids);
});

test("railway arresting officer survives during custody and is cleared on release",()=>{
 const rail=new RailwaySecurity();
 const active=new RailwaySecurity({schemaVersion:1,interactionVersion:2,
  elapsed:15,wanted:true,challenged:true,
  guard:{stationId:"tower",x:2,z:-93,hp:90}});
 const original={...active.guard};
 const result=active.respond("surrender");
 assert.equal(result.type,"jailed");
 assert.deepEqual(active.guard,original);
 assert.deepEqual(new RailwaySecurity(active.snapshot()).guard,original);
 assert.equal(active.payFine(()=>true).ok,true);
 assert.equal(active.guard,null);
 assert.equal(active.jailed,null);
});

test("capture is a staged 90-degree collapse followed by exactly three orbiting gold stars",()=>{
 const standing=capturePose(0),mid=capturePose(.36),fallen=capturePose(1);
 assert.equal(standing.angle,0);
 assert.ok(mid.angle>0&&mid.angle<Math.PI/2);
 assert.ok(fallen.angle>1.5&&fallen.angle<Math.PI/2);
 assert.equal(standing.stars,false);
 const initial=captureStars(1);
 assert.equal(initial.length,3);
 for(const p of initial)assert.ok([p.x,p.y,p.z,p.scale].every(Number.isFinite));
 const moved=captureStars(1.5);
 assert.notDeepEqual(initial,moved);
 assert.deepEqual(captureStars(CAPTURE_DURATION_SECONDS),[]);
 assert.equal(capturePose(CAPTURE_DURATION_SECONDS).finished,true);
 const mesh=captureStarGeometry();
 assert.ok(mesh.indices.length>0);
 assert.equal(mesh.positions.length,mesh.normals.length);
 assert.equal(mesh.positions.length,mesh.colors.length);
 assert.ok(mesh.indices.every(i=>i>=0&&i<mesh.positions.length/3));
});

test("arrest while mounted dismounts but preserves horse identity, tack and stamina",()=>{
 const f=new FaunaWorld(),horse=f.get("fauna-1");
 horse.tame=true;horse.trust=3;horse.stamina=61;
 horse.gear={bit:true,reins:true,saddle:true,horseshoes:true};
 const p={x:horse.x,z:horse.z,yaw:.5,altitudeM:2.5,jumpY:0,jumpV:0,
  mountRiding:true,walkSpeed:10.5,clearMoveTarget(){}};
 assert.equal(f.board(horse.id,p).ok,true);
 p.x+=5;p.z-=3;p.jumpY=.8;p.jumpV=1;
 const arrest=f.impoundMount(p);
 assert.equal(arrest.ok,true);
 assert.equal(f.mount,null);assert.equal(p.mountRiding,false);
 assert.equal(p.jumpY,0);assert.equal(p.jumpV,0);
 assert.equal(f.custodyMountId,horse.id);
 assert.equal(horse.x,p.x);assert.equal(horse.z,p.z);
 const restored=new FaunaWorld(f.snapshot());
 assert.equal(restored.mount,null);
 assert.equal(restored.custodyMountId,horse.id);
 assert.equal(restored.get(horse.id).stamina,61);
 assert.deepEqual(restored.get(horse.id).gear,horse.gear);
 // Returned next to gate, grounded; the original horse remains in the herd list.
 p.x=100;p.z=150;p.mountRiding=true;p.jumpY=4.5;
 const returned=restored.releaseCustodyMount(p,()=>true);
 assert.equal(returned.ok,true);
 assert.equal(restored.animals.filter(a=>a.id===horse.id).length,1);
 assert.ok(Math.hypot(returned.x-p.x,returned.z-p.z)>=3);
 assert.equal(restored.custodyMountId,null);
 assert.equal(restored.mount,null);
 assert.equal(p.mountRiding,false);
 assert.equal(p.jumpY,0);assert.equal(p.walkSpeed,5);
});

test("horse is not lost on unsafe ground and can be returned later",()=>{
 const f=new FaunaWorld(),horse=f.get("fauna-1");
 horse.tame=true;horse.gear={bit:true,reins:true,saddle:true,horseshoes:false};
 const p={x:horse.x,z:horse.z,yaw:0,altitudeM:2.5,jumpY:0,jumpV:0,mountRiding:true,clearMoveTarget(){}};
 f.board(horse.id,p);f.impoundMount(p);
 assert.equal(f.releaseCustodyMount(p,()=>false).ok,false);
 assert.equal(f.custodyMountId,horse.id);
 assert.equal(f.releaseCustodyMount(p,()=>true).ok,true);
 assert.equal(f.custodyMountId,null);
});

test("app plays custody FX while simulation is paused and uses safe horse recovery in both legal systems",()=>{
 const app=read("app.mjs"),render=read("render.mjs"),ui=read("law-ui.mjs");
 assert.match(app,/function beginCustody\(kind/);
 assert.match(app,/fauna\.impoundMount\(controller\)/);
 assert.match(app,/fauna\.releaseCustodyMount\(controller/);
 assert.match(app,/function finishCustody\(\)/);
 assert.match(app,/onRelease:\(\)=>finishCustody\(\)/);
 assert.match(app,/beginCustody\("railway"\)/);
 assert.match(app,/beginCustody\("law"\)/);
 assert.match(ui,/onRelease\?\.\(\)/);
 assert.match(render,/this\.custodyStarMesh/);
 assert.match(render,/this\.captureFX\.elapsed/);
 assert.match(render,/if\(capture\?\.stars\)/);
 assert.match(render,/captureFX\.elapsed>=CAPTURE_DURATION_SECONDS/);
});

test("both desktop and VR defer railway jail rendering until stun completes",()=>{
 const src=read("render.mjs");
 const matches=src.match(/if\(this\.railwaySecurity\?\.jailed&&/g)||[];
 assert.equal(matches.length,2,"both non-VR and XR paths must defer jail cut");
 assert.match(src,/captureFX\.elapsed>=CAPTURE_DURATION_SECONDS/);
 assert.match(src,/this\.drawMesh\(this\.custodyStarMesh/);
 assert.match(src,/this\.captureFX\.elapsed\+Math\.max/);
});
test("the arrest guard stays visible until the jail transition and remains in law saves",()=>{
 const render=read("render.mjs"),law=read("law-system.mjs"),rail=read("railway-security.mjs");
 assert.ok(render.includes("const guard=this.railwaySecurity?.guard"));
 assert.ok(render.includes("this.drawLawGuards(vp,light,s,radius)"));
 assert.ok(!law.includes("s.deployed=[];s.challengeShown=false;"),
  "detention must not despawn the actual guards");
 assert.match(rail,/this\.jailed=\{stationId,fine\};this\.wanted=false;/);
});
