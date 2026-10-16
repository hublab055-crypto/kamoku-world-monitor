import {buildOriginalModel} from "./original-models.mjs";
import {jointTransforms,point,samplePose} from "../planet-explorer/rig.mjs";
/** Export self-contained glTF 2.0 GLB and Wavefront OBJ; no external dependencies. */
export const JOINT_GRAPH=Object.freeze([
  ["pelvis",null,[0,.96,0]],["waist","pelvis",[0,0,0]],["torso","waist",[0,.15,0]],
  ["neck","torso",[0,.78,0]],["head","neck",[0,.13,0]],
  ["leftShoulder","torso",[-.43,.65,0]],["leftElbow","leftShoulder",[0,-.45,0]],
  ["leftWrist","leftElbow",[0,-.39,0]],["leftHand","leftWrist",[0,-.11,0]],
  ["rightShoulder","torso",[.43,.65,0]],["rightElbow","rightShoulder",[0,-.45,0]],
  ["rightWrist","rightElbow",[0,-.39,0]],["rightHand","rightWrist",[0,-.11,0]],
  ["leftHip","pelvis",[-.21,-.03,0]],["leftKnee","leftHip",[0,-.47,0]],
  ["leftAnkle","leftKnee",[0,-.43,0]],["leftFoot","leftAnkle",[0,-.06,0]],
  ["rightHip","pelvis",[.21,-.03,0]],["rightKnee","rightHip",[0,-.47,0]],
  ["rightAnkle","rightKnee",[0,-.43,0]],["rightFoot","rightAnkle",[0,-.06,0]]
]);
export const utf8 = text => {
  const out=[];
  for(const ch of text){
    const n=ch.codePointAt(0);
    if(n<=127)out.push(n);
    else if(n<=2047)out.push(192|(n>>6),128|(n&63));
    else if(n<=65535)out.push(224|(n>>12),128|((n>>6)&63),128|(n&63));
    else out.push(240|(n>>18),128|((n>>12)&63),128|((n>>6)&63),128|(n&63));
  }
  return Uint8Array.from(out);
};
export const base64 = bytes => {
  const table="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let s="";
  for(let i=0;i<bytes.length;i+=3){
    const a=bytes[i],hasB=i+1<bytes.length,hasC=i+2<bytes.length;
    const b=hasB?bytes[i+1]:0,c=hasC?bytes[i+2]:0;
    s+=table[a>>2]+table[((a&3)<<4)|(b>>4)]+(hasB?table[((b&15)<<2)|(c>>6)]:"=")+(hasC?table[c&63]:"=");
  }
  return s;
};
class BufferWriter {
  constructor(){this.bytes=[];this.views=[];this.accessors=[];}
  align(){while(this.bytes.length%4)this.bytes.push(0);}
  append(values,componentType,type,target){
    this.align();
    const begin=this.bytes.length,bytesPer=componentType===5126||componentType===5125?4:2;
    const buf=new ArrayBuffer(bytesPer),dv=new DataView(buf);
    const count=type==="VEC4"?4:type==="VEC3"?3:1;
    if(values.length%count!==0)throw Error("Misaligned accessor values");
    for(const number of values){
      if(!Number.isFinite(number))throw Error("Non-finite vertex value");
      if(componentType===5126)dv.setFloat32(0,number,true);
      else if(componentType===5125)dv.setUint32(0,number,true);
      else if(componentType===5123)dv.setUint16(0,number,true);
      for(let j=0;j<bytesPer;j++)this.bytes.push(dv.getUint8(j));
    }
    const view={buffer:0,byteOffset:begin,byteLength:this.bytes.length-begin};
    if(target!==undefined)view.target=target;
    this.views.push(view);
    const accession={bufferView:this.views.length-1,componentType,count:values.length/count,type};
    if(type==="VEC3"&&target===34962&&componentType===5126){
      const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
      for(let i=0;i<values.length;i+=3){
        for(let j=0;j<3;j++){min[j]=Math.min(min[j],values[i+j]);max[j]=Math.max(max[j],values[i+j]);}
      }
      accession.min=min.map(Math.fround);accession.max=max.map(Math.fround);
    }
    if(type==="SCALAR"&&componentType===5126){accession.min=[Math.fround(Math.min(...values))];accession.max=[Math.fround(Math.max(...values))];}
    this.accessors.push(accession);
    return this.accessors.length-1;
  }
  finish(){this.align();return Uint8Array.from(this.bytes);}
}
const qx=a=>[Math.sin(a/2),0,0,Math.cos(a/2)];
const qy=a=>[0,Math.sin(a/2),0,Math.cos(a/2)];
const qz=a=>[0,0,Math.sin(a/2),Math.cos(a/2)];
const qmul=(a,b)=>[
  a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1],
  a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0],
  a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3],
  a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2]
];
function rotationFor(joint,p){
  if(joint==="waist")return qmul(qx(p.torsoX||0),qy(p.torsoY||0));
  if(joint==="neck")return qy(p.headY||0);
  if(joint.endsWith("Shoulder"))return qmul(qz(p[joint+"Z"]||0),qx(p[joint+"X"]||0));
  if(joint.endsWith("Hip")||joint.endsWith("Knee")||joint.endsWith("Elbow")||
      joint.endsWith("Wrist")||joint.endsWith("Ankle"))return qx(p[joint+"X"]||0);
  return [0,0,0,1];
}
const ACTIVE_JOINTS=[
  "waist","leftShoulder","rightShoulder","leftElbow","rightElbow",
  "leftHip","rightHip","leftKnee","rightKnee","leftAnkle","rightAnkle"
];
function attachAnimations(writer,gltf,nodeMap){
  const clips=[
    ["walk",5,1.0,(i)=>samplePose({moving:true,phase:i*Math.PI/2})],
    ["jump",4,1.0,(i)=>samplePose({jumpHeight:i===0||i===3?.01:1})],
    ["sword",6,1.0,(i)=>samplePose({action:"sword",progress:i/5})],
    ["axe",6,1.4,(i)=>samplePose({action:"axe",progress:i/5})],
    ["build",7,1.3,(i)=>samplePose({action:"build",progress:i/6})]
  ];
  gltf.animations=[];
  for(const [name,length,duration,makePose] of clips){
    const times=Array.from({length},(_,i)=>i*duration/(length-1));
    const timesAccessor=writer.append(times,5126,"SCALAR");
    const samplers=[],channels=[];
    for(const joint of ACTIVE_JOINTS){
      const data=[];
      for(let i=0;i<length;i++)data.push(...rotationFor(joint,makePose(i)));
      const out=writer.append(data,5126,"VEC4");
      const sampler=samplers.length;
      samplers.push({input:timesAccessor,output:out,interpolation:"LINEAR"});
      channels.push({sampler,target:{node:nodeMap.get(joint),path:"rotation"}});
    }
    gltf.animations.push({name,samplers,channels});
  }
}
/**
 * Animated avatars use rigid segmented joint nodes (not skinned mesh).
 * GLB animation rotation channels use those same joints; edit in Blender and export.
 */
