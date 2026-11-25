import test from "node:test";
import assert from "node:assert/strict";
import {ownerMechanismPoseOverrides} from "../planet-explorer/cad-world-motion.mjs";
import {MECHANISM_FORMAT} from "../model-lab/cad/mechanism-core.mjs";

const source={
 format:"UE-assembly-v2",units:"mm",
 objects:[
  {id:"a",kind:"assembly",pos:[0,0,0],rot:[0,0,0],size:[80,50,10]},
  {id:"b",kind:"shaft",pos:[0,0,10],rot:[0,0,0],size:[20,20,10],parent:"a"},
  {id:"c",kind:"gear",pos:[30,0,10],rot:[0,0,0],size:[40,40,10],parent:"a"},
  {id:"d",kind:"block",pos:[60,0,10],rot:[0,0,0],size:[20,20,10],parent:"a"}
 ],
 mechanism:{format:MECHANISM_FORMAT,joints:[
  {type:"revolute",part:"b",axis:"z",speed:30,teeth:20},
  {type:"gear",part:"c",driver:"b",axis:"z",teeth:40},
  {type:"slider",part:"d",axis:"z",speed:30,stroke:40}
 ]}
};
const part=(id,group)=>({id,group,lat:35,lon:137,offsetY:0,rx:0,ry:0,rz:0,rotation:0});
const owner={prefabs:[{name:"Machine",parts:[{}, {}, {}].map(()=>({rz:0})),assetDocument:{cadMotion:{source,scale:.01}}}],
 primitives:[part(1,"Machine"),part(2,"Machine"),part(3,"Machine")]};
test("placed CAD assemblies rotate shafts and geared wheels without mutating save",()=>{
 const before=JSON.stringify(owner);
 const result=ownerMechanismPoseOverrides(owner,1);
 assert.equal(result.size,3);
 assert.ok(Math.abs(result.get(1).rz-Math.PI)<1e-10);
 assert.ok(Math.abs(result.get(2).rz+Math.PI/2)<1e-10);
 assert.equal(JSON.stringify(owner),before);
});
test("placed slider motion stops at same simulation time, advances at different time",()=>{
 const a=ownerMechanismPoseOverrides(owner,.5).get(3);
 const b=ownerMechanismPoseOverrides(owner,.5).get(3);
 const c=ownerMechanismPoseOverrides(owner,1.5).get(3);
 assert.equal(a.offsetY,b.offsetY);
 assert.ok(a.offsetY>c.offsetY);
});
test("malformed motion cannot break static world render",()=>{
 const corrupted=structuredClone(owner);
 corrupted.prefabs[0].assetDocument.cadMotion.source.mechanism.joints[0].speed=NaN;
 assert.equal(ownerMechanismPoseOverrides(corrupted,1).size,0);
});
