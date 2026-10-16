import test from "node:test";
import assert from "node:assert/strict";
import {ORIGINAL_MODELS,buildOriginalModel,modelBounds} from "../original-assets/original-models.mjs";
import {exportOriginalGLB,exportOriginalOBJ,JOINT_GRAPH} from "../original-assets/export.mjs";
import {ExplorerRenderer} from "../planet-explorer/render.mjs";
import {Planet} from "../planet/planet-core.mjs";
import {Terrain} from "../planet/terrain-engine.mjs";
import {OriginalModelViewer} from "../model-lab/viewer.mjs";

const record={};
function header(glb){
 const dv=new DataView(glb.buffer,glb.byteOffset,glb.byteLength);
 assert.equal(dv.getUint32(0,true),0x46546c67);
 assert.equal(dv.getUint32(4,true),2);
 assert.equal(dv.getUint32(8,true),glb.length);
 const len=dv.getUint32(12,true);
 assert.equal(dv.getUint32(16,true),0x4e4f534a);
 const json=JSON.parse(String.fromCharCode(...glb.slice(20,20+len)).trim());
 const binHead=20+len;
 assert.equal(dv.getUint32(binHead+4,true),0x004e4942);
 assert.equal(dv.getUint32(binHead,true),glb.length-8-binHead);
 assert.equal(json.buffers[0].byteLength,dv.getUint32(binHead,true));
 return {json,bufferStart:binHead+8};
}
function mockGL(){
 const calls={draws:0,bytes:0};
 const gl={
 VERTEX_SHADER:35633,FRAGMENT_SHADER:35632,COMPILE_STATUS:35713,LINK_STATUS:35714,
 ARRAY_BUFFER:34962,ELEMENT_ARRAY_BUFFER:34963,STATIC_DRAW:35044,
 FLOAT:5126,TRIANGLES:4,UNSIGNED_SHORT:5123,DEPTH_TEST:2929,
 COLOR_BUFFER_BIT:16384,DEPTH_BUFFER_BIT:256,BLEND:3042,SRC_ALPHA:770,ONE_MINUS_SRC_ALPHA:771,
 createShader:()=>({}),shaderSource(){},compileShader(){},getShaderParameter:()=>true,
 createProgram:()=>({}),attachShader(){},linkProgram(){},getProgramParameter:()=>true,
 getUniformLocation:()=>({}),createVertexArray:()=>({}),bindVertexArray(){},
 createBuffer:()=>({}),bindBuffer(){},bufferData:(_type,values)=>{assert.ok(values.length>0);calls.bytes+=values.byteLength||values.length;},
 enableVertexAttribArray(){},vertexAttribPointer(){},enable(){},disable(){},
 uniformMatrix4fv(){},uniform3fv(){},uniform1f(){},useProgram(){},viewport(){},
 clearColor(){},clear(){},blendFunc(){},depthMask(){},drawElements(_type,count){assert.ok(count>0);calls.draws++;},
 deleteBuffer(){},deleteVertexArray(){},deleteProgram(){}
 };
 return {gl,calls,canvas:{width:960,height:560,clientWidth:960,clientHeight:560,
 getContext:()=>gl,getBoundingClientRect:()=>({left:0,top:0,width:960,height:560})}};
}
test("original model catalog has twelve standalone reusable items",()=>{
 assert.equal(ORIGINAL_MODELS.length,12);
 assert.equal(new Set(ORIGINAL_MODELS.map(x=>x.id)).size,12);
 assert.equal(ORIGINAL_MODELS.filter(x=>x.kind==="avatar").length,3);
 assert.equal(ORIGINAL_MODELS.filter(x=>x.kind==="nature").length,4);
 assert.equal(ORIGINAL_MODELS.filter(x=>x.kind==="building").length,1);
 assert.equal(ORIGINAL_MODELS.filter(x=>x.kind==="equipment").length,4);
});
test("all models contain valid original colored indexed 3D geometry",()=>{
 for(const entry of ORIGINAL_MODELS){
  const model=buildOriginalModel(entry.id);
  assert.equal(model.id,entry.id);
  let polygons=0;
  for(const part of model.parts){
   const g=part.geometry;assert.ok(g.positions.length>0);
   assert.equal(g.positions.length,g.normals.length);
   assert.equal(g.positions.length,g.colors.length);
   assert.equal(g.positions.length%3,0);
   assert.equal(g.indices.length%3,0);
   assert.ok(g.positions.every(Number.isFinite));
   assert.ok(g.normals.every(Number.isFinite));
   assert.ok(g.colors.every(c=>c>=0&&c<=1));
   assert.ok(g.indices.every(i=>i>=0&&i<g.positions.length/3));
   assert.ok(g.indices.length/3<1500);
   polygons+=g.indices.length/3;
  }
  assert.ok(polygons>=40&&polygons<3000,entry.id);
 }
});
test("models include distinct silhouettes, vertex colors, geometry and realistic metric extents",()=>{
 const human=["pioneer","scout","artisan"].map(id=>buildOriginalModel(id));
 assert.notDeepEqual(human[0].parts[1].geometry.colors,human[1].parts[1].geometry.colors);
 for(const id of ["pine","broadleaf","flowering","boulder","hut"]){
  const b=modelBounds(buildOriginalModel(id));
  assert.ok(b.max[1]>b.min[1]+.4);
  assert.ok(b.max[0]>b.min[0]+.15);
 }
});
test("avatar parts use existing semantic humanoid pivots",()=>{
 const valid=new Set(JOINT_GRAPH.map(x=>x[0]));
 for(const id of ["pioneer","scout","artisan"]){
  const model=buildOriginalModel(id);
  assert.equal(model.kind,"avatar");
  assert.ok(model.parts.length>=16);
  for(const part of model.parts){
   assert.ok(valid.has(part.pivot),"unknown pivot "+part.pivot);
  }
 }
});
test("every model exports to a self-contained 2.0 GLB with vertex color and valid binary buffers",()=>{
 for(const {id} of ORIGINAL_MODELS){
  const glb=exportOriginalGLB(id),{json,bufferStart}=header(glb);
  assert.equal(json.asset.version,"2.0");
  assert.ok(json.nodes.length>1);
  assert.equal(json.meshes.length,buildOriginalModel(id).parts.length);
  assert.equal(json.extras.modelId,id);
  assert.equal(json.extras.license,"CC0-1.0");
  assert.ok(bufferStart+json.buffers[0].byteLength<=glb.length);
  assert.ok(glb.length<180000);
  for(const mesh of json.meshes){
   const primitive=mesh.primitives[0];
   assert.ok(primitive.attributes.POSITION>=0);
   assert.ok(primitive.attributes.NORMAL>=0);
   assert.ok(primitive.attributes.COLOR_0>=0);
   assert.equal(primitive.mode,4);
  }
  for(const view of json.bufferViews){
   assert.ok(view.byteOffset%4===0);
   assert.ok(view.byteLength>0);
   assert.ok(view.byteOffset+view.byteLength<=json.buffers[0].byteLength);
  }
 }
});
test("animated humanoid GLB exports five clips with time bounds and joint targets",()=>{
 for(const id of ["pioneer","scout","artisan"]){
  const {json}=header(exportOriginalGLB(id));
  assert.deepEqual(json.animations.map(x=>x.name),["walk","jump","sword","axe","build"]);
  for(const clip of json.animations){
   assert.ok(clip.channels.length>=10);
   for(const channel of clip.channels){
    assert.equal(channel.target.path,"rotation");
    const sampler=clip.samplers[channel.sampler],accessor=json.accessors[sampler.input];
    assert.equal(accessor.type,"SCALAR");
    assert.ok(accessor.min&&accessor.max);
    assert.equal(json.bufferViews[accessor.bufferView].target,undefined);
   }
  }
 }
});
test("OBJ export has real vertices and faces without external files",()=>{
 for(const item of ORIGINAL_MODELS){
  const s=exportOriginalOBJ(item.id);
  assert.ok(s.startsWith("# Universal Engine"));
  assert.ok(s.includes("\nv "));
  assert.ok(s.includes("\nf "));
  assert.ok(s.endsWith("\n"));
 }
});
test("explorer renders original body parts and switches all three avatars",()=>{
 const {canvas,calls}=mockGL();
 const planet=new Planet({seed:77,timeDays:.25}),terrain=new Terrain(planet);
 const scene=new ExplorerRenderer(canvas,planet,terrain);
 assert.equal(scene.avatarStyle,"pioneer");
 assert.ok(scene.rigParts.length>=16);
 const originalColor=scene.rigParts[0].part.geometry.colors.slice(0,3);
 scene.setAvatarStyle("scout");
 assert.equal(scene.avatarStyle,"scout");
 assert.notDeepEqual(originalColor,scene.rigParts[0].part.geometry.colors.slice(0,3));
 scene.setAvatarStyle("artisan");
 assert.equal(scene.avatarStyle,"artisan");
 assert.ok(Object.keys(scene.tools).includes("axe"));
 assert.ok(scene.buildingMeshes.details);
 assert.throws(()=>scene.setAvatarStyle("not-found"),/Unknown/);
 scene.destroy();
 assert.ok(calls.bytes>300000);
});
test("model showroom previews original animated humanoids and scenery",()=>{
 const {canvas,calls}=mockGL();
 const lab=new OriginalModelViewer(canvas);
 const a=lab.load("pioneer");
 assert.equal(a.kind,"avatar");
 lab.setClip("walk");
 lab.render(.05);
 lab.setClip("sword");
 lab.render(.05);
 const b=lab.load("flowering");
 assert.equal(b.kind,"nature");
 lab.render(.05);
 assert.ok(calls.draws>=a.parts.length+3);
 lab.destroy();
});