export function exportOriginalGLB(modelOrId){
  const model=typeof modelOrId==="string"?buildOriginalModel(modelOrId):modelOrId;
  const writer=new BufferWriter();
  const gltf={
    asset:{version:"2.0",generator:"Universal Engine Original Model Factory 1.0"},
    scene:0,scenes:[{nodes:[0]}],
    nodes:[{name:model.id,children:[],extras:{originalAsset:true,creator:"Universal Engine"}}],
    meshes:[],
    materials:[{name:"UE Vertex Colors",doubleSided:true,pbrMetallicRoughness:{
      baseColorFactor:[1,1,1,1],metallicFactor:0,roughnessFactor:.86}}],
    bufferViews:writer.views,accessors:writer.accessors,
    buffers:[],extras:{modelId:model.id,license:"CC0-1.0",creator:"Original procedural geometry created for Universal Engine"}
  };
  const pivotNodes=new Map();
  if(model.kind==="avatar"){
    for(const [name,parent,translation]of JOINT_GRAPH){
      const index=gltf.nodes.length;
      const node={name,translation,rotation:[0,0,0,1],children:[],extras:{jointPivot:true}};
      gltf.nodes.push(node);
      pivotNodes.set(name,index);
      gltf.nodes[parent===null?0:pivotNodes.get(parent)].children.push(index);
    }
  }
  for(const part of model.parts){
    const mesh=part.geometry;
    const maxIndex=Math.max(...mesh.indices);
    if(maxIndex>65535)throw Error("Model part exceeds UNSIGNED_SHORT glTF limit");
    const indexAccessor=writer.append(mesh.indices,5123,"SCALAR",34963);
    const positionAccessor=writer.append(mesh.positions,5126,"VEC3",34962);
    const normalAccessor=writer.append(mesh.normals,5126,"VEC3",34962);
    const colorAccessor=writer.append(mesh.colors,5126,"VEC3",34962);
    const mi=gltf.meshes.length;
    gltf.meshes.push({name:part.name,primitives:[{
      attributes:{POSITION:positionAccessor,NORMAL:normalAccessor,COLOR_0:colorAccessor},
      indices:indexAccessor,material:0,mode:4
    }]});
    const i=gltf.nodes.length;
    gltf.nodes.push({name:part.name,mesh:mi});
    const parent=part.pivot?pivotNodes.get(part.pivot):0;
    if(parent===undefined)throw Error("Unknown rig joint "+part.pivot);
    gltf.nodes[parent].children.push(i);
  }
  if(model.kind==="avatar")attachAnimations(writer,gltf,pivotNodes);
  const binary=writer.finish(),json=utf8(JSON.stringify(gltf));
  const jsonSize=(json.length+3)&~3,binSize=(binary.length+3)&~3;
  const total=12+8+jsonSize+8+binSize;
  const out=new Uint8Array(total),dv=new DataView(out.buffer);
  dv.setUint32(0,0x46546c67,true);dv.setUint32(4,2,true);dv.setUint32(8,total,true);
  dv.setUint32(12,jsonSize,true);dv.setUint32(16,0x4e4f534a,true);
  out.fill(32,20,20+jsonSize);out.set(json,20);
  const binHead=20+jsonSize;dv.setUint32(binHead,binSize,true);dv.setUint32(binHead+4,0x004e4942,true);
  out.set(binary,binHead+8);
  gltf.buffers.push({byteLength:binary.length});
  // JSON must include final buffer size; regenerate once from the completed document.
  const complete=utf8(JSON.stringify(gltf));
  const padded=(complete.length+3)&~3;
  const finalLen=12+8+padded+8+binSize;
  const final=new Uint8Array(finalLen),header=new DataView(final.buffer);
  header.setUint32(0,0x46546c67,true);header.setUint32(4,2,true);header.setUint32(8,finalLen,true);
  header.setUint32(12,padded,true);header.setUint32(16,0x4e4f534a,true);
  final.fill(32,20,20+padded);final.set(complete,20);
  const at=20+padded;header.setUint32(at,binSize,true);header.setUint32(at+4,0x004e4942,true);
  final.set(binary,at+8);
  return final;
}
export function exportOriginalOBJ(modelOrId){
  const model=typeof modelOrId==="string"?buildOriginalModel(modelOrId):modelOrId;
  const transforms=model.kind==="avatar"?jointTransforms(samplePose()):{};
  const lines=["# Universal Engine original low-poly model","# Name: "+model.id,
    "# Origin: original procedural geometry, generated in Universal Engine",
    "o "+model.id];
  let vertexCount=0;
  for(const part of model.parts){
    lines.push("g "+part.name.replaceAll(" ","_"));
    const m=part.geometry,transform=part.pivot?transforms[part.pivot]:null;
    for(let i=0;i<m.positions.length;i+=3){
      const p=transform?point(transform,m.positions.slice(i,i+3)):m.positions.slice(i,i+3);
      lines.push("v "+p.map(v=>v.toFixed(5)).join(" "));
    }
    for(let i=0;i<m.indices.length;i+=3){
      lines.push("f "+m.indices.slice(i,i+3).map(x=>x+1+vertexCount).join(" "));
    }
    vertexCount+=m.positions.length/3;
  }
  return lines.join("\n")+"\n";
}
