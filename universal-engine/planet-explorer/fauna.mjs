/** Wild ancestors and tamable animals for Planet Explorer. All coordinates are local metres. */
export const WILD_SPECIES=Object.freeze({
 horse:{name:"野生馬",ancestor:"野生馬（初期の馬の系統）",icon:"🐎",gait:7.5},
 cattle:{name:"オーロックス",ancestor:"ウシの野生祖先",icon:"🐂"},
 sheep:{name:"ムフロン",ancestor:"ヒツジに近縁な野生種",icon:"🐏"},
 goat:{name:"ベゾアールヤギ",ancestor:"家畜ヤギの野生祖先",icon:"🐐"},
 chicken:{name:"セキショクヤケイ",ancestor:"ニワトリの主要な野生祖先",icon:"🐓"},
 dog:{name:"オオカミ",ancestor:"イヌの野生祖先",icon:"🐺"},
 cat:{name:"リビアヤマネコ",ancestor:"ネコの野生祖先",icon:"🐈"}
});
export const HORSE_GAITS=Object.freeze({walk:7.5,trot:10.5,gallop:14.5});
export const TACK=Object.freeze({
 bit:{name:"ハミ",cost:{metal:1}},reins:{name:"手綱",cost:{fiber:2}},
 saddle:{name:"クラ",cost:{wood:2,fiber:2}},horseshoes:{name:"蹄鉄",cost:{metal:2}}
});
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const initial=()=>[
 ["horse",16,13],["horse",49,-30],["horse",-45,62],
 ["cattle",-32,-37],["cattle",-59,-25],["sheep",-15,76],["sheep",-4,88],
 ["goat",-67,29],["goat",-76,35],["chicken",30,-35],["chicken",36,-39],
 ["dog",82,-57],["cat",29,55]
].map(([kind,x,z],i)=>({id:"fauna-"+(i+1),kind,x,z,homeX:x,homeZ:z,yaw:(i*2.4)%6.28,
 tame:false,trust:0,following:false,stamina:100,gear:{bit:false,reins:false,saddle:false,horseshoes:false}}));
