import {SocialEquipment,ITEM_OPTIONS,ITEM_MAP,TWO_HANDED_ITEMS,ARROW_TYPES} from "./social-equipment.mjs?v=0.8q-rod";
import {ActionSlots,DECK_KINDS,COMMAND_LABELS} from "./action-slots.mjs?v=0.8q-rod-deck";
import {applyBowHold} from "./archery-timing.mjs";
import {parseFrontierGLB,findFrontierGLB,cachedFrontierGLB,AVATAR_PACK_VERSION} from "./frontier-glb.mjs";

/** Browser UI adapter; domain logic lives in SocialEquipment. */
export function installFrontierInteractions({get,log,updateHUD,openBookLibrary,saveLifeJournal,showSpeech=()=>{},showEffect=()=>{},onFish=()=>({ok:false,message:"釣りを準備できません"})}){
 const $=id=>document.getElementById(id);
 let social=new SocialEquipment(),headingUp=false,choice={player:"male",scout:"female",artisan:"male"};
 let modelSource="standard",modelQuality="auto",modelLoadId=0;
 let configId="player",slotSignature="",lastActiveActor=null;
 let trajectoryMode="auto",ammoType="wood",volleyAim="focus",volleyTiming="simultaneous",volleyInterval=.22,practiceTargetId=null;
 let decks=Object.fromEntries(["player","scout","artisan"].map(id=>[id,new ActionSlots()]));
 const handNames={right:"右手",left:"左手"};
  const twoHanded=new Set(TWO_HANDED_ITEMS);
 const actor=()=>{const c=get();return (c.rtsMode?c.squad?.selectedAgents()[0]:null)||c.squad?.get("player");};
 function syncRoster(){
  const c=get();if(!c.squad)return;
  for(let i=0;i<c.squad.agents.length;i++){
   const person=c.squad.agents[i];
   if(!social.actor(person.id))social.ensureActor(person.id,person.role);
   if(!decks[person.id]){
    const deck=new ActionSlots();
    if(person.role==="archer")deck.select(1);
    if(person.role==="mage"||person.role==="healer")deck.select(3);
    decks[person.id]=deck;
   }
   if(!choice[person.id])choice[person.id]=i%2?"female":"male";
   if(c.renderer?.glbFor)c.renderer.glbFor[person.id]=choice[person.id];
  }
 }
 function equipmentInventory(){const c=get(),who=actor();return c.squad&&who?social.inventoryFor(who,c.life,c.squad.frontier):[];}
 function syncHands(){
  const c=get(),who=actor();if(!c.squad||!who)return;
  c.renderer.handEquipment=Object.fromEntries(c.squad.agents.map(a=>[a.id,{...social.actor(a.id).hands}]));
  for(const hand of ["right","left"]){
   const item=social.handItem(who.id,hand),details=ITEM_MAP.get(item)||ITEM_MAP.get("none");
   const count=social.quantity(who,item,c.life,c.squad.frontier);
   const button=$("hand-"+hand+"-use");
   button.textContent=(details?.icon||"▫️")+" "+handNames[hand]+"　"+(details?.name||"空")+(twoHanded.has(item)?"（両手）":"");
   button.title=handNames[hand]+"： "+(details?.name||"空")+"（タップすると使用）";
   button.classList.toggle("unavailable",item==="none"||count<1);
  }
 }
 function equipHandFromInventory(item,hand){
  const c=get(),who=actor();
  const r=social.equipHand(who,hand,item,c.life,c.squad.frontier);
  if(r.ok){
   decks[who.id].configure(decks[who.id].selected,{hands:{[hand]:item}});
   slotSignature="";quick();if(!$("quick-config-panel").hidden)renderConfig();
  }
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
 function aimFor(who,c=get()){
  const selected=practiceTargetId!=null?c.projectiles?.targets.find(t=>t.id===practiceTargetId):null;
  if(selected)return {...selected,kind:"practice",targetPoint:{x:selected.x,y:selected.y+1.65,z:selected.z}};
  const deck=decks[who?.id];
  if(!deck||!c.battle||!who)return null;
  const bow=["right","left"].some(h=>social.handItem(who.id,h)==="bow");
  const meleeReach=["right","left"].some(h=>social.handItem(who.id,h)==="spear")?5.5:4;
   const range=bow?(trajectoryMode==="direct"?55:145):meleeReach;
  const combat=["bow","melee"].includes(deck.current().kind)||bow;
  return combat?deck.resolveTarget(c.battle.enemies,who.control,range):
   c.battle.enemies.find(e=>e.id===deck.manualTargetId&&e.hp>0)||null;
 }
 function updateTarget(){
  const c=get(),who=actor(),deck=decks[who?.id];
  if(!deck||!c.battle||!c.renderer)return null;
  const combat=isCombat(who)&&!!who.control?.nearGround;
  const target=aimFor(who,c);
  if(!combat&&!target)deck.clearManual();
  c.renderer.combatTargetId=target?.kind==="practice"?null:target?.id||null;
  c.battle.targetId=target?.kind==="practice"?null:target?.id||null;
  $("aim-reticle").hidden=!combat;
  const label=$("combat-target-label");label.hidden=!combat&&!target;
  if(combat||target)label.textContent=target?
   target.kind==="practice"?"🎯 練習用の的":
    "🎯 "+target.name+" / HP "+target.hp+(deck.manualTargetId===target.id?"（手動）":"（自動）"):
    "🎯 対象なし"+(deck.autoTarget?"":"（手動選択）");
  return target;
 }
 function selectTargetAt(clientX,clientY){
  const c=get(),who=actor();
  if(!who||!c.renderer?.canvas||!c.battle)return false;
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
  if(!closest){
   const target=c.renderer.pickTarget(clientX,clientY);
   if(!target)return false;
   practiceTargetId=target.id;
   for(const person of c.rtsMode&&c.syncMode?c.squad.selectedAgents():[who])
    decks[person.id].clearManual();
   updateTarget();log("🎯 練習用の的をターゲットに指定しました。");return true;
  }
  practiceTargetId=null;
  for(const person of c.rtsMode&&c.syncMode?c.squad.selectedAgents():[who])
   decks[person.id].setManualTarget(closest.id);
  updateTarget();log("🎯 "+closest.name+"を手動ターゲットに指定しました。");return true;
 }
 function quick(){
  const c=get();if(!c.squad)return;
  syncRoster();
  const who=actor(),a=social.actor(who.id),deck=decks[who.id];
  if(who.id!==lastActiveActor){
   applyDeck(who,{quiet:true});lastActiveActor=who.id;slotSignature="";
  }
  syncHands();
  const key=who.id+":"+deck.selected+":"+JSON.stringify(deck.slots)+":"+
   a.hands.right+":"+a.hands.left+":"+c.rtsMode+":"+c.syncMode+":"+c.squad.selected.size;
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
  if(c.rtsMode&&c.syncMode&&c.squad.selected.size>1){
   const volleyButton=document.createElement("button");
   volleyButton.type="button";volleyButton.textContent="🏹 一斉射撃";
   volleyButton.title="弓装備・矢ありの選択アバターが同時に射撃";
   volleyButton.addEventListener("click",volley);
   bar.append(volleyButton);
  }
  $("archery-mode-bar").hidden=!isCombat(who)&&!(c.rtsMode&&c.syncMode);
  if(isCombat(who)){
   const clear=document.createElement("button");clear.type="button";
   clear.textContent="× 解除";clear.title="手動ターゲットを解除";
   clear.addEventListener("click",()=>{deck.clearManual();practiceTargetId=null;updateTarget();});
   bar.append(clear);
  }
  $("quick-use").title="実行："+COMMAND_LABELS[deck.current().commands[0]];
  updateTarget();
 }
 function executeItem(result,who,c,hand="right",chosenVariant=null,shotOptions=null){
  if(!result.ok){log(result.message);return result;}
  if(result.kind==="book"){openBookLibrary();return result;}
  if(result.kind==="fishing"){
   if(who.id!=="player")return {ok:false,message:"釣り竿の使用は現在プレイヤーのみ対応"};
   const r=onFish(who,hand);
   if(r?.message)log(r.message);
   updateHUD();
   return r;
  }
  if(result.kind==="guard"){c.battle?.guard();log(result.message);return result;}
  if(result.kind==="heal"){
   const healed=c.battle?.heal(result.amount)||0;
   showEffect({kind:"heal",text:"+"+healed+" HP",actorId:who.id});
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
   const variant=chosenVariant||(["sword","spear","greatsword","axe"].includes(result.action)?
    social.attackVariant(who.id,result.action):"overhead");
   const target=result.action==="bow"&&shotOptions&&Object.hasOwn(shotOptions,"target")?
     shotOptions.target:["sword","spear","greatsword","axe","bow"].includes(result.action)?aimFor(who,c):null;
   if(target&&(!c.manualInputActive||who.id!=="player"||shotOptions?.forceTurn)){
    const desired=Math.atan2(target.x-who.control.x,target.z-who.control.z);
    who.control.turn(Math.atan2(Math.sin(desired-who.control.yaw),Math.cos(desired-who.control.yaw)));
   }
   const targetId=target?.kind==="practice"?null:target?.id??null;
   const targetPoint=target?.kind==="practice"?target.targetPoint:null;
   if(who.id!=="player"){
    const ok=c.squad.performEquippedAction(who.id,result.action,hand,variant,targetId);
    if(ok){
     const task=c.squad.get(who.id)?.task;
     if(task&&result.action==="bow"){
      task.targetPoint=targetPoint;task.trajectory=trajectoryMode;
      task.arrowType=result.arrowType||"wood";
      if(shotOptions?.holdDelay)applyBowHold(task,shotOptions.holdDelay);
     }
     if(result.usesArrow)social.spendArrow(who.id,result.arrowType);
     if(c.renderer)c.renderer.actionHand[who.id]=twoHanded.has(result.action)?"right":hand;
    }
    if(!ok)log(who.name+"は行動できません（実行中か地上にいません）。");
    updateHUD();return {ok};
   }
   const started=c.actions.start(result.action,c.controller,c.sample,variant);
   if(started){
    if(result.action==="bow"){
     c.actions.active.targetId=targetId;
     c.actions.active.targetPoint=targetPoint;
     c.actions.active.trajectory=trajectoryMode;
     c.actions.active.arrowReleased=false;
     c.actions.active.arrowType=result.arrowType||"wood";
    }
    if(result.usesArrow)social.spendArrow(who.id,result.arrowType);
    if(c.renderer)c.renderer.actionHand[who.id]=twoHanded.has(result.action)?"right":hand;
   }
   if(!started)log(c.actions.message);
   updateHUD();return {ok:started,message:c.actions.message};
  }else{log(result.message);saveLifeJournal();}
  updateHUD();return result;
 }
 function selectCurrentAmmo(who){return social.setArrowType(who.id,ammoType);}
 function nearestEnemy(who,enemies,excluded=new Set()){
  return enemies.filter(e=>e.hp>0&&!excluded.has(e.id))
   .sort((a,b)=>Math.hypot(a.x-who.control.x,a.z-who.control.z)-
    Math.hypot(b.x-who.control.x,b.z-who.control.z))[0]||null;
 }
 function volley(){
  const c=get();
  if(!c.rtsMode||!c.syncMode)return {ok:false,message:"シンクロモードではありません。"};
  const selected=c.squad.selectedAgents(),eligible=[];
  let noGear=0,noAmmo=0,busy=0;
  for(const person of selected){
   const hand=["right","left"].find(h=>social.handItem(person.id,h)==="bow");
   if(!hand){noGear++;continue;}
   if(!social.arrowCount(person.id,ammoType)){noAmmo++;continue;}
   const ready=person.id==="player"?!c.actions.active:!person.task?.kind?.startsWith("equipped_");
   if(!ready){busy++;continue;}
   eligible.push({person,hand});
  }
  const assigned=new Set();
  let launched=0;
  for(const {person,hand} of eligible){
   selectCurrentAmmo(person);
   let target=aimFor(person,c);
   if(volleyAim==="nearest")target=nearestEnemy(person,c.battle.enemies)||target;
   else if(volleyAim==="spread"){
    target=nearestEnemy(person,c.battle.enemies,assigned)||
     nearestEnemy(person,c.battle.enemies)||target;
    if(target?.id!==undefined)assigned.add(target.id);
   }
   const result=social.useHand(person,hand,c.life,c.squad.frontier);
   const delay=volleyTiming==="ripple"?launched*volleyInterval:0;
   if(result.ok&&executeItem(result,person,c,hand,null,
    {target,holdDelay:delay,forceTurn:true}).ok)launched++;
  }
  log("🔗 "+(volleyTiming==="ripple"?"順次":"一斉")+"射撃："+launched+"人、"+
   ARROW_TYPES[ammoType].name+" / "+({focus:"集中",nearest:"各自",spread:"分散"}[volleyAim])+"照準"+
   (noGear?" / 弓なし"+noGear+"人":"")+(noAmmo?" / 矢なし"+noAmmo+"人":"")+
   (busy?" / 動作中"+busy+"人":""));
  return {ok:launched>0,count:launched};
 }
 function addRecoveredArrow(id,type="wood"){
  if(!social.recoverArrow(id,type))return {ok:false};
  if(!$("quick-config-panel").hidden)renderConfig();
  updateHUD();
  return {ok:true,arrows:social.arrowCount(id,type)};
 }
 /** A synchronized order executes once for every armed selected actor. */
  function meleeOrder(variant,available){
   const c=get(),members=c.rtsMode&&c.syncMode?c.squad.selectedAgents():[actor()];
   let started=0,unarmed=0,busy=0;
   for(const person of members){
    const hand=["right","left"].find(h=>available.includes(social.handItem(person.id,h)));
    if(!hand){unarmed++;continue;}
    const weapon=social.handItem(person.id,hand);
    const result=executeItem(social.useItem(person,weapon,c.life,c.squad.frontier),
     person,c,twoHanded.has(weapon)?"right":hand,variant||social.attackVariant(person.id,weapon));
    if(result.ok)started++;else busy++;
   }
   if(c.rtsMode&&c.syncMode)log("🔗 同期近接攻撃："+started+"人"+
     (unarmed?" / 対応武器なし"+unarmed+"人":"")+(busy?" / 実行不可"+busy+"人":""));
   return {ok:started>0,count:started};
  }
  function runCommand(command,person=null){
  const c=get(),who=person||actor();if(!who)return {ok:false};
  if(!person&&c.rtsMode&&c.syncMode&&c.squad.selected.size>1&&
     ["guard","mine","chop","emote"].includes(command)){
   let count=0;
   for(const member of c.squad.selectedAgents())if(runCommand(command,member)?.ok)count++;
   log("🔗 一斉行動「"+(COMMAND_LABELS[command]||command)+"」："+count+"人");
   return {ok:count>0,count};
  }
  const item=(gear,hand="right",variant=null)=>executeItem(
   social.useItem(who,gear,c.life,c.squad.frontier),who,c,hand,variant);
  switch(command){
   case "sweep":return meleeOrder("sweep",["sword","axe","spear","greatsword"]);
    case "thrust":return meleeOrder("thrust",["sword","spear","greatsword"]);
    case "shoot":{
    if(c.rtsMode&&c.syncMode&&c.squad.selected.size>1)return volley();
    const hand=["right","left"].find(h=>social.handItem(who.id,h)==="bow");
    if(!hand){log("🏹 弓を装備してください。");return {ok:false};}
    selectCurrentAmmo(who);
     return item("bow",hand);
   }
   case "guard":
    const hasShield=["left","right"].some(h=>social.handItem(who.id,h)==="shield");
     const hasTwoHanded=twoHanded.has(social.handItem(who.id,"right"));
     if(!hasShield&&!hasTwoHanded){
     log("🛡️ ガードには盾か両手武器を装備してください。");return {ok:false};
    }
    if(who.id==="player"){
     if(!c.actions.start("guard",c.controller,c.sample)){
      log(c.actions.message);return {ok:false,message:c.actions.message};
     }
     c.battle?.guard(1.25,hasShield?0.30:0.55);
    }else{who.status="🛡️ 防御態勢";who.guardTime=1.2;}
    log("🛡️ ガード！ 次の攻撃を軽減します。");
    updateHUD();return {ok:true};
   case "heal":return item("potion");
   case "aim":{
    const deck=decks[who.id];deck.autoTarget=!deck.autoTarget;
    updateTarget();log(deck.autoTarget?"🎯 自動ターゲットを有効にしました。":"🎯 手動ターゲットモードです。敵をタップしてください。");
    return {ok:true};
   }
   case "mine":{
    const hand=["right","left"].find(h=>social.handItem(who.id,h)==="pickaxe");
    if(!hand){log("⛏️ つるはしを装備してください。");return {ok:false};}
    return item("pickaxe",hand);
   }
   case "chop":{
    const hand=["right","left"].find(h=>social.handItem(who.id,h)==="axe");
    if(!hand){log("🪓 斧を装備してください。");return {ok:false};}
    return item("axe",hand);
   }
   case "build":return executeItem({ok:true,kind:"action",action:"build"},who,c);
   case "talk":case "gift":openSocial();if(command==="gift")$("social-gift-item").focus();return {ok:true};
   case "emote":{
    who.status="🙂 エモート";
    showSpeech(who.id,"👋 やあ！");
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
  if(c.rtsMode&&c.syncMode&&c.squad.selected.size>1){
   let count=0;
   for(const member of c.squad.selectedAgents()){
    if(social.handItem(member.id,hand)==="bow")selectCurrentAmmo(member);
     const result=executeItem(social.useHand(member,hand,c.life,c.squad.frontier),member,c,hand);
    if(result?.ok)count++;
   }
   log("🔗 "+(hand==="right"?"右手":"左手")+"の一斉行動："+count+"人");
   return {ok:count>0,count};
  }
  if(social.handItem(who.id,hand)==="bow")selectCurrentAmmo(who);
  return executeItem(social.useHand(who,hand,c.life,c.squad.frontier),who,c,hand);
 }
 function renderConfig(){
  const c=get();if(!c.squad)return;
  const sel=$("quick-actor");sel.replaceChildren();
  for(const a of c.squad.agents){const o=document.createElement("option");o.value=a.id;o.textContent=a.name;sel.append(o);}
  sel.value=configId;
  const person=c.squad.get(configId),inventory=social.inventoryFor(person,c.life,c.squad.frontier);
  $("equip-inventory-label").textContent=person.name+"の所持品："+inventory.map(item=>item.name+"×"+item.quantity).join("・");
  $("arrow-stock-label").textContent="🏹 "+person.name+"：木"+social.arrowCount(configId,"wood")+
    " / 鉄"+social.arrowCount(configId,"iron")+" / 火"+social.arrowCount(configId,"fire")+"本";
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
    if(result.ok){
     decks[configId].configure(decks[configId].selected,{hands:{[hand]:picker.value}});
     slotSignature="";quick();renderConfig();
    }
    else picker.value=social.handItem(configId,hand);
   });
   row.append(picker);hands.append(row);
  }
  $("combat-auto-target").checked=decks[configId].autoTarget;
  const root=$("quick-config-rows");root.replaceChildren();
  const types=Object.entries(DECK_KINDS);
  for(let i=0;i<5;i++){
   const slot=decks[configId].slots[i],section=document.createElement("div");
   section.className="deck-config";
   const heading=document.createElement("label");heading.textContent="行動 "+(i+1)+"：";
   const picker=document.createElement("select");
   for(const [id,meta] of types){
    const opt=document.createElement("option");opt.value=id;opt.textContent=meta.icon+" "+meta.name;picker.append(opt);
   }
   picker.value=slot.kind;
   picker.addEventListener("change",()=>{
    decks[configId].configure(i,{kind:picker.value});slotSignature="";renderConfig();quick();
    if(i===decks[configId].selected)applyDeck(c.squad.get(configId));
   });
   heading.append(picker);section.append(heading);
   const gears=document.createElement("div");gears.className="deck-gears";
   for(const hand of ["right","left"]){
    const lbl=document.createElement("label");lbl.textContent=hand==="right"?"右手":"左手";
    const gear=document.createElement("select");
    for(const id of ["none","sword","spear","greatsword","shield","axe","bow","pickaxe","book","cup"]){
     const opt=document.createElement("option");opt.value=id;
     opt.textContent=(ITEM_MAP.get(id)?.icon||"▫️")+" "+(ITEM_MAP.get(id)?.name||id);
     gear.append(opt);
    }
    gear.value=slot.hands[hand];
    gear.addEventListener("change",()=>{
     const person=c.squad.get(configId);
     if(gear.value!=="none"&&social.quantity(person,gear.value,c.life,c.squad.frontier)<1){
      log("持っていない装備は設定できません。");gear.value=decks[configId].slots[i].hands[hand];
      return;
     }
     const prior=decks[configId].slots[i].hands[hand];
     decks[configId].configure(i,{hands:{[hand]:gear.value}});
     if(i===decks[configId].selected&&!applyDeck(person)){
      decks[configId].configure(i,{hands:{[hand]:prior}});gear.value=prior;
      applyDeck(person,{quiet:true});
     }
     slotSignature="";quick();
    });
    lbl.append(gear);gears.append(lbl);
   }
   section.append(gears);
   const cmds=document.createElement("div");cmds.className="deck-commands";
   for(let j=0;j<4;j++){
    const label=document.createElement("label");label.textContent="コマンド "+(j+1);
    const sel=document.createElement("select");
    for(const [id,name] of Object.entries(COMMAND_LABELS)){
     const opt=document.createElement("option");opt.value=id;opt.textContent=name;sel.append(opt);
    }
    sel.value=slot.commands[j];
    sel.addEventListener("change",()=>{
     decks[configId].setCommand(i,j,sel.value);slotSignature="";quick();
    });
    label.append(sel);cmds.append(label);
   }
   section.append(cmds);root.append(section);
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
  trajectoryMode=["direct","lob","auto"].includes(data?.trajectoryMode)?data.trajectoryMode:"auto";
  ammoType=ARROW_TYPES[data?.ammoType]?data.ammoType:"wood";
  volleyAim=["focus","nearest","spread"].includes(data?.volleyAim)?data.volleyAim:"focus";
  volleyTiming=["simultaneous","ripple"].includes(data?.volleyTiming)?data.volleyTiming:"simultaneous";
  volleyInterval=[.12,.22,.4,.6].includes(data?.volleyInterval)?data.volleyInterval:.22;
  practiceTargetId=null;$("archery-trajectory").value=trajectoryMode;
  $("archery-ammo").value=ammoType;$("volley-aim").value=volleyAim;
  $("volley-timing").value=volleyTiming;$("volley-interval").value=String(volleyInterval);
  $("volley-interval-label").hidden=volleyTiming!=="ripple";
  decks=Object.fromEntries(get().squad.agents.map(a=>
   [a.id,new ActionSlots(data?.actionDecks?.[a.id]||null,social.actor(a.id))]));
  syncRoster();
  lastActiveActor=null;
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
 function snapshot(){return {social:social.snapshot(),trajectoryMode,ammoType,volleyAim,volleyTiming,volleyInterval,
  actionDecks:Object.fromEntries(Object.entries(decks).map(([id,d])=>[id,d.snapshot()])),
  headingUp,choice:{...choice},modelSource,modelQuality};}
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
 $("archery-ammo").addEventListener("change",e=>{ammoType=e.target.value;log("🏹 "+ARROW_TYPES[ammoType].name+"を選択");});
 $("volley-aim").addEventListener("change",e=>{volleyAim=e.target.value;log("🎯 照準："+e.target.selectedOptions[0].textContent);});
 $("volley-timing").addEventListener("change",e=>{
  volleyTiming=e.target.value;$("volley-interval-label").hidden=volleyTiming!=="ripple";
  log("🔗 号令："+e.target.selectedOptions[0].textContent);
 });
 $("volley-interval").addEventListener("change",e=>{
  volleyInterval=Number(e.target.value);
  log("🔗 順次射撃の間隔："+volleyInterval+"秒");
 });
 $("archery-trajectory").addEventListener("change",event=>{
  trajectoryMode=event.target.value;
  log("🏹 弾道："+({auto:"距離で自動切替",direct:"直射",lob:"放物線"}[trajectoryMode]||trajectoryMode));
  updateTarget();
 });
 $("practice-target-place").addEventListener("click",()=>{
  const c=get(),who=actor();
  if(!who)return;
  const x=who.control.x+Math.sin(who.control.yaw)*9;
  const z=who.control.z+Math.cos(who.control.yaw)*9;
  const geo=who.control.locationAt(x,z),surface=c.sample(geo.lat,geo.lon);
  if(surface.water||surface.river){log("水域には的を設置できません。");return;}
  const target=c.projectiles?.addTarget(who.control,{groundY:surface.elevationM});
  if(!target){log("的は最大12個まで設置可能です。");return;}
  practiceTargetId=target.id;
  updateTarget();log("🎯 前方9mに練習用の的を設置しました。");
 });
 $("combat-auto-target").addEventListener("change",()=>{
  decks[configId].autoTarget=$("combat-auto-target").checked;updateTarget();
 });
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
  const c=get(),type=$("arrow-craft-type").value,result=social.craftTypedArrows(configId,type,c.actions?.resources);
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
  if(r.ok){
   from.status="💬 会話中";to.status="💬 会話中";
   get().renderer?.triggerSocial(from.id,to.id,"talk");
   showSpeech(to.id,r.message.split("：「").slice(1).join("：「").replace(/」$/,"")||r.message);
  }
 });
 $("social-gift").addEventListener("click",()=>{
  const {from,to}=selection(),c=get();
  const giftId=$("social-gift-item").value;
  const r=social.gift(from,to,giftId,c.life,c.squad.frontier);
  $("social-result").textContent=r.message;log(r.message);
  if(r.ok){
   c.renderer?.triggerSocial(from.id,to.id,"gift");
   showSpeech(to.id,"🎁 ありがとう！");
   showEffect({kind:"notice",actorId:to.id,text:"♥ +"+(giftId==="meal"?7:4)});
   saveLifeJournal();gifts();updateHUD();
  }
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
  if(/^[1-5]$/.test(e.key)){selectDeck(Number(e.key)-1);}
  if(e.key.toLowerCase()==="u"){e.preventDefault();useItem();}
  if(e.key.toLowerCase()==="r"){e.preventDefault();useHand("right");}
  if(e.key.toLowerCase()==="l"){e.preventDefault();useHand("left");}
 });
 return {quick,restore,snapshot,syncRoster,updateCamera,loadModels,equipmentInventory,equipHandFromInventory,
  hasTacticalArrow:id=>social.arrowCount(id,"wood")>0,
  consumeTacticalArrow:id=>social.spendArrow(id,"wood"),
  updateTarget,selectTargetAt,isCombat,volley,addRecoveredArrow,
  attackVariantFor:(id,kind)=>social.attackVariant(id,kind)};
}
