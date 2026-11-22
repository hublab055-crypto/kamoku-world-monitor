import {ARROW_TYPES,arrowTypeValid} from "./social-equipment.mjs";
/** Recoverable physical arrows for Universal Engine's metre-based ground world.
 * Flight is stepped (with swept intersection tests) and resolved only on impact.
 * Coordinates are local x/z metres and absolute terrain y metres. */
const GRAVITY=9.81;
/** Real in-game seconds after impact in which a landed arrow can be recovered. */
export const ARROW_RECOVERY_SECONDS=90;
const vecLength=v=>Math.hypot(v.x,v.y,v.z);
const finite=n=>typeof n==="number"&&Number.isFinite(n);
const clamp=(x,lo,hi)=>Math.min(hi,Math.max(lo,x));
const unit=v=>{const d=vecLength(v)||1;return {x:v.x/d,y:v.y/d,z:v.z/d};};
const mix=(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t});
const closestSphere=(a,b,c,r)=>{
 const d={x:b.x-a.x,y:b.y-a.y,z:b.z-a.z};
 const p={x:a.x-c.x,y:a.y-c.y,z:a.z-c.z};
 const A=d.x*d.x+d.y*d.y+d.z*d.z;
 if(A<1e-12)return (p.x*p.x+p.y*p.y+p.z*p.z<=r*r)?0:null;
 const B=2*(p.x*d.x+p.y*d.y+p.z*d.z),C=p.x*p.x+p.y*p.y+p.z*p.z-r*r;
 if(C<=0)return 0;
 const discriminant=B*B-4*A*C;
 if(discriminant<0)return null;
 const t=(-B-Math.sqrt(discriminant))/(2*A);
 return t>=0&&t<=1?t:null;
};
const closestCylinder=(a,b,c,r,low,high)=>{
 const dx=b.x-a.x,dz=b.z-a.z,px=a.x-c.x,pz=a.z-c.z;
 const A=dx*dx+dz*dz,B=2*(px*dx+pz*dz),C=px*px+pz*pz-r*r;
 const roots=[];
 if(C<=0)roots.push(0);
 if(A>1e-10){const disc=B*B-4*A*C;if(disc>=0){
  roots.push((-B-Math.sqrt(disc))/(2*A),(-B+Math.sqrt(disc))/(2*A));
 }}
 // Vertical crossing while inside the cylinder also counts.
 if(Math.abs(b.y-a.y)>1e-9)roots.push((low-a.y)/(b.y-a.y),(high-a.y)/(b.y-a.y));
 return roots.filter(t=>t>=0&&t<=1)
  .filter(t=>{const pt=mix(a,b,t);return pt.y>=low-.001&&pt.y<=high+.001&&
   (pt.x-c.x)**2+(pt.z-c.z)**2<=r*r+.0001;})
  .sort((x,y)=>x-y)[0]??null;
};
const closestBox=(a,b,box)=>{
 let lo=0,hi=1;
 for(const axis of ["x","y","z"]){
  const d=b[axis]-a[axis],min=box[axis]-box["half"+axis.toUpperCase()];
  const max=box[axis]+box["half"+axis.toUpperCase()];
  if(Math.abs(d)<1e-9){if(a[axis]<min||a[axis]>max)return null;}
  else{const q=(min-a[axis])/d,r=(max-a[axis])/d;lo=Math.max(lo,Math.min(q,r));hi=Math.min(hi,Math.max(q,r));if(lo>hi)return null;}
 }
 return lo;
};
const shotVector=({origin,target,yaw,mode})=>{
 const dx=target?target.x-origin.x:Math.sin(yaw),dz=target?target.z-origin.z:Math.cos(yaw);
 const horizontal=Math.hypot(dx,dz)||1,ux=dx/horizontal,uz=dz/horizontal;
 const flightMode=mode==="auto"?(target&&horizontal>28?"lob":"direct"):mode;
 let speed=flightMode==="lob"?35:47,pitch=flightMode==="lob"?.89:.022;
 if(target){
  const dy=target.y-origin.y,D=horizontal;
  if(flightMode==="lob"){
   // A controlled arcing shot, not the mathematical near-vertical high root:
   // solve launch speed for a 51-degree trajectory to the chosen target.
   pitch=.89;
   const denominator=2*Math.cos(pitch)**2*(D*Math.tan(pitch)-dy);
   if(denominator>0)speed=clamp(Math.sqrt(GRAVITY*D*D/denominator),12,48);
  }else{
   const v2=speed**2,disc=v2*v2-GRAVITY*(GRAVITY*D*D+2*dy*v2);
   pitch=disc>=0?Math.atan((v2-Math.sqrt(disc))/(GRAVITY*D)):Math.atan2(dy,D)+.06;
  }
 }
 pitch=clamp(pitch,-.28,1.30);
 return {mode:flightMode,vx:ux*speed*Math.cos(pitch),vy:speed*Math.sin(pitch),vz:uz*speed*Math.cos(pitch)};
};
export class ArrowProjectiles{
 constructor(saved=null){
  this.flying=[];this.embedded=[];this.targets=[];this.burning=[];this.nextId=1;
  if(saved)this.restore(saved);
 }
 addTarget(shooter,{groundY=0}={}){
  if(!shooter||!finite(shooter.x)||!finite(shooter.z))return null;
  if(this.targets.length>=12)return null;
  const angle=shooter.yaw||0;
  const target={id:this.nextId++,x:shooter.x+Math.sin(angle)*9,
   z:shooter.z+Math.cos(angle)*9,y:groundY,yaw:angle+Math.PI};
  this.targets.push(target);return target;
 }
 launch({shooterId,actor,groundY=0,target=null,mode="auto",arrowType="wood"}){
  if(!actor||!finite(actor.x)||!finite(actor.z)||this.flying.length>=64)return null;
  const yaw=actor.yaw||0;
  const origin={x:actor.x+Math.sin(yaw)*.52,y:groundY+1.48,z:actor.z+Math.cos(yaw)*.52};
  const velocity=shotVector({origin,target,yaw,mode});
  const arrow={id:this.nextId++,shooterId,ownerId:shooterId,arrowType:arrowTypeValid(arrowType)?arrowType:"wood",
   x:origin.x,y:origin.y,z:origin.z,
   vx:velocity.vx,vy:velocity.vy,vz:velocity.vz,mode:velocity.mode,age:0};
  this.flying.push(arrow);return arrow;
 }
 advance(dt,{groundHeight=()=>0,trees=[],buildings=[],enemies=[],onEnemyHit=()=>{}}={}){
  if(!finite(dt)||dt<0)throw TypeError("Invalid arrow delta");
  const events=[];
  for(const burn of [...this.burning]){
   const active=Math.min(Math.max(dt,0),burn.remaining);
   burn.tick+=active;
   while(burn.tick>=1-1e-8){
    burn.tick=Math.max(0,burn.tick-1);
    if(burn.surface==="enemy"){
     const target=enemies.find(e=>e.id===burn.objectId&&e.hp>0);
     if(target){
      const hit=onEnemyHit(target,4,burn.ownerId,{arrowType:"fire",effect:"burn"});
      events.push({surface:"burn",hit,ownerId:burn.ownerId});
     }
    }
   }
   burn.remaining=Math.max(0,burn.remaining-active);
   if(burn.remaining<=1e-8)this.burning.splice(this.burning.indexOf(burn),1);
  }
  // Recovery time only advances with the simulation clock, never during pause.
  // Filter in one sweep to bound memory and renderer work in long sessions.
  for(const stuck of this.embedded){
   stuck.recoverLeft=Math.max(0,(Number.isFinite(stuck.recoverLeft)?stuck.recoverLeft:ARROW_RECOVERY_SECONDS)-dt);
  }
  this.embedded=this.embedded.filter(stuck=>stuck.recoverLeft>0);
  // Embedded enemy arrows follow the moving target until it disappears.
  for(const stuck of this.embedded){
   if(stuck.surface!=="enemy"||!stuck.offset)continue;
   const enemy=enemies.find(e=>e.id===stuck.objectId);
   if(!enemy)continue;
   const gy=groundHeight(enemy.x,enemy.z);
   stuck.x=enemy.x+stuck.offset.x;
   stuck.y=gy+stuck.offset.y;
   stuck.z=enemy.z+stuck.offset.z;
  }
  for(const arrow of [...this.flying]){
   let remaining=Math.min(dt,.25),impact=null;
   while(remaining>1e-7&&!impact){
    const step=Math.min(remaining,.018);remaining-=step;
    const previous={x:arrow.x,y:arrow.y,z:arrow.z};
    arrow.x+=arrow.vx*step;
    arrow.y+=arrow.vy*step-.5*GRAVITY*step*step;
    arrow.z+=arrow.vz*step;arrow.vy-=GRAVITY*step;
    arrow.age+=step;
    const next={x:arrow.x,y:arrow.y,z:arrow.z};
    const candidates=[];
    const offer=(kind,obj,t)=>{if(t!==null&&t!==undefined&&t>=0&&t<=1)candidates.push({kind,obj,t});};
    // A finite vertical body is hit by any swept arrow segment, not a
    // target-ID-only hit. Obstacles can intercept it first.
    for(const enemy of enemies){
     if(enemy.hp<=0)continue;
     const y=finite(enemy.groundY)?enemy.groundY:groundHeight(enemy.x,enemy.z);
     const center={x:enemy.x,z:enemy.z};
     offer("enemy",enemy,closestCylinder(previous,next,center,
      (enemy.radius||.6)+.12,y+.25,y+(enemy.height||1.9)));
    }
    for(const target of this.targets)offer("target",target,
     closestSphere(previous,next,{x:target.x,y:target.y+1.65,z:target.z},.82));
    for(const tree of trees){
     const y=finite(tree.elevationM)?tree.elevationM:groundHeight(tree.x,tree.z);
     offer(tree.kind==="stone"?"stone":"tree",tree,
      closestCylinder(previous,next,tree,.70,y,y+(tree.kind==="stone"?1.8:5.5)));
    }
    for(const building of buildings){
     if(building.progress<.25)continue;
     offer("building",building,closestBox(previous,next,{
      x:building.x,y:building.height+2.0,z:building.z,
      halfX:3.3,halfY:2,halfZ:2.8}));
    }
    // Terrain collision crossing between old and new arrow tip heights.
    const floor=groundHeight(next.x,next.z);
    if(next.y<=floor){
     const previousFloor=groundHeight(previous.x,previous.z);
     const denom=(previous.y-previousFloor)-(next.y-floor);
     offer("ground",null,denom>.00001?clamp((previous.y-previousFloor)/denom,0,1):0);
    }
    candidates.sort((l,r)=>l.t-r.t);
    if(candidates.length)impact={...candidates[0],point:mix(previous,next,candidates[0].t)};
   }
   if(impact||arrow.age>12||arrow.y < -10000){
    this.flying=this.flying.filter(a=>a!==arrow);
    if(!impact)continue;
    const direction=unit({x:arrow.vx,y:arrow.vy,z:arrow.vz});
    const stuck={id:arrow.id,ownerId:arrow.ownerId,arrowType:arrow.arrowType||"wood",x:impact.point.x,
     y:impact.point.y,z:impact.point.z,dx:direction.x,dy:direction.y,dz:direction.z,
     surface:impact.kind,objectId:impact.obj?.id??null,recoverLeft:ARROW_RECOVERY_SECONDS};
    if(impact.kind==="enemy"){
     const enemy=impact.obj;
     stuck.offset={x:stuck.x-enemy.x,y:stuck.y-groundHeight(enemy.x,enemy.z),z:stuck.z-enemy.z};
    }
    this.embedded.push(stuck);
    if(this.embedded.length>160)this.embedded.shift();
    const event={...stuck};
    if(impact.kind==="enemy")event.hit=onEnemyHit(impact.obj,
     ARROW_TYPES[arrow.arrowType]?.damage||22,arrow.shooterId,{arrowType:arrow.arrowType,effect:"impact"});
    if(arrow.arrowType==="fire"&&["enemy","tree","building","target"].includes(impact.kind)){
     const existing=this.burning.find(b=>b.surface===impact.kind&&b.objectId===stuck.objectId);
     if(existing){existing.remaining=3;existing.tick=0;}
     else this.burning.push({x:stuck.x,y:stuck.y,z:stuck.z,ownerId:stuck.ownerId,
      objectId:stuck.objectId,surface:stuck.surface,remaining:3,tick:0});
     if(this.burning.length>32)this.burning.shift();
    }
    events.push(event);
   }
  }
  return events;
 }
 recover(id){
  const index=this.embedded.findIndex(a=>a.id===id);
  if(index<0)return null;
  return this.embedded.splice(index,1)[0];
 }
 snapshot(){return {version:1,nextId:this.nextId,
  targets:this.targets.map(t=>({...t})),burning:this.burning.map(b=>({...b})),flying:this.flying.map(a=>({...a})),
  embedded:this.embedded.map(a=>({...a}))};}
 restore(saved){
  if(saved?.version!==1)return false;
  const coords=o=>o&&["x","y","z"].every(k=>finite(o[k]));
  this.flying=(saved.flying||[]).filter(a=>coords(a)&&
   ["vx","vy","vz","age"].every(k=>finite(a[k]))).slice(0,64).map(a=>({
    ...a,arrowType:arrowTypeValid(a.arrowType)?a.arrowType:"wood"}));
  this.embedded=(saved.embedded||[]).filter(coords)
   .filter(a=>!Number.isFinite(a.recoverLeft)||a.recoverLeft>0)
   .slice(-160).map(a=>({...a,
    recoverLeft:finite(a.recoverLeft)?clamp(a.recoverLeft,0,ARROW_RECOVERY_SECONDS):ARROW_RECOVERY_SECONDS,
    arrowType:arrowTypeValid(a.arrowType)?a.arrowType:"wood"}));
  this.burning=(saved.burning||[]).filter(b=>coords(b)&&finite(b.remaining)&&b.remaining>0)
   .slice(-32).map(b=>({...b,remaining:clamp(b.remaining,0,3),tick:clamp(b.tick||0,0,1)}));
  this.targets=(saved.targets||[]).filter(coords).slice(0,12).map(a=>({...a}));
  this.nextId=Math.max(1,Math.floor(Number(saved.nextId)||1),
   ...[...this.flying,...this.embedded,...this.targets].map(a=>(a.id||0)+1));
  return true;
 }
}