export class FaunaWorld {
 constructor(saved=null){
  this.animals=initial();this.selectedId=null;this.mountId=null;this.gait="trot";this.elapsed=0;
  if(saved?.version===1&&Array.isArray(saved.animals)){
   for(const source of saved.animals){
    const dest=this.animals.find(a=>a.id===source.id&&a.kind===source.kind);
    if(!dest)continue;
    for(const key of ["x","z","yaw","stamina","trust"])
     if(Number.isFinite(source[key]))dest[key]=key==="stamina"?clamp(source[key],0,100):source[key];
    dest.tame=Boolean(source.tame);dest.following=Boolean(source.following&&dest.tame);
    if(dest.kind==="horse")for(const key of Object.keys(TACK))dest.gear[key]=Boolean(source.gear?.[key]);
   }
   this.mountId=this.animals.some(a=>a.id===saved.mountId&&a.kind==="horse"&&a.tame)?saved.mountId:null;
   this.gait=Object.hasOwn(HORSE_GAITS,saved.gait)?saved.gait:"trot";
  }
 }
 get(id){return this.animals.find(a=>a.id===id)||null;}
 get selected(){return this.get(this.selectedId);}
 get mount(){return this.get(this.mountId);}
 select(id){if(!this.get(id))return false;this.selectedId=id;return true;}
 range(animal,actor){return Math.hypot(animal.x-actor.x,animal.z-actor.z);}
 tame(id,actor){
  const a=this.get(id);
  if(!a)return {ok:false,message:"動物が見つかりません"};
  if(this.range(a,actor)>3.6)return {ok:false,message:"動物から3.6m以内へ近づいてください"};
  if(a.tame)return {ok:true,message:WILD_SPECIES[a.kind].name+"はすでに人になれています"};
  if(a.kind!=="horse")return {ok:false,message:"この動物の家畜化・飼育は次期拡張です"};
  a.trust=Math.min(3,a.trust+1);
  if(a.trust>=3){a.tame=true;a.following=true;return {ok:true,message:"🐎 野生馬がなつきました。呼ぶ・馬具装備が使えます"};}
  return {ok:true,message:"🐎 馬との信頼 "+a.trust+"/3。もう一度『なつかせる』を試してください"};
 }
 equip(id,part,actor,resources){
  const a=this.get(id),spec=TACK[part];
  if(!a||a.kind!=="horse"||!a.tame)return {ok:false,message:"飼いならした馬を選択してください"};
  if(!spec)return {ok:false,message:"不明な馬具です"};
  if(this.range(a,actor)>4)return {ok:false,message:"馬の近くで装備してください（4m以内）"};
  if(a.gear[part])return {ok:true,message:spec.name+"は装備済みです"};
  if(!resources||Object.entries(spec.cost).some(([k,v])=>(resources[k]||0)<v))
   return {ok:false,message:spec.name+"の材料が足りません（"+Object.entries(spec.cost).map(([k,v])=>k+"×"+v).join("・")+"）"};
  for(const [k,v]of Object.entries(spec.cost))resources[k]-=v;
  a.gear[part]=true;
  return {ok:true,message:"🐎 "+spec.name+"を装備しました"};
 }
 canMount(a){return Boolean(a&&a.kind==="horse"&&a.tame&&a.gear.bit&&a.gear.reins&&a.gear.saddle);}
 board(id,actor){
  const a=this.get(id);
  if(this.mountId)return {ok:false,message:"先に降馬してください"};
  if(!this.canMount(a))return {ok:false,message:"騎乗には馴致とハミ・手綱・クラが必要です"};
  if(this.range(a,actor)>3.5)return {ok:false,message:"馬の3.5m以内へ近づいてください"};
  if(actor.altitudeM>12.01||actor.jumpY>.01)return {ok:false,message:"地上に立ってから騎乗してください"};
  actor.clearMoveTarget?.();
  const location=actor.locationAt?.(a.x,a.z);
  actor.x=a.x;actor.z=a.z;
  if(location){actor.lat=location.lat;actor.lon=location.lon;}
  this.mountId=a.id;a.following=false;
  a.yaw=actor.yaw;
  return {ok:true,message:"🐎 騎乗しました。剣・槍・弓を使用できます"};
 }
 dismount(actor,canStand=()=>true){
  const a=this.mount;if(!a)return {ok:false,message:"騎乗していません"};
  // Verify that the ground beside the horse is traversable; never dismount into water or a wall.
  const dx=Math.cos(actor.yaw)*2.1,dz=-Math.sin(actor.yaw)*2.1;
  if(!canStand(actor.x+dx,actor.z+dz))return {ok:false,message:"降りる場所が危険です。平坦な場所へ移動してください"};
  a.x=actor.x;a.z=actor.z;a.yaw=actor.yaw;this.mountId=null;
  // Dismount the rider to the side rather than leaving the avatar inside the horse mesh.
  const sideX=actor.x+dx,sideZ=actor.z+dz;
  const location=actor.locationAt?.(sideX,sideZ);
  actor.x=sideX;actor.z=sideZ;
  if(location){actor.lat=location.lat;actor.lon=location.lon;}
  actor.clearMoveTarget?.();
  a.following=false;
  return {ok:true,message:"🐎 降馬しました"};
 }
 call(id,actor){
  const a=this.get(id);
  if(!a||!a.tame)return {ok:false,message:"飼いならした動物のみ呼べます"};
  if(this.mountId===id)return {ok:false,message:"現在騎乗中です"};
  a.following=true;
  return {ok:true,message:"📯 "+WILD_SPECIES[a.kind].name+"を呼びました"};
 }
 setGait(gait){
  if(!Object.hasOwn(HORSE_GAITS,gait))return false;
  this.gait=gait;return true;
 }
 speed(){
  if(!this.mount)return 5;
  const tired=this.mount.stamina<12;
  return tired?HORSE_GAITS.walk:HORSE_GAITS[this.gait];
 }
 advance(dt,actor,passable=()=>true){
  dt=clamp(dt,0,.1);this.elapsed+=dt;
  const ridden=this.mount;
  if(ridden){
   ridden.x=actor.x;ridden.z=actor.z;ridden.yaw=actor.yaw;
   const fatigue={walk:.06,trot:.20,gallop:.58}[this.gait];
   ridden.stamina=clamp(ridden.stamina+(actor.moving?-fatigue*(ridden.gear.horseshoes?.86:1):.38)*dt,0,100);
  }
  for(let i=0;i<this.animals.length;i++){
   const a=this.animals[i];if(a===ridden)continue;
   const dx=actor.x-a.x,dz=actor.z-a.z,distance=Math.hypot(dx,dz);
   if(a.following&&a.tame&&distance>3.3){
    const speed=a.kind==="horse"?6.8:3.1;
    this.step(a,dx,dz,Math.min(speed*dt,Math.max(0,distance-2.8)),passable);
   }else if(!a.following&&!a.tame&&Math.hypot(a.x-a.homeX,a.z-a.homeZ)<13){
    // Slow, bounded grazing/foraging; stationary when the player is far away.
    if(distance<230){
     const angle=this.elapsed*.24+i*2.39;
     this.step(a,Math.sin(angle),Math.cos(angle),dt*(a.kind==="chicken"?.17:.32),passable);
    }
   }
   if(!actor.moving)a.stamina=clamp(a.stamina+.13*dt,0,100);
  }
 }
 step(a,dx,dz,distance,passable){
  const length=Math.hypot(dx,dz)||1;
  const x=a.x+dx/length*distance,z=a.z+dz/length*distance;
  if(passable(a.x,a.z,x,z)){
   a.x=x;a.z=z;a.yaw=Math.atan2(dx,dz);
  }
 }
 snapshot(){
  return {version:1,mountId:this.mountId,gait:this.gait,
   animals:this.animals.map(a=>({id:a.id,kind:a.kind,x:a.x,z:a.z,yaw:a.yaw,stamina:a.stamina,trust:a.trust,
    tame:a.tame,following:a.following,gear:{...a.gear}}))};
 }
}