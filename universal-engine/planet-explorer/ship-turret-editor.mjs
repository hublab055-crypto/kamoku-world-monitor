import {normalizeTurrets} from "./ship-turrets.mjs?v=20261108";
/** Touch-friendly hardpoint editing; preferences also travel in journey saves. */
export function installTurretEditor({root,panel,getCombat,getVoyage,notify=()=>{}}){
 const button=document.createElement("button");button.type="button";button.textContent="🔧 砲塔";
 button.setAttribute("aria-expanded","false");panel.append(button);
 const editor=document.createElement("section");editor.className="ship-dashboard-editor";
 editor.hidden=true;editor.setAttribute("aria-label","砲塔配置と自動射撃");
 const header=document.createElement("header"),title=document.createElement("strong"),close=document.createElement("button");
 title.textContent="🔧 砲塔・発射機の配置";close.type="button";close.textContent="✕ 閉じる";
 header.append(title,close);editor.append(header);
 const label=document.createElement("label"),auto=document.createElement("input");auto.type="checkbox";
 label.append("ロックオン中の自動射撃",auto);editor.append(label);
 const select=document.createElement("select");select.setAttribute("aria-label","編集する砲塔");
 for(const [i,name] of ["左舷パルス砲","右舷パルス砲","ミサイル発射機"].entries()){
  const option=document.createElement("option");option.value=i;option.textContent=name;select.append(option);
 }
 editor.append(select);
 const enabledLabel=document.createElement("label"),enabled=document.createElement("input");enabled.type="checkbox";
 enabledLabel.append("兵装を有効にする",enabled);editor.append(enabledLabel);
 const sliders=[];
 for(const [axis,name,min,max] of [["x","左右 X",-15,15],["y","高さ Y",2,8],["z","前後 Z",-12,12]]){
  const row=document.createElement("label"),text=document.createElement("span"),slider=document.createElement("input");
  slider.type="range";slider.min=min;slider.max=max;slider.step=.5;slider.setAttribute("aria-label",name);
  row.append(text,slider);editor.append(row);sliders.push({axis,name,text,slider});
  slider.addEventListener("input",()=>{const m=getCombat();if(!m)return;m.turrets[Number(select.value)][axis]=Number(slider.value);save();refresh();});
 }
 const hint=document.createElement("small");hint.textContent="単位 m。X：右が＋、Y：上が＋、Z：船尾が＋。砲塔は目標へ自動旋回し、照準が合うと発射できます。自動射撃は選択中の兵装を使用します。";editor.append(hint);
 const state=document.createElement("small");editor.append(state);root.append(editor);
 function save(){
  const m=getCombat(),v=getVoyage();if(!m||!v)return;
  v.turrets=normalizeTurrets(m.turrets);v.autoFire=m.autoFire;
  try{localStorage.setItem("ue:ship-turrets:v1",JSON.stringify(v.turrets));}catch(_){}
 }
 function refresh(){
  const m=getCombat();if(!m)return;
  const mount=m.turrets[Number(select.value)];auto.checked=m.autoFire;enabled.checked=mount.enabled;
  for(const {axis,name,text,slider} of sliders){slider.value=mount[axis];text.textContent=name+" "+mount[axis].toFixed(1);}
  state.textContent=mount.targetId?(mount.aligned?"🎯 照準一致":"↻ 目標へ旋回中"):"目標をロックオンすると砲塔が旋回します";
 }
 select.addEventListener("change",refresh);
 auto.addEventListener("change",()=>{const m=getCombat();if(m){m.autoFire=auto.checked;save();}});
 enabled.addEventListener("change",()=>{const m=getCombat();if(m){m.turrets[Number(select.value)].enabled=enabled.checked;save();}});
 button.addEventListener("click",()=>{editor.hidden=!editor.hidden;button.setAttribute("aria-expanded",String(!editor.hidden));refresh();});
 close.addEventListener("click",()=>{editor.hidden=true;button.setAttribute("aria-expanded","false");});
 return {refresh(visible){button.hidden=!visible;if(!visible)editor.hidden=true;if(!editor.hidden)refresh();}};
}
