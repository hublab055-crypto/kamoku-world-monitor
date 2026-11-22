import {matIdentity,matTRS,matMultiply} from "./frontier-animated.mjs?v=20261114-crew-social-base-swim";

/** Clothing-independent, watertight adult study surface.
 *
 * The GLB face/hair remain artist-authored; this generates a contiguous
 * pelvis/torso/neck/arms/hands/legs/feet volume directly from the bind skeleton.
 * No clothing positions, UVs or triangle indices are ever copied.
 * It is an anatomical game approximation, not a surgical model.
 */
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const smooth01=t=>{const x=clamp(t,0,1);return x*x*(3-2*x);};
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const add=(a,b)=>a.map((v,i)=>v+b[i]);
const mul=(a,f)=>a.map(v=>v*f);
const dot=(a,b)=>a.reduce((sum,v,i)=>sum+v*b[i],0);
const norm=a=>Math.hypot(...a);
const mix=(a,b,t)=>a.map((v,i)=>v*(1-t)+b[i]*t);
const capsule=(p,a,b,r0,r1=r0)=>{
 const ab=sub(b,a),d=dot(ab,ab)||1,t=clamp(dot(sub(p,a),ab)/d,0,1);
 return norm(sub(p,mix(a,b,t)))-(r0+(r1-r0)*t);
};
const egg=(p,c,r)=>{const q=sub(p,c).map((v,i)=>v/r[i]);return (norm(q)-1)*Math.min(...r);};
const smoothMin=(a,b,k)=>{
 const h=Math.max(k-Math.abs(a-b),0)/k;
 return Math.min(a,b)-h*h*k*.25;
};
const normalized=n=>String(n||"").toLowerCase().replace(/[^a-z0-9]/g,"");
function bindWorld(rig){
 const matrices=[],visiting=new Set();
 function visit(i){
  if(matrices[i])return matrices[i];
  if(visiting.has(i))throw Error("GLB bind joints form a cycle");
  visiting.add(i);
  const n=rig.nodes[i];
  const local=n.matrix||matTRS(n.translation,n.rotation,n.scale);
  const parent=rig.parents?.[i]??-1;
  matrices[i]=parent<0?local:matMultiply(visit(parent),local);
  visiting.delete(i);return matrices[i];
 }
 rig.nodes.forEach((_,i)=>visit(i));
 return matrices;
}
function skeleton(rig){
 if(!rig?.isV10||!rig.nodes?.length||!rig.skins?.length)return null;
 const skinIndex=rig.skins.reduce((best,s,i)=>
  s.joints.length>(rig.skins[best]?.joints.length||0)?i:best,0);
 const skin=rig.skins[skinIndex];
 if(!skin?.joints?.length)return null;
 const names=new Map(skin.joints.map((nodeId,i)=>[normalized(rig.nodes[nodeId]?.name),i]));
 const pick=(...aliases)=>{
  for(const alias of aliases){
   const name=normalized(alias);
   if(names.has(name))return names.get(name);
  }
  return null;
 };
 const ids={
  pelvis:pick("Pelvis","Hips"),waist:pick("Waist","SpineMid","SpineLower","Spine","Spine1"),
  chest:pick("Chest","SpineUpper","Spine2","UpperChest"),neck:pick("Neck"),
  leftShoulder:pick("UpperArm_L","LeftShoulder","LShoulder"),leftElbow:pick("LowerArm_L","LeftElbow","LElbow"),
  leftWrist:pick("Hand_L","LeftWrist","LHand","LeftHand"),
  rightShoulder:pick("UpperArm_R","RightShoulder","RShoulder"),rightElbow:pick("LowerArm_R","RightElbow","RElbow"),
  rightWrist:pick("Hand_R","RightWrist","RHand","RightHand"),
  leftHip:pick("UpperLeg_L","LeftHip","LeftUpperLeg"),leftKnee:pick("LowerLeg_L","LeftKnee","LeftLowerLeg"),
  leftAnkle:pick("Foot_L","LeftAnkle","LeftFoot"),rightHip:pick("UpperLeg_R","RightHip","RightUpperLeg"),
  rightKnee:pick("LowerLeg_R","RightKnee","RightLowerLeg"),rightAnkle:pick("Foot_R","RightAnkle","RightFoot")
 };
 if(Object.values(ids).some(id=>id===null))return null;
 const worlds=bindWorld(rig);
 const points={};
 for(const [key,id] of Object.entries(ids)){
  const mat=worlds[skin.joints[id]];
  points[key]=[0,1,2].map(i=>(mat[12+i]-rig.center[i])*rig.scale);
 }
 const p=points;
 // Do not accidentally generate a folded, upside-down or wildly scaled body.
 const sh=(p.leftShoulder[1]+p.rightShoulder[1])*.5,knees=(p.leftKnee[1]+p.rightKnee[1])*.5;
 if(!(p.neck[1]>sh-.10&&sh>p.pelvis[1]+.22&&p.pelvis[1]>knees+.20&&
      p.leftHip[1]>p.leftKnee[1]+.17&&p.rightHip[1]>p.rightKnee[1]+.17&&
      p.leftKnee[1]>p.leftAnkle[1]+.15&&p.rightKnee[1]>p.rightAnkle[1]+.15))return null;
 return {skinIndex,ids,points};
}
/** SDF sections are measured from the V10 bind skeleton, not fixed y marks.
 * In particular the leg split belongs below the pelvis rather than the calf.
 */
