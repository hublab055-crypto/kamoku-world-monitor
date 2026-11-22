import {TOWN_NAMES,TOWN_TOPICS,TOWN_WARES} from "./town-life.mjs?v=0.8s-towns";

/** Mobile-sized town interaction desk. All mutations go through TownLife. */
export function installTownInteractionUI({get,onChange=()=>{},onNotice=()=>{}}){
 const $=id=>document.getElementById(id);
 const panel=$("town-interaction-panel"),status=$("town-interaction-status");
 const title=$("town-interaction-title"),detail=$("town-interaction-detail"),actions=$("town-interaction-actions");
 const toggle=$("viewport-town");
 let selection=null;
 const button=(label,action,disabled=false)=>{
  const node=document.createElement("button");
  node.type="button";node.textContent=label;node.disabled=disabled;node.dataset.townAction=action;
  return node;
 };
 function close(force=false){
  panel.hidden=true;toggle.setAttribute("aria-expanded","false");
 }
 function setStatus(message){status.textContent=message;}
 function currentSelection(){
  const {townId,town}=get();
  return selection?town.find(townId,selection.id,selection.source):null;
 }
 function render(){
  if(panel.hidden)return;
  const {town,townId,controller,actions:resources,life}=get();
  const inside=town.inside,subject=currentSelection();
  const room=inside?town.find(townId,inside.buildingId,"village"):null;
  const chosen=room||subject;
  actions.replaceChildren();
  if(!chosen){
   title.textContent="🏘️ 街の生活";
   detail.textContent=townId==="pioneer"?
    "街・村へ来訪すると、住人や商店と交流できます。":
    "🗺️ マップ一覧の「人物」「建物」から対象を選んでください。";
   if(inside)actions.append(button("🚪 外へ出る","leave"));
   return;
  }
  title.textContent=(chosen.kind==="resident"?"🧑 ":"🏠 ")+chosen.title;
  const distance=Math.hypot(controller.x-chosen.x,controller.z-chosen.z);
  const near=town.canInteract(townId,controller,chosen,{radius:chosen.kind==="resident"?6:9});
  detail.textContent=inside?"屋内で歩行できます（スティック・WASD）。退出は「外へ出る」 / 所持 "+town.coins+" コイン":
   (chosen.kind==="resident"?"住民の行動："+chosen.activity+" / ":"施設："+(TOWN_NAMES[chosen.type]||"")+" / ")+
   "距離 "+distance.toFixed(1)+"m / "+(near.ok?"交流できます":"近づいて操作してください")+
   " / 所持 "+town.coins+" コイン";
  if(room){
   actions.append(button("🚪 外へ出る","leave"));
   const wares=TOWN_WARES[room.type]||[];
   if(wares.length)addTrade(wares,resources,life,town);
   return;
  }
  if(chosen.kind==="resident"){
   const row=document.createElement("div");row.className="town-interaction-topics";
   for(const topic of TOWN_TOPICS)row.append(button("💬 "+topic.title,"talk:"+topic.id,!near.ok));
   actions.append(row);
   const bond=town.friendship[townId+":"+chosen.id]||0;
   const note=document.createElement("small");note.textContent="親しさ："+bond+"/100";
   actions.append(note);
  }else{
   if(!["well","watchtower"].includes(chosen.type))
    actions.append(button("🚪 建物に入る","enter",!near.ok));
   const wares=TOWN_WARES[chosen.type]||[];
   if(wares.length)addTrade(wares,resources,life,town,!near.ok);
   if(!wares.length){
    const p=document.createElement("small");
    p.textContent="ここでは見学や住民との交流ができます。";
    actions.append(p);
   }
  }
 }
 function addTrade(wares,resources,life,town,far=false){
  const label=document.createElement("strong");label.textContent="🛍️ 商品一覧";
  actions.append(label);
  for(const ware of wares){
   const store=ware.bag==="life"?life?.inventory:resources?.resources;
   const line=document.createElement("div");line.className="town-trade-line";
   const name=document.createElement("span");name.textContent=ware.name+"（所持 "+(store?.[ware.item]||0)+"）";
   const price=document.createElement("small");price.textContent="買 "+ware.price+" / 売 "+Math.max(1,Math.floor(ware.price*.6));
   const buy=button("買う","buy:"+ware.item,far||town.coins<ware.price);
   const sell=button("売る","sell:"+ware.item,far||!(store?.[ware.item]>0));
   line.append(name,price,buy,sell);actions.append(line);
  }
 }
 function open(entry){
  const {town,townId}=get();
  if(town.inside)selection={id:town.inside.buildingId,source:"village"};
  else if(entry?.source==="village"||entry?.source==="resident")
   selection={id:entry.id,source:entry.source};
  else selection=null;
  panel.hidden=false;toggle.setAttribute("aria-expanded","true");
  setStatus("会話や買い物、入室は対象の近くで操作してください");
  render();
 }
 function openNearby(){
  const {town,townId,controller}=get();
  const layout=town.layout(townId),candidates=[
   ...layout.residents.map(p=>({...p,id:p.id,source:"resident"})),
   ...layout.buildings.map((p,i)=>({...p,id:"village-"+i,source:"village"}))
  ];
  candidates.sort((a,b)=>town.distance(controller,a)-town.distance(controller,b));
  const nearest=candidates.find(p=>town.distance(controller,p)<10);
  open(nearest||null);
 }
 toggle.addEventListener("click",()=>panel.hidden?openNearby():close());
 $("town-interaction-close").addEventListener("click",()=>close());
 actions.addEventListener("click",event=>{
  const target=event.target.closest("button[data-town-action]");
  if(!target||!actions.contains(target))return;
  const {town,townId,controller,actions:resource,life,day}=get();
  const chosen=currentSelection(),value=target.dataset.townAction;
  let output=null;
  if(value==="leave")output=town.leave();
  else if(value==="enter"&&chosen)output=town.enter(townId,chosen.id,controller);
  else if(value.startsWith("talk:")&&chosen)
   output=town.dialogue(townId,chosen.id,value.slice(5),controller,day);
  else if((value.startsWith("buy:")||value.startsWith("sell:"))&&chosen)
   output=town.trade(townId,chosen.id,value.slice(value.indexOf(":")+1),
    value.slice(0,value.indexOf(":")),controller,resource,life);
  if(!output)return;
  setStatus(output.message);
  if(output.ok){onChange();onNotice(output.message);}
  render();
 });
 return {open,openNearby,close,refresh:render,get selected(){return selection;}};
}
