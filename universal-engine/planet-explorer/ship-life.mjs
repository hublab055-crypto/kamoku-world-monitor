/** Small shipboard survival activities; integrates with character vitals in app. */
export const SHIP_FURNITURE=Object.freeze({
 bed:{name:"船室のベッド",icon:"🛏️",activity:"sleep"},
 chair:{name:"船室の椅子",icon:"🪑",activity:"sit"},
 table:{name:"船室の食卓",icon:"🍽️",activity:"eat"},
 bookshelf:{name:"船室の本棚",icon:"📚",activity:"read"},
 kitchen:{name:"船室の調理台",icon:"🍳",activity:"cook"}
});
export const FISH_CATALOG=Object.freeze({
 aji:{name:"アジ",icon:"🐟",weightKg:.24},
 saba:{name:"サバ",icon:"🐟",weightKg:.65},
 tai:{name:"タイ",icon:"🐟",weightKg:2.1},
 sanma:{name:"サンマ",icon:"🐟",weightKg:.20},
 ika:{name:"イカ",icon:"🦑",weightKg:.35},
 maguro:{name:"マグロ",icon:"🐟",weightKg:20}
});
const kinds=Object.keys(FISH_CATALOG);
const hash=n=>{const x=Math.sin(n*12.9898+78.233)*43758.5453;return x-Math.floor(x);};
export class ShipFishing{
 constructor(saved=null){
  this.casting=Boolean(saved?.casting);
  this.elapsed=Number.isFinite(saved?.elapsed)?Math.max(0,Math.min(120,saved.elapsed)):0;
  this.nextBite=Number.isFinite(saved?.nextBite)?Math.max(3,Math.min(30,saved.nextBite)):9;
  this.hook=Object.hasOwn(FISH_CATALOG,saved?.hook)?saved.hook:null;
  this.hookLeft=Number.isFinite(saved?.hookLeft)?Math.max(0,Math.min(45,saved.hookLeft)):0;
  this.casts=Number.isSafeInteger(saved?.casts)?Math.min(1e9,Math.max(0,saved.casts)):0;
  this.caught=Number.isSafeInteger(saved?.caught)?Math.min(1e9,Math.max(0,saved.caught)):0;
  this.lastCatch=Object.hasOwn(FISH_CATALOG,saved?.lastCatch)?saved.lastCatch:null;
  this.history=Array.isArray(saved?.history)?saved.history.slice(-60)
   .filter(c=>Object.hasOwn(FISH_CATALOG,c?.kind)&&Number.isSafeInteger(c?.cast)&&c.cast>0)
   .map(c=>({kind:c.kind,cast:c.cast,weightKg:FISH_CATALOG[c.kind].weightKg})):[];
  this.power=Number.isFinite(saved?.power)?Math.max(.1,Math.min(1,saved.power)):.65;
  this.lineOutM=this.casting?(Number.isFinite(saved?.lineOutM)?Math.max(0,Math.min(32,saved.lineOutM)):15):0;
  this.reelTurns=Number.isFinite(saved?.reelTurns)?Math.max(0,saved.reelTurns):0;
  this.approach=Number.isFinite(saved?.approach)?Math.max(0,Math.min(1,saved.approach)):0;
  this.castMotion=Number.isFinite(saved?.castMotion)?Math.max(0,Math.min(1,saved.castMotion)):1;
  this.phase=this.casting?(this.hook?"hooked":"waiting"):"idle";
  this.message="";
 }
 cast({water=false,aboard=false,inCabin=false,power=.65}={}){
  if(!water&&!aboard)return {ok:false,message:"釣りは海辺または船の甲板から行います"};
  if(inCabin)return {ok:false,message:"船室から甲板へ出て釣り糸を垂らしてください"};
  if(this.casting)return {ok:false,message:"すでに釣りをしています"};
  this.casting=true;this.elapsed=0;this.hook=null;this.hookLeft=0;
  this.power=Math.max(.1,Math.min(1,Number.isFinite(power)?power:.65));
  this.lineOutM=3+this.power*26;this.approach=0;this.reelTurns=0;this.castMotion=0;
  this.phase="casting";
  this.casts++;this.nextBite=6+Math.floor(hash(this.casts*5.2)*11);
  return {ok:true,power:this.power,distanceM:this.lineOutM,
   message:"🎣 パワー "+Math.round(this.power*100)+"% で "+this.lineOutM.toFixed(1)+"m 投げました！"};
 }
 advance(dt,seed=77){
  if(!Number.isFinite(dt)||dt<0)throw RangeError("Invalid fishing delta");
  if(!this.casting||dt===0)return null;
  const delta=Math.min(dt,.25);
  this.castMotion=Math.min(1,this.castMotion+delta*2.25);
  if(this.phase==="casting"&&this.castMotion>=1)this.phase="waiting";
  if(this.hook){
   this.hookLeft=Math.max(0,this.hookLeft-delta);
   if(this.hookLeft<=0){
    this.casting=false;this.hook=null;this.elapsed=0;this.lineOutM=0;this.phase="idle";
    return {kind:"lost",message:"🎣 アタリを逃しました。もう一度仕掛けを投げてください"};
   }
   return null;
  }
  this.elapsed+=delta;
  this.approach=Math.min(1,this.elapsed/this.nextBite);
  if(this.elapsed<this.nextBite)return null;
  const chance=hash(seed*23.37+this.casts*17.89);
  this.hook=kinds[Math.min(kinds.length-1,Math.floor(chance*kinds.length))];
  this.hookLeft=28;this.phase="hooked";
  return {kind:"bite",species:this.hook,message:"🎣 ヒット！ ダイヤルを時計回りに回して巻き取ろう！"};
 }
 reel(inventory){
  if(!this.casting||!this.hook)return {ok:false,message:"まだアタリがありません"};
  if(!inventory||typeof inventory!=="object")return {ok:false,message:"魚を収納できる持ち物がありません"};
  const kind=this.hook,detail=FISH_CATALOG[kind];
  // The catch becomes normal food materials that can be used by ship's table.
  inventory.fish=(inventory.fish||0)+1;
  this.lastCatch=kind;
  this.casting=false;this.hook=null;this.hookLeft=0;this.elapsed=0;this.lineOutM=0;this.phase="idle";
  this.caught++;
  this.history.push({kind,cast:this.casts,weightKg:detail.weightKg});
  if(this.history.length>60)this.history.shift();
  return {ok:true,kind,weightKg:detail.weightKg,message:detail.icon+" "+detail.name+"を釣りました（約"+detail.weightKg+"kg）。魚×1を取得"};
 }
 /** Reel with a physical knob: positive clockwise radians pull in the line.
  * Can retrieve an empty line before any bite; rewards require a real hook. */
 turnReel(radians,inventory){
  if(!this.casting)return {ok:false,message:"仕掛けを投げてから巻き取ってください"};
  if(!Number.isFinite(radians))return {ok:false,message:"ダイヤル操作が不正です"};
  if(radians<=0)return {ok:true,kind:"hold",message:"時計回りに巻き取れます"};
  const turns=Math.min(radians/(2*Math.PI),2.5);
  this.reelTurns+=turns;
  this.lineOutM=Math.max(0,this.lineOutM-turns*4.2);
  if(this.hook&&this.lineOutM<=.8)return this.reel(inventory);
  if(!this.hook&&this.lineOutM<=.8){
   this.casting=false;this.elapsed=0;this.hookLeft=0;this.phase="idle";
   return {ok:true,kind:"empty",message:"🎣 アタリがないまま仕掛けを回収しました"};
  }
  this.phase=this.hook?"reeling":"waiting";
  return {ok:true,kind:"reeling",lineOutM:this.lineOutM,
   message:this.hook?"🐟 ヒット中！ 巻き取ってください":"🎣 仕掛けを巻き取っています"};
 }
 stop(){
  if(!this.casting)return {ok:false,message:"釣りはしていません"};
  this.casting=false;this.hook=null;this.hookLeft=0;this.elapsed=0;this.lineOutM=0;this.phase="idle";
  return {ok:true,message:"🎣 仕掛けを回収して釣りを終えました"};
 }
 snapshot(){return {version:1,casting:this.casting,elapsed:this.elapsed,nextBite:this.nextBite,
  hook:this.hook,hookLeft:this.hookLeft,casts:this.casts,caught:this.caught,lastCatch:this.lastCatch,
   history:this.history.map(c=>({...c})),power:this.power,lineOutM:this.lineOutM,
   reelTurns:this.reelTurns,approach:this.approach,castMotion:this.castMotion};}
}
