/**
 * User-editable Quest 3S controller profile. Independent of WebXR / DOM.
 * Keep physical button identity stable; only semantic commands are remapped.
 */
export const XR_BINDINGS_STORAGE_KEY="universal-engine:quest3s:controls:v1";
export const XR_STICK_LAYOUTS=Object.freeze({
 leftMove:"左スティック＝歩行、右スティック＝旋回（標準）",
 rightMove:"右スティック＝歩行、左スティック＝旋回"
});
export const XR_CONTROL_ACTIONS=Object.freeze({
 none:"割り当てなし",
 interact:"決定・近くの物を操作（船内では着席／ハッチ、戦闘中は兵装切替）",
 jump:"ジャンプ（地表）",
 deck:"行動スロット切替",
 rts:"VR卓上RTS切替",
 camera:"一人称／三人称切替",
 planet:"惑星ビュー切替",
 selectAll:"RTS：味方全選択",
 sync:"RTS：シンクロ切替",
 shipWeapon:"船の兵装切替",
 useLeft:"左手の装備を使用",
 useRight:"右手の装備を使用",
 gripLeft:"左手で掴む（物理動作）",
 gripRight:"右手で掴む（物理動作）",
 guard:"防御",
 shoot:"射撃"
});
export const XR_CONTROL_SOURCES=Object.freeze([
 {key:"left:4",label:"X（左）"},
 {key:"left:5",label:"Y（左）"},
 {key:"right:4",label:"A（右）"},
 {key:"right:5",label:"B（右）"},
 {key:"left:3",label:"左スティック押込"},
 {key:"right:3",label:"右スティック押込"},
 {key:"left:trigger",label:"左トリガー"},
 {key:"right:trigger",label:"右トリガー"},
 {key:"left:grip",label:"左グリップ"},
 {key:"right:grip",label:"右グリップ"}
]);
const DEFAULT_BUTTONS=Object.freeze({
 "left:4":"interact","left:5":"deck",
 "right:4":"rts","right:5":"camera",
 "left:3":"planet","right:3":"selectAll",
 "left:trigger":"useLeft","right:trigger":"useRight",
 "left:grip":"gripLeft","right:grip":"gripRight"
});
export const defaultXRBindings=()=>({
 stickLayout:"leftMove",buttonActions:{...DEFAULT_BUTTONS}
});
export function normalizeXRBindings(value){
 const result=defaultXRBindings();
 if(value?.stickLayout==="rightMove")result.stickLayout="rightMove";
 for(const key of Object.keys(DEFAULT_BUTTONS)){
  const action=value?.buttonActions?.[key];
  if(typeof action==="string"&&Object.hasOwn(XR_CONTROL_ACTIONS,action))
   result.buttonActions[key]=action;
 }
 return result;
}
export function xrBoundAction(bindings,key){
 return bindings?.buttonActions?.[key]??DEFAULT_BUTTONS[key]??"none";
}
export function loadXRBindings(storage){
 try{return normalizeXRBindings(JSON.parse(storage?.getItem(XR_BINDINGS_STORAGE_KEY)||"null"));}
 catch(_){return defaultXRBindings();}
}
export function saveXRBindings(storage,bindings){
 const clean=normalizeXRBindings(bindings);
 try{storage?.setItem(XR_BINDINGS_STORAGE_KEY,JSON.stringify(clean));return true;}
 catch(_){return false;}
}
