import {WILD_SPECIES,TACK} from "./fauna.mjs?v=0.8f-animals";

/** Compact animal panel; independent from the existing item/action decks. */
export function installFaunaUI({state,log,save,refreshHud,passable}){
 const $=id=>document.getElementById(id),panel=$("fauna-panel"),select=$("fauna-animal");
 const ctx=()=>state();
 function refresh(){
  const {fauna,controller}=ctx();if(!fauna||!controller)return;
  if(select.options.length!==fauna.animals.length){
   select.replaceChildren();
   for(const a of fauna.animals){const option=document.createElement("option");option.value=a.id;select.append(option);}
  }
  fauna.animals.forEach((a,i)=>{
   select.options[i].textContent=WILD_SPECIES[a.kind].icon+" "+WILD_SPECIES[a.kind].name+
    " "+Math.round(fauna.range(a,controller))+"m"+(a.tame?" ♥":"");
  });
  const a=fauna.selected||fauna.animals[0];
  if(!fauna.selectedId)fauna.select(a.id);
  select.value=a.id;
  $("fauna-heading").textContent=WILD_SPECIES[a.kind].icon+" "+WILD_SPECIES[a.kind].name;
  $("fauna-details").textContent=WILD_SPECIES[a.kind].ancestor+" ／ 距離"+
   Math.round(fauna.range(a,controller))+"m ／ "+(a.tame?"馴致済":"野生")+
   (a.kind==="horse"?" ／ 信頼"+a.trust+"/3 ／ 馬の体力"+a.stamina.toFixed(0)+"%":"");
  $("fauna-tack").hidden=a.kind!=="horse";
  for(const button of $("fauna-tack").querySelectorAll("[data-tack]")){
   const part=button.dataset.tack;
   button.textContent=(a.gear[part]?"✓ ":"＋ ")+TACK[part].name;
   button.disabled=a.gear[part];
  }
  $("fauna-tame").disabled=a.tame||a.kind!=="horse";
  $("fauna-call").disabled=!a.tame||Boolean(fauna.mount);
  $("fauna-ride").disabled=Boolean(fauna.mount)||!fauna.canMount(a);
  $("fauna-unride").disabled=!fauna.mount;
  $("fauna-gait").value=fauna.gait;
  $("fauna-mounted-state").textContent=fauna.mount?
   "🐎 騎乗 "+({walk:"常歩",trot:"速歩",gallop:"駈歩"}[fauna.gait])+" "+
    fauna.speed().toFixed(1)+" m/s / 馬の体力 "+fauna.mount.stamina.toFixed(0)+"%":
   "徒歩 5.0 m/s";
 }
 function open(id){
  const {fauna}=ctx();if(id)fauna?.select(id);
  panel.hidden=false;$("fauna-toggle").setAttribute("aria-expanded","true");refresh();
 }
 function close(){panel.hidden=true;$("fauna-toggle").setAttribute("aria-expanded","false");}
 function command(kind,part){
  const {fauna,controller,actions}=ctx(),a=fauna?.selected;
  if(!a||!controller)return;
  let result={ok:false,message:"選択した動物を操作できません"};
  if(kind==="approach"){
   if(fauna.mount)result.message="先に降馬してください";
   else result=controller.setMoveTarget(a.x,a.z)?{ok:true,message:"🐾 動物の近くへ移動開始"}:
    {ok:false,message:"水域・急斜面などのため移動できません"};
  }else if(kind==="tame")result=fauna.tame(a.id,controller);
  else if(kind==="call")result=fauna.call(a.id,controller);
  else if(kind==="equip")result=fauna.equip(a.id,part,controller,actions?.resources);
  else if(kind==="ride")result=fauna.board(a.id,controller);
  else if(kind==="unride")result=fauna.dismount(controller,(x,z)=>passable(controller.x,controller.z,x,z));
  log(result.message);
  if(result.ok)save();
  controller.mountRiding=Boolean(fauna.mount);controller.walkSpeed=fauna.speed();
  refresh();refreshHud();
 }
 $("fauna-toggle").addEventListener("click",()=>panel.hidden?open():close());
 $("fauna-close").addEventListener("click",close);
 select.addEventListener("change",()=>{ctx().fauna?.select(select.value);refresh();});
 for(const k of ["approach","tame","call","ride","unride"])
  $("fauna-"+k).addEventListener("click",()=>command(k));
 $("fauna-tack").addEventListener("click",e=>{
  const btn=e.target.closest("button[data-tack]");if(btn)command("equip",btn.dataset.tack);
 });
 $("fauna-gait").addEventListener("change",()=>{
  if(ctx().fauna?.setGait($("fauna-gait").value)){save();refresh();refreshHud();}
 });
 return {refresh,open,close};
}