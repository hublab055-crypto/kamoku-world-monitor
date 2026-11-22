/**
 * Surface height edits on a spherical world.  Brush stamps store only deltas,
 * in planet geographic coordinates, so they survive travel and save/load.
 * Height-field editing supports pits, trenches and fill, not caves/overhangs.
 */
const DEG=Math.PI/180;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export class Earthworks {
 constructor(saved=null){
  this.stamps=[];
  if(saved){
   if(saved.version!==1||!Array.isArray(saved.stamps)||saved.stamps.length>400)throw Error("地形データが不正です");
   for(const a of saved.stamps){
    if(!Array.isArray(a)||a.length!==4||!a.every(Number.isFinite)||Math.abs(a[0])>90||
      Math.abs(a[1])>180||a[2]<4||a[2]>30||Math.abs(a[3])>3)
      throw Error("地形編集値が不正です");
    this.stamps.push([...a]);
   }
  }
 }
 deltaAt(lat,lon){
  let out=0;
  for(const [a,b,r,depth] of this.stamps){
   const north=(lat-a)*111195;
   let dlon=lon-b; if(dlon>180)dlon-=360;else if(dlon< -180)dlon+=360;
   const east=dlon*111195*Math.cos(a*DEG);
   const q=(north*north+east*east)/(r*r);
   if(q<1){const t=1-q;out+=depth*t*t;}
  }
  return clamp(out,-36,20);
 }
 change(lat,lon,mode="dig",radius=14){
  if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)
   return {ok:false,message:"地形座標が不正です"};
  if(this.stamps.length>=400)return {ok:false,message:"このセーブでの地形編集上限に達しました"};
  if(!["dig","fill"].includes(mode)||!Number.isFinite(radius)||radius<4||radius>30)
   return {ok:false,message:"掘削条件が不正です"};
  const at=this.deltaAt(lat,lon),depth=mode==="dig"?-1.5:1;
  if(mode==="dig"&&at<=-35)return {ok:false,message:"これ以上掘れません"};
  if(mode==="fill"&&at>=19)return {ok:false,message:"これ以上盛れません"};
  this.stamps.push([lat,lon,radius,depth]);
  return {ok:true,message:mode==="dig"?"⛏️ 地面を掘り、土を回収しました":"🧱 土を盛りました",
   material:mode==="dig"?{soil:2}:{soil:-1},heightChangeM:depth};
 }
 snapshot(){return {version:1,stamps:this.stamps.map(a=>[...a])};}
}
