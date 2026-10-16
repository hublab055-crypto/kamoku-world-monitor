/* Accessible lifestyle UI. All text is rendered through textContent (no user HTML). */
import {CATALOG,ITEM_NAMES,MATERIAL_NAMES} from "./lifestyle.mjs";
const actionLabels={
 sleep:"💤 寝る",rest:"😌 休む",sit:"🪑 座る",stand:"↗ 立つ",
 read:"📖 読む",takeBook:"📚 本を選ぶ",light:"🔥 点火・点灯",extinguish:"🌙 消す",
 warm:"♨️ 暖まる",cook:"🍲 調理",wash:"🧼 洗う",fetchWater:"💧 水を汲む",
 serve:"🍽️ 配膳",eat:"🥄 食べる",store:"🎒 持ち物を見る",
 enter:"⛺ 中に入る",exit:"🌿 外に出る",pack:"🎒 回収する"
};
const humanCost=cost=>Object.entries(cost).map(([k,n])=>(MATERIAL_NAMES[k]||k)+" "+n).join("・");
function button(text,action,attrs={},disabled=false){
 const b=document.createElement("button");b.type="button";b.textContent=text;
 b.dataset.action=action;b.disabled=disabled;
 for(const [k,v] of Object.entries(attrs))b.dataset[k]=String(v);
 return b;
}
function makeCard(title,description,subtext){
 const card=document.createElement("article");card.className="life-item";
 const name=document.createElement("h3");name.textContent=title;
 const desc=document.createElement("p");desc.textContent=description;
 const extra=document.createElement("small");extra.textContent=subtext;
 const commands=document.createElement("div");commands.className="life-buttons";
 card.append(name,desc,extra,commands);
 return {card,commands};
}
export function installLifestyleUI({getContext,onChange,onBook,onSleep,notify}){
 let activeTab="craft",focusedId=null,placement=null,returnFocus=null;
 const $=id=>document.getElementById(id);
 const root=$("life-overlay"),list=$("life-list"),message=$("life-message");
 function ctx(){return getContext();}
 function say(text){message.textContent=text;notify(text);}
 function refresh(){
  const {life,actions,access,controller}=ctx(),hut=access.inside;
  updateStats();
  $("life-place").hidden=!placement;list.hidden=!!placement;
  for(const btn of root.querySelectorAll("[data-life-tab]")){
   btn.setAttribute("aria-pressed",String(btn.dataset.lifeTab===activeTab));
  }
  if(placement){drawPlacement();return;}
  list.replaceChildren();
  if(activeTab==="craft"){
   for(const [kind,entry] of Object.entries(CATALOG)){
    const quantity=life.count(kind);
    const {card,commands}=makeCard(entry.emoji+" "+entry.name,
     entry.category==="furniture"?"家具：小屋の中に配置可能":
     entry.category==="deployable"?"携帯設備：持ち運びと野外設置が可能":"生活道具：調理や食事に使います",
     "必要 "+humanCost(entry.cost)+"　｜　所持 "+quantity);
    const can=Object.entries(entry.cost).every(([k,n])=>(actions.resources[k]||0)>=n);
    commands.append(button("🔨 作る","craft",{kind},!can));
    if(entry.inside&&hut&&quantity>0)commands.append(button("🏠 設置","start-place",{kind}));
    if(entry.category==="deployable"&&quantity>0&&!hut)
     commands.append(button("⛺ 地面に設置","deploy",{kind}));
    list.append(card);
   }
  }else if(activeTab==="inventory"){
   const all=[...Object.entries(life.inventory).filter(([,n])=>n>0)];
   if(!all.length)empty("まだ持ち物がありません。");
   for(const [kind,quantity] of all){
    const entry=CATALOG[kind];
    const title=(entry?.emoji||"📦")+" "+(entry?.name||ITEM_NAMES[kind]||kind);
    const {card,commands}=makeCard(title,"持ち物として携帯中",
     "数量："+quantity);
    if(entry?.inside&&hut)commands.append(button("🏠 家具として設置","start-place",{kind}));
    if(entry?.category==="deployable"&&!hut)commands.append(button("⛺ 設置","deploy",{kind}));
    if(["cup","bowl","spoon"].includes(kind))commands.append(button("使う","use-item",{kind}));
    list.append(card);
   }
  }else if(activeTab==="home"){
   if(!hut){empty("小屋の中で家具を使いましょう。ドアを開けて中に入ってください。");return;}
   const all=life.atHut(hut);
   if(!all.length)empty("家具がありません。クラフトして配置できます。");
   for(const f of all){
    const type=CATALOG[f.kind],name=type.emoji+" "+type.name;
    const {card,commands}=makeCard(name+" #"+f.id,
      f.lit?"🔥 使用中・点灯中":"設置位置 x:"+f.x.toFixed(1)+"m / z:"+f.z.toFixed(1)+"m",
      "向き "+(f.rotation||0)+"°"+(focusedId===f.id?"　← 選択した家具":""));
    const options=type.actions||[];
    for(const action of options){
     if(action==="takeBook")continue;
     if(action==="stand"&&life.activity==="idle")continue;
     if(action==="sit"&&life.activity==="sit"&&life.activityFurnitureId===f.id)continue;
     if(action==="light"&&f.lit||action==="extinguish"&&!f.lit)continue;
     commands.append(button(actionLabels[action]||action,"use",{id:f.id,command:action}));
    }
    commands.append(button("📦 家具を回収","pickup",{id:f.id}));
    list.append(card);
   }
  }else if(activeTab==="camp"){
   const nearby=life.nearbyCamp(controller);
   if(life.insideTentId!=null){
    const {card,commands}=makeCard("⛺ テントの中","雨風をしのいで過ごせます。","移動を再開する前に外に出てください。");
    commands.append(button("🌿 テントから出る","exit-tent"));
    list.append(card);
   }
   if(!hut){
    const {card,commands}=makeCard("🌿 野外で採集","食材と水を入手します。","食材を2個・水を1杯");
    commands.append(button("🌱 食材を集める","forage"));
    list.append(card);
   }
   for(const obj of life.deployments){
    const type=CATALOG[obj.kind],dist=Math.hypot(controller.x-obj.x,controller.z-obj.z);
    const {card,commands}=makeCard(type.emoji+" "+type.name+" #"+obj.id,
     "設置済み / 距離 "+dist.toFixed(1)+"m",focusedId===obj.id?"選択中":"");
    if(dist<=4){
     if(obj.kind==="tent"&&life.insideTentId!==obj.id)commands.append(button("⛺ 入る","camp-use",{id:obj.id,command:"enter"}));
     commands.append(button("💤 休む・寝る","camp-use",{id:obj.id,command:"sleep"}));
     commands.append(button("🎒 回収する","camp-use",{id:obj.id,command:"pack"},life.insideTentId===obj.id));
    }else commands.append(button("近くまで歩いて操作","disabled",{},true));
    list.append(card);
   }
   for(const kind of ["tent","bedroll"]){
    if(life.count(kind)>0&&!hut){
     const type=CATALOG[kind];
     const {card,commands}=makeCard(type.emoji+" "+type.name+"（持ち物）",
      "設置すると地面に実体が現れ、使用後に回収できます。","所持数 "+life.count(kind));
     commands.append(button("⛺ 設置する","deploy",{kind}));
     list.append(card);
    }
   }
   if(!nearby&&life.deployments.length===0&&life.count("tent")===0&&life.count("bedroll")===0)
    empty("テントやベッドロールをクラフトすると野外に設置できます。");
  }
 }
 function empty(text){
  const p=document.createElement("p");p.textContent=text;p.className="life-empty";list.append(p);
 }
 function updateStats(){
  if(root.hidden)return;
  const {life,actions}=ctx(),v=life.stats;const bar=$("life-stats");bar.replaceChildren();
  for(const part of [
   "⚡ 体力 "+Math.round(v.stamina)+"%","🍽️ 空腹 "+Math.round(v.hunger)+"%",
   "🧼 清潔 "+Math.round(v.cleanliness)+"%","🔥 体温 "+Math.round(v.warmth)+"%",
   "📚 知識 "+v.knowledge.toFixed(1),"🌲 木 "+actions.resources.wood,"🪨 石 "+actions.resources.stone,
   "🧵 繊維 "+actions.resources.fiber,"🪵 粘土 "+actions.resources.clay,"⚙ 金属 "+actions.resources.metal
  ]){const item=document.createElement("span");item.textContent=part;bar.append(item);}
 }
 function showPlacement(kind){
  const {life,access}=ctx(),hut=access.inside;
  if(!hut){say("小屋の中で設置してください。");return;}
  if(life.count(kind)<1){say("家具の持ち物がありません。");return;}
  const coords=[[-1.65,1.35],[1.64,1.29],[-1.65,.65],[1.65,.55],[-1.65,-.5],
   [1.65,-.6],[-1.3,-1.55],[1.65,-1.45],[0,-.75],[0,0]];
  const position=coords.find(([x,z])=>life.canPlace(kind,hut,x,z,0))||[0,0];
  placement={kind,x:position[0],z:position[1],rotation:0};
  drawPlacement();
  refresh();
 }
 function drawPlacement(){
  if(!placement)return;
  const {life,access}=ctx(),kind=placement.kind,type=CATALOG[kind],hut=access.inside;
  $("life-place-title").textContent=type.emoji+" "+type.name+" の配置";
  const mark=$("life-place-mark"),valid=life.canPlace(kind,hut,placement.x,placement.z,placement.rotation);
  mark.textContent=type.emoji+" "+type.name;
  mark.style.left=((placement.x+2.49)/4.98*100)+"%";
  mark.style.top=((placement.z+2.13)/4.26*100)+"%";
  mark.style.rotate=placement.rotation+"deg";
  mark.classList.toggle("invalid",!valid);
  $("life-place-coords").textContent="左右 X: "+placement.x.toFixed(1)+"m / 奥行 Z: "+
   placement.z.toFixed(1)+"m / 回転: "+placement.rotation+"°"+(valid?" ✓ 設置可能":" ✕ 設置不可");
  $("life-place-confirm").disabled=!valid;
 }
 function open(tab="craft",focusId=null){
  returnFocus=document.activeElement;
  activeTab=["craft","inventory","home","camp"].includes(tab)?tab:"craft";
  focusedId=focusId;
  placement=null;root.hidden=false;
  const {controller}=ctx();controller.clearMoveTarget();
  refresh();$("life-close").focus();
 }
 function close(){
  root.hidden=true;placement=null;focusedId=null;
  returnFocus?.focus?.();
 }
 function action(event){
  const target=event.target.closest("button[data-action]");if(!target||target.disabled)return;
  const d=target.dataset,what=d.action,context=ctx();
  const {life,actions,access,controller}=context,kind=d.kind,id=Number(d.id);
  let outcome=null;
  if(what==="craft")outcome=life.craft(kind,actions.resources);
  else if(what==="start-place"){showPlacement(kind);return;}
  else if(what==="deploy"){
   if(access.inside||life.insideTentId!==null)outcome={ok:false,message:"屋外へ出てから設置してください。"};
   else outcome=life.deploy(kind,controller,context.sample,actions.structures);
  }
  else if(what==="pickup")outcome=life.pickUpFurniture(id,access.inside);
  else if(what==="forage"){
   if(access.inside)outcome={ok:false,message:"小屋の外で採集してください。"};
   else outcome=life.forage(controller);
  }
  else if(what==="exit-tent")outcome=life.exitTent(controller);
  else if(what==="camp-use"){
   outcome=life.useCamp(id,d.command,controller);
   if(outcome.ok&&d.command==="sleep")onSleep();
  }
  else if(what==="use-item")outcome=life.useItem(kind);
  else if(what==="use"){
   outcome=life.use(id,d.command,access.inside,controller,actions.resources);
   if(outcome.ok&&["read","takeBook"].includes(d.command)){onChange();close();onBook();return;}
   if(outcome.ok&&d.command==="sleep")onSleep();
  }
  if(outcome){say(outcome.message);if(outcome.ok)onChange();refresh();}
 }
 root.addEventListener("click",action);
 root.querySelectorAll("[data-life-tab]").forEach(button=>button.addEventListener("click",()=>{
  activeTab=button.dataset.lifeTab;placement=null;focusedId=null;refresh();
 }));
 $("life-close").addEventListener("click",close);
 $("life-place-cancel").addEventListener("click",()=>{placement=null;refresh();});
 $("life-rotate").addEventListener("click",()=>{if(!placement)return;
  placement.rotation=(placement.rotation+90)%360;drawPlacement();
 });
 root.querySelectorAll("[data-life-move]").forEach(button=>button.addEventListener("click",()=>{
  if(!placement)return;
  const op=button.dataset.lifeMove,axis=op[0],dir=op[1]==="+"?1:-1;
  const limit=axis==="x"?2.3:2;
  placement[axis]=Math.round(Math.max(-limit,Math.min(limit,placement[axis]+dir*.25))*100)/100;
  drawPlacement();
 }));
 $("life-floor-map").addEventListener("pointerdown",event=>{
  if(!placement)return;
  const box=$("life-floor-map").getBoundingClientRect();
  placement.x=Math.round((((event.clientX-box.left)/box.width)*4.98-2.49)*4)/4;
  placement.z=Math.round((((event.clientY-box.top)/box.height)*4.26-2.13)*4)/4;
  drawPlacement();
 });
 $("life-place-confirm").addEventListener("click",()=>{
  if(!placement)return;
  const {life,access}=ctx(),p=placement;
  const outcome=life.placeFurniture(p.kind,access.inside,p.x,p.z,p.rotation);
  say(outcome.message);
  if(outcome.ok){placement=null;activeTab="home";onChange();}
  refresh();
 });
 document.getElementById("viewport-life").addEventListener("click",()=>open("craft"));
 document.getElementById("toolbar-life").addEventListener("click",()=>open("craft"));
 window.addEventListener("keydown",event=>{
  if(root.hidden)return;
  if(event.key==="Escape"){event.preventDefault();close();}
  if(["w","a","s","d","q","e","f","ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(event.key))
   event.preventDefault();
  event.stopImmediatePropagation();
 },true);
 return {open,close,refresh,updateStats};
}
