import test from "node:test";
import assert from "node:assert/strict";
import {packCadMesh,cadMeshGeometry,validCadMesh} from "../cad-mesh-geometry.mjs";
import {prepareDesignOutput,designPlacementPreview} from "../design-studio-ui.mjs";
import {OwnerWorld} from "../owner-world.mjs";
const faces=[{vertices:[[0,0,0],[100,0,0],[100,100,0],[0,100,0]]},{vertices:[[0,0,100],[0,100,100],[100,100,100],[100,0,100]]}];
test("CAD quads retain geometry and dimensions",()=>{const m=packCadMesh(faces);assert.equal(m.width,.1);assert.equal(m.height,.1);assert.ok(validCadMesh(m.mesh));const g=cadMeshGeometry(m.mesh);assert.equal(g.indices.length,12);assert.equal(Math.min(...g.positions),-.5);assert.equal(Math.max(...g.positions),1);});
test("invalid and empty CAD are rejected",()=>{assert.throws(()=>packCadMesh([]));assert.throws(()=>cadMeshGeometry("bad"));assert.throws(()=>packCadMesh([{vertices:[[0,0,0],[1,0,0],[1,1,0],[0,1,0]]}]));});
test("CAD direct output survives owner save and restore",()=>{const data=prepareDesignOutput({kind:"part",name:"test",faces});const w=new OwnerWorld();assert.ok(w.savePrefabParts(data.name,data.parts).ok);assert.ok(w.placePrefab(data.name,{lat:35,lon:136}).ok);const re=new OwnerWorld(w.snapshot());assert.equal(re.primitives[0].cadMesh,data.parts[0].cadMesh);assert.equal(re.prefabs[0].parts[0].cadMesh,data.parts[0].cadMesh);assert.ok(re.removePrimitive(re.primitives[0].id).ok);});
test("assembly direct output reuses existing asset bridge",()=>{const p=prepareDesignOutput({kind:"assembly",source:{format:"UE-assembly-v2",units:"mm",objects:[{id:"x",kind:"plate",name:"plate",size:[100,100,20],pos:[0,0,0],rot:[0,0,0],parent:null}]}});assert.equal(p.parts.length,1);assert.equal(p.parts[0].offsetY,0);assert.equal(p.assetDocument.format,"ue/asset-document");});

test("ghost uses exact CAD mesh and committed coordinates without saving",()=>{
 const data=prepareDesignOutput({kind:"part",name:"preview",faces}),w=new OwnerWorld(),point={lat:35,lon:136};
 const g=designPlacementPreview(data,point,()=>({water:false,river:false}));assert.equal(g.valid,true);assert.equal(w.primitives.length,0);assert.equal(w.prefabs.length,0);assert.equal(g.parts[0].cadMesh,data.parts[0].cadMesh);
 assert.ok(w.savePrefabParts(data.name,data.parts).ok);assert.ok(w.placePrefab(data.name,point).ok);
 for(const k of ["lat","lon","width","height","depth","offsetY","rz","cadMesh"])assert.equal(g.parts[0][k],w.primitives[0][k]);
});
test("ghost moves and rejects invalid surface for any part",()=>{
 const data={parts:[{x:0,z:0},{x:10,z:0}]},land=()=>({water:false,river:false});
 const a=designPlacementPreview(data,{lat:35,lon:136},land),b=designPlacementPreview(data,{lat:35,lon:137},land);
 assert.notEqual(a.parts[0].lon,b.parts[0].lon);assert.equal(designPlacementPreview(data,{lat:35,lon:136},(lat,lon)=>({water:lon>136.00001})).valid,false);assert.equal(designPlacementPreview(data,null,land),null);
});
