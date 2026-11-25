/**
 * Quest WebXR room model. Room geometry is saved relative to ONE physical
 * anchor, never to GPS/compass or a session's arbitrary tracking origin.
 * Physical camera pixels are neither requested nor saved.
 */
export const MR_ROOM_SAVE_KEY="universal-engine:mr-room:20261122:v1";
const good=n=>typeof n==="number"&&Number.isFinite(n);
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const matrix=m=>m?.length===16&&[0,2,8,10,12,13,14].every(i=>good(m[i]));
const finite=(n,d=0)=>good(n)?n:d;
const types=new Set(["chair","sofa","table","wall","obstacle","bed","tv","bookshelf","kitchen"]);
const dimensions={chair:[.65,.65,.45],sofa:[1.6,.85,.43],table:[1.1,.8,.72],wall:[2,.12,2.2],obstacle:[.8,.8,.9],bed:[1,2.05,.5],tv:[1.15,.2,1.1],bookshelf:[.9,.32,1.8],kitchen:[1.8,.6,.94]};
export const MR_FLOOR_POSES=Object.freeze(["floor_legs_out","floor_crosslegged","floor_seiza","floor_side_sit","floor_knees_up"]);
export const MR_CHAIR_POSES=Object.freeze(["chair_upright","chair_relaxed","chair_ankles_crossed","chair_edge"]);
export const MR_SOFA_POSES=Object.freeze(["sofa_relaxed","sofa_upright","sofa_sideways","sofa_legs_crossed"]);
export const MR_STAND_POSES=Object.freeze(["stand_neutral","stand_attention","stand_arms_crossed","stand_hands_hips","stand_weight_shift"]);
export const MR_SEAT_POSES={floor:MR_FLOOR_POSES,chair:MR_CHAIR_POSES,sofa:MR_SOFA_POSES};
const cleanObject=(o,i)=>{
 if(!types.has(o?.type))return null;
 const def=dimensions[o.type];
 return {id:typeof o.id==="string"&&/^[a-zA-Z0-9_-]{1,48}$/.test(o.id)?o.id:"object-"+i,
  type:o.type,x:clamp(finite(o.x),-20,20),z:clamp(finite(o.z),-20,20),
  yaw:clamp(finite(o.yaw),-Math.PI*2,Math.PI*2),
  width:clamp(finite(o.width,def[0]),.1,8),
  depth:clamp(finite(o.depth,def[1]),.08,8),
  height:clamp(finite(o.height,def[2]),.15,3),
  seatY:o.type==="chair"||o.type==="sofa"?clamp(finite(o.seatY,def[2]),.25,.85):0};
};
export class MRRoomLayout {
 constructor(snapshot=null){
  const s=snapshot?.version===1?snapshot:{};
  this.width=clamp(finite(s.width,5),2,15);
  this.depth=clamp(finite(s.depth,5),2,15);
  this.objects=(Array.isArray(s.objects)?s.objects:[]).slice(0,32)
   .map(cleanObject).filter(Boolean);
  this.portal=s.portal&&good(s.portal.x)&&good(s.portal.z)?
   {x:clamp(s.portal.x,-10,10),z:clamp(s.portal.z,-10,10),yaw:finite(s.portal.yaw),
    width:clamp(finite(s.portal.width,1.05),.7,1.8)}:null;
  this.anchorHandle=typeof s.anchorHandle==="string"&&s.anchorHandle.length<512?s.anchorHandle:null;
  this.cushions=(Array.isArray(s.cushions)?s.cushions:[]).slice(0,32).filter(c=>c&&typeof c.id==="string"&&Number.isFinite(c.x)&&Number.isFinite(c.z)&&["floor","chair","sofa"].includes(c.surface)).map(c=>({...c,pose:MR_SEAT_POSES[c.surface].includes(c.pose)?c.pose:MR_SEAT_POSES[c.surface][0]}));
  this.navigationBoundary=Array.isArray(s.navigationBoundary)?s.navigationBoundary.slice(0,24).filter(p=>p&&good(p.x)&&good(p.z)).map(p=>({x:clamp(p.x,-20,20),z:clamp(p.z,-20,20)})):[];
  this.origin=null;this.relocalization="unavailable";
 }
 get ready(){return Boolean(this.origin);}
 setOrigin(x,z,yaw=0){
  if(![x,z,yaw].every(good))return false;
  this.origin={x,z,yaw};this.relocalization="manual";return true;
 }
 setOriginMatrix(m,{persistent=false}={}){
  if(!matrix(m))return false;
  this.origin={x:m[12],z:m[14],yaw:Math.atan2(m[8],m[0])};
  this.relocalization=persistent?"persistent":"manual";return true;
 }
 forgetTracking(){this.origin=null;this.relocalization="unavailable";}
 world(local){
  if(!this.ready||!local||!good(local.x)||!good(local.z))return null;
  const {x,z,yaw}=this.origin,c=Math.cos(yaw),s=Math.sin(yaw);
  return {x:x+c*local.x+s*local.z,z:z-s*local.x+c*local.z,
   yaw:finite(local.yaw)+yaw,y:finite(local.y)};
 }
 local(world){
  if(!this.ready||!world||!good(world.x)||!good(world.z))return null;
  const {x,z,yaw}=this.origin,c=Math.cos(yaw),s=Math.sin(yaw);
  const dx=world.x-x,dz=world.z-z;
  return {x:c*dx-s*dz,z:s*dx+c*dz,yaw:finite(world.yaw)-yaw,y:finite(world.y)};
 }
 setSize(width,depth){
  this.width=clamp(Number(width)||5,2,15);
  this.depth=clamp(Number(depth)||5,2,15);
 }
 add(type,point,{width,depth,height,seatY,yaw}={}){
  if(!types.has(type)||!this.ready||!point)return null;
  const p=this.local(point);
  if(!p)return null;
  const def=dimensions[type];
  const id=type+"-"+Date.now().toString(36)+"-"+this.objects.length;
  const item=cleanObject({id,type,x:p.x,z:p.z,yaw:good(yaw)?yaw:p.yaw,
   width:finite(width,def[0]),depth:finite(depth,def[1]),height:finite(height,def[2]),
   seatY:finite(seatY,def[2])},this.objects.length);
  if(this.objects.length>=32)this.objects.shift();
  this.objects.push(item);return item;
 }
 /** A cushion defines an actual available seat; furniture alone is not a seat. */
 addCushion(point,{furnitureId=null,seatIndex=0,pose=null}={}){
  if(!this.ready||!point||this.cushions.length>=32)return null;
  const local=this.local(point);if(!local)return null;
  const parent=this.objects.find(o=>o.id===furnitureId);
  if(furnitureId&&!parent)return null;
  if(parent&&!["chair","sofa"].includes(parent.type))return null;
  const surface=parent?.type||"floor";
  const total=surface==="sofa"?3:1;
  if(!Number.isInteger(seatIndex)||seatIndex<0||seatIndex>=total)return null;
  if(parent&&this.cushions.some(c=>c.parentId===parent.id&&c.seatIndex===seatIndex))return null;
  if(!parent&&!this.free(point.x,point.z,.24))return null;
  const chosen=MR_SEAT_POSES[surface].includes(pose)?pose:MR_SEAT_POSES[surface][0];
  const c={id:"zabuton-"+Date.now().toString(36)+"-"+this.cushions.length,
   parentId:parent?.id||null,seatIndex,surface,pose:chosen,x:local.x,z:local.z,yaw:parent?.yaw??local.yaw};
  this.cushions.push(c);return c;
 }
 removeLastCushion(){return this.cushions.pop()||null;}
 setCushionPose(id,pose){
  const c=this.cushions.find(c=>c.id===id);
  if(!c||!MR_SEAT_POSES[c.surface]?.includes(pose))return false;
  c.pose=pose;return true;
 }
 worldCushions(){
  return this.cushions.flatMap(c=>{
   const parent=c.parentId?this.objects.find(o=>o.id===c.parentId):null;
   if(c.parentId&&!parent)return [];
   let local={x:c.x,z:c.z,yaw:c.yaw};
   let seatY=0;
   if(parent){
    const offset=parent.type==="sofa"?(c.seatIndex-1)*parent.width/3:0;
    local={x:parent.x+Math.cos(parent.yaw)*offset,z:parent.z-Math.sin(parent.yaw)*offset,yaw:parent.yaw};
    seatY=parent.seatY;
   }
   const w=this.world(local);
   return w?[{...w,id:c.id,type:"cushion",surface:c.surface,pose:c.pose,
    width:parent?.type==="sofa"?Math.min(.48,parent.width/3):.43,depth:.43,height:.04,
    seatY,parentId:c.parentId}]:[];
  });
 }
 setNavigationBoundary(points){
  if(!this.ready||!Array.isArray(points)||points.length<3||points.length>24)return false;
  const local=points.map(p=>this.local(p));
  if(local.some(p=>!p||!good(p.x)||!good(p.z)))return false;
  this.navigationBoundary=local.map(p=>({x:p.x,z:p.z}));return true;
 }
 clearNavigationBoundary(){this.navigationBoundary=[];}
 worldBoundary(){return this.navigationBoundary.map(p=>this.world(p)).filter(Boolean);}
 setPortal(point,width=1.05){
  const p=this.local(point);if(!p)return null;
  this.portal={x:p.x,z:p.z,yaw:p.yaw,width:clamp(width,.7,1.8)};
  return this.portal;
 }
 worldObjects(){return this.objects.map(o=>({...o,...this.world(o)}));}
 worldPortal(){return this.portal?this.world(this.portal)&&{...this.portal,...this.world(this.portal)}:null;}
 seatWorld(){return this.worldCushions();}
 removeLast(){const o=this.objects.pop()||null;if(o)this.cushions=this.cushions.filter(c=>c.parentId!==o.id);return o;}
 inside(x,z,r=.25){
  const p=this.local({x,z});if(!p)return false;
  return Math.abs(p.x)<=this.width/2-r&&Math.abs(p.z)<=this.depth/2-r;
 }
 free(x,z,r=.28,{seatId=null}={}){
  if(!this.inside(x,z,r))return false;
  for(const o of this.worldObjects()){
   if(o.id===seatId||this.cushions.some(c=>c.id===seatId&&c.parentId===o.id))continue;
   const dx=x-o.x,dz=z-o.z,c=Math.cos(o.yaw),s=Math.sin(o.yaw);
   const lx=c*dx-s*dz,lz=s*dx+c*dz;
   if(Math.abs(lx)<o.width/2+r&&Math.abs(lz)<o.depth/2+r)return false;
  }
  return true;
 }
 nearestSeat(x,z){
  return this.seatWorld().sort((a,b)=>Math.hypot(a.x-x,a.z-z)-Math.hypot(b.x-x,b.z-z))[0]||null;
 }
 snapshot(){return {version:1,width:this.width,depth:this.depth,
  objects:this.objects.map(o=>({...o})),cushions:this.cushions.map(c=>({...c})),
  navigationBoundary:this.navigationBoundary.map(p=>({...p})),portal:this.portal?{...this.portal}:null,
  anchorHandle:this.anchorHandle};}
}
/** Read WebXR plane metadata, not passthrough camera pixels.
 * A horizontal plane cannot reliably be classified as chair: register chairs
 * manually unless the runtime provides a semantic label.
 */
