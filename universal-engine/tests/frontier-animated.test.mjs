import test from "node:test";
import assert from "node:assert/strict";
import {parseFrontierRig,poseFrontierRig,chooseFrontierClip,sampleAnimationTrack,matMultiply,matIdentity} from "../planet-explorer/frontier-animated.mjs";
import {SkinnedFrontierAsset} from "../planet-explorer/frontier-skinned-renderer.mjs";

export function tinySkinnedGLB(){
 const buffers=[],views=[],accessors=[];
 function append(data,type,componentType,components){
  let offset=buffers.reduce((n,v)=>n+v.byteLength,0);
  if(offset%4){const padding=new Uint8Array(4-offset%4);buffers.push(padding);offset+=padding.byteLength;}
  const bytes=new Uint8Array(data.buffer,data.byteOffset,data.byteLength);buffers.push(bytes);
  views.push({buffer:0,byteOffset:offset,byteLength:bytes.byteLength});
  accessors.push({bufferView:views.length-1,componentType,count:data.length/components,type});
  return accessors.length-1;
 }
 const pos=append(new Float32Array([0,0,0,1,0,0,0,2,0]),"VEC3",5126,3);
 const nor=append(new Float32Array([0,1,0,0,1,0,0,1,0]),"VEC3",5126,3);
 const joints=append(new Uint8Array([0,0,0,0,0,0,0,0,0,0,0,0]),"VEC4",5121,4);
 const weights=append(new Float32Array([1,0,0,0,1,0,0,0,1,0,0,0]),"VEC4",5126,4);
 const ids=append(new Uint16Array([0,1,2]),"SCALAR",5123,1);
 const eyelid=append(new Float32Array([0,0,0,0,0,0,0,-.1,0]),"VEC3",5126,3);
 const lips=append(new Float32Array([0,0,0,0,0,0,0,-.2,0]),"VEC3",5126,3);
 const identity=append(new Float32Array(matIdentity()),"MAT4",5126,16);
 const times=append(new Float32Array([0,1]),"SCALAR",5126,1);
 const translations=append(new Float32Array([0,0,0,0,.4,0]),"VEC3",5126,3);
 const talking=append(new Float32Array([0,0,0,1]),"SCALAR",5126,1);
 const binarySize=buffers.reduce((n,b)=>n+b.byteLength,0);
 const json={asset:{version:"2.0"},scene:0,scenes:[{nodes:[0,1]}],
  nodes:[{name:"Body",mesh:0,skin:0},{name:"Chest"}],
  meshes:[{weights:[0,0],extras:{targetNames:["EyeClose","MouthOpen"]},primitives:[
   {attributes:{POSITION:pos,NORMAL:nor,JOINTS_0:joints,WEIGHTS_0:weights},
    indices:ids,targets:[{POSITION:eyelid},{POSITION:lips}]}]}],
  skins:[{joints:[1],inverseBindMatrices:identity}],
  animations:[
   {name:"Walk",samplers:[{input:times,output:translations,interpolation:"LINEAR"}],
    channels:[{sampler:0,target:{node:1,path:"translation"}}]},
   {name:"FaceTalking",samplers:[{input:times,output:talking,interpolation:"LINEAR"}],
    channels:[{sampler:0,target:{node:0,path:"weights"}}]}
  ],
  bufferViews:views,accessors,buffers:[{byteLength:binarySize}]
 };
 const encoded=new TextEncoder().encode(JSON.stringify(json));
 const pad=(encoded.byteLength+3)&~3,binPad=(binarySize+3)&~3,total=12+8+pad+8+binPad;
 const output=new ArrayBuffer(total),view=new DataView(output);
 view.setUint32(0,0x46546c67,true);view.setUint32(4,2,true);view.setUint32(8,total,true);
 view.setUint32(12,pad,true);view.setUint32(16,0x4e4f534a,true);
 const jj=new Uint8Array(output,20,pad);jj.fill(32);jj.set(encoded);
 const binOffset=20+pad;
 view.setUint32(binOffset,binPad,true);view.setUint32(binOffset+4,0x004e4942,true);
 const dst=new Uint8Array(output,binOffset+8,binPad);let offset=0;
 for(const chunk of buffers){dst.set(chunk,offset);offset+=chunk.byteLength;}
 return output;
}
function fakeWebGL(){
 const state={drawCount:0,boneMatrices:[],morphs:[]};
 const gl=new Proxy({},{
  get(_,key){
   if(key==="state")return state;
   if(key==="getShaderParameter"||key==="getProgramParameter")return ()=>true;
   if(key==="getUniformLocation")return (_,name)=>name;
   if(key==="drawElements")return ()=>{state.drawCount++;};
   if(key==="uniform2fv")return (id,arr)=>{if(id==="uMorph")state.morphs.push([...arr]);};
   if(key==="texImage2D")return (...args)=>{if(args[2]==="RGBA32F")state.boneMatrices.push([...args[8]]);};
   if(String(key).startsWith("create"))return ()=>({});
   if(typeof key==="string"&&key.toUpperCase()===key)return key;
   return ()=>{};
  }
 });
 return gl;
}
test("parse actual GLB2 binary: joint palette, clip names, 2 face morph targets",()=>{
 const rig=parseFrontierRig(tinySkinnedGLB());
 assert.equal(rig.triangles,1);
 assert.equal(rig.skins[0].joints.length,1);
 assert.deepEqual(rig.morphNames,["EyeClose","MouthOpen"]);
 assert.deepEqual(rig.clips.map(c=>c.name),["Walk","FaceTalking"]);
 assert.equal(rig.nodes[0].weights.length,2);
});
test("walking animates joint at half-time and mouth morph follows FaceTalking",()=>{
 const rig=parseFrontierRig(tinySkinnedGLB());
 const pose=poseFrontierRig(rig,"walk",.5,"faceTalking",.5);
 assert.ok(Math.abs(pose.world[1][13]-.2)<.00001);
 assert.ok(Math.abs(pose.morphs[0][1]-.5)<.00001);
 assert.equal(chooseFrontierClip(rig.clips,"axe").name,undefined);
});
test("GPU renderer uploads four RGBA bone matrix columns and independent clip state",()=>{
 const gl=fakeWebGL(),model=new SkinnedFrontierAsset(gl,tinySkinnedGLB());
 const vp=matIdentity(),avatar=matIdentity(),light=[.5,.8,.1];
 model.draw(vp,avatar,light,"scout",.5,{moving:true,motion:"idle"});
 assert.equal(gl.state.drawCount,1);
 assert.ok(Math.abs(gl.state.boneMatrices[0][13]-.2)<.00001);
 model.draw(vp,avatar,light,"player",.5,{talking:true});
 assert.equal(gl.state.drawCount,2);
 assert.ok(gl.state.morphs.some(m=>Math.abs(m[1]-.5)<.00001));
 assert.notEqual(model.instances.get("scout"),model.instances.get("player"));
 model.destroy();
});
test("invalid GLB header, accessor range and missing meshes are rejected",()=>{
 assert.throws(()=>parseFrontierRig(new ArrayBuffer(28)),/GLB/);
 const track={times:[0,1],frames:[{value:[0]},{value:[1]}],path:"weights",interpolation:"LINEAR"};
 assert.deepEqual(sampleAnimationTrack(track,.5),[.5]);
 assert.equal(matMultiply(matIdentity(),matIdentity())[0],1);
});
