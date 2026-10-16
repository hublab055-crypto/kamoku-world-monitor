import {SocialEquipment,ITEM_OPTIONS,ITEM_MAP} from "./social-equipment.mjs";
import {ActionSlots,DECK_KINDS,COMMAND_LABELS} from "./action-slots.mjs";
import {parseFrontierGLB,findFrontierGLB,cachedFrontierGLB,AVATAR_PACK_VERSION} from "./frontier-glb.mjs";

/** Browser UI adapter; domain logic lives in SocialEquipment. */
export function installFrontierInteractions({get,log,updateHUD,openBookLibrary,saveLifeJournal}){
 const $=id=>document.getElementById(id);
 let social=new SocialEquipment(),headingUp=false,choice={player:"male",scout:"female",artisan:"male"};
 let modelSource="standard",modelQuality="auto",modelLoadId=0;
 let configId="player",slotSignature="",lastActiveActor=null;
 let decks=Object.fromEntries(["player","scout","artisan"].map(id=>[id,new ActionSlots()]));
 const handNames={right:"右手",left:"左手"};
 const actor=()=>{const c=get();return (c.rtsMode?c.squad?.selectedAgents()[0]:null)||c.squad?.get("player");};
 function equipmentInventory(){const c=get(),who=actor();return c.squad&&who?social.inventoryFor(who,c.life,c.squad.frontier):[];}
 function syncHands(){
  const c=get(),who=actor();if(!c.squad||!who)return;
  c.renderer.handEquipment=Object.fromEntries(c.squad.agents.map(a=>[a.id,{...social.actor(a.id).hands}]));
  for(const hand of ["right","left"]){
   const item=social.handItem(who.id,hand),details=ITEM_MAP.get(item)||ITEM_MAP.get("none");
   const count=social.quantity(who,item,c.life,c.squad.frontier);
   const button=$("hand-"+hand+"-use");
   button.textContent=(details?.icon||"▫️")+" "+handNames[hand]+"　"+(details?.name||"空");
   button.title=handNames[hand]+"： "+(details?.name||"空")+"（タップすると使用）";
   button.classList.toggle("unavailable",item==="none"||count<1);
  }
 }
 function equipHandFromInventory(item,hand){
  const c=get(),who=actor();
  const r=social.equipHand(who,hand,item,c.life,c.squad.frontier);
  if(r.ok){slotSignature="";quick();if(!$("quick-config-panel").hidden)renderConfig();}
  updateHUD();return r;
 }
 function isCombat(who=actor()){
  return !!who&&["melee","bow"].includes(decks[who.id]?.current().kind);
 }
 function applyDeck(who,{quiet=false}={}){
  const c=get(),deck=decks[who?.id]?.current();
  if(!c.squad||!who||!deck)return false;
  const before={...social.actor(who.id).hands};
  for(const hand of ["right","left"]){
   const result=social.equipHand(who,hand,deck.hands[hand],c.life,c.squad.frontier);
   if(!result.ok){
    social.actor(who.id).hands=before;
    if(!quiet)log(result.message);
    return false;
   }
  }
  if(c.renderer)syncHands();
  return true;
 }
 function selectDeck(index){
  const who=actor();if(!who)return;
  const deck=decks[who.id],previous=deck.selected;
  if(!deck.select(index))return;
  if(!applyDeck(who)){deck.select(previous);applyDeck(who,{quiet:true});return;}
  slotSignature="";quick();updateHUD();
 }
 function updateTarget(){
  const c=get(),who=actor(),deck=decks[who?.id];
  if(!deck||!c.battle||!c.renderer)return null;
  const combat=isCombat(who);
  const range=deck.current().kind==="bow"?18:4;
  const target=combat?deck.resolveTarget(c.battle.enemies,who.control,range):null;
  c.renderer.combatTargetId=target?.id||null;
  c.battle.targetId=target?.id||null;
  $("aim-reticle").hidden=!combat;
  const label=$("combat-target-label");label.hidden=!combat;
  if(combat)label.textContent=target?"🎯 "+target.name+" / HP "+target.hp+
    (deck.manualTargetId===target.id?"（手動）":"（自動）"):"🎯 対象なし"+
    (deck.autoTarget?"":"（手動選択）");
  return target;
 }
 function selectTargetAt(clientX,clientY){
  const c=get(),who=actor();
  if(!isCombat(who)||!c.renderer?.canvas||!c.battle)return false;
  const rect=c.renderer.canvas.getBoundingClientRect();
  if(!rect.width||!rect.height)return false;
  const nx=(clientX-rect.left)/rect.width,ny=(clientY-rect.top)/rect.height;
  let closest=null,best=.085;
  for(const marker of c.renderer.screenEnemies||[]){
   if(!marker.onScreen||!c.battle.enemies.some(e=>e.id===marker.id&&e.hp>0))continue;
   const d=Math.hypot((marker.u-nx)*rect.width,(marker.v-ny)*rect.height);
   const dnorm=d/Math.max(1,Math.min(rect.width,rect.height));
   if(dnorm<best){closest=marker;best=dnorm;}
  }
  if(!closest)return false;
  decks[who.id].setManualTarget(closest.id);
  updateTarget();log("🎯 "+closest.name+"を手動ターゲットに指定しました。");return true;
 }
 function quick(){
  const c=get();if(!c.squad)return;
  const who=actor(),a=social.actor(who.id),deck=decks[who.id];
  if(who.id!==lastActiveActor){
   applyDeck(who,{quiet:true});lastActiveActor=who.id;slotSignature="";
  }
  syncHands();
  const key=who.id+":"+deck.selected+":"+JSON.stringify(deck.slots)+":"+
   a.hands.right+":"+a.hands.left;
  if(slotSignature===key)return;
  slotSignature=key;
  const root=$("quick-slots");root.replaceChildren();
  deck.slots.forEach((entry,i)=>{
   const info=DECK_KINDS[entry.kind],b=document.createElement("button");b.type="button";
   b.setAttribute("aria-pressed",String(i===deck.selected));
   b.title=(i+1)+": "+info.name+" / "+entry.commands.map(k=>COMMAND_LABELS[k]).join("・");
   b.append(document.createTextNode(info.icon+(i+1)));
   const caption=document.createElement("span");caption.textContent=info.name;b.append(caption);
   b.addEventListener("click",()=>selectDeck(i));
   root.append(b);
  });
  const bar=$("action-command-bar");bar.replaceChildren();
  deck.current().commands.forEach(command=>{
   const button=document.createElement("button");button.type="button";
   button.textContent=COMMAND_LABELS[command];
   button.addEventListener("click",()=>runCommand(command));
   bar.append(button);
  });
  if(isCombat(who)){
   const clear=document.createElement("button");clear.type="button";
   clear.textContent="× 解除";clear.title="手動ターゲットを解除";
   clear.addEventListener("click",()=>{deck.clearManual();updateTarget();});
   bar.append(clear);
  }
  $("quick-use").title="実行："+COMMAND_LABELS[deck.current().commands[0]];
  updateTarget();
 }
 function executeItem(result,who,c,hand="right",chosenVariant=null){
  if(!result.ok){log(result.message);return result;}
  if(result.kind==="book"){openBookLibrary();return result;}
  if(result.kind==="guard"){c.battle?.guard();log(result.message);return result;}
  if(result.kind==="heal"){
   const healed=c.battle?.heal(result.amount)||0;
   log(result.message+" 戦闘HP +"+healed);saveLifeJournal();updateHUD();return result;
  }
  if(result.kind==="deploy"){
   if(who.id!=="player"){log("設置操作は開拓者が行います。");return {ok:false,message:"NPCの設置未対応"};}
   const kind=result.item,stock=c.life.inventory,gifts=c.squad.frontier.person(who.id)?.gifts||{},
     bag=c.squad.frontier.person(who.id)?.inventory||{};
   // A gifted/personal item is temporarily made visible to Lifestyle.deploy;
   // if placement fails, return it to the same owner without duplicating it.
   let borrower=null;
   if(!(stock[kind]>0)){
    borrower=(bag[kind]||0)>0?bag:(gifts[kind]||0)>0?gifts:null;
    if(borrower){stock[kind]=(stock[kind]||0)+1;borrower[kind]--;}
   }
   const deployed=c.life.deploy(kind,c.controller,c.sample,c.actions.structures);
   if(borrower&&!deployed.ok){stock[kind]--;borrower[kind]++;}
   log(deployed.message);
   if(deployed.ok){saveLifeJournal();updateHUD();}
   return deployed;
  }
  if(result.kind==="action"){
   const variant=chosenVariant||(["sword","axe"].includes(result.action)?
     social.attackVariant(who.id,result.action):"overhead");
   if(who.id==="player"&&["sword","axe","bow"].includes(result.action)){
    const target=updateTarget();
    if(target){
     const desired=Math.atan2(target.x-c.controller.x,target.z-c.controller.z);
     c.controller.turn(Math.atan2(Math.sin(desired-c.controller.yaw),Math.cos(desired-c.controller.yaw)));
    }
   }
   if(who.id!=="player"){
    const ok=c.squad.performEquippedAction(who.id,result.action,hand,variant);
    if(ok){if(result.usesArrow)social.spendArrow(who.id);if(c.renderer)c.renderer.actionHand[who.id]=hand;}
    log(ok?who.name+"に "+result.action+" の使用を指示しました。":"道具を使用できません。地上にいるか確認してください。");
    updateHUD();return {ok};
   }
   const started=c.actions.start(result.action,c.controller,c.sample,variant);
   if(started){if(result.usesArrow)social.spendArrow(who.id);if(c.renderer)c.renderer.actionHand[who.id]=hand;}
   log(c.actions.message);
   if(!started)return {ok:false,message:c.actions.message};
  }else{log(result.message);saveLifeJournal();}
  updateHUD();return result;
 }
 function runCommand(command){
  const c=get(),who=actor();if(!who)return {ok:false};
  const item=(gear,hand="right",variant=null)=>executeItem(
   social.useItem(who,gear,c.life,c.squad.frontier),who,c,hand,variant);
  switch(command){
   case "sweep":return item(social.handItem(who.id,"right")==="axe"?"axe":"sword","right","sweep");
   case "thrust":return item("sword","right","thrust");
   case "shoot":{
    const hand=social.handItem(who.id,"left")==="bow"?"left":"right";
    return item("bow",hand);
   }
   case "guard":c.battle?.guard();log("🛡️ ガード！ 次の攻撃を軽減します。");updateHUD();return {ok:true};
   case "heal":return item("potion");
   case "aim":{
    const deck=decks[who.id];deck.autoTarget=!deck.autoTarget;
    updateTarget();log(deck.autoTarget?"🎯 自動ターゲットを有効にしました。":"🎯 手動ターゲットモードです。敵をタップしてください。");
    return {ok:true};
   }
   case "mine":return item("pickaxe");
   case "chop":return item("axe");
   case "build":return executeItem({ok:true,kind:"action",action:"build"},who,c);
   case "talk":case "gift":openSocial();if(command==="gift")$("social-gift-item").focus();return {ok:true};
   case "emote":{
    who.status="🙂 エモート";
    c.renderer?.triggerSocial(who.id,c.squad.agents.find(a=>a.id!==who.id)?.id,"talk");
    log(who.name+"が手を振りました。");return {ok:true};
   }
   case "follow":{
    if(who.id==="player"){openSocial();log("ついてきてほしい人物を選択してください。");return {ok:true};}
    who.order="follow";who.status="👣 隊長を追従";who.auto=true;
    log(who.name+"が隊長についていきます。");return {ok:true};
   }
   case "rest":log("💤 休息はベッドやベッドロールで行えます。");c.lifeUI?.open("home");return {ok:true};
   case "inventory":c.lifeUI?.open("inventory");return {ok:true};
   case "book":openBookLibrary();return {ok:true};
   case "config":configId=who.id;renderConfig();$("quick-config-panel").hidden=false;return {ok:true};
   default:return {ok:false,message:"未対応コマンド"};
  }
 }
 function useItem(){
  const who=actor();if(!who)return;
  return runCommand(decks[who.id].current().commands[0]);
 }
 function useHand(hand){
  const c=get(),who=actor();if(!who)return;
  return executeItem(social.useHand(who,hand,c.life,c.squad.frontier),who,c,hand);
 }
 function renderConfig(){
  const c=get();if(!c.squad)return;
  const sel=$("quick-actor");sel.replaceChildren();
  for(const a of c.squad.agents){const o=document.createElement("option");o.value=a.id;o.textContent=a.name;sel.append(o);}
  sel.value=configId;
  const person=c.squad.get(configId),inventory=social.inventoryFor(person,c.life,c.squad.frontier);
  $("equip-inventory-label").textContent=person.name+"の所持品："+inventory.map(item=>item.name+"×"+item.quantity).join("・");
  $("arrow-stock-label").textContent="🏹 "+person.name+"の矢筒："+(social.actor(configId)?.arrows||0)+"本";
  $("attack-mode").value=social.actor(configId)?.attackMode||"overhead";
  function selectInventory(current){
   const picker=document.createElement("select");
   const empty=document.createElement("option");empty.value="none";empty.textContent="▫️ はずす";picker.append(empty);
   for(const item of inventory){
    const o=document.createElement("option");o.value=item.id;o.textContent=item.icon+" "+item.name+" ×"+item.quantity;picker.append(o);
   }
   if(current!=="none"&&!inventory.some(item=>item.id===current)){
    const item=ITEM_MAP.get(current),o=document.createElement("option");
    o.value=current;o.textContent=(item?.icon||"▫️")+" "+(item?.name||current)+"（在庫なし）";
    picker.append(o);
   }
   picker.value=current;return picker;
  }
  const hands=$("hand-config-rows");hands.replaceChildren();
  for(const hand of ["right","left"]){
   const row=document.createElement("label");row.textContent=hand==="right"?"🫱 右手":"🫲 左手";
   const picker=selectInventory(social.handItem(configId,hand));
   picker.addEventListener("change",()=>{
    const result=social.equipHand(person,hand,picker.value,c.life,c.squad.frontier);
    log(result.message);
    if(result.ok){slotSignature="";quick();renderConfig();}
    else picker.value=social.handItem(configId,hand);
   });
   row.append(picker);hands.append(row);
  }
  const root=$("quick-config-rows");root.replaceChildren();
  for(let i=0;i<5;i++){
   const row=document.createElement("label");row.textContent="クイック "+(i+1);
   const picker=selectInventory(social.actor(configId).slots[i]);
   picker.addEventListener("change",()=>{social.equip(configId,i,picker.value);slotSignature="";quick();renderConfig();});
   row.append(picker);root.append(row);
  }
 }
 function selection(){const c=get();return {from:c.squad.get($("social-from").value),to:c.squad.get($("social-target").value)};}
 function gifts(){
  const {from}=selection();if(!from)return;
  const sel=$("social-gift-item"),prior=sel.value;sel.replaceChildren();
  const available=social.availableGifts(from,get().life,get().squad.frontier);
  for(const item of available){const option=document.createElement("option");option.value=item.id;option.textContent=item.icon+" "+item.name;sel.append(option);}
  if(available.some(g=>g.id===prior))sel.value=prior;
  if(!available.length){const o=document.createElement("option");o.value="";o.textContent="贈れる物がありません";sel.append(o);}
 }
 function targets(){
  const c=get(),from=c.squad.get($("social-from").value),sel=$("social-target"),prior=sel.value;sel.replaceChildren();
  for(const a of c.squad.agents.filter(a=>a.id!==from.id)){
   const o=document.createElement("option");o.value=a.id;
   o.textContent=a.name+" ("+Math.hypot(a.control.x-from.control.x,a.control.z-from.control.z).toFixed(1)+"m)";
   sel.append(o);
  }
  if([...sel.options].some(o=>o.value===prior))sel.value=prior;
  gifts();
 }
 function openSocial(){
  const c=get();if(!c.squad)return;
  $("quick-config-panel").hidden=true;
  $("social-from").replaceChildren();
  for(const a of c.squad.agents){const o=document.createElement("option");o.value=a.id;o.textContent=a.name;$("social-from").append(o);}
  $("social-from").value=actor().id;targets();
  $("social-panel").hidden=false;
  $("social-result").textContent="相手の4m以内で「話す」「プレゼント」を使えます。";
 }
 function setHeading(val){
  headingUp=Boolean(val);
  $("rts-heading-up").checked=headingUp;$("camera-rts-heading").checked=headingUp;
  updateCamera();
 }
 function updateCamera(){
  const c=get(),selected=actor();
  if(c.renderer){c.renderer.rtsHeadingUp=c.rtsMode&&headingUp;
   c.renderer.rtsHeadingYaw=selected?.control?.yaw||c.controller?.yaw||0;}
 }
 function restore(data){
  social=new SocialEquipment(data?.social||null);headingUp=Boolean(data?.headingUp);
  choice={player:"male",scout:"female",artisan:"male"};
  for(const id of Object.keys(choice))if(["male","female","classic"].includes(data?.choice?.[id]))choice[id]=data.choice[id];
  // Old saves have no source setting; never silently use stale browser-local GLBs.
  modelSource=data?.modelSource==="imported"?"imported":"standard";
  modelQuality=["auto","high","mobile"].includes(data?.modelQuality)?data.modelQuality:"auto";
  $("frontier-glb-source").value=modelSource;$("frontier-glb-quality").value=modelQuality;
  if(get().renderer)get().renderer.glbFor={...choice};
  $("camera-rts-heading").checked=headingUp;$("rts-heading-up").checked=headingUp;
  slotSignature="";quick();updateCamera();
  $("frontier-glb-choice").value=choice[$("frontier-glb-actor").value]||"male";
 }
 function snapshot(){return {social:social.snapshot(),headingUp,choice:{...choice},modelSource,modelQuality};}
 async function loadModels(renderer,{force=false}={}){
  const token=++modelLoadId,summary=[],status=$("frontier-glb-status");
  status.dataset.state="loading";
  status.textContent="GLB読み込み中… "+(modelSource==="standard"?"共通モデル "+AVATAR_PACK_VERSION:"端末内モデル");
  for(const sex of ["male","female"]){
   try{
    const asset=await findFrontierGLB(sex,{source:modelSource,quality:modelQuality,force});
    if(token!==modelLoadId||renderer!==get().renderer)return;
    if(!asset){renderer.clearFrontierGlb(sex);summary.push(sex+" 未登録");continue;}
    const parsed=parseFrontierGLB(asset.buffer);
    renderer.setFrontierGlb(sex,parsed,asset.buffer);
    const detail=renderer.glbStatuses[sex];
    summary.push(sex+" "+(asset.quality==="custom"?"カスタム":asset.quality==="high"?"高精細":"軽量")+
     " "+parsed.triangles.toLocaleString()+"三角形 / "+(detail?.animated?"アニメ対応":"静的表示")+
     (asset.warning?" / ⚠ "+asset.warning:""));
   }catch(err){
    if(token!==modelLoadId||renderer!==get().renderer)return;
    renderer.clearFrontierGlb(sex);
    summary.push(sex+" 読込失敗 ("+String(err.message||err)+")");
    console.warn("Frontier avatar:",err);
   }
  }
  if(token!==modelLoadId||renderer!==get().renderer)return;
  const standard=modelSource==="standard",failed=summary.some(v=>v.includes("失敗")||v.includes("未登録"));
  status.dataset.state=failed?"warning":"ready";
  status.textContent=(standard?"共通モデル "+AVATAR_PACK_VERSION:"端末固有インポートGLB")+
   " / 指定画質 "+modelQuality+" / "+
   " / "+summary.join(" / ")+(failed?"。失敗した人物は従来モデルになります。":"。");
 }
 $("quick-use").addEventListener("click",useItem);
 $("hand-right-use").addEventListener("click",()=>useHand("right"));
 $("hand-left-use").addEventListener("click",()=>useHand("left"));
 $("quick-inventory").addEventListener("click",()=>get().lifeUI?.open("inventory"));
 $("attack-mode").addEventListener("change",()=>{
  if(social.setAttackMode(configId,$("attack-mode").value)){
   log("⚔️ 攻撃モーションを更新しました。");
   renderConfig();
  }
 });
 $("arrow-craft").addEventListener("click",()=>{
  const c=get(),result=social.craftArrows(configId,c.actions?.resources);
  log(result.message);
  if(result.ok){saveLifeJournal();slotSignature="";quick();updateHUD();}
  renderConfig();
 });
 $("equip-open-inventory").addEventListener("click",()=>{
  $("quick-config-panel").hidden=true;get().lifeUI?.open("inventory");
 });
 $("quick-config").addEventListener("click",()=>{configId=actor().id;renderConfig();$("quick-config-panel").hidden=false;});
 $("quick-config-close").addEventListener("click",()=>{$("quick-config-panel").hidden=true;});
 $("quick-actor").addEventListener("change",()=>{configId=$("quick-actor").value;renderConfig();});
 $("viewport-social").addEventListener("click",openSocial);
 $("social-close").addEventListener("click",()=>{$("social-panel").hidden=true;});
 $("social-from").addEventListener("change",targets);
 $("social-target").addEventListener("change",gifts);
 $("social-talk").addEventListener("click",()=>{
  const {from,to}=selection();const r=social.talk(from,to);
  $("social-result").textContent=r.message;log(r.message);
  if(r.ok){from.status="💬 会話中";to.status="💬 会話中";get().renderer?.triggerSocial(from.id,to.id,"talk");}
 });
 $("social-gift").addEventListener("click",()=>{
  const {from,to}=selection(),c=get();
  const r=social.gift(from,to,$("social-gift-item").value,c.life,c.squad.frontier);
  $("social-result").textContent=r.message;log(r.message);
  if(r.ok){c.renderer?.triggerSocial(from.id,to.id,"gift");saveLifeJournal();gifts();updateHUD();}
 });
 $("rts-heading-up").addEventListener("change",e=>setHeading(e.target.checked));
 $("camera-rts-heading").addEventListener("change",e=>setHeading(e.target.checked));
 $("frontier-glb-actor").addEventListener("change",()=>{$("frontier-glb-choice").value=choice[$("frontier-glb-actor").value];});
 $("frontier-glb-source").addEventListener("change",()=>{
  modelSource=$("frontier-glb-source").value;void loadModels(get().renderer);
 });
 $("frontier-glb-quality").addEventListener("change",()=>{
  modelQuality=$("frontier-glb-quality").value;void loadModels(get().renderer);
 });
 $("frontier-glb-refresh").addEventListener("click",()=>void loadModels(get().renderer,{force:true}));
 $("frontier-glb-choice").addEventListener("change",()=>{
  choice[$("frontier-glb-actor").value]=$("frontier-glb-choice").value;
  const c=get();if(c.renderer)c.renderer.glbFor={...choice};
 });
 $("frontier-glb-input").addEventListener("change",async e=>{
  const file=e.target.files?.[0],sex=$("frontier-glb-sex").value;if(!file)return;
  try{
   if(!/\.glb$/i.test(file.name)||file.size>85*1024*1024)throw Error("85MB以内の.glbを選択してください。ZIPは展開が必要です。");
   const raw=await file.arrayBuffer(),parsed=parseFrontierGLB(raw),c=get();
   c.renderer.setFrontierGlb(sex,parsed,raw);
   let saved=false;
   try{await cachedFrontierGLB(sex,raw);saved=true;}catch(err){log("端末保存できませんでした: "+err.message);}
   if(saved){
    modelSource="imported";$("frontier-glb-source").value=modelSource;
    await loadModels(c.renderer);
   }
   const detail=c.renderer.glbStatuses[sex];
   $("frontier-glb-status").textContent="✅ "+sex+" "+parsed.triangles.toLocaleString()+"三角形 / "+(detail?.animated?"GPU骨格・顔モーフ対応 / "+(detail.clips?.length||0)+"クリップ (Walk・FaceTalking等)":"静的表示（"+(detail?.reason||"スキニング未対応")+"）");
   log("GLBを適用しました。");
  }catch(err){$("frontier-glb-status").textContent="GLB読み込み失敗: "+err.message;}
  e.target.value="";
 });
 window.addEventListener("keydown",e=>{
  if(e.target?.closest?.("input,select,textarea,[contenteditable=true]"))return;
  const c=get();if(!c.squad)return;
  if(/^[1-5]$/.test(e.key)){social.select(actor().id,Number(e.key)-1);slotSignature="";quick();}
  if(e.key.toLowerCase()==="u"){e.preventDefault();useItem();}
  if(e.key.toLowerCase()==="r"){e.preventDefault();useHand("right");}
  if(e.key.toLowerCase()==="l"){e.preventDefault();useHand("left");}
 });
 return {quick,restore,snapshot,updateCamera,loadModels,equipmentInventory,equipHandFromInventory,
  attackVariantFor:(id,kind)=>social.attackVariant(id,kind)};
}
