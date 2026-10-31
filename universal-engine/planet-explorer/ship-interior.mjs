/** Local ship coordinates: forward -Z; floor Y=0; dimensions 8m x 26m. */
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const valid=v=>Number.isFinite(v);
export const SHIP_CREW=Object.freeze([
 {id:"navigator",name:"航法士",role:"航法・通信",x:-2.3,z:-10.8},
 {id:"engineer",name:"機関士",role:"機関・整備",x:1.6,z:7.2},
 {id:"companion",name:"同行者",role:"探索・支援",x:-2.5,z:3.0}
]);
export const SHIP_STATIONS=Object.freeze([
 {id:"helm",name:"操縦席",x:0,z:-11.7,radius:2.3},
 {id:"navigation",name:"航法コンソール",x:-2.3,z:-10.6,radius:1.8},
 {id:"cargo",name:"船倉マニフェスト",x:0,z:10.2,radius:2.9},
 {id:"engine",name:"エンジン監視盤",x:2.8,z:10.8,radius:1.7},
 {id:"hatch",name:"船尾ハッチ",x:0,z:12.0,radius:3.0}
]);
const blockers=[
 {x1:-3.95,x2:-2.95,z1:-12.6,z2:-9.1}, // pilot navigation consoles
 {x1:2.95,x2:3.95,z1:-12.6,z2:-9.1},
 {x1:-3.95,x2:-2.35,z1:5,z2:11.0}, // cargo storage banks
 {x1:2.35,x2:3.95,z1:5,z2:11.0},
 {x1:-1.0,x2:1.0,z1:-12.9,z2:-11.1}, // helm console
 {x1:1.18,x2:2.08,z1:10.9,z2:12.2}
];
export class ShipInterior{
 constructor(data={}){
  this.x=valid(data.x)?clamp(data.x,-3.45,3.45):0;
  this.z=valid(data.z)?clamp(data.z,-12.4,12.4):-8.2;
  this.yaw=valid(data.yaw)?data.yaw:0;
  this.pitch=valid(data.pitch)?clamp(data.pitch,-.8,.8):0;
  this.mode=["interior","cockpit"].includes(data.mode)?data.mode:"interior";
  this.lastCrewId=typeof data.lastCrewId==="string"?data.lastCrewId:null;
  this.seated=Boolean(data.seated);
  this.suitOn=Boolean(data.suitOn);
  if(!this.canOccupy(this.x,this.z)){this.x=0;this.z=-8.2;}
 }
 canOccupy(x,z){
  if(!valid(x)||!valid(z)||Math.abs(x)>3.48||z< -12.75||z>12.7)return false;
  const r=.27;
  return !blockers.some(b=>x+r>b.x1&&x-r<b.x2&&z+r>b.z1&&z-r<b.z2);
 }
 walk(forward=0,sideways=0,dt=1){
  if(this.seated||!valid(forward)||!valid(sideways)||!valid(dt)||dt<=0)return false;
  const magnitude=Math.hypot(forward,sideways);
  if(magnitude===0)return false;
  const speed=2.6*Math.min(dt,.16)/Math.max(1,magnitude);
  // Player forward points toward -Z at yaw=0.
  const dx=(Math.sin(this.yaw)*forward+Math.cos(this.yaw)*sideways)*speed;
  const dz=(-Math.cos(this.yaw)*forward+Math.sin(this.yaw)*sideways)*speed;
  let moved=false;
  if(this.canOccupy(this.x+dx,this.z)){this.x+=dx;moved=true;}
  if(this.canOccupy(this.x,this.z+dz)){this.z+=dz;moved=true;}
  return moved;
 }
 turn(dx,dy=0){
  if(!valid(dx)||!valid(dy))return;
  this.yaw=((this.yaw+dx+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI;
  this.pitch=clamp(this.pitch+dy,-.78,.78);
 }
 distance(point){return Math.hypot(this.x-point.x,this.z-point.z);}
 get nearHatch(){return Math.hypot(this.x,this.z-11.55)<2.0;}
 get nearHelm(){return Math.hypot(this.x,this.z+10.65)<2.7;}
 sit(){
  if(this.seated)return {ok:false,message:"すでに操縦席に着席中です"};
  if(!this.nearHelm)return {ok:false,message:"操縦席の前まで歩いてください"};
  this.seated=true;this.x=0;this.z=-10.45;this.yaw=0;this.pitch=0;this.mode="interior";
  return {ok:true,message:"🪑 操縦席に着席しました。航行操作が使用できます"};
 }
 stand(){
  if(!this.seated)return {ok:false,message:"操縦席に座っていません"};
  this.seated=false;this.x=0;this.z=-10.20;this.mode="interior";
  return {ok:true,message:"🚶 操縦席から立ち上がりました"};
 }
 nearCrew(radius=2.6){return SHIP_CREW.filter(c=>this.distance(c)<=radius).sort((a,b)=>this.distance(a)-this.distance(b));}
 nearStations(radius=2.8){return SHIP_STATIONS.filter(c=>this.distance(c)<=Math.min(radius,c.radius)).sort((a,b)=>this.distance(a)-this.distance(b));}
 talk(id,voyage){
  const crew=SHIP_CREW.find(c=>c.id===id);
  if(!crew)return {ok:false,message:"乗員が見つかりません"};
  if(this.distance(crew)>2.6)return {ok:false,message:crew.name+"には近づいてから話しかけてください"};
  this.lastCrewId=crew.id;
  const status=voyage?.status;
  const responses={
   navigator:status==="orbit"?"目的天体の周回軌道に入りました。操縦席から着陸できます。":
    status==="preflight"?"航路を確認しました。操縦席から離陸できます。":
    "目的地への航路は順調です。進路がずれたら自動航行を使ってください。",
   engineer:voyage?.fuel<18?"推進剤が少なくなっています。補給設備は今後の実装予定です。":
    "推進系は正常です。燃料は現在"+Math.round(voyage?.fuel??100)+"%。船倉の積荷も確認してください。",
   companion:status==="orbit"?"着陸後は現地を探索しましょう。":
    "船内の移動ができるようになりましたね。窓から見える星が少しずつ動いています。"
  };
  return {ok:true,name:crew.name,message:responses[crew.id]};
 }
 snapshot(){return {schemaVersion:1,x:this.x,z:this.z,yaw:this.yaw,pitch:this.pitch,mode:this.mode,lastCrewId:this.lastCrewId,seated:this.seated,suitOn:this.suitOn};}
 static fromSnapshot(data){return new ShipInterior(data?.schemaVersion===1?data:{});}
}
