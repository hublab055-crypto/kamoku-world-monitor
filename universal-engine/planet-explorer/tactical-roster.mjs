/** Scalable tactical roster definitions. 100% local simulation, no remote data. */
export const TROOP_ROLES=Object.freeze({
 sword:Object.freeze({name:"剣士",icon:"⚔️",rank:"front",weapon:"sword",hp:110,range:2.5,damage:17,period:1.4}),
 spear:Object.freeze({name:"槍兵",icon:"🔱",rank:"front",weapon:"spear",hp:115,range:3.5,damage:15,period:1.6}),
 axe:Object.freeze({name:"斧兵",icon:"🪓",rank:"front",weapon:"axe",hp:115,range:2.5,damage:21,period:1.9}),
 archer:Object.freeze({name:"弓兵",icon:"🏹",rank:"rear",weapon:"bow",hp:75,range:38,damage:13,period:2.5}),
 mage:Object.freeze({name:"魔法使い",icon:"✨",rank:"rear",weapon:"none",hp:65,range:28,damage:23,period:3.1}),
 healer:Object.freeze({name:"回復役",icon:"💚",rank:"support",weapon:"none",hp:80,range:14,damage:0,heal:18,period:3.2})
});
export const TROOP_PRESETS=Object.freeze({
 party:Object.freeze({name:"冒険者パーティ",formation:"battleline",roles:Object.freeze({sword:1,spear:1,axe:1,archer:1,mage:1,healer:1})}),
 company:Object.freeze({name:"第一中隊",formation:"battleline",roles:Object.freeze({spear:20,sword:10,archer:10,mage:5,healer:5})})
});
export const MAX_ALLIES=80;
export function rosterForPreset(kind){
 const plan=TROOP_PRESETS[kind];
 if(!plan)throw RangeError("未知の部隊編成");
 return Object.entries(plan.roles).flatMap(([role,count])=>Array(count).fill(role));
}
/** Squad front line faces positive Z, rear roles behind.
 * Returns offsets in input roster order to preserve identity and stable save indices. */
export function tacticalOffsets(roles,spacing=2.4){
 if(!Array.isArray(roles)||roles.length>MAX_ALLIES||
   !Number.isFinite(spacing)||spacing<1.2||spacing>8)throw RangeError("Invalid battle formation");
 const slots=Array(roles.length),front=[],rear=[],support=[];
 roles.forEach((role,i)=>{
  const rank=TROOP_ROLES[role]?.rank||"front";
  (rank==="front"?front:rank==="rear"?rear:support).push(i);
 });
 const put=(indices,baseZ,maxCols=10)=>{
  const cols=Math.min(maxCols,Math.max(1,Math.ceil(Math.sqrt(indices.length*2))));
  indices.forEach((index,j)=>{
   const row=Math.floor(j/cols),col=j%cols,itemsThisRow=Math.min(cols,indices.length-row*cols);
   slots[index]={x:(col-(itemsThisRow-1)/2)*spacing,z:baseZ-row*spacing};
  });
  return Math.ceil(indices.length/cols);
 };
 const frontRows=put(front,0);
 const rearRows=put(rear,-(frontRows+1)*spacing);
 put(support,-(frontRows+rearRows+2)*spacing);
 return slots;
}
