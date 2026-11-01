/**
 * Universal Engine — menu > display.
 * Presentation state is independent of gameplay's element.hidden / save slots.
 * A permanently available eye button prevents an all-hidden lockout.
 */
export const UI_VISIBILITY_STORAGE_KEY="universal-engine:ui-visibility:v1";

export function parseUiVisibility(raw){
 try{
  const data=typeof raw==="string"?JSON.parse(raw):raw;
  if(!data||typeof data!=="object"||Array.isArray(data))return {};
  return Object.fromEntries(Object.entries(data).filter(([key,value])=>
   /^[a-z0-9:._-]{1,100}$/i.test(key)&&value===false));
 }catch(_){return {};}
}

const GROUPS=[
 {title:"基本操作",items:[
  ["stick-area","移動スティック"],["mobile-action-buttons","スマホの4アクション"],
  ["action-pad","従来の道具・ジャンプ"],["hand-actions","左右の手の操作"],
  ["action-command-bar","アクションコマンド"],["quick-items","5つの行動スロット"],
  ["archery-mode-bar","弓・矢の設定"],["rts-controls","RTS操作"],
  ["door-controls","扉の操作"],["mobile-dpad","画面下部の方向キー",".mobile-dpad"]
 ]},
 {title:"HUD・情報",items:[
  ["avatar-vitals","HP・体力・空腹など",".avatar-vitals"],
  ["viewport-overlay","高度・座標",".viewport-overlay"],
  ["walk-note","画面操作ガイド"],["mode-bar","移動モードの表示",".mode-bar"],
  ["orbit-city-controls","惑星の都市選択"],["orbit-landing-preview","降下先選択"],
  ["orbit-city-pins","惑星の都市マーカー"],["actor-marker","アバター位置マーカー"],
  ["rts-markers","RTSマーカー"],["aim-reticle","照準"],
  ["combat-target-label","攻撃対象"],["marine-swim-hud","水泳・潜水"],
  ["fishing-reel-hud","釣りリール"],["railway-onboard-hud","列車乗車HUD"],
  ["railway-security-hud","治安・拘束HUD"]
 ]},
 {title:"ゲーム画面のメニュー",items:[
  ["viewport-quick-panel","操作メニュー内の項目"],["viewport-toolbar","詳細ツールバー"],
  ["mobile-action-settings","スマホ操作の割当設定"],
  ["game-console","ゲームログ・コンソール"],["auto-panel","自動行動"],
  ["quick-config-panel","装備と行動の編集"],["group-panel","部隊管理"],
  ["rts-multi-group-panel","複数部隊管理"],["owner-panel","オーナー編集"],
  ["book-overlay","本棚・読書"],["life-overlay","生活・クラフト"],
  ["strategy-panel","国家・外交"],["territory-panel","土地・財政"],
  ["map-directory-panel","マップ一覧"],["map-route-panel","目的地マップ"],
  ["settlement-travel-panel","街・村の選択"],["railway-panel","鉄道"],
  ["harbor-panel","港・客船"],["town-interaction-panel","街の生活"],
  ["marine-panel","海・船"],["fauna-panel","動物・騎乗"],["farm-panel","農業"],
  ["social-panel","交流・会話"],["page-share-overlay","QRコード共有"]
 ]},
 {title:"画面外の情報・設定",items:[
  ["view-header","画面上部の操作",".view-header"],
  ["xr-controls","VR・MR設定"],["avatar-settings","人物の設定"],
  ["frontier-glb-settings","GLBアバター設定"],["camera-settings","カメラ設定"],
  ["info-grid","探索・環境情報",".info-grid"],["bottom-info","エンジン・ログ",".bottom-info"]
 ]}
];

function labelFor(element){
 const title=element.getAttribute("aria-label")||
  element.querySelector(":scope > strong, :scope > h2, :scope > .fauna-panel-top strong")?.textContent||
  element.textContent?.trim().slice(0,25)||
  element.id;
 return title.replace(/\s+/g," ").slice(0,48);
}

