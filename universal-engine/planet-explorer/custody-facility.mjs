/** Walkable two-floor custody facility. The planet clock remains paused while detained.
 * Facility poses are local metres, never written to the planet controller.
 */
import {resolveCustodyAtriumRailCollision} from "./custody-atrium-guardrail.mjs?v=atrium-rail-v1";

export const PRISON=Object.freeze({
  upperY:3.8, halfX:11.7, halfZ:9.7,
  innerX:5.5, innerZ:4.5,
  cellFront:-6.20, cellBack:-9.48,
  stairX:8.75, stairTopZ:-4.45, stairBottomZ:5.55,
  doorHalfWidth:.58, daySeconds:300
});
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const cellCenters=Object.freeze([-8,-4,0,4,8]);
export const CUSTODY_START=Object.freeze({x:0,z:-8.1,y:3.8,yaw:0});
const pathToDining=[
  {x:0,z:-5.25,y:3.8},{x:6.4,z:-5.25,y:3.8},
  {x:8.75,z:-5.10,y:3.8},{x:8.75,z:-4.45,y:3.8},
  {x:8.75,z:5.55,y:0},{x:8.75,z:7.8,y:0},
  {x:2.5,z:7.8,y:0},{x:1,z:1.7,y:0}
];
const npcStart=cellCenters.filter(c=>c!==0).map((c,i)=>({
  id:"inmate-"+(i+1),cellX:c,
  x:c,y:PRISON.upperY,z:-8.15,yaw:0,step:0,upperStart:true
}));
function sceneTime(s){return ((s.elapsed%PRISON.daySeconds)+PRISON.daySeconds)%PRISON.daySeconds;}
export function custodyPhase(elapsed){
  const t=((elapsed%300)+300)%300;
  return t<15?"wake":t<90?"breakfast":t<180?"work":
   t<235?"dinner":t<270?"return":"sleep";
}
export function custodyFloorY(x,z,wasY=3.8){
  if(x>7.10&&x<10.45&&z>=PRISON.stairTopZ&&z<=PRISON.stairBottomZ)
    return PRISON.upperY*clamp((PRISON.stairBottomZ-z)/
      (PRISON.stairBottomZ-PRISON.stairTopZ),0,1);
  // First-floor rooms and exterior of stair. Upper floor is only reachable via
  // the upper gallery, not by falling from it.
  return wasY<1.45?0:PRISON.upperY;
}
export function newCustodyFacility(saved=null){
  const valid=Boolean(saved?.schemaVersion===1&&saved?.facility==="atrium-2f");
  const elapsed=valid&&Number.isFinite(saved.elapsed)?Math.max(0,saved.elapsed):0;
  const origin=valid&&saved.player||CUSTODY_START;
  const safe={...CUSTODY_START,
    x:Number.isFinite(origin.x)?clamp(origin.x,-11.35,11.35):0,
    z:Number.isFinite(origin.z)?clamp(origin.z,-9.35,9.35):-8.1,
    yaw:Number.isFinite(origin.yaw)?origin.yaw:0};
  safe.y=valid&&Number.isFinite(origin.y)&&origin.y<1.5?0:PRISON.upperY;
  return {
    schemaVersion:1,facility:"atrium-2f",elapsed,
    player:{...safe,blocked:false,moving:false,movedM:0},
    door:valid?clamp(Number(saved.door)||0,0,1):0,
    phase:custodyPhase(elapsed),lastPhase:valid?String(saved.phase||"wake"):"wake",
    inmates:npcStart.map((n,i)=>({
      ...n, ...(valid&&saved.inmates?.[i]?.id===n.id?{
        x:Number.isFinite(saved.inmates[i].x)?saved.inmates[i].x:n.x,
        z:Number.isFinite(saved.inmates[i].z)?saved.inmates[i].z:n.z,
        y:Number.isFinite(saved.inmates[i].y)?saved.inmates[i].y:n.y,
        step:clamp(Math.trunc(saved.inmates[i].step)||0,0,20),upperStart:saved.inmates[i].upperStart!==false
      }:{})
    })),
    guard:valid&&saved.guard&&[saved.guard.x,saved.guard.z,saved.guard.y].every(Number.isFinite)?
      {...saved.guard,step:Math.max(0,Math.trunc(saved.guard.step)||0),upperStart:saved.guard.upperStart!==false}:
      {x:1.25,z:-5.35,y:3.8,yaw:Math.PI,step:0,upperStart:true},
    mealCount:valid?Math.min(999,Math.max(0,Math.trunc(saved.mealCount)||0)):0,
    rested:valid?Boolean(saved.rested):false,
    elapsedSinceSave:0,announcements:[]
  };
}
export function custodyFacilitySnapshot(state){
  return {schemaVersion:1,facility:"atrium-2f",elapsed:state.elapsed,
    player:{x:state.player.x,y:state.player.y,z:state.player.z,yaw:state.player.yaw},
    door:state.door,phase:state.phase,
    inmates:state.inmates.map(n=>({id:n.id,x:n.x,y:n.y,z:n.z,step:n.step,upperStart:n.upperStart})),
    guard:{...state.guard},
    mealCount:state.mealCount,rested:state.rested};
}
const inCell=p=>p.y>2.5&&p.z<PRISON.cellFront&&
 p.x>-1.65&&p.x<1.65;
