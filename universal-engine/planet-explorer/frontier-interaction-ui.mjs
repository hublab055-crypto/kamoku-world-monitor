import {SocialEquipment,ITEM_OPTIONS,ITEM_MAP} from "./social-equipment.mjs";
import {parseFrontierGLB,findFrontierGLB,cachedFrontierGLB} from "./frontier-glb.mjs";

/** Browser UI adapter; domain logic lives in SocialEquipment. */
export function installFrontierInteractions({get,log,updateHUD,openBookLibrary,saveLifeJournal}){
 const $=id=>document.getElementById(id);
 let social=new SocialEquipment(),headingUp=false,choice={player:"male",scout:"female",artisan:"male"};
 let configId="player",slotSignature="";
 const actor=()=>{const c=get();return (c.rtsMode?c.squad?.selectedAgents()[0]:null)||c.squad?.get("player");};
 function quick(){
  const c=get();if(!c.squad)return;
  const who=actor(),a=social.actor(who.id);
  const key=who.id+":"+a.selected+":"+a.slots.join(",");
  if(slotSignature===key)return;slotSignature=key;
  const root=$("quick-slots");root.replaceChildren();
  a.slots.forEach((id,i)=>{
   const item=ITEM_MAP.get(id),b=document.createElement("button");b.type="button";
   b.setAttribute("aria-pressed",String(i===a.selected));
   b.title=(i+1)+": "+(item?.name||id);
   b.append(document.createTextNode((item?.icon||"▫️")+(i+1)));
   const caption=document.createElement("span");caption.textContent=item?.name||id;b.append(caption);
   b.addEventListener("click",()=>{social.select(who.id,i);slotSignature="";quick();});
   root.append(b);
  });
 }
 function use(){
  const c=get(),who=actor();if(!who)return;
  const result=social.use(who,c.life,c.squad.frontier);
  if(!result.ok){log(result.message);return;}
  if(result.kind==="book"){openBookLibrary();return;}
  if(result.kind==="action"){
   if(who.id!=="player"){log("NPCの手動武器モーションは未対応です。装備設定は保存できます。");return;}
   c.actions.start(result.action,c.controller,(lat,lon)=>c.terrain.sample?c.terrain.sample(lat,lon):c.terrain.surface(lat,lon));
   log(c.actions.message);
  }else{
   log(result.message);saveLifeJournal();
  }
  updateHUD();
 }
 // The source terrain object does not guarantee a .surface() method; call the
 // provided sample function instead (same terrainSurface used by the main app).
 function useItem(){
  const c=get(),who=actor();if(!who)return;
  const result=social.use(who,c.life,c.squad.frontier);
  if(!result.ok){log(result.message);return;}
  if(result.kind==="book"){openBookLibrary();return;}
  if(result.kind==="action"){
   if(who.id!=="player"){log("NPCの手動道具モーションは未対応です。");return;}
   c.actions.start(result.action,c.controller,c.sample);
   log(c.actions.message);
  }else{log(result.message);saveLifeJournal();}
  updateHUD();
 }
 function renderConfig(){
  const c=get();if(!c.squad)return;
  const sel=$("quick-actor");sel.replaceChildren();
  for(const a of c.squad.agents){const o=document.createElement("option");o.value=a.id;o.textContent=a.name;sel.append(o);}
  sel.value=configId;
  const root=$("quick-config-rows");root.replaceChildren();
  for(let i=0;i<5;i++){
   const label=document.createElement("label");label.textContent="装備 "+(i+1);
   const picker=document.createElement("select");picker.dataset.index=String(i);
   for(const [id,name,icon] of ITEM_OPTIONS){const o=document.createElement("option");o.value=id;o.textContent=icon+" "+name;picker.append(o);}
   picker.value=social.actor(configId).slots[i];
   picker.addEventListener("change",()=>{social.equip(configId,i,picker.value);slotSignature="";quick();});
   label.append(picker);root.append(label);
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
  if(get().renderer)get().renderer.glbFor={...choice};
  $("camera-rts-heading").checked=headingUp;$("rts-heading-up").checked=headingUp;
  slotSignature="";quick();updateCamera();
  $("frontier-glb-choice").value=choice[$("frontier-glb-actor").value]||"male";
 }
 function snapshot(){return {social:social.snapshot(),headingUp,choice:{...choice}};}
 async function loadModels(renderer){
  const summary=[];
  for(const sex of ["male","female"]){
   try{
    const bytes=await findFrontierGLB(sex);
    if(renderer!==get().renderer)return;
    if(!bytes){summary.push(sex+" 未登録");continue;}
    const parsed=parseFrontierGLB(bytes);
    renderer.setFrontierGlb(sex,parsed);
    summary.push(sex+" "+parsed.triangles.toLocaleString()+"三角形");
   }catch(err){summary.push(sex+" 読込失敗");console.warn("Frontier avatar:",err);}
  }
  if(renderer===get().renderer)$("frontier-glb-status").textContent=summary.join(" / ")+"。未登録時は従来モデルになります。";
 }
 $("quick-use").addEventListener("click",useItem);
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
  if(r.ok){from.status="💬 会話中";to.status="💬 会話中";}
 });
 $("social-gift").addEventListener("click",()=>{
  const {from,to}=selection(),c=get();
  const r=social.gift(from,to,$("social-gift-item").value,c.life,c.squad.frontier);
  $("social-result").textContent=r.message;log(r.message);
  if(r.ok){saveLifeJournal();gifts();updateHUD();}
 });
 $("rts-heading-up").addEventListener("change",e=>setHeading(e.target.checked));
 $("camera-rts-heading").addEventListener("change",e=>setHeading(e.target.checked));
 $("frontier-glb-actor").addEventListener("change",()=>{$("frontier-glb-choice").value=choice[$("frontier-glb-actor").value];});
 $("frontier-glb-choice").addEventListener("change",()=>{
  choice[$("frontier-glb-actor").value]=$("frontier-glb-choice").value;
  const c=get();if(c.renderer)c.renderer.glbFor={...choice};
 });
 $("frontier-glb-input").addEventListener("change",async e=>{
  const file=e.target.files?.[0],sex=$("frontier-glb-sex").value;if(!file)return;
  try{
   if(!/\.glb$/i.test(file.name)||file.size>85*1024*1024)throw Error("85MB以内の.glbを選択してください。ZIPは展開が必要です。");
   const raw=await file.arrayBuffer(),parsed=parseFrontierGLB(raw),c=get();
   c.renderer.setFrontierGlb(sex,parsed);
   try{await cachedFrontierGLB(sex,raw);}catch(err){log("端末保存できませんでした: "+err.message);}
   $("frontier-glb-status").textContent="✅ "+sex+" "+parsed.triangles.toLocaleString()+"三角形（バインドポーズ・簡易色表示）";
   log("GLBを適用しました。");
  }catch(err){$("frontier-glb-status").textContent="GLB読み込み失敗: "+err.message;}
  e.target.value="";
 });
 window.addEventListener("keydown",e=>{
  if(e.target?.closest?.("input,select,textarea,[contenteditable=true]"))return;
  const c=get();if(!c.squad)return;
  if(/^[1-5]$/.test(e.key)){social.select(actor().id,Number(e.key)-1);slotSignature="";quick();}
  if(e.key.toLowerCase()==="u"){e.preventDefault();useItem();}
 });
 return {quick,restore,snapshot,updateCamera,loadModels};
}
