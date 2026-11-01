/** Smartphone-only, four programmable action buttons. Desktop/Quest keep the existing decks. */
export const MOBILE_UI_KEY="universal-engine:mobile-hud:v1";
export const MOBILE_ACTIONS=Object.freeze({
 interact:"✋ 調べる・話す",attack:"⚔️ 攻撃",jump:"⬆️ ジャンプ",inventory:"🎒 持ち物",
 guard:"🛡️ ガード",shoot:"🏹 射撃",talk:"💬 会話",mine:"⛏️ 採掘",chop:"🪓 伐採",
 build:"🔨 建築",heal:"🧪 回復",craft:"🛠️ クラフト",map:"🗺️ マップ",
 rts:"⚓ RTS切替",deck:"⚙️ 装備編集",menu:"☰ 操作一覧",none:"— なし"
});
export const MOBILE_ACTION_ICONS=Object.freeze({
 interact:"✋",attack:"⚔️",jump:"⬆️",inventory:"🎒",guard:"🛡️",shoot:"🏹",
 talk:"💬",mine:"⛏️",chop:"🪓",build:"🔨",heal:"🧪",craft:"🛠️",
 map:"🗺️",rts:"⚓",deck:"⚙️",menu:"☰",none:"−"
});
export const MOBILE_EXTRA_OPTIONS=Object.freeze({
 vitals:"HP・体力など",decks:"5つの行動デッキ",commands:"コマンド列",
 legacy:"従来のジャンプ・道具",door:"ドア操作",combat:"弓・戦闘詳細",
 console:"ログボタン",share:"QR共有ボタン",rts:"RTS指揮パネル"
});
export const defaultMobileUI=()=>({
 buttons:[
  {tap:"interact",hold:"talk"},{tap:"attack",hold:"guard"},
  {tap:"jump",hold:"none"},{tap:"inventory",hold:"deck"}
 ],
 extras:Object.fromEntries(Object.keys(MOBILE_EXTRA_OPTIONS).map(id=>[id,false])),
 size:56,opacity:90
});
export function normalizeMobileUI(raw){
 const defaults=defaultMobileUI(),buttons=Array.isArray(raw?.buttons)?raw.buttons:[];
 return {
  buttons:defaults.buttons.map((def,i)=>({
   tap:Object.hasOwn(MOBILE_ACTIONS,buttons[i]?.tap)?buttons[i].tap:def.tap,
   hold:Object.hasOwn(MOBILE_ACTIONS,buttons[i]?.hold)?buttons[i].hold:def.hold
  })),
  extras:Object.fromEntries(Object.keys(MOBILE_EXTRA_OPTIONS).map(id=>[id,raw?.extras?.[id]===true])),
  size:[48,56,64,72].includes(raw?.size)?raw.size:defaults.size,
  opacity:[60,75,90,100].includes(raw?.opacity)?raw.opacity:defaults.opacity
 };
}
export function installMobileHUD({stage,execute,onSettingsOpen=()=>{},storage=globalThis.localStorage,
 mobileQuery="(max-width:1100px) and (pointer:coarse)"}){
 const $=id=>document.getElementById(id);
 const grid=$("mobile-action-grid"),panel=$("mobile-ui-settings"),toggle=$("viewport-ui-settings-toggle");
 if(!stage||!grid||!panel||!toggle)return {sync:()=>{},enabled:false};
 let state;
 try{state=normalizeMobileUI(JSON.parse(storage?.getItem(MOBILE_UI_KEY)||"null"));}
 catch(_){state=defaultMobileUI();}
 let available=typeof matchMedia==="function"&&matchMedia(mobileQuery).matches;
 let active=false;
 const save=()=>{try{storage?.setItem(MOBILE_UI_KEY,JSON.stringify(state));}catch(_){}};
 const open=show=>{
  panel.hidden=!show;toggle.setAttribute("aria-expanded",String(show));
  if(show){renderSettings();onSettingsOpen();}
 };
 const apply=()=>{
  for(const id of Object.keys(MOBILE_EXTRA_OPTIONS))
   stage.classList.toggle("show-mobile-"+id,state.extras[id]);
  stage.style.setProperty("--mobile-action-size",state.size+"px");
  stage.style.setProperty("--mobile-action-opacity",String(state.opacity/100));
 };
 function trigger(action){if(action!=="none")execute(action);}
 function buildButtons(){
  grid.replaceChildren();
  state.buttons.forEach((config,i)=>{
   const button=document.createElement("button");
   button.type="button";button.className="mobile-action-button";
   button.textContent=MOBILE_ACTION_ICONS[config.tap];button.dataset.slot=String(i);
   button.title=MOBILE_ACTIONS[config.tap]+(config.hold!=="none"?" / 長押し："+MOBILE_ACTIONS[config.hold]:"");
   button.setAttribute("aria-label",button.title);
   let timer=null,longFired=false;
   const clear=()=>{if(timer!==null){clearTimeout(timer);timer=null;}};
   button.addEventListener("pointerdown",event=>{
    if(event.button!==0&&event.pointerType==="mouse")return;
    longFired=false;clear();
    if(config.hold!=="none"){
     timer=setTimeout(()=>{timer=null;longFired=true;trigger(config.hold);},480);
    }
   });
   for(const eventName of ["pointerup","pointerleave","pointercancel","lostpointercapture"])
    button.addEventListener(eventName,clear);
   button.addEventListener("click",()=>{
    if(longFired){longFired=false;return;}
    trigger(config.tap);
   });
   grid.append(button);
  });
 }
 function selectValue(selected,onChange){
  const sel=document.createElement("select");
  for(const [key,name] of Object.entries(MOBILE_ACTIONS)){
   const opt=document.createElement("option");opt.value=key;opt.textContent=name;sel.append(opt);
  }
  sel.value=selected;sel.addEventListener("change",()=>onChange(sel.value));return sel;
 }
 function renderSettings(){
  const rows=$("mobile-ui-assignments"),extras=$("mobile-ui-extras");
  rows.replaceChildren();extras.replaceChildren();
  state.buttons.forEach((cfg,i)=>{
   const row=document.createElement("div");row.className="mobile-ui-assignment";
   const label=document.createElement("strong");label.textContent="ボタン "+(i+1);
   const tapLabel=document.createElement("label");tapLabel.textContent="短押し";
   tapLabel.append(selectValue(cfg.tap,value=>{state.buttons[i].tap=value;save();buildButtons();}));
   const holdLabel=document.createElement("label");holdLabel.textContent="長押し";
   holdLabel.append(selectValue(cfg.hold,value=>{state.buttons[i].hold=value;save();buildButtons();}));
   row.append(label,tapLabel,holdLabel);rows.append(row);
  });
  for(const [id,label] of Object.entries(MOBILE_EXTRA_OPTIONS)){
   const row=document.createElement("label");row.className="mobile-ui-option";
   const checkbox=document.createElement("input");checkbox.type="checkbox";checkbox.checked=state.extras[id];
   checkbox.addEventListener("change",()=>{state.extras[id]=checkbox.checked;save();apply();});
   row.append(checkbox,document.createTextNode(" "+label));extras.append(row);
  }
  for(const id of ["size","opacity"]){
   const select=$("mobile-ui-"+id);select.value=String(state[id]);
   select.onchange=()=>{state[id]=Number(select.value);save();apply();};
  }
 }
 toggle.addEventListener("click",()=>open(panel.hidden));
 $("mobile-ui-close").addEventListener("click",()=>open(false));
 $("mobile-ui-reset").addEventListener("click",()=>{
  state=defaultMobileUI();save();apply();buildButtons();renderSettings();
 });
 document.addEventListener("keydown",event=>{
  if(event.key==="Escape"&&!panel.hidden){open(false);event.stopPropagation();}
 });
 apply();buildButtons();
 const query=typeof matchMedia==="function"?matchMedia(mobileQuery):null;
 const onMedia=()=>{available=Boolean(query?.matches);sync(lastContext);};
 query?.addEventListener?.("change",onMedia);
 let lastContext={};
 function sync(context={}){
  lastContext=context;
  const mobileActive=available&&!context.xrActive;
  active=mobileActive&&!context.rtsMode&&Boolean(context.isSurface);
  stage.classList.toggle("mobile-ui-enabled",mobileActive);
  stage.classList.toggle("mobile-minimal",active);
  grid.hidden=!active;
  toggle.hidden=!mobileActive;
  if(!mobileActive&&!panel.hidden)open(false);
 }
 sync();
 return {sync,openSettings:()=>open(true),getSettings:()=>normalizeMobileUI(state),get enabled(){return active;}};
}