export function mrDetectedSurfaces(frame,space,max=24){
 const found=[];
 for(const plane of frame?.detectedPlanes||[]){
  if(found.length>=max)break;
  const pose=plane.planeSpace&&frame.getPose?.(plane.planeSpace,space);
  const m=pose?.transform?.matrix;
  if(!matrix(m))continue;
  const polygon=Array.from(plane.polygon||[]);
  const w=polygon.length?Math.max(...polygon.map(p=>p.x))-Math.min(...polygon.map(p=>p.x)):.7;
  const h=polygon.length?Math.max(...polygon.map(p=>p.z))-Math.min(...polygon.map(p=>p.z)):.7;
  const orientation=plane.orientation||plane.planeOrientation;
  const semantic=String(plane.semanticLabel||"").toLowerCase();
  let type=semantic.includes("chair")?"chair":semantic.includes("couch")||semantic.includes("sofa")?"sofa":
   orientation==="vertical"?"wall":orientation==="horizontal"&&m[13]>.32&&m[13]<1.3?"table":null;
  if(!type)continue;
  const def=dimensions[type];
  const width=clamp(Math.max(w,h,.1),.1,8);
  found.push({type,x:m[12],y:m[13],z:m[14],
   yaw:Math.atan2(m[8],m[0]),width,
   depth:type==="wall"?.14:clamp(Math.min(Math.max(w,.2),Math.max(h,.2)),.15,4),
   height:type==="wall"?2.2:def[2],seatY:type==="chair"||type==="sofa"?clamp(m[13],.3,.8):0});
 }
 return found;
}
/** A portal is an invitation point, not a mechanism for automatic XR session
 * switching, which browsers must start from explicit user gestures. */
export function mrNearPortal(head,portal,radius=.95){
 if(!head||!portal)return false;
 return Math.hypot(head[12]-portal.x,head[14]-portal.z)<=radius;
}

/** Right-hand controller trigger aimed through the door centre. A nearby
 * ray hit can end the current XR session, never silently start the next. */
export function mrPortalRayHit(ray,portal,maxDistance=3){
 if(!matrix(ray)||!portal)return false;
 const direction=[-ray[8],-ray[9],-ray[10]];
 const goal=[portal.x-ray[12],finite(portal.y)+1.12-ray[13],portal.z-ray[14]];
 const dot=goal.reduce((s,v,i)=>s+v*direction[i],0);
 if(dot<.15||dot>maxDistance)return false;
 const rem=goal.map((v,i)=>v-direction[i]*dot);
 return Math.hypot(...rem)<.50;
}
