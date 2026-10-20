import {samplePose} from "./rig.mjs";
import {swimStroke,isAquaticAction} from "./swim-motion.mjs?v=0.8o-four-strokes";
/** GLB2 skeletal/morph animation data. Pure module; no DOM/WebGL dependency.
 * Supports glTF node hierarchy, inverse bind matrices, skin weights, two morph targets,
 * LINEAR/STEP/CUBICSPLINE animation samples, and separate face/body playback.
 */
const WIDTH={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16};
const TYPES={5120:1,5121:1,5122:2,5123:2,5125:4,5126:4};
export const matIdentity=()=>[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
export function matMultiply(a,b){
 const r=Array(16).fill(0);
 for(let c=0;c<4;c++)for(let row=0;row<4;row++)for(let k=0;k<4;k++)r[c*4+row]+=a[k*4+row]*b[c*4+k];
 return r;
}
export function matTRS(t=[0,0,0],q=[0,0,0,1],s=[1,1,1]){
 const [x,y,z,w]=q;
 return [(1-2*(y*y+z*z))*s[0],2*(x*y+z*w)*s[0],2*(x*z-y*w)*s[0],0,
 2*(x*y-z*w)*s[1],(1-2*(x*x+z*z))*s[1],2*(y*z+x*w)*s[1],0,
 2*(x*z+y*w)*s[2],2*(y*z-x*w)*s[2],(1-2*(x*x+y*y))*s[2],0,
 t[0],t[1],t[2],1];
}
function valueAccessor(json,bytes,id){
 const accessor=json.accessors?.[id];if(!accessor||accessor.sparse||!Number.isInteger(accessor.bufferView))throw Error("Unsupported GLB accessor");
 const view=json.bufferViews?.[accessor.bufferView],width=WIDTH[accessor.type],size=TYPES[accessor.componentType];
 if(!view||!width||!size||!Number.isInteger(accessor.count)||accessor.count<0||accessor.count>250000)throw Error("Invalid GLB accessor");
 const start=(view.byteOffset||0)+(accessor.byteOffset||0),stride=view.byteStride||size*width;
 if(start<0||stride<size*width||start+(accessor.count?accessor.count-1:0)*stride+(accessor.count?size*width:0)>bytes.byteLength)throw Error("GLB accessor beyond buffer");
 const dv=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),result=[];
 for(let i=0;i<accessor.count;i++){
  const row=[];
  for(let j=0;j<width;j++){
   const at=start+i*stride+j*size,c=accessor.componentType;
   let n=c===5126?dv.getFloat32(at,true):c===5125?dv.getUint32(at,true):c===5123?dv.getUint16(at,true):
    c===5122?dv.getInt16(at,true):c===5121?dv.getUint8(at):dv.getInt8(at);
   if(accessor.normalized&&c!==5126){
    const signed=(c===5120||c===5122),max=2**(8*size-(signed?1:0))-1;
    n=signed?Math.max(-1,n/max):n/max;
   }
   row.push(n);
  }
  result.push(row);
 }
 return result;
}
export function readFrontierGLB(buffer){
 const bytes=buffer instanceof ArrayBuffer?buffer:buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.byteLength);
 if(bytes.byteLength<28||bytes.byteLength>85*1024*1024)throw Error("GLB file size outside limits");
 const dv=new DataView(bytes);
 if(dv.getUint32(0,true)!==0x46546c67||dv.getUint32(4,true)!==2||dv.getUint32(8,true)!==bytes.byteLength)throw Error("Invalid GLB2 header");
 let json=null,binary=null,offset=12;
 while(offset+8<=bytes.byteLength){
  const size=dv.getUint32(offset,true),type=dv.getUint32(offset+4,true);
  offset+=8;if(offset+size>bytes.byteLength)throw Error("Truncated GLB chunk");
  if(type===0x4e4f534a)json=JSON.parse(new TextDecoder().decode(new Uint8Array(bytes,offset,size)));
  if(type===0x004e4942)binary=new Uint8Array(bytes,offset,size);
  offset+=size;
 }
 if(!json?.asset||!binary)throw Error("GLB JSON or BIN missing");
 return {json,binary};
}
function clipTracks(json,bytes){
 return (json.animations||[]).map((animation,index)=>{
  const tracks=[],duration={value:0};
  for(const channel of animation.channels||[]){
   const sampler=animation.samplers?.[channel.sampler],target=channel.target||{};
   if(!sampler||!Number.isInteger(target.node)||!["translation","rotation","scale","weights"].includes(target.path))continue;
   const times=valueAccessor(json,bytes,sampler.input).map(v=>v[0]);
   const rows=valueAccessor(json,bytes,sampler.output);
   if(!times.length||times.some(n=>!Number.isFinite(n)))continue;
   duration.value=Math.max(duration.value,times.at(-1)||0);
   const width=target.path==="weights"?Math.max(1,Math.round(rows.length/times.length/(sampler.interpolation==="CUBICSPLINE"?3:1))):WIDTH[json.accessors[sampler.output].type];
   const flat=rows.flat(),frames=[];
   for(let i=0;i<times.length;i++){
    const count=sampler.interpolation==="CUBICSPLINE"?3:1,head=i*width*count;
    frames.push(count===3?{input:flat.slice(head,head+width),value:flat.slice(head+width,head+width*2),output:flat.slice(head+width*2,head+width*3)}:
     {value:flat.slice(head,head+width)});
   }
   tracks.push({node:target.node,path:target.path,times,frames,interpolation:sampler.interpolation||"LINEAR"});
  }
  return {name:animation.name||"Clip"+index,tracks,duration:duration.value};
 });
}
function targetNames(mesh,primitive){
 const names=mesh?.extras?.targetNames||primitive?.extras?.targetNames||[];
 return Array.from({length:Math.min(primitive?.targets?.length||0,2)},(_,i)=>names[i]||"target"+i);
}
export function parseFrontierRig(buffer){
 const {json,binary}=readFrontierGLB(buffer);
 const acc=id=>valueAccessor(json,binary,id);
 const nodes=(json.nodes||[]).map(n=>({
  name:n.name||"",matrix:Array.isArray(n.matrix)?n.matrix:null,
  translation:n.translation||[0,0,0],rotation:n.rotation||[0,0,0,1],scale:n.scale||[1,1,1],
  mesh:n.mesh,skin:n.skin,children:n.children||[],weights:n.weights||(Number.isInteger(n.mesh)?json.meshes?.[n.mesh]?.weights:null)||null
 }));
 const primitives=[],images=(json.images||[]).map(image=>{
  if(!Number.isInteger(image.bufferView))return null;
  const view=json.bufferViews[image.bufferView];
  return view?{mimeType:image.mimeType||"image/png",bytes:binary.slice(view.byteOffset||0,(view.byteOffset||0)+view.byteLength)}:null;
 });
 const textureMap=(json.textures||[]).map(t=>t.source);
 const bounds={min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};
 let totalTris=0;
 for(let nodeId=0;nodeId<nodes.length;nodeId++){
  const node=nodes[nodeId];if(!Number.isInteger(node.mesh))continue;
  const mesh=json.meshes[node.mesh];if(!mesh)continue;
  for(const primitive of mesh.primitives||[]){
   if(primitive.mode!=null&&primitive.mode!==4)continue;
   const attrs=primitive.attributes||{};
   if(!Number.isInteger(attrs.POSITION))continue;
   const positions=acc(attrs.POSITION),normals=Number.isInteger(attrs.NORMAL)?acc(attrs.NORMAL):null;
   const joints=Number.isInteger(attrs.JOINTS_0)?acc(attrs.JOINTS_0):null;
   const weights=Number.isInteger(attrs.WEIGHTS_0)?acc(attrs.WEIGHTS_0):null;
   const colors=Number.isInteger(attrs.COLOR_0)?acc(attrs.COLOR_0):null;
   const uvs=Number.isInteger(attrs.TEXCOORD_0)?acc(attrs.TEXCOORD_0):null;
   const indices=Number.isInteger(primitive.indices)?acc(primitive.indices).map(x=>x[0]):positions.map((_,i)=>i);
   const morphs=(primitive.targets||[]).slice(0,2).map(t=>Number.isInteger(t.POSITION)?acc(t.POSITION):null);
   const mat=json.materials?.[primitive.material]||{};
   const pbr=mat.pbrMetallicRoughness||{},textureIndex=pbr.baseColorTexture?.index;
   const textureImage=Number.isInteger(textureIndex)?textureMap[textureIndex]:null;
   if(indices.some(i=>!Number.isInteger(i)||i<0||i>=positions.length))throw Error("GLB triangle indices out of range");
   const count=positions.length;
   if(count>175000||indices.length>450000)throw Error("GLB geometry too large");
   const arrays={positions:new Float32Array(count*3),normals:new Float32Array(count*3),colors:new Float32Array(count*3),
    uv:new Float32Array(count*2),joints:new Float32Array(count*4),weights:new Float32Array(count*4),
    morph0:new Float32Array(count*3),morph1:new Float32Array(count*3)};
   for(let i=0;i<count;i++){
    for(let c=0;c<3;c++){
     const p=positions[i][c]||0;
     arrays.positions[i*3+c]=p;arrays.normals[i*3+c]=normals?.[i]?.[c]??(c===1?1:0);
     arrays.colors[i*3+c]=Math.max(0,Math.min(1,(colors?.[i]?.[c]??1)*(pbr.baseColorFactor?.[c]??1)));
     arrays.morph0[i*3+c]=morphs[0]?.[i]?.[c]||0;arrays.morph1[i*3+c]=morphs[1]?.[i]?.[c]||0;
     bounds.min[c]=Math.min(bounds.min[c],p);bounds.max[c]=Math.max(bounds.max[c],p);
    }
    arrays.uv.set(uvs?.[i]||[0,0],i*2);
    arrays.joints.set(joints?.[i]||[0,0,0,0],i*4);
    const w=weights?.[i]||[1,0,0,0],sum=w.reduce((a,b)=>a+b,0)||1;
    arrays.weights.set(w.map(x=>x/sum),i*4);
   }
   const names=targetNames(mesh,primitive);
   totalTris+=Math.floor(indices.length/3);
   primitives.push({node:nodeId,skin:node.skin??null,arrays,indices:new Uint32Array(indices),
    textureImage,names,material:mat.name||"",doubleSided:!!mat.doubleSided});
  }
 }
 if(!primitives.length)throw Error("GLB contains no drawable mesh");
 const skins=(json.skins||[]).map(s=>({
  joints:s.joints||[],inverseBind:Number.isInteger(s.inverseBindMatrices)?acc(s.inverseBindMatrices):null,
  skeleton:s.skeleton
 }));
 const clips=clipTracks(json,binary);
 // Rigid segmented GLBs have local coordinates relative to their pivot joints.
 // Normalize using the complete transformed bind pose, not per-part local boxes.
 if(!skins.length){
  const matrices=poseFrontierRig({nodes,primitives:[],clips:[]},"idle",0).world;
  const posed={min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};
  for(const part of primitives){
   const m=matrices[part.node]||matIdentity(),a=part.arrays.positions;
   for(let i=0;i<a.length;i+=3){
    const x=a[i],y=a[i+1],z=a[i+2],p=[
     m[0]*x+m[4]*y+m[8]*z+m[12],
     m[1]*x+m[5]*y+m[9]*z+m[13],
     m[2]*x+m[6]*y+m[10]*z+m[14]];
    for(let j=0;j<3;j++){posed.min[j]=Math.min(posed.min[j],p[j]);posed.max[j]=Math.max(posed.max[j],p[j]);}
   }
  }
  if(Number.isFinite(posed.min[0])){bounds.min=posed.min;bounds.max=posed.max;}
 }
 const h=Math.max(.001,bounds.max[1]-bounds.min[1]);
 return {primitives,skins,nodes,clips,images,bounds,
  scale:1.8/h,center:[(bounds.min[0]+bounds.max[0])/2,bounds.min[1],(bounds.min[2]+bounds.max[2])/2],
  triangles:totalTris,morphNames:[...new Set(primitives.flatMap(p=>p.names))]};
}
function quatSlerp(a,b,alpha){
 let dot=a.reduce((s,x,i)=>s+x*b[i],0),end=b;
 if(dot<0){dot=-dot;end=b.map(x=>-x);}
 if(dot>.9995){const v=a.map((x,i)=>x+(end[i]-x)*alpha),m=Math.hypot(...v)||1;return v.map(x=>x/m);}
 const theta=Math.acos(Math.max(-1,Math.min(1,dot))),sin=Math.sin(theta);
 const p=Math.sin((1-alpha)*theta)/sin,q=Math.sin(alpha*theta)/sin;
 return a.map((x,i)=>x*p+end[i]*q);
}
export function sampleAnimationTrack(track,time,loop=true){
 const times=track.times,frames=track.frames,limit=times.length-1;
 if(limit<0)return null;
 const duration=times[limit];
 const t=loop&&duration>0?((time%duration)+duration)%duration:Math.max(times[0],Math.min(time,duration));
 let lo=0,hi=limit;
 while(lo<hi){const mid=(lo+hi+1)>>1;if(times[mid]<=t)lo=mid;else hi=mid-1;}
 if(lo===limit||track.interpolation==="STEP")return frames[lo].value;
 const a=frames[lo],b=frames[lo+1],gap=times[lo+1]-times[lo],f=gap?Math.min(1,Math.max(0,(t-times[lo])/gap)):0;
 if(track.interpolation==="CUBICSPLINE"){
  const h00=2*f*f*f-3*f*f+1,h10=f*f*f-2*f*f+f,h01=-2*f*f*f+3*f*f,h11=f*f*f-f*f;
  const v=a.value.map((x,i)=>h00*x+h10*gap*a.output[i]+h01*b.value[i]+h11*gap*b.input[i]);
  if(track.path==="rotation"){const n=Math.hypot(...v)||1;return v.map(x=>x/n);}return v;
 }
 return track.path==="rotation"?quatSlerp(a.value,b.value,f):
  a.value.map((x,i)=>x+(b.value[i]-x)*f);
}
export function chooseFrontierClip(clips,kind){
 const alias={walk:["Walk","Walking","Run"],run:["Run","Walk"],idle:["Idle","Stand"],
  talk:["Talk","Talking"],gift:["Give","Talk"],axe:["Chop","Axe"],mine:["Mine","Pickaxe","Chop"],
  sword:["Attack","Sword"],spear:["Spear","Polearm","Attack","Sword"],greatsword:["Greatsword","TwoHandSword","Attack","Sword"],bow:["Shoot","Bow","Archery","Attack"],sit:["Sit"],read:["Read","Sit"],eat:["Eat","Sit"],rest:["Sleep","Rest","Sit"],
  sleep:["Sleep","Rest"],faceIdle:["FaceIdle"],faceTalking:["FaceTalking"]};
 const wants=alias[kind]||[kind];
 for(const name of wants){const found=clips.find(c=>c.name.toLowerCase()===name.toLowerCase());if(found)return found;}
 return kind==="faceTalking"||kind==="faceIdle"?null:clips.find(c=>c.name.toLowerCase()==="idle")||null;
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
/** Standard named GLB joints receive procedural swim, tread and dive strokes.
 * The original animation tracks still supply face and any unrecognized joints.
 */
export function applyAquaticRigPose(rig,poses,action,time,moving=true){
 if(!isAquaticAction(action)||!Number.isFinite(time))return false;
 const index=new Map(rig.nodes.map((n,i)=>[(n.name||"").toLowerCase(),i]));
 if(!["rightshoulder","leftshoulder","rightelbow","leftelbow","lefthip","righthip"].every(name=>index.has(name)))
  return false;
 const pose=swimStroke(action,time,moving);
 for(const [name,id] of index){
  const joint=poses[id];
  if(!joint)continue;
  if(name==="waist"){
   joint.rotation=qmul(qx(pose.torsoX),qy(pose.torsoY));
  }else{
   for(const side of ["left","right"]){
    const keys={
     [side+"shoulder"]:qmul(qz(pose[side+"ShoulderZ"]),qx(pose[side+"ShoulderX"])),
     [side+"elbow"]:qx(pose[side+"ElbowX"]),
     [side+"wrist"]:qx(pose[side+"WristX"]),
     [side+"hip"]:qx(pose[side+"HipX"]),
     [side+"knee"]:qx(pose[side+"KneeX"]),
     [side+"ankle"]:qx(pose[side+"AnkleX"])
    };
    if(keys[name])joint.rotation=keys[name];
   }
  }
 }
 return true;
}
/** Override semantic humanoid joints when a weapon uses procedural staging.
 * Works for standard named GLBs without requiring new exported clips.
 * Unknown/imported skeletons retain their original animation.
 */
export function applyWeaponRigPose(rig,poses,action,progress,variant="overhead",hand="right"){
 if(!["sword","spear","greatsword","axe","bow","fish","guard","hit"].includes(action)||!Number.isFinite(progress))return false;
 const index=new Map(rig.nodes.map((n,i)=>[(n.name||"").toLowerCase(),i]));
 if(!["rightshoulder","leftshoulder","rightelbow","leftelbow","waist"].every(n=>index.has(n)))return false;
 const motion=samplePose({action,progress,variant});
 if(hand==="left"&&!["spear","greatsword"].includes(action)){
  for(const part of ["ShoulderX","ShoulderZ","ElbowX","WristX"]){
   const left="left"+part,right="right"+part;
   const l=motion[left],r=motion[right];
   motion[left]=part==="ShoulderZ"?-r:r;
   motion[right]=part==="ShoulderZ"?-l:l;
  }
  motion.torsoY=-(motion.torsoY||0);
 }
 for(const [name,id] of index){
  const key=name==="waist"?"waist":name;
  if(key==="waist")poses[id].rotation=qmul(qx(motion.torsoX||0),qy(motion.torsoY||0));
  else for(const side of ["left","right"]){
   // The standardized GLB rig exposes hip/knee nodes too; heavy strikes
   // plant the legs while the existing idle/walk blend is maintained.
   if(["spear","greatsword"].includes(action)&&key===side+"hip")
    poses[id].rotation=qx(motion[side+"HipX"]||0);
   if(["spear","greatsword"].includes(action)&&key===side+"knee")
    poses[id].rotation=qx(motion[side+"KneeX"]||0);
   if(key===side+"shoulder")poses[id].rotation=qmul(qz(motion[side+"ShoulderZ"]||0),qx(motion[side+"ShoulderX"]||0));
   if(key===side+"elbow")poses[id].rotation=qx(motion[side+"ElbowX"]||0);
   if(key===side+"wrist")poses[id].rotation=qx(motion[side+"WristX"]||0);
  }
 }
 return true;
}
export function poseFrontierRig(rig,bodyKind,time,faceKind="faceIdle",faceTime=time,opts={}){
 const pose=rig.nodes.map(n=>({translation:[...n.translation],rotation:[...n.rotation],scale:[...n.scale],
  weights:[...(n.weights||[0,0])]}));
 const body=chooseFrontierClip(rig.clips,bodyKind);
 const face=chooseFrontierClip(rig.clips,faceKind);
 for(const [clip,t,faceOnly] of [[body,time,false],[face,faceTime,true]]){
  if(!clip)continue;
  for(const track of clip.tracks){
   if(faceOnly&&track.path!=="weights")continue;
   const target=pose[track.node];if(!target)continue;
   const val=sampleAnimationTrack(track,t);
   if(val)target[track.path]=val;
  }
 }
 if(isAquaticAction(bodyKind))
  applyAquaticRigPose(rig,pose,bodyKind,time,opts.moving!==false);
 if(Number.isFinite(opts.motionProgress))
  applyWeaponRigPose(rig,pose,bodyKind,opts.motionProgress,opts.variant||"overhead",opts.hand||"right");
 const world=Array(rig.nodes.length),inProgress=new Set(),parents=Array(rig.nodes.length).fill(-1);
 rig.nodes.forEach((node,i)=>node.children.forEach(child=>{if(parents[child]<0)parents[child]=i;}));
 const calculate=i=>{
  if(world[i])return world[i];
  if(inProgress.has(i))throw Error("GLB joint cycle");
  inProgress.add(i);
  const n=rig.nodes[i],p=pose[i],local=n.matrix&&p.translation.every((x,j)=>x===n.translation[j])&&p.rotation.every((x,j)=>x===n.rotation[j])?
   n.matrix:matTRS(p.translation,p.rotation,p.scale);
  world[i]=parents[i]<0?local:matMultiply(calculate(parents[i]),local);
  inProgress.delete(i);return world[i];
 };
 rig.nodes.forEach((_,i)=>calculate(i));
 const morphs=rig.primitives.map(pr=>{
  const weights=pose[pr.node]?.weights||[0,0];
  let blink=weights[0]||0,mouth=weights[1]||0;
  const names=pr.names.map(n=>n.toLowerCase());
  if(names.some(n=>n.includes("eye")))blink=weights[names.findIndex(n=>n.includes("eye"))]||0;
  if(names.some(n=>n.includes("mouth")))mouth=weights[names.findIndex(n=>n.includes("mouth"))]||0;
  // Facial procedural fallback for GLBs containing targets but no named clips.
  if(!face||!face.tracks.some(t=>t.path==="weights")){
   blink=Math.max(blink,Math.max(0,1-Math.abs((faceTime%3.6)-.17)/.14));
   if(faceKind==="faceTalking")mouth=Math.max(mouth,.20+.65*Math.abs(Math.sin(faceTime*13)));
  }
  return [Math.min(1,Math.max(0,blink)),Math.min(1,Math.max(0,mouth))];
 });
 return {world,morphs,bodyName:body?.name||"static",faceName:face?.name||"procedural"};
}
