import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {OwnerWorld} from "../planet-explorer/owner-world.mjs";
import {isRailRestricted,isRailwayCrossing} from "../planet-explorer/railway-security.mjs";
import {trackCrossingGeometry,trackFenceGeometry} from "../planet-explorer/railway-animated-geometry.mjs";
import {chooseSettlementSpawn} from "../planet-explorer/settlement-spawn.mjs";

const origin={lat:28,lon:42};
const east=(p,metres)=>({lat:p.lat,lon:p.lon+metres/(111195*Math.cos(p.lat*Math.PI/180))});
const distance=(a,b)=>Math.hypot((a.lat-b.lat)*111195,
 (a.lon-b.lon)*111195*Math.cos((a.lat+b.lat)*Math.PI/360));

test("a named primitive group saves as a reusable building and restores in owner schema 3",()=>{
 const world=new OwnerWorld();
 assert.equal(world.placePrimitive("cube",origin,{width:6,height:3,depth:5,group:"工房"}).ok,true);
 assert.equal(world.placePrimitive("cone",east(origin,4),{width:3,height:5,depth:3,offsetY:3,group:"工房"}).ok,true);
 const saved=world.savePrefab("工房","屋根付き工房");
 assert.equal(saved.ok,true);assert.equal(saved.count,2);
 const restored=new OwnerWorld(JSON.parse(JSON.stringify(world.snapshot())));
 assert.equal(restored.snapshot().version,3);assert.equal(restored.prefabs[0].name,"屋根付き工房");
 const before=restored.primitives.length,target={lat:28.002,lon:42.002};
 const placed=restored.placePrefab("屋根付き工房",target);
 assert.equal(placed.ok,true);assert.equal(restored.primitives.length,before+2);
 const copy=placed.ids.map(id=>restored.primitives.find(part=>part.id===id));
 assert.ok(Math.abs(distance(copy[0],copy[1])-4)<.08);
 assert.notEqual(copy[0].group,"工房");
 assert.equal(restored.deletePrefab("屋根付き工房").ok,true);
 assert.equal(restored.primitives.length,before+2,"deleting a preset keeps placed instances");
});

test("schema 2 owner saves migrate without losing primitive parts",()=>{
 const legacy={version:2,buildings:[],roads:[],stamps:[],primitives:[{id:1,shape:"sphere",
  lat:28,lon:42,width:2,height:2,depth:2,offsetY:0,rotation:0,color:[.2,.4,.6],group:"旧建物"}]};
 const restored=new OwnerWorld(legacy);
 assert.equal(restored.primitives.length,1);assert.deepEqual(restored.prefabs,[]);
 assert.equal(restored.snapshot().version,3);
});

test("the visible level crossing opens both fences and is exempt from trespass warnings",()=>{
 assert.equal(isRailwayCrossing("tower",0,0),true);
 assert.equal(isRailRestricted("tower",0,0),false);
 assert.equal(isRailRestricted("tower",0,12),true);
 assert.equal(isRailRestricted("tower",0,-94),true);
 const rows=Array.from({length:41},(_,i)=>({x:0,y:0,z:-100+i*5}));
 const fence=trackFenceGeometry(rows,{gateZ:-94,crossings:[0]});
 const crossing=trackCrossingGeometry();
 assert.ok(fence.indices.length>500);assert.ok(crossing.indices.length>250);
 assert.equal(crossing.positions.length,crossing.normals.length);
});

test("named settlement descent chooses dry ground away from the track",()=>{
 const terrain={planet:{radiusM:6371000}};
 const spawn=chooseSettlementSpawn(terrain,origin,"tower",{sample:()=>({water:false,river:false,elevationM:80})});
 assert.ok(spawn);assert.ok(Math.abs(spawn.x)>=18);
 assert.equal(isRailRestricted("tower",spawn.x,spawn.z,{margin:3}),false);
});

test("owner UI is narrow, vertically scrollable and exposes prefab actions",()=>{
 const base=new URL("../planet-explorer/",import.meta.url);
 const html=readFileSync(new URL("index.html",base),"utf8"),css=readFileSync(new URL("style.css",base),"utf8"),
  editor=readFileSync(new URL("owner-editor-ui.mjs",base),"utf8");
 for(const id of ["owner-prefab-group","owner-prefab-name","owner-prefab-save","owner-prefab-list","owner-prefab-use"])
  assert.ok(html.includes('id="'+id+'"'),id);
 assert.match(html,/<option value="prefab">/);
 assert.match(css,/width:min\(278px/);assert.match(css,/overflow-y:auto/);assert.match(css,/owner-compact-row/);
 assert.match(html,/id="owner-collapse"[^>]+aria-expanded="true"/);
 assert.match(css,/\.owner-panel\.is-collapsed/);assert.match(css,/#owner-collapse/);
 assert.match(editor,/collapse\.textContent=collapsed\?"◀︎":"▶︎"/);
 assert.match(editor,/if\(active\)\{collapsed=false/);
});
