/** Smartphone action profile and camera-relative movement, independent of DOM. */
export const MOBILE_ACTIONS=Object.freeze({
  interact:{icon:"✋",label:"調べる・操作"},
  attack:{icon:"⚔️",label:"攻撃・右手装備"},
  jump:{icon:"⬆️",label:"ジャンプ"},
  inventory:{icon:"🎒",label:"持ち物"},
  talk:{icon:"💬",label:"会話"},
  guard:{icon:"🛡️",label:"ガード"},
  shoot:{icon:"🏹",label:"射撃"},
  heal:{icon:"🧪",label:"回復薬"},
  mine:{icon:"⛏️",label:"採掘"},
  chop:{icon:"🪓",label:"伐採"},
  craft:{icon:"🔨",label:"クラフト"},
  map:{icon:"🗺️",label:"地図"},
  rts:{icon:"⚓",label:"RTS切替"},
  camera:{icon:"◉",label:"視点切替"},
  menu:{icon:"☰",label:"操作メニュー"},
  equipment:{icon:"⚙️",label:"装備設定"},
  leftHand:{icon:"🫲",label:"左手装備"},
  settings:{icon:"🎮",label:"スマホUI設定"},
  logs:{icon:"▤",label:"ログ"},
  vehicleExit:{icon:"🚶",label:"降車・下船"},
  cruise:{icon:"🧭",label:"巡航切替"},
  anchor:{icon:"⚓",label:"錨の上げ下げ"},
  sailsUp:{icon:"⛵",label:"帆を広げる"},
  sailsDown:{icon:"🛑",label:"帆を絞る"},
  gait:{icon:"🐎",label:"歩法切替"},
  vehiclePanel:{icon:"🎛️",label:"乗り物の操作盤"},
  takeHelm:{icon:"🛞",label:"舵輪を操作"},
  sit:{icon:"🪑",label:"操縦席に座る"},
  stand:{icon:"🚶",label:"操縦席から立つ"},
  hatch:{icon:"🚪",label:"ハッチ開閉"},
  disembark:{icon:"🌍",label:"地表へ降りる"},
  cargo:{icon:"📦",label:"船倉・貨物"},
  launchLand:{icon:"🚀",label:"離陸・着陸"},
  autopilot:{icon:"🤖",label:"自動操縦切替"},
  navigation:{icon:"🪐",label:"航路設定"},
  transfer:{icon:"🛰️",label:"惑星間航行開始"},
  throttleUp:{icon:"➕",label:"出力を上げる"},
  throttleDown:{icon:"➖",label:"出力を下げる"},
  shipSettings:{icon:"🎮",label:"宇宙船UI設定"},
  saveVoyage:{icon:"💾",label:"宇宙船の状態を保存"},
  landingGear:{icon:"🛬",label:"ランディングギア切替"},
  attitudeMode:{icon:"↔️",label:"ヨー／ロール操作切替"},
  none:{icon:"－",label:"割り当てなし"}
});
export const MOBILE_LAYERS=Object.freeze({
  legacy:"従来の道具・ジャンプボタン",
  decks:"5つの行動デッキ",
  commands:"行動コマンドバー",
  rts:"RTS指揮ボタン",
  doors:"ドア操作ボタン",
  archery:"弓の詳細操作",
  vitals:"ステータス・持ち物表示",
  shortcuts:"ログ・QRショートカット"
});
const DEFAULT_BUTTONS={
  walk:[{tap:"interact",hold:"talk"},{tap:"attack",hold:"guard"},
        {tap:"jump",hold:"camera"},{tap:"inventory",hold:"menu"}],
  rts:[{tap:"rts",hold:"camera"},{tap:"attack",hold:"shoot"},
       {tap:"map",hold:"inventory"},{tap:"menu",hold:"settings"}],
  ride:[{tap:"gait",hold:"vehiclePanel"},{tap:"attack",hold:"guard"},
        {tap:"map",hold:"camera"},{tap:"vehicleExit",hold:"inventory"}],
  boat:[{tap:"cruise",hold:"sailsUp"},{tap:"anchor",hold:"sailsDown"},
        {tap:"takeHelm",hold:"vehiclePanel"},{tap:"vehicleExit",hold:"camera"}],
  passenger:[{tap:"interact",hold:"talk"},{tap:"map",hold:"camera"},
        {tap:"inventory",hold:"menu"},{tap:"vehicleExit",hold:"vehiclePanel"}],
  shipInterior:[{tap:"interact",hold:"talk"},{tap:"hatch",hold:"disembark"},
        {tap:"cargo",hold:"inventory"},{tap:"navigation",hold:"saveVoyage"}],
  shipCockpit:[{tap:"launchLand",hold:"landingGear"},{tap:"autopilot",hold:"attitudeMode"},
        {tap:"navigation",hold:"transfer"},{tap:"stand",hold:"saveVoyage"}]
};
export function defaultMobileConfig(){
  return {version:1,profiles:JSON.parse(JSON.stringify(DEFAULT_BUTTONS)),
    layers:Object.fromEntries(Object.keys(MOBILE_LAYERS).map(key=>[key,false]))};
}
export function normalizeMobileConfig(raw){
  const result=defaultMobileConfig();
  if(!raw||raw.version!==1)return result;
  for(const mode of Object.keys(DEFAULT_BUTTONS)){
    const entries=raw.profiles?.[mode];
    if(!Array.isArray(entries))continue;
    for(let i=0;i<4;i++){
      const slot=entries[i]||{};
      for(const action of ["tap","hold"]){
        if(Object.hasOwn(MOBILE_ACTIONS,slot[action]))result.profiles[mode][i][action]=slot[action];
      }
    }
  }
  for(const key of Object.keys(MOBILE_LAYERS))result.layers[key]=raw.layers?.[key]===true;
  return result;
}
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const angleDifference=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
/** x to screen-right, y to screen-bottom. Camera yaw is frozen on touch start.
 * Return movement components relative to the avatar yaw *after* the turn.
 * Thus movement immediately tracks the stick while the avatar rotates smoothly.
 */
export function resolveMobileFacing(stick,avatarYaw,cameraStartYaw,dt,{deadzone=.12,turnRate=9}={}){
  const x=clamp(Number(stick?.x)||0,-1,1),y=clamp(Number(stick?.y)||0,-1,1);
  const magnitude=clamp(Math.hypot(x,y),0,1);
  if(magnitude<=deadzone||![avatarYaw,cameraStartYaw,dt].every(Number.isFinite))
    return {active:false,turn:0,forward:0,strafe:0};
  const desiredYaw=cameraStartYaw+Math.atan2(x,-y);
  const delta=angleDifference(desiredYaw,avatarYaw);
  const turn=clamp(delta,-Math.max(0,dt)*turnRate,Math.max(0,dt)*turnRate);
  const remaining=angleDifference(desiredYaw,avatarYaw+turn);
  return {active:true,turn,forward:magnitude*Math.cos(remaining),
    strafe:magnitude*Math.sin(remaining),desiredYaw};
}
