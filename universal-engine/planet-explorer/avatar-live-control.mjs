/** Bounded player-only morphs; untouched crew meshes and wardrobe gates are preserved. */
import {normalizeAvatarRoster} from "./avatar-v10.mjs";
export const LIVE_AVATAR_FIELDS=Object.freeze([
 {key:"eyeSize",label:"目",min:76,max:126},
 {key:"browSize",label:"眉",min:76,max:126},
 {key:"mouthSize",label:"口",min:76,max:126},
 {key:"torsoWidth",label:"胴体",min:80,max:120},
 {key:"legLength",label:"脚",min:80,max:120}
]);
export function liveAvatarValue(roster,key){
 const spec=LIVE_AVATAR_FIELDS.find(item=>item.key===key);
 if(!spec)return null;
 const n=Number(roster?.player?.appearance?.[key]);
 return Number.isFinite(n)?Math.max(spec.min,Math.min(spec.max,n)):100;
}
export function setLiveAvatarValue(roster,key,value){
 const spec=LIVE_AVATAR_FIELDS.find(item=>item.key===key);
 if(!spec||value===null||value===""||!Number.isFinite(Number(value)))return null;
 const n=Math.max(spec.min,Math.min(spec.max,Math.round(Number(value))));
 const normalized=normalizeAvatarRoster(roster),player=normalized.player;
 return {roster:{...normalized,player:{...player,appearance:{...player.appearance,[key]:n}}},value:n};
}