function canWalk(from,to,door,withSweep=true){
  const a={x:from.x,z:from.z},b={x:to.x,z:to.z};
  let blocked=false;
  let dest={...b};
  const borderZ=PRISON.cellFront;
  // Front wall of the player's own small cell. Keep the door opening usable
  // only after the guard has actually opened its animated leaf.
  if(from.y>2.5){
    const crossing=(a.z-borderZ)*(b.z-borderZ)<0;
    if(crossing&&Math.abs(b.x)<1.75){
      if(!(Math.abs(b.x)<.46&&door>.88)){
        dest={x:b.x,z:borderZ+(a.z<borderZ?-.22:.22)};blocked=true;
      }
    }
    if(inCell(from)){
      const minX=-1.58,maxX=1.58,minZ=PRISON.cellBack+.22;
      if(dest.x<minX||dest.x>maxX){dest.x=clamp(dest.x,minX,maxX);blocked=true;}
      if(dest.z<minZ){dest.z=minZ;blocked=true;}
      if(dest.z>borderZ-.12&&door<=.88){dest.z=borderZ-.12;blocked=true;}
    }
  }
  // Solid outer walls. Neither locked inmates nor free walking can leave.
  const x=clamp(dest.x,-PRISON.halfX,PRISON.halfX),z=clamp(dest.z,-PRISON.halfZ,PRISON.halfZ);
  if(x!==dest.x||z!==dest.z)blocked=true;
  dest={x,z};
  // Higher floor, including central gallery. Stair descent is separate.
  if(withSweep&&from.y>2.5&&!(from.x>7.1&&from.x<10.45&&from.z>-4.45)){
    const rail=resolveCustodyAtriumRailCollision(a,dest);
    if(rail.blocked){dest.x=rail.x;dest.z=rail.z;blocked=true;}
  }
  return {...dest,blocked};
}
/** Right-thumbstick turning and left-stick motion. Rail and doors block fast sweeps. */
export function walkCustodyFacility(state,input={},dt=0){
  const from=state.player,t=clamp(Number.isFinite(dt)?dt:0,0,.1);
  let f=clamp(Number(input.forward)||0,-1,1),s=clamp(Number(input.strafe)||0,-1,1);
  const len=Math.hypot(f,s);
  if(len>1){f/=len;s/=len;}
  const yaw=from.yaw+clamp(Number(input.turn)||0,-1,1)*1.7*t;
  const speed=t*2.45;
  const next={x:from.x+speed*(Math.sin(yaw)*f+Math.cos(yaw)*s),
    z:from.z+speed*(Math.cos(yaw)*f-Math.sin(yaw)*s)};
  const dest=canWalk(from,next,state.door);
  const y=custodyFloorY(dest.x,dest.z,from.y);
  const movedM=Math.hypot(dest.x-from.x,dest.z-from.z);
  state.player={x:dest.x,z:dest.z,y,yaw,
    moving:movedM>.00001,blocked:dest.blocked,movedM};
  return state.player;
}
const dinnerPoint={x:1,z:1.7,y:0};
function moveTo(n,target,dt,speed=1.45){
  const len=dist(n,target);
  if(len<=.07){n.x=target.x;n.z=target.z;n.y=target.y;return true;}
  const d=Math.min(len,dt*speed);
  n.x+=(target.x-n.x)*d/len;n.z+=(target.z-n.z)*d/len;
  if(n.x>7.1&&n.x<10.45&&n.z>=PRISON.stairTopZ&&n.z<=PRISON.stairBottomZ)
    n.y=custodyFloorY(n.x,n.z,n.y);
  else n.y+=(target.y-n.y)*Math.min(1,d/Math.max(.1,len));
  n.yaw=Math.atan2(target.x-n.x,target.z-n.z);
  return false;
}
const waypointsFor=(n,returning=false)=>{
  const starting=[{x:n.cellX,z:-5.25,y:3.8},...pathToDining];
  return returning?[...pathToDining.slice(0,-1).reverse(),{x:n.cellX,z:-5.25,y:3.8},
    {x:n.cellX,z:-8.15,y:3.8}]:starting;
};
/** Deterministic small-group shift. Guard really travels to doors and stairs.
 * The cell stays open in the meal and work periods, shut and locked at night.
 */
