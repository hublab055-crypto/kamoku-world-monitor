import {avatarV10Skeleton,avatarV10SkinWeights} from "./avatar-v10-procedural-body.mjs?v=20261117-proportions";

/** Lightweight educational proxies, NOT organ scans, clinical anatomy,
 * medical measurements or a surgical model. Uses the authored V10 skeleton.
 * Never shown through clothing or outside the unlocked study base outfit.
 */
const add=(a,b)=>a.map((x,i)=>x+b[i]);
const sub=(a,b)=>a.map((x,i)=>x-b[i]);
const scale=(v,s)=>v.map(x=>x*s);
const length=v=>Math.hypot(...v);
const unit=v=>scale(v,1/(length(v)||1));
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const mix=(a,b,t)=>a.map((v,i)=>v*(1-t)+b[i]*t);
export function createAvatarV10InspectionMeshes(rig){
 const parts=avatarV10Skeleton(rig);
 if(!parts)return [];
 const p=parts.points,groups=new Map();
 function group(name){
  if(!groups.has(name))groups.set(name,{positions:[],normals:[],colors:[],uv:[],joints:[],weights:[],
   indices:[]});
  return groups.get(name);
 }
 function vertex(g,point,normal,color){
  const i=g.positions.length/3,raw=point.map((v,axis)=>v/rig.scale+rig.center[axis]);
  const influences=avatarV10SkinWeights(point,parts);
  g.positions.push(...raw);g.normals.push(...unit(normal));g.colors.push(...color);
  g.uv.push(0,0);g.joints.push(...influences.joints);g.weights.push(...influences.weights);
  return i;
 }
 function ellipsoid(layer,center,r,color){
  const g=group(layer),rings=7,sides=12,vertices=[];
  for(let j=0;j<=rings;j++){
   const theta=Math.PI*j/rings,ring=[];
   for(let i=0;i<=sides;i++){
    const phi=2*Math.PI*i/sides;
    const v=[Math.sin(theta)*Math.cos(phi),Math.cos(theta),Math.sin(theta)*Math.sin(phi)];
    ring.push(vertex(g,add(center,v.map((x,k)=>x*r[k])),v.map((x,k)=>x/r[k]),color));
   }
   vertices.push(ring);
  }
  for(let j=0;j<rings;j++)for(let i=0;i<sides;i++){
   const a=vertices[j][i],b=vertices[j][i+1],c=vertices[j+1][i],d=vertices[j+1][i+1];
   g.indices.push(a,c,b,b,c,d);
  }
 }
 function bone(layer,a,b,r,color){
  const d=sub(b,a),axis=unit(d);
  const ref=Math.abs(axis[1])<.85?[0,1,0]:[1,0,0];
  const ex=unit(cross(axis,ref)),ez=unit(cross(ex,axis));
  const g=group(layer),sides=10,rows=5,indices=[];
  for(let j=0;j<=rows;j++){
   const t=j/rows,ring=[],rad=r*(.78+.22*Math.sin(Math.PI*t));
   for(let i=0;i<=sides;i++){
    const angle=i*2*Math.PI/sides,n=add(scale(ex,Math.cos(angle)),scale(ez,Math.sin(angle)));
    ring.push(vertex(g,add(mix(a,b,t),scale(n,rad)),n,color));
   }
   indices.push(ring);
  }
  for(let j=0;j<rows;j++)for(let i=0;i<sides;i++){
   const a=indices[j][i],b=indices[j][i+1],c=indices[j+1][i],d=indices[j+1][i+1];
   g.indices.push(a,c,b,b,c,d);
  }
 }
 const ivory=[.89,.85,.70],muscle=[.75,.24,.22],lung=[.44,.73,.89],
  heart=[.91,.39,.46],viscera=[.90,.57,.28],bladder=[.50,.65,.86];
 const B=(a,b,r)=>bone("bones",p[a],p[b],r,ivory);
 for(const [a,b,r] of [
  ["pelvis","waist",.024],["waist","chest",.021],["chest","neck",.023],
  ["chest","leftShoulder",.019],["chest","rightShoulder",.019],
  ["leftShoulder","leftElbow",.018],["leftElbow","leftWrist",.012],
  ["rightShoulder","rightElbow",.018],["rightElbow","rightWrist",.012],
  ["pelvis","leftHip",.033],["pelvis","rightHip",.033],
  ["leftHip","leftKnee",.023],["leftKnee","leftAnkle",.017],
  ["rightHip","rightKnee",.023],["rightKnee","rightAnkle",.017]
 ])B(a,b,r);
 ellipsoid("bones",add(p.pelvis,[0,-.012,0]),[.11,.061,.065],ivory);
 for(const side of ["left","right"]){
  bone("muscles",p[side+"Shoulder"],p[side+"Elbow"],.034,muscle);
  bone("muscles",p[side+"Hip"],p[side+"Knee"],.062,muscle);
  bone("muscles",p[side+"Knee"],p[side+"Ankle"],.047,muscle);
 }
 const chestY=p.chest[1],pelvisY=p.pelvis[1],abdY=(p.pelvis[1]+p.waist[1])*.5;
 for(const sign of [-1,1]){
  ellipsoid("muscles",[sign*.10,chestY-.02,.08],[.092,.060,.047],muscle);
  ellipsoid("muscles",[sign*.065,abdY,.085],[.057,.095,.035],muscle);
  ellipsoid("organs",[sign*.082,chestY-.037,.015],[.068,.096,.078],lung);
  ellipsoid("organs",[sign*.061,abdY-.021,.012],[.055,.074,.044],viscera);
 }
 ellipsoid("organs",[-.018,chestY-.07,.058],[.044,.055,.046],heart);
 ellipsoid("organs",[.068,chestY-.145,.033],[.108,.050,.072],viscera);
 ellipsoid("organs",[-.063,chestY-.18,.040],[.066,.047,.055],viscera);
 ellipsoid("organs",[0,pelvisY-.059,.055],[.048,.042,.042],bladder);
 ellipsoid("organs-uterine",[0,pelvisY-.025,.020],[.046,.038,.029],heart);
 ellipsoid("organs-testicular",[0,pelvisY-.099,.027],[.039,.026,.030],viscera);
 // Optional OB/GYN learning volumes. This is a simplified adult pelvic
 // orientation aid, not an obstetric measurement, surgical simulator or
 // representation of a fetus. The regular skin mesh remains unchanged.
 const obstetric="organs-obstetric";
 const soft=[.81,.40,.53],connective=[.92,.72,.55],pelvicFloor=[.55,.65,.72];
 ellipsoid(obstetric,add(p.pelvis,[0,-.014,.028]),[.077,.081,.051],soft);  // uterine body
 ellipsoid(obstetric,add(p.pelvis,[0,-.092,.034]),[.029,.030,.028],soft); // cervix
 bone(obstetric,add(p.pelvis,[0,-.103,.040]),add(p.pelvis,[0,-.174,.067]),.022,connective);
 ellipsoid(obstetric,add(p.pelvis,[0,-.145,.006]),[.136,.014,.084],pelvicFloor);
 for(const side of [-1,1]){
  ellipsoid(obstetric,add(p.pelvis,[side*.087,-.018,.016]),[.024,.017,.019],connective);
 }
 // Pelvic brim guide, approximated with small bones anchored to the pelvis.
 for(const side of [-1,1]){
  bone(obstetric,add(p.pelvis,[side*.040,.014,.024]),
   add(p.pelvis,[side*.141,-.057,.013]),.013,ivory);
 }
 return [...groups.entries()].map(([inspectLayer,g])=>({
  node:rig.skins[parts.skinIndex]?.skeleton??0,skin:parts.skinIndex,
  arrays:{positions:new Float32Array(g.positions),normals:new Float32Array(g.normals),
   colors:new Float32Array(g.colors),uv:new Float32Array(g.uv),
   joints:new Float32Array(g.joints),weights:new Float32Array(g.weights),
   morph0:new Float32Array(g.positions.length),morph1:new Float32Array(g.positions.length)},
  indices:new Uint32Array(g.indices),textureImage:null,names:[],wardrobe:["base"],
  material:"study-"+inspectLayer,inspectLayer,gloveColor:null,doubleSided:false,
  name:"V10 anatomical study "+inspectLayer
 }));
}
