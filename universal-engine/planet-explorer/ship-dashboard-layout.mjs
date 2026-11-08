/** Player-customizable ship dashboard. Only whitelisted local actions are accepted.
 * The four physical switch positions are fixed; their assignments are configurable.
 */
export const DASHBOARD_ACTIONS=Object.freeze([
 Object.freeze({id:"scan",label:"📡 スキャン"}),
 Object.freeze({id:"weapon",label:"🎯 兵装切替"}),
 Object.freeze({id:"fire",label:"🔴 発射"}),
 Object.freeze({id:"hatch",label:"🚪 ハッチ"}),
 Object.freeze({id:"flare",label:"🔥 フレア"}),
 Object.freeze({id:"ciws",label:"🛡️ CIWS切替"}),
 Object.freeze({id:"auto",label:"🧭 自動航行"}),
 Object.freeze({id:"camera",label:"🎥 視点切替"}),
 Object.freeze({id:"wide",label:"⛶ 広画面"}),
 Object.freeze({id:"none",label:"— 非表示"})
]);
export const DEFAULT_DASHBOARD_SLOTS=Object.freeze(["scan","weapon","fire","hatch"]);
export const DEFAULT_SHIP_VIEW=Object.freeze({wide:true,fov:108,rightStick:true});
const ids=new Set(DASHBOARD_ACTIONS.map(action=>action.id));
const clamp=(n,minimum,maximum)=>Math.max(minimum,Math.min(maximum,n));
export function normalizeDashboardSlots(candidate){
 const a=Array.isArray(candidate)?candidate:[];
 return DEFAULT_DASHBOARD_SLOTS.map((fallback,i)=>typeof a[i]==="string"&&ids.has(a[i])?a[i]:fallback);
}
export function normalizeShipViewSettings(candidate){
 const value=candidate&&typeof candidate==="object"?candidate:{};
 return {
  wide:typeof value.wide==="boolean"?value.wide:DEFAULT_SHIP_VIEW.wide,
  fov:Number.isFinite(value.fov)?clamp(Math.round(value.fov),85,116):DEFAULT_SHIP_VIEW.fov,
  rightStick:typeof value.rightStick==="boolean"?value.rightStick:DEFAULT_SHIP_VIEW.rightStick
 };
}
/** Right-stick look is separate from ship yaw/pitch and thrust.
 * Up moves the camera up; in chase mode this becomes orbital elevation.
 */
export function shipCameraStickDelta(stick,dt){
 const x=Number.isFinite(stick?.x)?clamp(stick.x,-1,1):0;
 const y=Number.isFinite(stick?.y)?clamp(stick.y,-1,1):0;
 const strength=Math.min(1,Math.hypot(x,y));
 if(!Number.isFinite(dt)||dt<=0||strength<.12)return {yaw:0,pitch:0};
 const step=clamp(dt,0,.08);
 return {yaw:x===0?0:x*step*1.65,pitch:y===0?0:-y*step*1.20};
}
