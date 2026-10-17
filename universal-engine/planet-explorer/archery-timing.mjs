/** Shared pure timing curve for synchronized volleys.
 * All archers begin drawing together. Ripple holds at 78% (full draw)
 * for an additional delay before their individual releases.
 */
export function bowTimedProgress(elapsed,baseDuration,holdDelay=0){
 if(!Number.isFinite(elapsed)||!Number.isFinite(baseDuration)||baseDuration<=0)return 0;
 const pause=Math.max(0,Math.min(3,Number(holdDelay)||0));
 const transition=baseDuration*.78;
 const adjusted=elapsed<=transition?elapsed:
  elapsed<=transition+pause?transition:elapsed-pause;
 return Math.max(0,Math.min(1,adjusted/baseDuration));
}
export function applyBowHold(task,seconds){
 if(!task||task.kind!=="equipped_bow")return false;
 const delay=Math.max(0,Math.min(1.8,Number(seconds)||0));
 task.baseDuration=task.duration;task.holdDelay=delay;
 task.duration+=delay;task.remaining+=delay;
 return true;
}
export function taskBowProgress(task){
 const base=task.baseDuration||task.duration;
 return bowTimedProgress(task.duration-task.remaining,base,task.holdDelay||0);
}
