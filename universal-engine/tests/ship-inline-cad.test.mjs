import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {ShipModelingBench,validBenchPart} from "../planet-explorer/ship-modeling-bench.mjs";
import {cadMeshGeometry} from "../planet-explorer/cad-mesh-geometry.mjs";
const box=(w=80,d=50,h=20)=>{
 const v=[[0,0,0],[w,0,0],[w,d,0],[0,d,0],[0,0,h],[w,0,h],[w,d,h],[0,d,h]];
 return [[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]].map(ids=>({vertices:ids.map(i=>v[i])}));
};
test("inline ship CAD import preserves geometry and correct mm to m conversion",()=>{
 const m=new ShipModelingBench();assert.ok(m.importCAD(box()).ok);
 const p=m.parts[0];assert.equal(p.width,.08);assert.equal(p.height,.02);assert.equal(p.depth,.05);
 assert.ok(validBenchPart(p));assert.ok(cadMeshGeometry(p.cadMesh).indices.length>0);
 assert.equal(m.prefabParts()[0].cadMesh,p.cadMesh);
 assert.deepEqual(new ShipModelingBench(m.snapshot()).snapshot(),m.snapshot());
});
test("inline ship CAD re-output updates only the selected CAD part and rejects invalid input transactionally",()=>{
 const m=new ShipModelingBench();assert.ok(m.importCAD(box()).ok);const id=m.selected;
 assert.ok(m.update({x:.1}).ok);assert.ok(m.importCAD(box(120)).ok);
 assert.equal(m.parts.length,1);assert.equal(m.selected,id);assert.equal(m.parts[0].x,.1);
 assert.equal(m.parts[0].width,.12);const before=m.snapshot();
 assert.equal(m.importCAD(box(2000)).ok,false);assert.equal(m.importCAD([]).ok,false);assert.deepEqual(m.snapshot(),before);
 m.select(null);assert.ok(m.importCAD(box()).ok);assert.equal(m.parts.length,2);
});
test("inline ship CAD does not replace primitive or enable fake face editing",()=>{
 const m=new ShipModelingBench();assert.ok(m.add({shape:"cube",x:0,y:0,z:0,width:.1,height:.1,depth:.1,rotation:0}).ok);
 assert.ok(m.importCAD(box()).ok);assert.equal(m.parts.length,2);assert.equal(m.parts[0].cadMesh,undefined);
 m.remove();assert.ok(m.importCAD(box()).ok);m.remove();m.remove();
 const n=new ShipModelingBench();assert.ok(n.importCAD(box()).ok);
 assert.equal(n.grab("right",{x:3.05,y:.965,z:-3.05},"face"),false);
});
test("inline ship CAD routes same-origin frame output to local workbench and leaves ground CAD independent",()=>{
 const ui=readFileSync(new URL("../planet-explorer/ship-modeling-bench-ui.mjs",import.meta.url),"utf8");
 const renderer=readFileSync(new URL("../planet-explorer/render.mjs",import.meta.url),"utf8");
 assert.match(ui,/e\.source!==frame\.contentWindow/);assert.match(ui,/model\.importCAD\(e\.data\.payload\.faces,\{datum:e\.data\.payload\.benchDatum===true\}\)/);
 assert.match(ui,/bench=1/);assert.match(renderer,/cadMeshGeometry\(p\.cadMesh\)/);
});

test("bench datum maps CAD millimetres to the tabletop origin and rejects invalid placement",()=>{
 const m=new ShipModelingBench();assert.ok(m.importCAD(box(),{datum:true}).ok);
 const p=m.parts[0];assert.ok(Math.abs(p.x-.04)<1e-9);assert.ok(Math.abs(p.y-.195)<1e-9);assert.ok(Math.abs(p.z+.025)<1e-9);
 const shifted=box().map(f=>({vertices:f.vertices.map(([x,y,z])=>[x,y,z+10])}));assert.ok(m.importCAD(shifted,{datum:true}).ok);assert.ok(Math.abs(m.parts[0].y-.205)<1e-9);assert.equal(m.parts.length,1);
 const before=m.snapshot();const below=box().map(f=>({vertices:f.vertices.map(([x,y,z])=>[x,y,z-300])}));assert.equal(m.importCAD(below,{datum:true}).ok,false);assert.deepEqual(m.snapshot(),before);
});