export function installUiVisibility({doc=document,store=globalThis.localStorage}={}){
 const panel=doc.getElementById("ui-display-panel");
 const list=doc.getElementById("ui-display-list");
 const access=doc.getElementById("ui-display-access");
 if(!panel||!list||!access)return null;
 const registered=new Map();
 let preferences={};
 try{preferences=parseUiVisibility(store?.getItem(UI_VISIBILITY_STORAGE_KEY));}catch(_){}
 let lastOpener=access;

 function add(key,label,element,group){
  if(!element||registered.has(key)||element===panel||element===access)return;
  registered.set(key,{key,label,element,group});
 }
 function collect(){
  for(const group of GROUPS)for(const [key,label,selector] of group.items)
   add(key,label,selector?doc.querySelector(selector):doc.getElementById(key),group.title);

  // Buttons can be hidden separately without removing the entire menu.
  for(const el of doc.querySelectorAll(".viewport-compact-bar > button[id], #viewport-quick-panel > button[id], #viewport-toolbar > button[id], .view-header .quick-actions > button[id]")){
   if(el.id==="ui-display-access"||el.id.startsWith("ui-display-"))continue;
   add(el.id,labelFor(el),el,"メニュー内の個別ボタン");
  }

  // New systems may append panels later; surface these automatically too.
  const canvas=doc.querySelector(".canvas-wrap");
  const exclude=new Set(["world","descent-atmosphere","descent-glow","world-hit-flash",
   "world-fx-layer","harvest-fx-layer","construction-line-preview","fatal",
   "viewport-actions","ui-display-panel","orbit-pick-marker"]);
  if(canvas)for(const el of canvas.children){
   if(!el.id||exclude.has(el.id)||el.getAttribute("aria-hidden")==="true")continue;
   add(el.id,labelFor(el),el,"その他のUI");
  }
 }
 function apply(){
  for(const {key,element} of registered.values()){
   if(preferences[key]===false)element.setAttribute("data-ui-user-hidden","true");
   else element.removeAttribute("data-ui-user-hidden");
  }
 }
 function save(){
  try{store?.setItem(UI_VISIBILITY_STORAGE_KEY,JSON.stringify(preferences));}catch(_){}
 }
 function setVisible(key,visible){
  if(!registered.has(key))return;
  if(visible)delete preferences[key];else preferences[key]=false;
  apply();save();
 }
 function buildList(){
  list.replaceChildren();
  const groups=[...new Set([...GROUPS.map(g=>g.title), "メニュー内の個別ボタン","その他のUI"])];
  for(const group of groups){
   const entries=[...registered.values()].filter(item=>item.group===group);
   if(!entries.length)continue;
   const details=doc.createElement("details");
   details.className="ui-display-group";
   if(group==="基本操作"||group==="HUD・情報")details.open=true;
   const summary=doc.createElement("summary");
   summary.textContent=group+"（"+entries.length+"）";
   details.append(summary);
   const options=doc.createElement("div");
   options.className="ui-display-options";
   for(const entry of entries){
    const label=doc.createElement("label");
    const input=doc.createElement("input");
    input.type="checkbox";
    input.dataset.uiVisibilityKey=entry.key;
    input.checked=preferences[entry.key]!==false;
    input.addEventListener("change",()=>setVisible(entry.key,input.checked));
    label.append(input,doc.createTextNode(" "+entry.label));
    options.append(label);
   }
   details.append(options);list.append(details);
  }
 }
 function refresh(){collect();apply();if(!panel.hidden)buildList();}
 function open(opener=access){
  lastOpener=opener;
  refresh();panel.hidden=false;
  access.setAttribute("aria-expanded","true");
  panel.querySelector("#ui-display-close")?.focus();
 }
 function close(){
  panel.hidden=true;access.setAttribute("aria-expanded","false");
  if(lastOpener?.isConnected&&!lastOpener.closest("[data-ui-user-hidden='true']"))
   lastOpener.focus();
  else access.focus();
 }
 function fromMenu(id){
  const button=doc.getElementById(id);
  button?.addEventListener("click",()=>{
   const menu=doc.getElementById("viewport-quick-panel");
   if(menu&&!menu.hidden)doc.getElementById("viewport-quick-toggle")?.click();
   open(button);
  });
 }
 access.addEventListener("click",()=>panel.hidden?open(access):close());
 fromMenu("ui-display-from-menu");
 fromMenu("ui-display-from-toolbar");
 doc.getElementById("ui-display-close")?.addEventListener("click",close);
 doc.getElementById("ui-display-all-show")?.addEventListener("click",()=>{
  preferences={};apply();save();buildList();
 });
 doc.getElementById("ui-display-all-hide")?.addEventListener("click",()=>{
  for(const key of registered.keys())preferences[key]=false;
  apply();save();buildList();
 });
 doc.getElementById("ui-display-reset")?.addEventListener("click",()=>{
  preferences={};apply();
  try{store?.removeItem(UI_VISIBILITY_STORAGE_KEY);}catch(_){}
  buildList();
 });
 const onEscape=event=>{
  if(event.key!=="Escape"||panel.hidden)return;
  event.preventDefault();event.stopImmediatePropagation();close();
 };
 doc.defaultView?.addEventListener("keydown",onEscape,true);
 refresh();
 const canvas=doc.querySelector(".canvas-wrap");
 const Observer=doc.defaultView?.MutationObserver;
 const observer=canvas&&Observer?new Observer(changes=>{
  if(changes.some(change=>change.addedNodes.length))refresh();
 }):null;
 observer?.observe(canvas,{childList:true});
 return {refresh,setVisible,getVisible:key=>preferences[key]!==false,close,
  destroy(){observer?.disconnect();doc.defaultView?.removeEventListener("keydown",onEscape,true);}};
}
if(typeof document!=="undefined")installUiVisibility();
