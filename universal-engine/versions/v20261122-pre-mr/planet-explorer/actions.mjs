/**
 * A small, deterministic action loop for the 3D rig demo.
 * This is not combat or construction simulation for Frontier World.
 */
const COST={wood:4,stone:2};
export const ATTACK_VARIANTS=Object.freeze(["overhead","sweep","thrust","combo"]);
export function actionDuration(kind,variant="overhead"){
 if(kind==="sword")return variant==="combo"?1.42:.58;
 if(kind==="axe")return variant==="combo"?1.38:.78;
  if(kind==="saw")return 1.25;
 if(kind==="spear")return variant==="combo"?1.67:variant==="thrust"?.80:variant==="sweep"?1.00:1.12;
 if(kind==="greatsword")return variant==="combo"?2.15:variant==="thrust"?1.08:variant==="sweep"?1.38:1.47;
 return {mine:1.65,dig:1.12,fill:1.25,bow:1.62,guard:1.2,build:4.3}[kind]??0;
}
function distanceMeters(a,b,radius){
  const rad=Math.PI/180,dlat=(b.lat-a.lat)*rad,dlon=(b.lon-a.lon)*rad;
  const h=Math.sin(dlat/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(dlon/2)**2;
  return radius*2*Math.asin(Math.min(1,Math.sqrt(h)));
}
export class Actions {
  constructor() {
    this.resources={wood:12,stone:8,fiber:12,clay:8,metal:5,soil:0};
     this.worldHarvestEnabled=false; // legacy standalone action tests retain demo drops
    this.structures=[];
    this.active=null;
    this.completed=0;
    this.message="準備完了";
  }
  start(kind, controller, terrainSurface, variant="overhead") {
    if(!["sword","spear","greatsword","axe","saw","mine","dig","fill","bow","guard","build"].includes(kind))throw new RangeError("Unknown action: "+kind);
    if(this.active){this.message="動作が完了してから操作してください";return false;}
    if(controller.altitudeM>12.01 || controller.jumpY>.01) {
      this.message="地上に立ってから操作してください";return false;
    }
    // For weapon moves, old saves and direct tool buttons default to overhead.
    const move=ATTACK_VARIANTS.includes(variant)&&!(kind==="axe"&&variant==="thrust")?variant:"overhead";
    const duration=actionDuration(kind,move);
    let structureId=null;
    if(kind==="build") {
      if(this.resources.wood<COST.wood||this.resources.stone<COST.stone) {
        this.message="建築資源が不足しています（木4・石2）";return false;
      }
      const x=controller.x+Math.sin(controller.yaw)*6.5;
      const z=controller.z+Math.cos(controller.yaw)*6.5;
      const p=controller.locationAt(x,z);
      const surface=terrainSurface(p.lat,p.lon);
      if(surface.water||surface.river||Math.abs(surface.elevationM-terrainSurface(controller.lat,controller.lon).elevationM)>2.4){
        this.message="そこには建築できません（海・川・傾斜）";return false;
      }
      if(this.structures.some(s=>Number.isFinite(s.lat)&&Number.isFinite(s.lon)&&
         distanceMeters(p,s,controller.terrain.planet.radiusM)<8)){
        this.message="既存の建物に近すぎます";return false;
      }
      this.resources.wood-=COST.wood;this.resources.stone-=COST.stone;
      structureId=this.structures.length+1;
      this.structures.push({id:structureId,x,z,lat:p.lat,lon:p.lon,height:surface.elevationM,progress:0,kind:"hut"});
    }
    this.active={kind,time:0,duration,structureId,variant:move};
    this.message={sword:"剣で攻撃モーション",spear:"🔱 長槍で攻撃",greatsword:"⚔️ 両手剣で攻撃",axe:"斧で伐採",saw:"ノコギリで製材",mine:"つるはしで石を採掘",dig:"シャベルで掘削中",fill:"土を盛っています",bow:"弓を引いて矢を放つ",guard:"盾を構えて防御中",build:"作業小屋を建築中"}[kind];
    return true;
  }
  advance(dt) {
    if(!Number.isFinite(dt)||dt<0)throw new TypeError("Invalid action delta");
    if(!this.active)return null;
    const a=this.active;
    a.time=Math.min(a.duration,a.time+Math.min(dt,.25));
    const progress=a.time/a.duration;
    if(a.kind==="build"){
      const s=this.structures.find(s=>s.id===a.structureId);
      if(s)s.progress=progress;
    }
    if(progress<1)return null;
    const completed=a.kind;
    if(completed==="axe"&&!this.worldHarvestEnabled){this.resources.wood+=2;this.resources.fiber=(this.resources.fiber||0)+1;}
    if(completed==="mine"&&!this.worldHarvestEnabled){this.resources.stone+=2;this.resources.clay=(this.resources.clay||0)+1;this.resources.metal=(this.resources.metal||0)+1;}
    this.completed++;
    this.active=null;
    this.message={sword:"剣の振り終わり",spear:"長槍の攻撃完了",greatsword:"両手剣の攻撃完了",axe:"伐採終了",saw:"製材終了",mine:"採掘終了",dig:"掘削終了",fill:"盛り土終了",bow:"矢を放ちました",guard:"ガード解除",build:"作業小屋が完成"}[completed];
    return completed;
  }
  getAnimation() {
    return this.active?{action:["dig","fill"].includes(this.active.kind)?"mine":this.active.kind==="saw"?"axe":this.active.kind,progress:this.active.time/this.active.duration,variant:this.active.variant||"overhead"}:
      {action:"idle",progress:0};
  }
  snapshot() {
    return JSON.parse(JSON.stringify({format:"ue/explorer-actions",version:1,
      resources:this.resources,structures:this.structures,active:this.active,
      completed:this.completed,message:this.message}));
  }
  static fromSnapshot(data) {
    if(data?.format!=="ue/explorer-actions"||data.version!==1||
       !Array.isArray(data.structures)||!data.resources)throw Error("Unsupported action snapshot.");
    const x=new Actions();
    if(!["wood","stone"].every(k=>Number.isSafeInteger(data.resources[k])&&data.resources[k]>=0))throw Error("Invalid saved resources.");
    for(const s of data.structures){
      if(![s.x,s.z,s.height,s.progress,s.id,s.lat,s.lon].every(Number.isFinite)||s.progress<0||s.progress>1)throw Error("Invalid saved building.");
    }
    if(data.active && (!["sword","spear","greatsword","axe","saw","mine","dig","fill","bow","guard","build"].includes(data.active.kind)||
       ![data.active.time,data.active.duration].every(Number.isFinite)||
       data.active.time<0||data.active.duration<=0))throw Error("Invalid saved action.");
    x.resources={...x.resources,...data.resources};
    for(const k of ["fiber","clay","metal","soil"]){
      if(!Number.isSafeInteger(x.resources[k])||x.resources[k]<0)x.resources[k]=0;
    }
    x.structures=data.structures.map(s=>({...s}));
    x.active=data.active?{...data.active,
      variant:ATTACK_VARIANTS.includes(data.active.variant)?data.active.variant:"overhead"}:null;
    x.completed=data.completed||0;
    x.message=typeof data.message==="string"?data.message:"復元しました";
    return x;
  }
}