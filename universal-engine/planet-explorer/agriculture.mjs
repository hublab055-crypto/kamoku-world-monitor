/** Persistent manual agriculture and orchards; all positions are local metres.
 * The planet simulation clock (timeDays) is the only growth clock.
 */
export const CROPS=Object.freeze({
 wheat:{name:"小麦",icon:"🌾",days:6,harvest:{wheat:4,straw:5},seeds:2},
 carrot:{name:"ニンジン",icon:"🥕",days:4,harvest:{carrot:5},seeds:2},
 apple:{name:"リンゴの木",icon:"🍎",days:16,regrow:12,harvest:{apple:6},seeds:1}
});
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const fail=message=>({ok:false,message});
export class AgricultureWorld{
 constructor(saved=null){
  this.plots=[];
  this.seeds={wheat:4,carrot:4,apple:2};
  this.nextId=1;
  if(saved?.version===1&&Array.isArray(saved.plots)){
   this.plots=saved.plots.slice(0,200).filter(p=>
    Number.isFinite(p.x)&&Number.isFinite(p.z)&&
    ["field","orchard"].includes(p.kind)&&(!p.crop||Object.hasOwn(CROPS,p.crop))&&
    Number.isFinite(p.plantedAt)&&Number.isFinite(p.lastHarvest)&&
    typeof p.id==="string").map(p=>({...p,
     plantedAt:Math.max(0,p.plantedAt),lastHarvest:Math.max(0,p.lastHarvest),
     harvests:Math.max(0,Math.floor(p.harvests||0))}));
   for(const k of Object.keys(CROPS))
    if(Number.isSafeInteger(saved.seeds?.[k])&&saved.seeds[k]>=0)this.seeds[k]=saved.seeds[k];
   this.nextId=Math.max(1,...this.plots.map(p=>Number(p.id.replace(/^farm-/,""))||0))+1;
  }
 }
 closest(actor,radius=4.2){return this.plots.filter(p=>distance(actor,p)<=radius).sort((a,b)=>distance(actor,a)-distance(actor,b))[0]||null;}
 till(x,z,actor,canPlant=()=>true,day=0){
  if(!actor?.nearGround||actor?.mountRiding)return fail("地上で降馬してから土を耕してください");
  if(![x,z,day].every(Number.isFinite)||distance(actor,{x,z})>5)return fail("耕す場所は自分の5m以内に指定してください");
  if(!canPlant(x,z))return fail("水域・急斜面では耕作できません");
  if(this.plots.length>=200)return fail("耕作地が上限200区画に達しました");
  if(this.plots.some(p=>distance(p,{x,z})<(p.kind==="orchard"?5:3.2)))return fail("ほかの畑・果樹から少し離してください");
  const plot={id:"farm-"+this.nextId++,kind:"field",x,z,crop:null,plantedAt:Math.max(0,day),lastHarvest:0,harvests:0};
  this.plots.push(plot);
  return {ok:true,plot,message:"🪏 土を耕して畑を1区画つくりました。種まきができます"};
 }
 sow(plotId,kind,actor,day){
  const plot=this.plots.find(p=>p.id===plotId),spec=CROPS[kind];
  if(!plot||!spec)return fail("畑または作物が見つかりません");
  if(!actor?.nearGround||actor?.mountRiding||distance(plot,actor)>4.2)return fail("降馬して畑の4.2m以内へ近づいてください");
  if(plot.crop)return fail("この区画には既に作物が育っています");
  if((this.seeds[kind]||0)<1)return fail(spec.name+"の種がありません。収穫物から採種してください");
  if(kind==="apple"){
   if(this.plots.some(p=>p.id!==plot.id&&distance(p,plot)<5))return fail("果樹は周囲5mの間隔が必要です");
   plot.kind="orchard";
  }
  this.seeds[kind]--;plot.crop=kind;plot.plantedAt=Math.max(0,day);plot.lastHarvest=0;plot.harvests=0;
  return {ok:true,plot,message:spec.icon+" "+spec.name+"の種をまきました（生育目安："+spec.days+"日）"};
 }
 growth(plot,day){
  if(!plot?.crop)return 0;
  const spec=CROPS[plot.crop],since=plot.kind==="orchard"&&plot.harvests>0?plot.lastHarvest:plot.plantedAt;
  const days=plot.kind==="orchard"&&plot.harvests>0?spec.regrow:spec.days;
  return clamp((Math.max(0,day)-since)/days,0,1);
 }
 harvest(plotId,actor,day,resources){
  const plot=this.plots.find(p=>p.id===plotId);
  if(!plot?.crop)return fail("この畑に収穫できる作物はありません");
  if(!actor?.nearGround||actor?.mountRiding||distance(plot,actor)>4.2)return fail("降馬して畑の近くで収穫してください");
  if(this.growth(plot,day)<1)return fail("まだ収穫期ではありません（生育 "+Math.round(this.growth(plot,day)*100)+"%）");
  if(!resources)return fail("収穫用の持ち物がありません");
  const kind=plot.crop,spec=CROPS[kind];
  for(const [name,qty] of Object.entries(spec.harvest))resources[name]=(resources[name]||0)+qty;
  this.seeds[kind]+=spec.seeds;
  plot.harvests++;
  if(plot.kind==="orchard")plot.lastHarvest=Math.max(plot.lastHarvest,day);
  else {plot.crop=null;plot.kind="field";}
  return {ok:true,plot,drops:{...spec.harvest},message:spec.icon+" "+spec.name+"を収穫。"+
   Object.entries(spec.harvest).map(([k,n])=>k+"×"+n).join("、")+" ／ 種+"+spec.seeds};
 }
 snapshot(){return {version:1,plots:this.plots.map(p=>({...p})),seeds:{...this.seeds}};}
}
