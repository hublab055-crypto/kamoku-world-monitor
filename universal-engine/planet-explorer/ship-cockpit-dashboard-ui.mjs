import {DASHBOARD_ACTIONS,DEFAULT_DASHBOARD_SLOTS,normalizeDashboardSlots} from "./ship-dashboard-layout.mjs?v=20261108-ciws-captain";
import {COCKPIT_SWITCHES} from "./ship-control-hit.mjs?v=20261108-ciws-captain";

/** One editable mapping drives touchscreen buttons and the four physical 3D caps.
 * DOM is built from whitelisted options only; preferences never run arbitrary code.
 */
export function installCockpitDashboard({root,onAction=()=>{},getViewSettings=()=>({}),setViewSettings=()=>{}}){
 const key="ue:ship-dashboard:v1";
 let stored=null;
 try{stored=JSON.parse(localStorage.getItem(key)||"null");}catch(_){}
 let layout=normalizeDashboardSlots(stored);
 const persist=()=>{try{localStorage.setItem(key,JSON.stringify(layout));}catch(_){}};
 const style=document.createElement("style");
 style.textContent=`
 #space-flight .ship-dashboard-editor{position:absolute;right:8px;top:112px;z-index:340;
  width:min(355px,calc(100% - 16px));max-height:min(67dvh,450px);overflow:auto;
  box-sizing:border-box;padding:12px;background:#0a2337f7;border:1px solid #96cce7;
  border-radius:12px;box-shadow:0 12px 32px #000c;color:#e8faff;pointer-events:auto;
  font:12px/1.5 system-ui}
 #space-flight .ship-dashboard-editor[hidden]{display:none!important}
 #space-flight .ship-dashboard-editor label{display:flex;align-items:center;justify-content:space-between;
  gap:8px;margin:7px 0;color:#e8faff;font-size:12px}
 #space-flight .ship-dashboard-editor select{flex:1;max-width:195px;border:1px solid #8dbacc;
  border-radius:6px;background:#143a52;color:#f2fbff;min-height:36px;padding:5px}
 #space-flight .ship-dashboard-editor input[type=range]{width:180px;max-width:55%}
 #space-flight .ship-dashboard-editor input[type=checkbox]{width:18px;height:18px}
 #space-flight .ship-dashboard-editor button{background:#24536e;border:1px solid #8fb7c9;
  color:#efffff;padding:6px 9px;min-height:38px;border-radius:7px}
 #space-flight .ship-dashboard-editor header{display:flex;justify-content:space-between;align-items:center;gap:8px}
 #space-flight .ship-dashboard-editor small{display:block;margin:8px 0;color:#b5d6e6}
 #space-flight .ship-combat-console .ship-dashboard-settings{background:#345069;color:#fff}
 #space-flight .ship-combat-console .ship-hatch-trigger{background:#195e43;color:#c5ffda}
 `;
 document.head.append(style);
 const panel=document.createElement("div");
 panel.className="ship-combat-console";panel.setAttribute("role","group");
 panel.setAttribute("aria-label","カスタマイズ可能な宇宙船操縦盤");
 const buttons=layout.map((_,i)=>{
  const button=document.createElement("button");button.type="button";
  button.dataset.slot=String(i);button.addEventListener("click",()=>executeAction(layout[i]));
  panel.append(button);return button;
 });
 const configure=document.createElement("button");configure.type="button";
 configure.className="ship-dashboard-settings";configure.textContent="⚙️";
 configure.setAttribute("aria-label","ダッシュボードのボタン配置とカメラ設定");
 configure.setAttribute("aria-expanded","false");
 panel.append(configure);root.append(panel);
 const editor=document.createElement("section");editor.className="ship-dashboard-editor";
 editor.hidden=true;editor.setAttribute("role","dialog");editor.setAttribute("aria-label","操縦盤と視界の設定");
 const header=document.createElement("header");
 const heading=document.createElement("strong");heading.textContent="⚙️ 操縦盤をカスタマイズ";
 const close=document.createElement("button");close.type="button";close.textContent="✕ 閉じる";
 header.append(heading,close);editor.append(header);
 const caption=document.createElement("small");
 caption.textContent="画面ボタンと船内3Dスイッチは同じ割当です。左から1〜4番を変更。『非表示』も選べます。";
 editor.append(caption);
 const selects=[];
 for(let i=0;i<4;i++){
  const label=document.createElement("label");label.append(document.createTextNode("スイッチ "+(i+1)));
  const select=document.createElement("select");select.setAttribute("aria-label","スイッチ"+(i+1)+"の機能");
  for(const {id,label:text} of DASHBOARD_ACTIONS){
   const option=document.createElement("option");option.value=id;option.textContent=text;select.append(option);
  }
  select.value=layout[i];
  select.addEventListener("change",()=>{
   const next=[...layout];next[i]=select.value;layout=normalizeDashboardSlots(next);
   persist();refresh(); // Immediately update both 3D and touchscreen mapping.
  });
  label.append(select);editor.append(label);selects.push(select);
 }
 const reset=document.createElement("button");reset.type="button";reset.textContent="↺ ボタン配置を初期化";
 reset.addEventListener("click",()=>{layout=[...DEFAULT_DASHBOARD_SLOTS];selects.forEach((s,i)=>s.value=layout[i]);persist();refresh();});
 editor.append(reset);
 const viewTitle=document.createElement("strong");viewTitle.textContent=" 👁 視界と右スティック";
 editor.append(viewTitle);
 const fovRow=document.createElement("label");fovRow.append(document.createTextNode("操縦席の画角"));
 const fovInput=document.createElement("input");fovInput.type="range";fovInput.min="85";fovInput.max="116";fovInput.step="1";
 const fovValue=document.createElement("output");
 fovInput.addEventListener("input",()=>{fovValue.textContent=fovInput.value+"°";setViewSettings({fov:Number(fovInput.value)});});
 fovRow.append(fovInput,fovValue);editor.append(fovRow);
 const stickLabel=document.createElement("label");stickLabel.append(document.createTextNode("右の視点スティック"));
 const stickCheck=document.createElement("input");stickCheck.type="checkbox";
 stickCheck.addEventListener("change",()=>setViewSettings({rightStick:stickCheck.checked}));
 stickLabel.append(stickCheck);editor.append(stickLabel);
 const wideLabel=document.createElement("label");wideLabel.append(document.createTextNode("パノラマ広画面"));
 const wideCheck=document.createElement("input");wideCheck.type="checkbox";
 wideCheck.addEventListener("change",()=>setViewSettings({wide:wideCheck.checked}));
 wideLabel.append(wideCheck);editor.append(wideLabel);
 const safety=document.createElement("small");
 safety.textContent="ハッチは停泊中／着陸後だけ開閉可能です。設定を変更しても飛行中の気密ロックは解除されません。";
 editor.append(safety);root.append(editor);
 function openEditor(open){
  editor.hidden=!open;configure.setAttribute("aria-expanded",String(open));
  if(open){
   const settings=getViewSettings();
   fovInput.value=String(settings.fov??108);fovValue.textContent=fovInput.value+"°";
   stickCheck.checked=settings.rightStick!==false;wideCheck.checked=settings.wide!==false;
  }
 }
 configure.addEventListener("click",()=>openEditor(editor.hidden));
 close.addEventListener("click",()=>openEditor(false));
 function executeAction(id){
  if(!DASHBOARD_ACTIONS.some(a=>a.id===id)||id==="none")return false;
  onAction(id);return true;
 }
 function executeHardware(id){
  const index=COCKPIT_SWITCHES.findIndex(x=>x.id===id);
  return index>=0?executeAction(layout[index]):false;
 }
 function refresh({visible=true,model=null,v=null}={}){
  panel.hidden=!visible;if(!visible)openEditor(false);
  const labels={
   scan:"📡 スキャン",weapon:"🎯 兵装",fire:"🔴 発射",hatch:v?.hatchOpen?"🔒 閉める":"🚪 開ける",
   auto:v?.autopilot?"🧭 AUTO":"🧭 手動",camera:"🎥 視点",wide:"⛶ 広画面",none:"非表示"
  };
  for(let i=0;i<buttons.length;i++){
   const button=buttons[i],id=layout[i];
   button.hidden=id==="none";button.className="ship-dashboard-action "+(id==="fire"?"ship-fire-trigger":id==="scan"?"ship-scan-trigger":id==="hatch"?"ship-hatch-trigger":"ship-weapon-switch");
   button.textContent=id==="weapon"&&model?"🎯 "+model.config.name:
    id==="fire"&&model?.weapon==="missile"?"🚀 発射 ("+model.missiles+")":labels[id]||id;
   button.setAttribute("aria-label",DASHBOARD_ACTIONS.find(a=>a.id===id)?.label||id);
   if(id==="hatch")button.title="停泊・着陸中のみ遠隔開閉できます";
  }
 }
 refresh({visible:false});
 return {panel,editor,refresh,executeHardware,get layout(){return [...layout];}};
}
