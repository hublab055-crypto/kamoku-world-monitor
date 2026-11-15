import test from "node:test";
import assert from "node:assert/strict";
import {createAvatarV10FootMeshes} from "./avatar-v10-body-mesh.mjs";

const mesh=(name,node,wardrobe,positions,colors=null)=>({
 name,node,skin:0,wardrobe,indices:new Uint32Array([0,1,2]),
 arrays:{
  positions:new Float32Array(positions),
  normals:new Float32Array([0,1,0,0,1,0,0,1,0]),
  colors:colors||new Float32Array(9).fill(.4),
  joints:new Float32Array(12),
  weights:new Float32Array([1,0,0,0,1,0,0,0,1,0,0,0]),
  uv:new Float32Array(6),morph0:new Float32Array(9),morph1:new Float32Array(9)
 }
});

test("V10 base/swim have complete skinned foot surfaces without altering shoes",()=>{
 const left=mesh("Casual left shoe",5,["casual"],[-.3,.04,.2,-.2,.21,.5,-.25,.02,.68]);
 const right=mesh("Casual right shoe",6,["casual"],[.2,.04,.2,.3,.21,.5,.25,.02,.68]);
 const face=mesh("Face and skull",2,["work","casual"],[0,1,0,.1,1,0,.1,1.2,0],new Float32Array(90).fill(.7));
 const rig={isV10:true,primitives:[face,left,right]};
 const result=createAvatarV10FootMeshes(rig);
 assert.equal(result.length,2);
 assert.deepEqual(result.map(p=>p.name),["V10 generated foot skin 1","V10 generated foot skin 2"]);
 assert.ok(result.every(p=>p.wardrobe.includes("base")&&p.wardrobe.includes("swim")));
 assert.ok(result.every(p=>p.skin===0&&p.textureImage===null));
 assert.ok(result.every(p=>p.arrays.weights!==left.arrays.weights));
 assert.equal(result[0].arrays.colors[0],.7);
 assert.equal(left.arrays.colors[0],.4);
 assert.equal(left.arrays.positions[4],.21);
 assert.ok(Math.min(...result[0].arrays.positions.filter((_,i)=>i%3===1))<=.04);
 assert.ok(result[0].arrays.positions[4]<.21);
});
test("only create missing feet for V10, never cover an authored base foot",()=>{
 const shoe=mesh("work boot",8,["work"],[0,0,0,.1,.1,0,.1,0,.2]);
 assert.equal(createAvatarV10FootMeshes({isV10:false,primitives:[shoe]}).length,0);
 assert.equal(createAvatarV10FootMeshes({isV10:true,primitives:[shoe]}).length,1);
 assert.equal(createAvatarV10FootMeshes({isV10:true,primitives:[
  shoe,mesh("base heel and toe",3,["base"],[0,0,0,.1,.1,0,.1,0,.2])
 ]}).length,0);
});
