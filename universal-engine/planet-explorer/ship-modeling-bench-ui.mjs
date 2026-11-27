import {ShipModelingBench,nearModelingBench} from "./ship-modeling-bench.mjs";
const key="ue-ship-modeling-bench-v1";
export function installShipModelingBench({getVoyage,getWorld,onCommit,log}){
 const $=id=>document.getElementById(id),open=$("ship-modeling-open"),panel=$("ship-modeling-panel"),status=$("ship-modeling-status"),select=$("ship-modeling-parts");
 let model;try{model=new ShipModelingBench(JSON.parse(localStorage.getItem(key)||"null"));}catch{model=new ShipModelingBench();}
 const near=()=>{const v=getVoyage();return Boolean(v?.active&&!v.seated&&nearModelingBench(v.interior));};
 const close=()=>{panel.hidden=true;};
 function update(){const allowed=near();open.hidden=!allowed;if(!allowed)close();}
 function say(msg){status.textContent=msg;log(msg);}
 function persist(){try{localStorage.setItem(key,JSON.stringify(model.snapshot()));}catch{say("端末への保存に失敗しました");}}
 const fields=["x","y","z","width","height","depth","rotation"];
 function values(){return {shape:$("ship-modeling-shape").value,...Object.fromEntries(fields.map(k=>[k,$("ship-modeling-"+k).value.trim()===""?NaN:Number($("ship-modeling-"+k).value)*(k==="rotation"?Math.PI/180:.001)]))};}
 function refresh(fill=false){select.replaceChildren();const option=(v,t)=>{const o=document.createElement("option");o.value=v;o.textContent=t;select.append(o);};option("","新規部品");for(const p of model.parts)option(String(p.id),"#"+p.id+" "+p.shape);select.value=model.selected===null?"":String(model.selected);const p=model.parts.find(p=>p.id===model.selected);if(fill&&p){$("ship-modeling-shape").value=p.shape;for(const k of fields)$("ship-modeling-"+k).value=String(Math.round(p[k]*(k==="rotation"?180/Math.PI:1000)*1000)/1000);}}
 open.addEventListener("click",()=>{if(!near())return;panel.hidden=false;refresh();});
 $("ship-modeling-close").addEventListener("click",close);
 select.addEventListener("change",()=>{model.select(Number(select.value));refresh(true);});
 panel.addEventListener("click",e=>{const act=e.target.closest("button[data-bench]")?.dataset.bench;if(!act||!near())return;
  if(act==="save"){const name=$("ship-modeling-name").value.trim(),world=getWorld();if(!world||!name||!model.parts.length){say("名前を入力して部品を作成してください");return;}const result=world.savePrefabParts(name,model.prefabParts());say(result.message);if(result.ok)onCommit();return;}
  const result=act==="add"?model.add(values()):act==="edit"?model.update(values()):model.remove();if(!result.ok){say(result.message);return;}persist();refresh(true);say("作業台に反映・端末に保存しました");
 });
 panel.addEventListener("keydown",e=>{e.stopPropagation();if(e.key==="Escape")close();});
 return {model,update,close};
}