export function advanceCustodyFacility(state,dt=0){
  const t=clamp(Number.isFinite(dt)?dt:0,0,.1);
  if(!t)return [];
  const old=state.phase;
  state.elapsed+=t;
  state.phase=custodyPhase(state.elapsed);
  const open=!["wake","sleep"].includes(state.phase);
  state.door=clamp(state.door+(open?1:-1)*t/1.1,0,1);
  const events=[];
  if(old!==state.phase){
    const captions={breakfast:"朝食だ。看守が居房を解錠した。一階の食堂へ移動しろ。",
      work:"作業の時間だ。中庭と作業場へ向かえ。",
      dinner:"夕食だ。一階の食堂に集合しろ。",
      return:"点呼だ。二階の居房へ戻れ。",
      sleep:"消灯だ。横になって休め。",
      wake:"朝の点呼だ。起きろ。"};
    events.push({type:"schedule",phase:state.phase,message:captions[state.phase]});
    for(const n of state.inmates){n.step=0;n.upperStart=n.y>1.45;}state.guard.step=0;state.guard.upperStart=state.guard.y>1.45;
  }
  const away=!["wake","return","sleep"].includes(state.phase);
  for(const [index,n] of state.inmates.entries()){
    let route;
    if(state.phase==="return"){
      route=waypointsFor(n,true);
    }else if(state.phase==="work"){
      route=!n.upperStart?[{x:-7+(index%2)*2,z:-1+index*.45,y:0}]:
        waypointsFor(n,false);
    }else if(state.phase==="breakfast"||state.phase==="dinner"){
      route=!n.upperStart?[{x:-2+(index%2)*1.4,z:1.5+Math.floor(index/2)*2,y:0}]:
        waypointsFor(n,false);
    }else continue;
    if(n.step>=route.length)continue;
    // Stagger departures, and never walk through a closed cell door.
    if(away&&(state.door<.88||sceneTime(state)<16+(n.cellX+8)*.3))continue;
    if(moveTo(n,route[n.step],t))n.step++;
  }
  const guardRoute=away&&!state.guard.upperStart?[{x:5.7,z:5.9,y:0}]:away?[pathToDining[1],pathToDining[2],pathToDining[3],pathToDining[4],pathToDining[5],{x:5.7,z:5.9,y:0}]:
   [{x:8.75,z:5.55,y:0},{x:8.75,z:-4.45,y:3.8},{x:6.4,z:-5.25,y:3.8},{x:1.25,z:-5.35,y:3.8}];
  if((away||state.phase==="return")&&state.guard.step<guardRoute.length&&(!away||state.door>.88))
   if(moveTo(state.guard,guardRoute[state.guard.step],t,1.7))state.guard.step++;
  state.elapsedSinceSave+=t;
  return events;
}
export function custodyFacilityInteract(state,action){
  const player=state.player;
  if(action==="eat"){
    if(player.y>1.2||dist(player,dinnerPoint)>5.4)
      return {ok:false,message:"食堂の席まで来てください。"};
    if(!["breakfast","dinner"].includes(state.phase))
      return {ok:false,message:"配膳の時間ではありません。"};
    state.mealCount++;
    return {ok:true,message:"🍞 パンと水をいただいた。食事を済ませた。"};
  }
  if(action==="rest"){
    if(!inCell(player)||dist(player,{x:-.8,z:-8.25})>1.85)
      return {ok:false,message:"自分の居房のベッドで休めます。"};
    state.rested=true;
    return {ok:true,message:"🛏️ ベッドに腰掛けて休み、体力を回復した。"};
  }
  if(action==="status"){
    return {ok:true,message:"拘置所 "+state.phase+"／"+Math.floor(state.elapsed/300+1)+"日目"+
      "。二階回廊から東側の階段で一階へ。食堂で食事、夜は居房へ。"};
  }
  return {ok:false,message:"操作できません。"};
}
