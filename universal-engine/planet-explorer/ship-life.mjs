/** Small shipboard survival activities; integrates with character vitals in app. */
export const SHIP_FURNITURE=Object.freeze({
 bed:{name:"船室のベッド",icon:"🛏️",activity:"sleep"},
 chair:{name:"船室の椅子",icon:"🪑",activity:"sit"},
 table:{name:"船室の食卓",icon:"🍽️",activity:"eat"},
 bookshelf:{name:"船室の本棚",icon:"📚",activity:"read"}
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
  this.message="";
 }
 cast({water=false,aboard=false,inCabin=false}={}){
  if(!water&&!aboard)return {ok:false,message:"釣りは海辺または船の甲板から行います"};
  if(inCabin)return {ok:false,message:"船室から甲板へ出て釣り糸を垂らしてください"};
  if(this.casting)return {ok:false,message:"すでに釣りをしています"};
  this.casting=true;this.elapsed=0;this.hook=null;this.hookLeft=0;
  this.casts++;this.nextBite=6+Math.floor(hash(this.casts*5.2)*11);
  return {ok:true,message:"🎣 釣り糸を垂らしました。アタリを待ちましょう"};
 }
 advance(dt,seed=77){
  if(!Number.isFinite(dt)||dt<0)throw RangeError("Invalid fishing delta");
  if(!this.casting||dt===0)return null;
  const delta=Math.min(dt,.25);
  if(this.hook){
   this.hookLeft=Math.max(0,this.hookLeft-delta);
   if(this.hookLeft<=0){
    this.casting=false;this.hook=null;this.elapsed=0;
    return {kind:"lost",message:"🎣 アタリを逃しました。もう一度仕掛けを投げてください"};
   }
   return null;
  }
  this.elapsed+=delta;
  if(this.elapsed<this.nextBite)return null;
  const chance=hash(seed*23.37+this.casts*17.89);
  this.hook=kinds[Math.min(kinds.length-1,Math.floor(chance*kinds.length))];
  this.hookLeft=28;
  return {kind:"bite",species:this.hook,message:"🎣 アタリ！「引き上げる」で魚を釣り上げましょう"};
 }
 reel(inventory){
  if(!this.casting||!this.hook)return {ok:false,message:"まだアタリがありません"};
  if(!inventory||typeof inventory!=="object")return {ok:false,message:"魚を収納できる持ち物がありません"};
  const kind=this.hook,detail=FISH_CATALOG[kind];
  // The catch becomes normal food materials that can be used by ship's table.
  inventory.fish=(inventory.fish||0)+1;
  inventory[kind]=(inventory[kind]||0)+1;
  this.casting=false;this.hook=null;this.hookLeft=0;this.elapsed=0;
  this.caught++;
  return {ok:true,kind,weightKg:detail.weightKg,message:detail.icon+" "+detail.name+"を釣りました（約"+detail.weightKg+"kg）。魚×1を取得"};
 }
 stop(){
  if(!this.casting)return {ok:false,message:"釣りはしていません"};
  this.casting=false;this.hook=null;this.hookLeft=0;this.elapsed=0;
  return {ok:true,message:"🎣 仕掛けを回収して釣りを終えました"};
 }
 snapshot(){return {version:1,casting:this.casting,elapsed:this.elapsed,nextBite:this.nextBite,
  hook:this.hook,hookLeft:this.hookLeft,casts:this.casts,caught:this.caught};}
}
