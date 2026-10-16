/**
 * Universal Engine v0.7a experimental humanoid rig: 60 semantic pivots.
 * Keeps the *exact* names and rest-pose transforms of the original 21 joints.
 * Units: metres, radians, column-major matrices; +Y up / +Z forward.
 *
 * The currently-rendered body is segmented low-poly mesh with joint covers.
 * This is NOT skinning / anatomical muscle deformation.
 */
import {matrixMultiply,identity,translate,rotX,rotY,rotZ} from "./rig.mjs";
const isFinite3 = v => Array.isArray(v)&&v.length===3&&v.every(Number.isFinite);
const pos=(id,parent,t,lod="core",limits=[-Math.PI,Math.PI])=>Object.freeze({
 id,parentId:parent,bindTranslationM:Object.freeze(t),lodGroup:lod,
 limitsRad:Object.freeze({x:Object.freeze([...limits]),y:Object.freeze([...limits]),z:Object.freeze([...limits])})
});
const base=[
 pos("pelvis",null,[0,.96,0]),
 pos("waist","pelvis",[0,0,0]),
 pos("lowerSpine","waist",[0,.08,0],"detail"),
 pos("torso","waist",[0,.15,0]),
 pos("chest","torso",[0,.43,0],"detail"),
 pos("neck","torso",[0,.78,0]),
 pos("head","neck",[0,.13,0]),
 pos("jaw","head",[0,.06,.14],"face",[-.6,.6]),
 pos("leftEye","head",[-.082,.2,.204],"face",[-.4,.4]),
 pos("rightEye","head",[.082,.2,.204],"face",[-.4,.4])
];
for(const side of ["left","right"]){
 const sign=side==="left"?-1:1;
 const stem=side[0].toUpperCase()+side.slice(1);
 const hand=side+"Hand";
 base.push(
  pos(side+"Clavicle","torso",[sign*.20,.70,0],"detail"),
  pos(side+"Shoulder",side+"Clavicle",[sign*.23,-.05,0]),
  pos(side+"UpperArmTwist",side+"Shoulder",[0,-.20,0],"detail"),
  pos(side+"Elbow",side+"Shoulder",[0,-.45,0]),
  pos(side+"ForearmTwist",side+"Elbow",[0,-.17,0],"detail"),
  pos(side+"Wrist",side+"Elbow",[0,-.39,0]),
  pos(hand,side+"Wrist",[0,-.11,0])
 );
 for(const [finger,x,z] of [["Thumb",sign*.105,.055],["Index",sign*.075,.095],
   ["Middle",sign*.025,.118],["Ring",-sign*.025,.105],["Little",-sign*.070,.077]]){
  base.push(pos(side+finger+"1",hand,[x,-.10,z],"fingers",[-1.5,1.5]));
  base.push(pos(side+finger+"2",side+finger+"1",[0,-.085,.012],"fingers",[-1.5,1.5]));
 }
 base.push(
  pos(side+"Hip","pelvis",[sign*.21,-.03,0]),
  pos(side+"ThighTwist",side+"Hip",[0,-.2,0],"detail"),
  pos(side+"Knee",side+"Hip",[0,-.47,0]),
  pos(side+"CalfTwist",side+"Knee",[0,-.22,0],"detail"),
  pos(side+"Ankle",side+"Knee",[0,-.43,0]),
  pos(side+"Heel",side+"Ankle",[0,-.08,-.11],"detail"),
  pos(side+"Foot",side+"Ankle",[0,-.06,0]),
  pos(side+"Toe",side+"Foot",[0,-.035,.21],"detail")
 );
}
export const RIG_V2=Object.freeze(base);
export const RIG_V2_IDS=Object.freeze(base.map(j=>j.id));
export const LEGACY_JOINTS=Object.freeze([
 "pelvis","waist","torso","neck","head",
 "leftShoulder","leftElbow","leftWrist","leftHand",
 "rightShoulder","rightElbow","rightWrist","rightHand",
 "leftHip","leftKnee","leftAnkle","leftFoot",
 "rightHip","rightKnee","rightAnkle","rightFoot"
]);
/** RIG length = 60, 21 old joint names kept, all IDs are unique. */
export function validateRig(joints=RIG_V2){
 if(!Array.isArray(joints)||!joints.length)throw Error("Rig joints must be a nonempty array");
 const known=new Set(),parents=new Map();
 for(const joint of joints){
  if(typeof joint.id!=="string"||!joint.id||known.has(joint.id))throw Error("Rig duplicate or missing joint ID");
  if(!isFinite3(joint.bindTranslationM))throw Error("Rig invalid translation: "+joint.id);
  const lim=joint.limitsRad;
  if(!lim||!["x","y","z"].every(k=>Array.isArray(lim[k])&&lim[k].length===2&&lim[k].every(Number.isFinite)&&lim[k][0]<=lim[k][1]))
    throw Error("Rig invalid limits: "+joint.id);
  known.add(joint.id);parents.set(joint.id,joint.parentId);
 }
 const roots=joints.filter(x=>x.parentId===null);
 if(roots.length!==1||roots[0].id!=="pelvis")throw Error("Rig must have one pelvis root");
 for(const joint of joints){
  const seen=new Set();let id=joint.id;
  while(id!==null){
   if(seen.has(id))throw Error("Rig cycle at "+joint.id);
   seen.add(id);
   if(!parents.has(id))throw Error("Rig unknown parent: "+id);
   id=parents.get(id);
  }
 }
 return true;
}
validateRig();
const finite=(v,fallback=0)=>Number.isFinite(v)?v:fallback;
const rotationKeys={
 torso:[null,null,null],
 head:[null,"faceHeadY",null],
 waist:["torsoX","torsoY",null],
 neck:[null,"headY",null],
 chest:["chestX",null,"chestZ"],
 jaw:["jawX",null,null]
};
/**
 * Evaluates an independent node hierarchy. Existing limb transforms intentionally
 * coincide with v0.6 at neutral and during standard legacy motions.
 */
export function jointTransformsV2(pose={},yaw=0){
 if(!Number.isFinite(yaw))throw new TypeError("Invalid orientation");
 const transforms={},root=matrixMultiply(translate(0,finite(pose.rootY),0),rotY(yaw));
 for(const joint of RIG_V2){
  const p=joint.parentId===null?root:transforms[joint.parentId];
  if(!p)throw Error("Rig parent missing: "+joint.id);
  const t=joint.bindTranslationM;
  let local=translate(...t);
  const keys=rotationKeys[joint.id]||[joint.id+"X",joint.id+"Y",joint.id+"Z"];
  const clampRot=(key,axis)=>{
   if(key===null)return 0;
   const v=finite(pose[key]);
   const lim=joint.limitsRad[axis];
   return Math.max(lim[0],Math.min(lim[1],v));
  };
  const x=clampRot(keys[0],"x"),y=clampRot(keys[1],"y"),z=clampRot(keys[2],"z");
  // Shoulder legacy Euler order: Z then X. Waist: X then Y.
  local=matrixMultiply(local,rotZ(z));
  local=matrixMultiply(local,rotX(x));
  local=matrixMultiply(local,rotY(y));
  transforms[joint.id]=matrixMultiply(p,local);
 }
 return transforms;
}
/** Joint-debug identity graph; renderer attaches meshes using the pivot id. */
export function rigDescription(){
 return {id:"ue-humanoid-v2",version:2,joints:RIG_V2.length,
         legacyCompatible:LEGACY_JOINTS.every(k=>RIG_V2_IDS.includes(k)),
         controls:["locomotion","action","face","fingers"]};
}
