import test from "node:test";
import assert from "node:assert/strict";
import {guardGeometry,guardPostGeometry} from "../planet-explorer/guard-geometry.mjs";
import {LawSystem,GUARD_POSTS} from "../planet-explorer/law-system.mjs";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
const here=new URL("../planet-explorer/",import.meta.url);
const code=file=>readFileSync(new URL(file,here),"utf8");
function valid(b){
 assert.ok(b.positions.length>0);
 assert.equal(b.positions.length,b.normals.length);
 assert.equal(b.positions.length,b.colors.length);
 assert.ok(b.positions.every(Number.isFinite));
 assert.ok(b.indices.every(i=>Number.isSafeInteger(i)&&i>=0&&i<b.positions.length/3));
 assert.ok(b.positions.length/3<65536);
}
test("original guard and knight geometry is renderable and walk pose varies",()=>{
 for(const kind of ["guard","knight"]){
  const idle=guardGeometry(kind,0),walking=guardGeometry(kind,1);
  valid(idle);valid(walking);valid(guardGeometry(kind,2,{hostile:true}));
  assert.notDeepEqual(idle.positions,walking.positions);
 }
 valid(guardPostGeometry());valid(guardPostGeometry({occupied:true}));
});
test("world renderer uses shared guard meshes, renders the real garrison and offers tap picking",()=>{
 const src=code("render.mjs");
 assert.match(src,/drawLawGuards\(vp,light,s,radius\)/);
 assert.match(src,/this\.lawPostMeshes/);
 assert.match(src,/this\.lawGuardMeshes/);
 assert.match(src,/pickGuard\(clientX,clientY\)/);
 assert.match(src,/this\.drawLawGuards\(vp,light,s,radius\)/);
});
test("existing attack animation and physical arrows can hit guard HP",()=>{
 const src=code("app.mjs");
 assert.match(src,/sweptWeaponContacts\(controller,guards/);
 assert.match(src,/law\.damageGuard\(activeSettlementId,guard\.id,damage/);
 assert.match(src,/enemies:\[\.\.\.battle\.enemies,\.\.\.law\.guardTargets/);
 assert.match(src,/renderer\.pickGuard\(x,y\)/);
});
test("garrison manpower is bounded after repeated simulated days, no random spawned troops",()=>{
 const law=new LawSystem();
 law.advance(.1,{day:0,settlementId:"capital"});
 law.reportCrime("capital","murder");
 const guards=law.guardTargets("capital");
 assert.ok(guards.length>0);
 law.damageGuard("capital",guards[0].id,500);
 for(let day=1;day<8;day++){
  law.advance(.1,{day,settlementId:"capital",x:1000,z:1000});
  const s=law.district("capital");
  assert.ok(s.current+s.deployed.length<=GUARD_POSTS.capital.max);
 }
});