function bodyField(parts,isBust,{includeAuthoredHands=false,includeAuthoredFeet=false}={}){
 const p=parts.points;
 // Chest joint is often an upper-rib/clavicle pivot: use measured landmarks.
 const shoulderY=(p.leftShoulder[1]+p.rightShoulder[1])*.5;
 const kneeY=(p.leftKnee[1]+p.rightKnee[1])*.5;
 const torsoHeight=shoulderY-p.pelvis[1];
 const chestHeight=shoulderY-clamp(torsoHeight*.34,.125,.20);
 const navelHeight=p.pelvis[1]+clamp((p.waist[1]-p.pelvis[1])*.48,.035,.135);
 const crotchY=p.pelvis[1]-clamp((p.pelvis[1]-kneeY)*.28,.105,.16);
 const trunkX=(p.leftShoulder[0]+p.rightShoulder[0])*.5;
 // A continuous oval rib cage/waist replaces two discrete overlapping eggs.
 // Overlapping eggs created concave underarms and a corset-like waist pinching.
 // Radius is measured in metres in the normalized 1.8m avatar frame.
 const shoulderWidth=Math.abs(p.rightShoulder[0]-p.leftShoulder[0]);
 const torsoScale=clamp(shoulderWidth/.50,.86,1.16);
 const torsoLevels=[
  [0,.185,.138],  // pelvis
  [.28,.177,.132], // waist: never collapse to a narrow hourglass
  [.55,.194,.135], // lower ribs
  [.82,.215,.142], // armpit-to-rib-cage continuity
  [1,.198,.133]    // shoulders
 ];
 const torsoProfile=y=>{
  const t=clamp((y-p.pelvis[1])/(torsoHeight||1),0,1);
  for(let i=1;i<torsoLevels.length;i++){
   if(t<=torsoLevels[i][0]){
    const a=torsoLevels[i-1],b=torsoLevels[i];
    const u=clamp((t-a[0])/(b[0]-a[0]),0,1),e=u*u*(3-2*u);
    return [mix([a[1],a[2]],[b[1],b[2]],e)[0]*torsoScale,
            mix([a[1],a[2]],[b[1],b[2]],e)[1]];
   }
  }
  return [torsoLevels.at(-1)[1]*torsoScale,torsoLevels.at(-1)[2]];
 };
 const torsoField=point=>{
  const [radiusX,radiusZ]=torsoProfile(point[1]);
  const zCenter=p.pelvis[2]+(p.chest[2]-p.pelvis[2])*clamp((point[1]-p.pelvis[1])/(torsoHeight||1),0,1);
  const x=(point[0]-trunkX)/radiusX,z=(point[2]-zCenter)/radiusZ;
  const radial=(Math.hypot(x,z)-1)*Math.min(radiusX,radiusZ);
  const bottom=p.pelvis[1]-.080,top=shoulderY+.025;
  const cap=Math.max(bottom-point[1],point[1]-top);
  return -smoothMin(-radial,-cap,.045); // smooth intersection with rounded ends
 };
 const shapes=[
  // An oval pelvis supports a modest gluteal contour without rearward bulbs.
  [add(p.pelvis,[0,-.030,-.011]),[.188,.128,.143]],
  [mix(p.chest,p.neck,.60),[.067,.085,.063]],
  [add(p.neck,[0,.050,0]),[.053,.105,.054]]
 ];
 const bust=isBust?.067:.037;
 const extras=[
  [[trunkX-.094,chestHeight-.005,p.chest[2]+.104],[.086,.074,bust]],
  [[trunkX+.094,chestHeight-.005,p.chest[2]+.104],[.086,.074,bust]],
  // Shallow gluteal transition is retained; do not restore rear bulges.
  [add(p.pelvis,[-.075,-.065,-.031]),[.097,.085,.114]],
  [add(p.pelvis,[.075,-.065,-.031]),[.097,.085,.114]]

 ];
 const chains=[
  ["leftShoulder","leftElbow",.069,.060],["leftElbow","leftWrist",.061,.052],
  ["rightShoulder","rightElbow",.069,.060],["rightElbow","rightWrist",.061,.052],
  ["leftHip","leftKnee",.109,.076],["leftKnee","leftAnkle",.072,.044],
  ["rightHip","rightKnee",.109,.076],["rightKnee","rightAnkle",.072,.044],
  // Slimmer deltoids / trapezius, without swallowing the neck.
  ["chest","leftShoulder",.093,.075],["chest","rightShoulder",.093,.075],
  ["pelvis","leftHip",.090,.098],["pelvis","rightHip",.090,.098],
  ["chest","neck",.052,.050]
 ];
 for(const side of ["left","right"]){
  const hip=p[side+"Hip"],sign=Math.sign(hip[0]-p.pelvis[0])||(side==="left"?-1:1);
  // Rounded greater-trochanter / anterior upper-thigh transition.
  // Keep the new volume in front of the hip so the improved rear glutes remain.
  extras.push([add(hip,[sign*.016,-.039,.027]),[.104,.121,.093]]);
  const wrist=p[side+"Wrist"];
  // Fill the narrow forearm-to-palm seam even when authored fingers exist.
  shapes.push([wrist,[.055,.052,.054]]);
  if(!includeAuthoredHands){
   const elbow=p[side+"Elbow"];
   const wristAxis=sub(wrist,elbow),L=norm(wristAxis)||1;
   const palm=add(wrist,mul(wristAxis,.048/L));
   shapes.push([palm,[.061,.072,.054]]);
   // Fallback digits only when original palm meshes are unavailable.
   for(const dx of [-.031,-.010,.011,.032])
    extras.push([add(palm,[dx,-.014,.014]),[.012,.047,.014]]);
  }
  if(!includeAuthoredFeet){
   const ankle=p[side+"Ankle"];
   shapes.push([add(ankle,[0,.010,.062]),[.075,.046,.142]]);
  }
 }
 const fn=point=>{
  let d=torsoField(point);
  // Smaller smooth blend retains readable clavicle, thigh and elbow contours.
  for(const [center,radii] of shapes)d=smoothMin(d,egg(point,center,radii),.030);
  for(const [center,radii] of extras)d=smoothMin(d,egg(point,center,radii),.023);
  for(const [a,b,r0,r1] of chains)d=smoothMin(d,capsule(point,p[a],p[b],r0,r1),.025);
  // Open a separation only BELOW the pelvis, not at knee height.
  const gap=clamp(Math.abs(p.leftHip[0]-p.rightHip[0])*.16,.035,.057);
  const below=crotchY-point[1],inside=gap-Math.abs(point[0]-p.pelvis[0]);
  if(below>0&&inside>0)d=Math.max(d,Math.min(below,inside));
  return d;
 };
 fn.landmarks={chestY:chestHeight,navelY:navelHeight,nippleX:.094,hipY:(p.leftHip[1]+p.rightHip[1])*.5,
  shoulderY,neckY:p.neck[1],crotchY};
 return fn;
}

