/** Real-time based planet clock. One game day is always 86,400 game seconds. */
export const GAME_SECONDS_PER_DAY=86400;
export const DEFAULT_TIME_SCALE=1;
export const TIME_SCALES=Object.freeze([.25,1,60,600,3600]);

export function normalizeTimeScale(value,fallback=DEFAULT_TIME_SCALE){
 const number=Number(value);
 return TIME_SCALES.includes(number)?number:fallback;
}

export function gameDaysForRealSeconds(realSeconds,timeScale=DEFAULT_TIME_SCALE){
 if(!Number.isFinite(realSeconds)||realSeconds<0)throw new RangeError("Invalid real-time delta");
 const scale=normalizeTimeScale(timeScale);
 return realSeconds*scale/GAME_SECONDS_PER_DAY;
}

export function timeScaleLabel(value){
 const scale=normalizeTimeScale(value);
 return scale===1?"実時間 ×1":scale<1?"スロー ×"+scale:"早回し ×"+scale;
}
