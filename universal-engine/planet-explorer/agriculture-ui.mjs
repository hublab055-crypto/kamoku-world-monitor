import {CROPS} from "./agriculture.mjs?v=0.8g-farming";
/** Small in-viewport agriculture and log-cutting controls. */
export function installAgricultureUI({get,notify,onChange,canPlant,cutLog}){
 const $=id=>document.getElementById(id),panel=$("farm-panel");
 const plotSelect=$("farm-plot");
 let selected=null;
 function refresh(){
  const {farm,controller,planet,harvest,actions}=get();
  if(!farm||!controller||!planet)return;
  const choice=selected;
  plotSelect.replaceChildren();
  for(const p of farm.plots){
   const o=document.createElement("option");o.value=p.id;
   const growth=farm.growth(p,planet.timeDays);
   o.textContent=(p.crop?CROPS[p.crop].icon+" "+CROPS[p.crop].name:"🟫 空き畑")+
    " "+Math.round(Math.hypot(p.x-controller.x,p.z-controller.z))+"m"+
    (p.crop?" "+Math.round(growth*100)+"%":"");
   plotSelect.append(o);
  }
  if(!farm.plots.length){const o=document.createElement("option");o.textContent="畑がありません";o.value="";plotSelect.append(o);}
  selected=farm.plots.some(p=>p.id===choice)?choice:(
   farm.closest(controller,10000)?.id||"");
  plotSelect.value=selected;
  $("farm-status").textContent="種：🌾"+farm.seeds.wheat+" 🥕"+farm.seeds.carrot+
   " 🍎"+farm.seeds.apple+" ／ 区画 "+farm.plots.length+" ／ 惑星 "+planet.timeDays.toFixed(1)+"日";
  const p=farm.plots.find(p=>p.id===selected);
  $("farm-plot-status").textContent=p?
   (p.crop?CROPS[p.crop].name+"：生育 "+Math.round(farm.growth(p,planet.timeDays)*100)+"%":
    "耕した土・種まき待ち"):"現在の場所で土を耕してみましょう";
  const pieces=harvest?.pieces||[];
  $("farm-timber").textContent=pieces.length?
   "🪚 製材済 "+pieces.length+"本 ／ 最近："+pieces.slice(-3).map(p=>p.lengthM.toFixed(2)+"m").join("・"):
   "🪵 伐採した倒木をノコギリで切り分けられます";
 }
 function open(id){if(id)selected=id;panel.hidden=false;$("farm-toggle").setAttribute("aria-expanded","true");refresh();}
 function close(){panel.hidden=true;$("farm-toggle").setAttribute("aria-expanded","false");}
 function act(fn){
  try{const r=fn();notify(r.message);if(r.ok){onChange();refresh();}return r;}catch(error){notify("農作業エラー："+error.message);}
 }
 $("farm-toggle").addEventListener("click",()=>panel.hidden?open():close());
 $("farm-close").addEventListener("click",close);
 plotSelect.addEventListener("change",()=>{selected=plotSelect.value;refresh();});
 $("farm-till").addEventListener("click",()=>act(()=>{
  const {farm,controller,planet}=get();
  const x=controller.x+Math.sin(controller.yaw)*3,z=controller.z+Math.cos(controller.yaw)*3;
  const r=farm.till(x,z,controller,canPlant,planet.timeDays);
  if(r.ok)selected=r.plot.id;return r;
 }));
 $("farm-sow").addEventListener("click",()=>act(()=>{
  const {farm,controller,planet}=get();
  return farm.sow(selected,$("farm-crop").value,controller,planet.timeDays);
 }));
 $("farm-harvest").addEventListener("click",()=>act(()=>{
  const {farm,controller,planet,actions}=get();
  return farm.harvest(selected,controller,planet.timeDays,actions.resources);
 }));
 $("farm-saw").addEventListener("click",()=>{const result=cutLog(Number($("farm-cut-length").value));notify(result.message);if(result.ok)onChange();refresh();});
 return {refresh,open,close,cutLength:()=>Number($("farm-cut-length").value)};
}