function skinVertex(point,parts){
 const p=parts.points,ids=parts.ids;
 const boneChains=[
  ["pelvis","waist"],["waist","chest"],["chest","neck"],
  ["chest","leftShoulder"],["leftShoulder","leftElbow"],["leftElbow","leftWrist"],
  ["chest","rightShoulder"],["rightShoulder","rightElbow"],["rightElbow","rightWrist"],
  ["pelvis","leftHip"],["leftHip","leftKnee"],["leftKnee","leftAnkle"],
  ["pelvis","rightHip"],["rightHip","rightKnee"],["rightKnee","rightAnkle"]
 ];
 let best=null;
 for(const [a,b] of boneChains){
  const ab=sub(p[b],p[a]),t=clamp(dot(sub(point,p[a]),ab)/(dot(ab,ab)||1),0,1);
  const dist=norm(sub(point,mix(p[a],p[b],t)));
  // Prefer the main trunk at major leg and shoulder intersections.
  const score=dist+((a==="pelvis"||a==="waist"||a==="chest")?.006:0);
  if(!best||score<best.score)best={a,b,t,score};
 }
 // Generic nearest-chain skinning sometimes binds the lateral ribs to the
 // Chest -> UpperArm chain. As the arm moves it pulls away the side of the rib
 // cage, making a visually missing patch. The trunk must follow its spine.
 const shoulderY=(p.leftShoulder[1]+p.rightShoulder[1])*.5;
 const shoulderWidth=Math.abs(p.rightShoulder[0]-p.leftShoulder[0]);
 const midX=(p.leftShoulder[0]+p.rightShoulder[0])*.5;
 const ribEdge=clamp(shoulderWidth*.62,.280,.35);
 const zCenter=p.pelvis[2]+(p.chest[2]-p.pelvis[2])*
  clamp((point[1]-p.pelvis[1])/(shoulderY-p.pelvis[1]||1),0,1);
 const lateral=clamp((ribEdge-Math.abs(point[0]-midX))/.065,0,1);
 const belowShoulder=clamp((shoulderY-.025-point[1])/.085,0,1);
 const abovePelvis=clamp((point[1]-p.pelvis[1]+.015)/.11,0,1);
 const nearTorso=clamp((.26-Math.abs(point[2]-zCenter))/.075,0,1);
 const torsoWeight=lateral*belowShoulder*abovePelvis*nearTorso;
 const lower=point[1]<p.waist[1];
 const a=lower?"pelvis":"waist",b=lower?"waist":"chest";
 const target=clamp((point[1]-p[a][1])/(p[b][1]-p[a][1]||1),0,1);
 const influence=new Map();
 const put=(index,weight)=>influence.set(index,(influence.get(index)||0)+weight);
 // Preserve the original arm/leg influence near the actual joints and
 // blend to torso-only weights towards the ribs and abdomen.
 put(ids[best.a],(1-best.t)*(1-torsoWeight));
 put(ids[best.b],best.t*(1-torsoWeight));
 put(ids[a],(1-target)*torsoWeight);
 put(ids[b],target*torsoWeight);
 // The greater trochanter and upper thigh must blend with the pelvis.
 // A nearest-segment-only assignment produces sharp cracks in hip flexion.
 // Preserve left/right separation at the midline and the original femur
 // influence below the transition band.
 const hipSide=Math.abs(point[0]-p.leftHip[0])<=Math.abs(point[0]-p.rightHip[0])?"left":"right";
 const hip=p[hipSide+"Hip"],hipId=ids[hipSide+"Hip"];
 const nearHip=smooth01((.157-Math.abs(point[0]-hip[0]))/.058);
 const offCenter=smooth01((Math.abs(point[0]-p.pelvis[0])-.028)/.054);
 const high=smooth01((hip[1]+.105-point[1])/.050);
 const low=smooth01((point[1]-(hip[1]-.143))/.050);
 const depth=smooth01((.185-Math.abs(point[2]-hip[2]))/.055);
 const hipBlend=nearHip*offCenter*high*low*depth*(1-torsoWeight);
 if(hipBlend>.0001){
  const drive=smooth01((hip[1]+.044-point[1])/.135);
  for(const [j,w] of influence)influence.set(j,w*(1-hipBlend));
  put(ids.pelvis,hipBlend*(1-drive));
  put(hipId,hipBlend*drive);
 }
 const top=[...influence.entries()].sort((x,y)=>y[1]-x[1]).slice(0,4);
 const sum=top.reduce((v,item)=>v+item[1],0)||1;
 return {joints:[...top.map(item=>item[0]),...Array(4-top.length).fill(0)],
  weights:[...top.map(item=>item[1]/sum),...Array(4-top.length).fill(0)]};
}
const TETRA=[
 [0,5,1,6],[0,1,2,6],[0,2,3,6],
 [0,3,7,6],[0,7,4,6],[0,4,5,6]
];
const CUBE=[[0,0,0],[1,0,0],[1,1,0],[0,1,0],[0,0,1],[1,0,1],[1,1,1],[0,1,1]];
export function createAvatarV10ProceduralBody(rig,{resolution=.036}={}){
 const parts=skeleton(rig);
 if(!parts)return null;
 const {points:p,skinIndex}=parts;
 // Model ID comes from the authored V10 roster, not a bone or player name.
 const isBust=rig.studyModelBust===true;
 // Reuse the authored articulated palms, fingers and genuine bare feet when
 // present. They are skin geometry, unlike the deleted Fitting body clothes
 // surrogate. This prevents an SDF "mitten" from hiding detailed fingers.
 const hasHands=["L","R"].every(side=>rig.primitives.some(x=>new RegExp("^Palm_"+side+"$","i").test(x.name||"")));
 const hasFeet=["L","R"].every(side=>rig.primitives.some(x=>new RegExp("^Bare_foot_"+side+"$","i").test(x.name||"")));
 const field=bodyField(parts,isBust,{includeAuthoredHands:hasHands,includeAuthoredFeet:hasFeet});
 rig.studyLandmarks=field.landmarks;
 const boundsX=Object.values(p).map(v=>v[0]);
 const boundsY=Object.values(p).map(v=>v[1]);
 const span=clamp(resolution,.031,.070),xmin=Math.min(-.55,...boundsX)-.17,xmax=Math.max(.55,...boundsX)+.17;
 const ymin=Math.min(-.08,...boundsY)-.12,ymax=Math.max(p.neck[1]+.16,...boundsY)+.17;
 const zmin=Math.min(-.38,...Object.values(p).map(v=>v[2]))-.20;
 const zmax=Math.max(.38,...Object.values(p).map(v=>v[2]))+.21;
 const nx=Math.min(90,Math.ceil((xmax-xmin)/span)),ny=Math.min(78,Math.ceil((ymax-ymin)/span));
 const nz=Math.min(48,Math.ceil((zmax-zmin)/span));
 // Coordinates are normalized by the same rig.scale/center as GLSL; the
 // final stored vertex is converted back to original GLB bind space.
 const sx=(xmax-xmin)/nx,sy=(ymax-ymin)/ny,sz=(zmax-zmin)/nz;
 const stride=nx+1,slice=stride*(ny+1),values=new Float32Array(slice*(nz+1));
 const getPos=(i,j,k)=>[xmin+sx*i,ymin+sy*j,zmin+sz*k];
 const id=(i,j,k)=>i+stride*j+slice*k;
 for(let k=0;k<=nz;k++)for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++)
  values[id(i,j,k)]=field(getPos(i,j,k));
 const positions=[],normals=[],colors=[],uv=[],weights=[],joints=[],indices=[],weld=new Map();
 const face=rig.primitives.find(item=>/(?:face|skull)/i.test(item.name)&&item.arrays?.colors?.length>=90);
 let skinColor=[.72,.52,.40];
 if(face){
  const n=Math.min(200,Math.floor(face.arrays.colors.length/3));
  skinColor=[0,0,0];
  for(let i=0;i<n;i++)for(let c=0;c<3;c++)skinColor[c]+=face.arrays.colors[i*3+c]/n;
 }
 const normal=point=>{
  const eps=.0025;
  const dx=field(add(point,[eps,0,0]))-field(add(point,[-eps,0,0]));
  const dy=field(add(point,[0,eps,0]))-field(add(point,[0,-eps,0]));
  const dz=field(add(point,[0,0,eps]))-field(add(point,[0,0,-eps]));
  const vector=[dx,dy,dz],d=norm(vector)||1;
  return mul(vector,1/d);
 };
 function edgeVertex(a,b,coords){
  const key=a<b?a+":"+b:b+":"+a;
  if(weld.has(key))return weld.get(key);
  const va=values[a],vb=values[b],t=clamp(va/(va-vb||1),0,1);
  const pa=coords.get(a),pb=coords.get(b),point=mix(pa,pb,t);
  const raw=point.map((v,i)=>v/rig.scale+rig.center[i]);
  const vn=normal(point),influence=skinVertex(point,parts);
  const ix=positions.length/3;
  positions.push(...raw);normals.push(...vn);colors.push(...skinColor);
  uv.push(.5+Math.atan2(point[2],point[0])/(2*Math.PI),clamp(point[1]/1.8,0,1));
  weights.push(...influence.weights);joints.push(...influence.joints);weld.set(key,ix);
  return ix;
 }
 function emitTriangle(a,b,c){
  if(a===b||b===c||a===c)return;
  const cross=(u,v)=>[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
  const raw=i=>positions.slice(i*3,i*3+3);
  const pa=raw(a),pb=raw(b),pc=raw(c);
  const n=cross(sub(pb,pa),sub(pc,pa));
  const out=[a,b,c].map(i=>normals.slice(i*3,i*3+3)).reduce((sum,vec)=>add(sum,vec),[0,0,0]);
  if(dot(n,out)>=0)indices.push(a,b,c);else indices.push(a,c,b);
 }
 for(let k=0;k<nz;k++)for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){
  const ids=CUBE.map(([x,y,z])=>id(i+x,j+y,k+z));
  let neg=0;for(const t of ids)if(values[t]<0)neg++;
  if(neg===0||neg===8)continue;
  const coords=new Map(ids.map((v,n)=>[v,getPos(i+CUBE[n][0],j+CUBE[n][1],k+CUBE[n][2])]));
  for(const tetra of TETRA){
   const inside=tetra.map(v=>ids[v]).filter(v=>values[v]<0);
   const outside=tetra.map(v=>ids[v]).filter(v=>values[v]>=0);
   if(!inside.length||!outside.length)continue;
   if(inside.length===1){
    emitTriangle(...outside.map(v=>edgeVertex(inside[0],v,coords)));
   }else if(outside.length===1){
    emitTriangle(...inside.map(v=>edgeVertex(outside[0],v,coords)));
   }else{
    const [i0,i1]=inside,[o0,o1]=outside;
    const a=edgeVertex(i0,o0,coords),b=edgeVertex(i0,o1,coords);
    const c=edgeVertex(i1,o0,coords),d=edgeVertex(i1,o1,coords);
    emitTriangle(a,b,c);emitTriangle(b,d,c);
   }
  }
 }
 if(indices.length<300||positions.length<300)return null;
 const arr={
  positions:new Float32Array(positions),normals:new Float32Array(normals),
  colors:new Float32Array(colors),uv:new Float32Array(uv),
  joints:new Float32Array(joints),weights:new Float32Array(weights),
  morph0:new Float32Array(positions.length),morph1:new Float32Array(positions.length)
 };
 return {node:rig.skins[skinIndex]?.skeleton??0,skin:skinIndex,arrays:arr,
  indices:new Uint32Array(indices),textureImage:null,names:[],wardrobe:["base","swim"],
  material:"procedural anatomy",gloveColor:null,doubleSided:false,
  name:"V10 procedural anatomical body",proceduralAnatomy:true};
}

// Reuse the exact same bind-frame joints for transparent inspection overlays.
export {skeleton as avatarV10Skeleton,skinVertex as avatarV10SkinWeights,
 bodyField as avatarV10BodyField};
