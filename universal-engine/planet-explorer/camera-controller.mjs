/**
 * Universal Engine v0.7c - independent camera controller.
 * Camera movement NEVER mutates the actor's lat/lon or movement state.
 * The camera is a local, deterministic presentation object (meters, radians).
 */
export const CAMERA_MODES=Object.freeze([
  ["legacy","従来の視点"],["follow","追従（三人称）"],
  ["shoulder","肩越し"],["free","自由視点"],
  ["orbitTarget","人物を中心に回転"],["tactical","上空から俯瞰"]
]);
const VALID=new Set(CAMERA_MODES.map(m=>m[0]));
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
const validNumber=x=>typeof x==="number"&&Number.isFinite(x);
const vec=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
export function sanitizeCamera(data){
 if(!data||data.version!==1||!VALID.has(data.mode))throw Error("Invalid camera save");
 const numeric={
  yawOffset:[-Math.PI*4,Math.PI*4],pitchRad:[-1.48,1.48],
  distanceM:[1,120],fieldOfViewDeg:[35,90],followStrength:[.1,24],
  tacticalHeightM:[35,18000],freeX:[-2e7,2e7],freeZ:[-2e7,2e7],
  freeHeightM:[1,22000],freeYaw:[-Math.PI*4,Math.PI*4],
  freePitch:[-1.48,1.48]
 };
 for(const [k,[lo,hi]]of Object.entries(numeric)){
  if(!validNumber(data[k])||data[k]<lo||data[k]>hi)throw Error("Invalid camera property: "+k);
 }
 if(typeof data.indicator!=="boolean")throw Error("Invalid marker selection");
 return {...data};
}
export class CameraController{
 constructor(snapshot=null){
  this.config={
   version:1,mode:"legacy",yawOffset:0,pitchRad:.26,
   distanceM:8,fieldOfViewDeg:65,followStrength:8,
   tacticalHeightM:250,freeX:0,freeZ:0,freeHeightM:12,
   freeYaw:0,freePitch:-.20,indicator:true
  };
  this.smoothEye=null;this.smoothTarget=null;this.lastMode="legacy";
  if(snapshot)this.config=sanitizeCamera(snapshot);
 }
 get mode(){return this.config.mode;}
 setMode(mode,actor=null,groundM=0){
  if(!VALID.has(mode))throw RangeError("Unknown camera mode");
  const old=this.config.mode;
  if(mode==="free"&&old!=="free"&&actor){
   this.config.freeX=actor.x;this.config.freeZ=actor.z;
   this.config.freeHeightM=clamp(groundM+Math.max(5,actor.altitudeM<=12?6:actor.altitudeM),1,22000);
   this.config.freeYaw=actor.yaw;this.config.freePitch=-.18;
  }
  this.config.mode=mode;
  this.smoothEye=null;this.smoothTarget=null;this.lastMode=mode;
  return mode;
 }
 setValue(field,value){
  const allowed=new Set(["distanceM","fieldOfViewDeg","followStrength","tacticalHeightM","indicator"]);
  if(!allowed.has(field))throw Error("Unknown camera setting");
  const next={...this.config,[field]:value};
  this.config=sanitizeCamera(next);
  return value;
 }
 rotate(dx,dy,sensitivity=1){
  if(![dx,dy,sensitivity].every(Number.isFinite))throw TypeError("Invalid camera rotation");
  const x=dx*sensitivity*.006,y=dy*sensitivity*.004;
  if(this.mode==="free"){
   this.config.freeYaw=(this.config.freeYaw+x)%(Math.PI*2);
   this.config.freePitch=clamp(this.config.freePitch-y,-1.42,1.42);
  }else{
   this.config.yawOffset=(this.config.yawOffset+x)%(Math.PI*2);
   this.config.pitchRad=clamp(this.config.pitchRad+y,-1.25,1.42);
  }
 }
 pan(dt,forward=0,strafe=0){
  if(this.mode!=="free")return false;
  if(![dt,forward,strafe].every(Number.isFinite)||dt<0)throw TypeError("Invalid pan input");
  const speed=clamp(Math.max(5,this.config.freeHeightM*.32),5,1600);
  const walk=clamp(dt,0,.08)*speed;
  const y=this.config.freeYaw,ff=clamp(forward,-1,1),ss=clamp(strafe,-1,1);
  this.config.freeX+=walk*(Math.sin(y)*ff+Math.cos(y)*ss);
  this.config.freeZ+=walk*(Math.cos(y)*ff-Math.sin(y)*ss);
  this.config.freeX=clamp(this.config.freeX,-2e7,2e7);
  this.config.freeZ=clamp(this.config.freeZ,-2e7,2e7);
  return true;
 }
 zoom(factor){
  if(!validNumber(factor)||factor<=0)throw TypeError("Invalid camera zoom");
  if(this.mode==="tactical")this.setValue("tacticalHeightM",clamp(this.config.tacticalHeightM*factor,35,18000));
  else if(this.mode==="free")this.config.freeHeightM=clamp(this.config.freeHeightM*factor,1,22000);
  else this.setValue("distanceM",clamp(this.config.distanceM*factor,1,120));
 }
 resetFreeAnchor(actor,groundM=0){
  if(!actor||!validNumber(actor.x)||!validNumber(actor.z))throw TypeError("Invalid camera anchor");
  this.config.freeX=actor.x;this.config.freeZ=actor.z;
  this.config.freeHeightM=clamp(groundM+6,1,22000);
  this.smoothEye=null;this.smoothTarget=null;
 }
 /**
  * Returns a view definition in the current local terrain patch's coordinate frame.
  * Local z points geographic north. Camera origin may differ from actor origin.
  */
 groundView(actor,{cx=0,cz=0,groundM=0,focusGroundM=groundM,dt=1/60}={}){
  if(!actor||![actor.x,actor.z,actor.yaw,actor.altitudeM,cx,cz,groundM,focusGroundM,dt].every(Number.isFinite))
    throw TypeError("Invalid camera view input");
  const c=this.config,m=c.mode,px=actor.x-cx,pz=actor.z-cz,yy=actor.yaw+c.yawOffset;
  const sin=Math.sin(yy),cos=Math.cos(yy);
  const targetGround=[px,groundM+1.18+(actor.jumpY||0),pz];
  const dist=c.distanceM,raised=Math.sin(c.pitchRad)*dist;
  let eye,target,farHeight=actor.altitudeM;
  const near=actor.altitudeM<=12;
  if(m==="legacy"){
   eye=near?[px-Math.sin(actor.yaw)*8,groundM+7,pz-Math.cos(actor.yaw)*8]:
     [px,groundM+actor.altitudeM,pz];
   target=near?targetGround:
     [px+Math.sin(actor.yaw)*actor.altitudeM*.5,groundM-actor.altitudeM*.8,
       pz+Math.cos(actor.yaw)*actor.altitudeM*.5];
  }else if(m==="free"){
   const baseY=Math.max(c.freeHeightM,focusGroundM+1.3);
   eye=[c.freeX-cx,baseY,c.freeZ-cz];
   const h=Math.cos(c.freePitch);
   target=[eye[0]+Math.sin(c.freeYaw)*h*12,eye[1]+Math.sin(c.freePitch)*12,
     eye[2]+Math.cos(c.freeYaw)*h*12];
   farHeight=Math.max(2.5,baseY-focusGroundM);
  }else if(m==="tactical"){
   const h=c.tacticalHeightM;
   eye=[px+Math.sin(yy)*h*.07,groundM+h,pz+Math.cos(yy)*h*.07];
   target=[px,groundM,pz];farHeight=h;
  }else if(!near&&(m==="follow"||m==="orbitTarget")){
   // When the explorer altitude changes, nonlegacy follow continues to view
   // the grounded avatar from above instead of snapping back to 8 meters.
   const h=Math.max(12,actor.altitudeM);
   eye=[px-sin*h*.10,groundM+h,pz-cos*h*.10];
   target=targetGround;farHeight=h;
  }else if(m==="shoulder"){
   eye=[px-sin*1.85+cos*.65,groundM+1.82,pz-cos*1.85-sin*.65];
   target=[px+sin*3.1,groundM+1.54,pz+cos*3.1];
   farHeight=3;
  }else{
   // follow: behind avatar, orbitTarget: orbit around the avatar at arbitrary yaw.
   const angle=m==="follow"?actor.yaw+c.yawOffset:yy;
   const ax=Math.sin(angle),az=Math.cos(angle);
   eye=[px-ax*dist*Math.cos(c.pitchRad),groundM+1.18+raised,
         pz-az*dist*Math.cos(c.pitchRad)];
   target=targetGround;
   farHeight=Math.max(2.5,dist);
  }
  // Avoid eye falling below local ground or becoming exactly equal to target.
  eye[1]=Math.max(eye[1],focusGroundM+.65);
  if(Math.hypot(eye[0]-target[0],eye[1]-target[1],eye[2]-target[2])<.2)
    eye[1]+=.4;
  if(m!=="legacy"){
   const a=1-Math.exp(-clamp(dt,0,.1)*c.followStrength);
   if(!this.smoothEye){this.smoothEye=[...eye];this.smoothTarget=[...target];}
   else {this.smoothEye=vec(this.smoothEye,eye,a);this.smoothTarget=vec(this.smoothTarget,target,a);}
   eye=[...this.smoothEye];target=[...this.smoothTarget];
  }
  return {eye,target,fovDeg:c.fieldOfViewDeg,heightM:farHeight,actorPos:[px,groundM+(actor.jumpY||0)+1.2,pz],
    focusX:m==="free"?c.freeX:actor.x,focusZ:m==="free"?c.freeZ:actor.z,
    marker:c.indicator && Math.max(farHeight,actor.altitudeM)>45};
 }
 snapshot(){return {...this.config};}
 static fromSnapshot(data){return new CameraController(sanitizeCamera(data));}
}
