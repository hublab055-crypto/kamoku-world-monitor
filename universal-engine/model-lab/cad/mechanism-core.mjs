/** Deterministic assembly mechanism preview.
 * B-rep references guide axes; this is articulated kinematics, not collision/contact dynamics.
 * Time t is seconds; geometry source is millimetres and angles are degrees.
 */
export const MECHANISM_FORMAT="ue/mechanism-v1";
const MAX_JOINTS=96;
const finite=Number.isFinite;
const angle=(t,rpm)=>t*rpm*6;
const safe=(n,fallback=0)=>finite(n)?n:fallback;
const copy=o=>JSON.parse(JSON.stringify(o));
const allowed=new Set(["revolute","slider","gear"]);
const axisNames=new Set(["x","y","z"]);
export function validateMechanism(mechanism,objects){
 if(mechanism==null)return {format:MECHANISM_FORMAT,joints:[]};
 if(mechanism.format!==MECHANISM_FORMAT||!Array.isArray(mechanism.joints)||mechanism.joints.length>MAX_JOINTS)
  throw Error("機構データ形式が不正です");
 const ids=new Set(objects.map(o=>o.id)),owners=new Set(),joints=mechanism.joints.map(j=>{
  if(!j||!allowed.has(j.type)||typeof j.part!=="string"||!ids.has(j.part)||
   owners.has(j.part)||!axisNames.has(j.axis||"z")||
   ![j.speed,j.stroke,j.phase,j.teeth].every(x=>x===undefined||finite(x))||
   (j.type==="gear"&&(!ids.has(j.driver)||j.driver===j.part||!Number.isInteger(j.teeth)||j.teeth<4||j.teeth>300)))
   throw Error("機構の部品・軸・歯数が不正です");
  owners.add(j.part);
  return {type:j.type,part:j.part,axis:j.axis||"z",speed:safe(j.speed,30),
   stroke:Math.max(0,Math.min(100000,safe(j.stroke,20))),phase:safe(j.phase),
   teeth:j.type==="gear"?j.teeth:(Number.isInteger(j.teeth)&&j.teeth>=4&&j.teeth<=300?j.teeth:20),driver:j.type==="gear"?j.driver:undefined};
 });
 const byPart=new Map(joints.map(j=>[j.part,j]));
 function check(id,seen=new Set()){
  if(seen.has(id))throw Error("歯車機構が循環しています");
  const j=byPart.get(id);if(j?.type!=="gear")return;
  const driver=byPart.get(j.driver);
  if(!driver||!["revolute","gear"].includes(driver.type))throw Error("歯車の駆動側には回転ジョイントが必要です");
  if(j.axis!=="z"||driver.axis!=="z")throw Error("歯車連動は現段階ではZ軸同士のみ対応です");
  seen.add(id);check(j.driver,seen);seen.delete(id);
 }
 joints.forEach(j=>check(j.part));
 return {format:MECHANISM_FORMAT,joints};
}
export function evaluateMechanism(objects,mechanism,timeSeconds){
 if(!Array.isArray(objects)||objects.length>500||!finite(timeSeconds))throw Error("機構計算の入力が不正です");
 const config=validateMechanism(mechanism,objects),pose=copy(objects);
 const orig=new Map(objects.map(o=>[o.id,o])),updated=new Map(pose.map(o=>[o.id,o]));
 const joints=new Map(config.joints.map(j=>[j.part,j])),angles=new Map();
 function angleOf(id){
  if(angles.has(id))return angles.get(id);
  const joint=joints.get(id);let value=0;
  if(joint?.type==="revolute")value=joint.phase+angle(timeSeconds,joint.speed);
  else if(joint?.type==="gear"){
   const driving=joints.get(joint.driver);
   const driveAngle=angleOf(joint.driver);
   const teeth0=driving.type==="gear"?driving.teeth:Math.max(4,Math.round(safe(driving.teeth,20)));
   value=joint.phase-driveAngle*teeth0/joint.teeth;
  }
  angles.set(id,value);return value;
 }
 for(const j of config.joints){
  const base=orig.get(j.part),o=updated.get(j.part);
  if(!base||!o)continue;
  if(j.type==="slider"){
   // Sinusoidal motion, bounded at +/- stroke/2, avoids unlimited drifting.
   const displacement=j.phase+j.stroke/2*Math.sin(2*Math.PI*j.speed*timeSeconds/60);
   const index={x:0,y:1,z:2}[j.axis];
   o.pos[index]=base.pos[index]+displacement;
  }else{
   const index={x:0,y:1,z:2}[j.axis];
   o.rot[index]=base.rot[index]+angleOf(j.part);
  }
 }
 return pose;
}
export function mechanismSample(objects){
 const shaft=objects.find(o=>o.kind==="shaft");
 if(!shaft)return {format:MECHANISM_FORMAT,joints:[]};
 const joints=[{type:"revolute",part:shaft.id,axis:"z",speed:30,phase:0}];
 const gear=objects.find(o=>o.kind==="gear");
 if(gear)joints.push({type:"gear",part:gear.id,driver:shaft.id,axis:"z",teeth:40,phase:0});
 return {format:MECHANISM_FORMAT,joints};
}
