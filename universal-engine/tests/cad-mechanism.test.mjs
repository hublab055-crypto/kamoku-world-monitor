import test from "node:test";
import assert from "node:assert/strict";
import {evaluateMechanism,validateMechanism,MECHANISM_FORMAT} from "../model-lab/cad/mechanism-core.mjs";
import {cadAssemblyToAssetDocument} from "../planet-explorer/cad-assembly-bridge.mjs";
import {applyAssetMechanismPose} from "../planet-explorer/cad-motion-preview.mjs";
import {AssetStudioModel} from "../planet-explorer/asset-studio-model.mjs";

const objects=[
 {id:"part1",kind:"assembly",name:"Mount",pos:[0,0,0],rot:[0,0,0],size:[100,60,10],parent:null},
 {id:"part2",kind:"shaft",name:"Motor",pos:[0,0,10],rot:[0,0,0],size:[20,20,40],parent:"part1",color:"#88aacc"},
 {id:"part3",kind:"gear",name:"Gear 40T",pos:[30,0,10],rot:[0,0,0],size:[40,40,8],parent:"part1",color:"#cc8899"},
 {id:"part4",kind:"block",name:"Slider",pos:[60,0,10],rot:[0,0,0],size:[20,20,12],parent:"part1",color:"#aaccee"},
];
const mechanism={format:MECHANISM_FORMAT,joints:[
 {part:"part2",type:"revolute",axis:"z",speed:30,teeth:20,phase:0},
 {part:"part3",type:"gear",driver:"part2",axis:"z",teeth:40,phase:0},
 {part:"part4",type:"slider",axis:"z",speed:30,stroke:40,phase:0}
]};
const document=()=>({format:"UE-assembly-v2",units:"mm",objects:structuredClone(objects),mates:[],mechanism});

test("shaft drives inverse gear rotation at exact teeth ratio",()=>{
 const data=evaluateMechanism(objects,mechanism,1);
 assert.equal(data[1].rot[2],180);
 assert.equal(data[2].rot[2],-90);
 assert.equal(objects[1].rot[2],0);
});
test("slider oscillates boundedly around its baseline",()=>{
 const at1=evaluateMechanism(objects,mechanism,.5);
 assert.equal(at1[3].pos[2],30);
 const at2=evaluateMechanism(objects,mechanism,1.5);
 assert.equal(at2[3].pos[2],-10);
});
test("game asset pose receives animated shaft, gear and slider",()=>{
 const {document:asset,scale}=cadAssemblyToAssetDocument(document());
 const preview=applyAssetMechanismPose(new AssetStudioModel(asset).parts,document(),1,scale);
 assert.ok(Math.abs(preview[0].rz-Math.PI)<1e-9);
 assert.ok(Math.abs(preview[1].rz+Math.PI/2)<1e-9);
 assert.ok(Math.abs(preview[2].z-new AssetStudioModel(asset).parts[2].z)<1e-9);
});
test("model serializes and restores CAD mechanism payload",()=>{
 const converted=cadAssemblyToAssetDocument(document());
 const model=new AssetStudioModel(converted.document);
 model.cadMotion={source:document(),scale:converted.scale};
 const saved=model.snapshot();
 assert.equal(new AssetStudioModel(saved).cadMotion.source.mechanism.joints.length,3);
});
test("cycle, missing driving gear, invalid teeth are rejected",()=>{
 assert.throws(()=>validateMechanism({format:MECHANISM_FORMAT,joints:[{type:"gear",part:"part3",driver:"part4",axis:"z",teeth:0}]},objects));
 assert.throws(()=>validateMechanism({format:MECHANISM_FORMAT,joints:[{type:"gear",part:"part2",driver:"part3",axis:"z",teeth:20},{type:"gear",part:"part3",driver:"part2",axis:"z",teeth:40}]},objects));
});
