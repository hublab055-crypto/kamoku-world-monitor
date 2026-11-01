import {MOBILE_ACTIONS,MOBILE_LAYERS,defaultMobileConfig,normalizeMobileConfig} from "./mobile-controls.mjs?v=1";

const STORAGE_KEY="universal-engine:mobile-four-actions:v1";
const $=id=>document.getElementById(id);
const mobileQuery="(max-width: 1024px) and (pointer: coarse)";
const safeLoad=()=>{
  try{return normalizeMobileConfig(JSON.parse(localStorage.getItem(STORAGE_KEY)));}
  catch(_){return defaultMobileConfig();}
};
const isMobile=()=>typeof matchMedia==="function"&&matchMedia(mobileQuery).matches;
const make=(tag,className,text)=>{
  const el=document.createElement(tag);
  if(className)el.className=className;
  if(text!==undefined)el.textContent=text;
  return el;
};
/** UI adapter: existing combat, inventory and world commands stay authoritative.
 * Four visible buttons only; five underlying action decks remain unchanged.
 */
export function installMobileFourActions({onAction}){
  const root=$("mobile-action-buttons"),settings=$("mobile-action-settings");
  const toggle=$("viewport-mobile-actions"),menu=$("viewport-quick-toggle");
  if(!root||!settings||!toggle)return null;
  let config=safeLoad(),active=false,surface=false,rts=false,vr=false,vehicle=null,editing="walk",shownMode="";
  function save(){
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify(config));}catch(_){}
  }
  function perform(action){
    if(!surface||!active||vr||!MOBILE_ACTIONS[action])return;
    onAction(action);
  }
  function drawButtons(){
    const mode=rts?"rts":vehicle||"walk";
    if(mode===shownMode&&root.childElementCount===4)return;
    shownMode=mode;root.replaceChildren();
    config.profiles[mode].forEach((slot,i)=>{
      const primary=MOBILE_ACTIONS[slot.tap],secondary=MOBILE_ACTIONS[slot.hold];
      const button=make("button","mobile-action-button");
      button.type="button";
      button.dataset.slot=String(i);
      button.title=primary.label+" ／ 長押し："+secondary.label;
      button.setAttribute("aria-label",primary.label+"（長押し："+secondary.label+"）");
      button.append(make("span","mobile-action-icon",primary.icon),make("small","mobile-action-caption",primary.label));
      let timer=null,held=false,pressed=null;
      function stop(){if(timer!==null)clearTimeout(timer);timer=null;pressed=null;}
      button.addEventListener("pointerdown",e=>{
        if(e.button!==0)return;
        stop();held=false;pressed={id:e.pointerId,x:e.clientX,y:e.clientY};
        timer=setTimeout(()=>{
          timer=null;held=true;perform(slot.hold);
          if(navigator.vibrate)navigator.vibrate(12);
        },520);
      });
      button.addEventListener("pointermove",e=>{
        if(pressed&&e.pointerId===pressed.id&&Math.hypot(e.clientX-pressed.x,e.clientY-pressed.y)>15)stop();
      });
      for(const type of ["pointerup","pointercancel","pointerleave","lostpointercapture"])
        button.addEventListener(type,stop);
      button.addEventListener("contextmenu",e=>e.preventDefault());
      button.addEventListener("click",e=>{
        if(held){e.preventDefault();held=false;return;}
        perform(slot.tap);
      });
      root.append(button);
    });
  }
  function applyLayers(){
    for(const key of Object.keys(MOBILE_LAYERS))
      document.body.classList.toggle("mobile-show-"+key,config.layers[key]===true);
  }
  function actionSelect(value,onChange,label){
    const select=make("select","mobile-action-select");
    select.setAttribute("aria-label",label);
    for(const [key,info] of Object.entries(MOBILE_ACTIONS)){
      const option=document.createElement("option");
      option.value=key;option.textContent=info.icon+" "+info.label;
      select.append(option);
    }
    select.value=value;
    select.addEventListener("change",()=>onChange(select.value));
    return select;
  }
  function drawSettings(){
    settings.replaceChildren();
    const header=make("div","mobile-action-settings-header");
    header.append(make("strong","", "🎮 スマホ操作設定"));
    const close=make("button","", "× 閉じる");
    close.type="button";close.addEventListener("click",()=>{settings.hidden=true;toggle.focus();});
    header.append(close);settings.append(header);
    settings.append(make("p","mobile-action-help","左下は移動スティック、右下は4ボタン。短押し／長押しを別々に設定できます。"));
    const profile=make("label","mobile-action-profile","設定する操作モード");
    const profileSelect=make("select","");
    for(const [key,name] of [["walk","徒歩・冒険"],["rts","RTS・部隊指揮"],["ride","騎乗"],["boat","帆船・ボート"],["passenger","列車・客船"],["shipInterior","宇宙船内"],["shipCockpit","宇宙船操縦席"]]){
      const option=document.createElement("option");
      option.value=key;option.textContent=name;profileSelect.append(option);
    }
    profileSelect.value=editing;
    profileSelect.addEventListener("change",()=>{editing=profileSelect.value;drawSettings();});
    profile.append(profileSelect);settings.append(profile);
    const slots=make("div","mobile-action-editor");
    config.profiles[editing].forEach((slot,i)=>{
      const row=make("div","mobile-action-editor-row");
      row.append(make("strong","mobile-action-letter","ABCD"[i]));
      const tapLabel=make("label","","短押し");
      tapLabel.append(actionSelect(slot.tap,v=>{
        config.profiles[editing][i].tap=v;save();shownMode="";drawButtons();
      },"ボタン"+(i+1)+"の短押し"));
      const holdLabel=make("label","","長押し");
      holdLabel.append(actionSelect(slot.hold,v=>{
        config.profiles[editing][i].hold=v;save();shownMode="";drawButtons();
      },"ボタン"+(i+1)+"の長押し"));
      row.append(tapLabel,holdLabel);slots.append(row);
    });
    settings.append(slots,make("strong","mobile-action-subhead","必要な追加UIを表示"));
    const layers=make("div","mobile-action-layer-list");
    for(const [key,name] of Object.entries(MOBILE_LAYERS)){
      const label=make("label","mobile-action-layer");
      const checkbox=document.createElement("input");
      checkbox.type="checkbox";checkbox.checked=config.layers[key];
      checkbox.addEventListener("change",()=>{
        config.layers[key]=checkbox.checked;applyLayers();save();
      });
      label.append(checkbox,document.createTextNode(name));layers.append(label);
    }
    settings.append(layers);
    const reset=make("button","mobile-action-reset","初期設定に戻す");
    reset.type="button";
    reset.addEventListener("click",()=>{
      config=defaultMobileConfig();save();applyLayers();
      shownMode="";drawButtons();drawSettings();
    });
    settings.append(reset);
  }
  function sync(next={}){
    if(typeof next.surface==="boolean")surface=next.surface;
    if(typeof next.rts==="boolean")rts=next.rts;
    if(typeof next.vr==="boolean")vr=next.vr;
    if(Object.hasOwn(next,"vehicle"))vehicle=["ride","boat","passenger"].includes(next.vehicle)?next.vehicle:null;
    active=isMobile()&&!vr;
    document.body.classList.toggle("mobile-minimal-ui",active);
    applyLayers();
    root.hidden=!active||!surface;
    if(!active)settings.hidden=true;
    if(active)drawButtons();
  }
  toggle.addEventListener("click",()=>{
    if(!isMobile())return;
    settings.hidden=!settings.hidden;
    if(!settings.hidden){config=safeLoad();editing=rts?"rts":vehicle||"walk";drawSettings();}
    const quickPanel=$("viewport-quick-panel");
    if(quickPanel&&!quickPanel.hidden)menu?.click();
  });
  document.addEventListener("keydown",e=>{
    if(e.key==="Escape"&&!settings.hidden){settings.hidden=true;e.preventDefault();}
  });
  window.addEventListener("resize",()=>sync());
  sync();
  return {sync,get active(){return active&&!rts&&surface&&!vr;},get mode(){return rts?"rts":vehicle||"walk";}};
}
