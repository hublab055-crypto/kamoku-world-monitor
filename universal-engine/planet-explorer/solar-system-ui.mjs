import {BODIES,STAR,bodyById,orbitalPosition,skyFromSurface} from "./solar-system.mjs";
export function installSolarSystemUI({get,onTravel,onMine,notify}){
 const style=document.createElement("style");
 style.textContent="#solar-panel[hidden]{display:none!important}#solar-panel{position:absolute;z-index:31;top:7px;right:7px;width:min(370px,calc(100% - 14px));max-height:75vh;overflow:auto;padding:12px;border:1px solid #628da6;border-radius:12px;background:#0c2433f2;color:#e4f4ff;font:12px/1.5 system-ui}#solar-panel canvas{display:block;max-width:100%;background:#071929;border:1px solid #3f5f72;border-radius:8px}#solar-panel .body{border-top:1px solid #456070;padding:7px 0}#solar-panel .line{display:flex;align-items:center;justify-content:space-between;gap:8px}#solar-panel small{color:#bcd1de}#solar-panel button{min-height:28px}#solar-sky-hint{position:absolute;top:7px;right:7px;z-index:8;background:#102b3baa;color:#e6f4ff;font:10px system-ui;pointer-events:none;border-radius:5px;padding:3px 6px}";
 document.head.append(style);
 const toggle=document.createElement("button");toggle.type="button";toggle.textContent="🪐 恒星系";
 toggle.setAttribute("aria-expanded","false");document.getElementById("viewport-quick-panel").append(toggle);
 const panel=document.createElement("section");panel.id="solar-panel";panel.hidden=true;panel.setAttribute("aria-label","恒星系の観測・航行");
 const title=document.createElement("h3");title.textContent="🪐 ヘリオス恒星系";
 const close=document.createElement("button");close.type="button";close.textContent="✕ 閉じる";
 const header=document.createElement("div");header.className="line";header.append(title,close);
 const status=document.createElement("p"),orbit=document.createElement("canvas"),sky=document.createElement("canvas"),skyText=document.createElement("p"),targets=document.createElement("div");
 orbit.width=350;orbit.height=180;sky.width=350;sky.height=140;
 const explanation=document.createElement("p");explanation.textContent="公転・自転に連動する試験版。船の操縦と軌道遷移アニメーションは未対応で、航行はゲーム時間を進めた画面切替です。";
 panel.append(header,status,orbit,document.createTextNode("地表から見える天体（方位角・高度）"),sky,skyText,targets,explanation);
 document.querySelector(".canvas-wrap").append(panel);
 const hint=document.createElement("div");hint.id="solar-sky-hint";document.querySelector(".canvas-wrap").append(hint);
 const setOpen=v=>{panel.hidden=!v;toggle.setAttribute("aria-expanded",String(v));if(v)render(true);};
 toggle.addEventListener("click",()=>setOpen(panel.hidden));close.addEventListener("click",()=>setOpen(false));
 let key="";
 function render(force=false){
  const data=get();if(!data?.planet||!data?.controller||!data?.solarSystem)return;
  const {planet,controller,solarSystem:system}=data;
  const updatedKey=system.currentId+":"+Math.floor(planet.timeDays*1440);
  if(!force&&updatedKey===key)return;key=updatedKey;
  const visible=skyFromSurface(system.currentId,planet,controller.lat,controller.lon,planet.timeDays).filter(s=>s.visible);
  hint.textContent=controller.altitudeM<=12?visible.slice(0,3).map(s=>(s.kind==="star"?"☀ ":"✦ ")+s.name).join(" ・ "):"";
  hint.hidden=!hint.textContent;
  if(panel.hidden)return;
  const body=bodyById(system.currentId);
  status.textContent="現在地 "+body.name+" ／ 恒星時 "+system.days.toFixed(2)+"日 ／ 重力 "+body.gravity+"m/s² ／ 気温目安 "+body.temperatureC+"℃";
  const ctx=orbit.getContext("2d");ctx.clearRect(0,0,350,180);
  ctx.fillStyle="#d5e6f2";ctx.font="11px system-ui";ctx.fillText("恒星と惑星の軌道（表示縮尺は圧縮）",8,16);
  const cx=167,cy=98;
  ctx.strokeStyle="#466078";
  for(const b of BODIES.filter(b=>!b.parent&&b.kind!=="asteroid-belt")){
   const r=54*Math.sqrt(b.au);ctx.beginPath();ctx.ellipse(cx,cy,r,r*.48,0,0,Math.PI*2);ctx.stroke();
  }
  ctx.fillStyle=STAR.color;ctx.beginPath();ctx.arc(cx,cy,5,0,Math.PI*2);ctx.fill();
  for(const b of BODIES.filter(b=>b.kind!=="asteroid-belt")){
   const p=orbitalPosition(b.id,planet.timeDays),r=54*Math.sqrt(Math.hypot(p.x,p.z)),angle=Math.atan2(p.z,p.x);
   const x=cx+r*Math.cos(angle),y=cy+r*.48*Math.sin(angle);
   ctx.fillStyle=b.color;ctx.beginPath();ctx.arc(x,y,b.kind==="moon"?2:4,0,Math.PI*2);ctx.fill();
   if(b.id===system.currentId){ctx.strokeStyle="#fff";ctx.beginPath();ctx.arc(x,y,8,0,Math.PI*2);ctx.stroke();}
   ctx.font="9px system-ui";ctx.fillStyle="#dceaf3";ctx.fillText(b.name,x+4,y-4);
  }
  const sc=sky.getContext("2d");sc.clearRect(0,0,350,140);sc.font="10px system-ui";
  for(const [az,name] of [[0,"N"],[90,"E"],[180,"S"],[270,"W"],[360,"N"]]){
   const x=10+az/360*329;sc.fillStyle="#afc9d8";sc.fillText(name,x-3,130);
   sc.strokeStyle="#375164";sc.beginPath();sc.moveTo(x,8);sc.lineTo(x,115);sc.stroke();
  }
  sc.strokeStyle="#55748a";sc.beginPath();sc.moveTo(10,115);sc.lineTo(339,115);sc.stroke();
  for(const s of visible){
   const x=10+s.azimuthDeg/360*329,y=113-s.altitudeDeg/90*100;
   sc.fillStyle=s.color;sc.beginPath();sc.arc(x,y,s.kind==="star"?5:Math.max(2,Math.min(6,s.diameterDeg*8)),0,Math.PI*2);sc.fill();
   sc.fillStyle="#eaf8ff";sc.fillText(s.name,Math.min(x+6,300),Math.max(y-5,10));
  }
  skyText.textContent=visible.length?visible.map(s=>s.name+" 高度"+Math.round(s.altitudeDeg)+"°").join("／"):"主な天体は地平線の下です";
  targets.replaceChildren();
  for(const b of BODIES){
   const el=document.createElement("div");el.className="body";const row=document.createElement("div");row.className="line";
   const title=document.createElement("strong");title.textContent=b.name;
   const btn=document.createElement("button");btn.type="button";
   btn.textContent=b.id===system.currentId?"滞在中":b.kind==="asteroid-belt"?"☄ 採掘":b.landable?"🚀 航行":"着陸不可";
   btn.disabled=b.id===system.currentId||(!b.landable&&b.kind!=="asteroid-belt");
   btn.addEventListener("click",()=>{
    if(b.kind==="asteroid-belt"){const result=onMine();notify?.(result.message);render(true);return;}
    const plan=get().solarSystem.travelPlan(b.id);if(!plan.ok){notify?.(plan.message);return;}
    if(!confirm(b.name+"に航行しますか？\nゲーム時間 "+plan.flightDays+"日が経過します。"))return;
    const result=onTravel(b.id,plan.flightDays);notify?.(result.message);
    if(result.ok)setOpen(false);
   });
   row.append(title,btn);
   const desc=document.createElement("small");
   desc.textContent=b.kind==="asteroid-belt"?"鉄・石材・希少金属を探査機で採掘":
    b.kind==="gas-giant"?"気体惑星／着陸不可":
    "自転 "+b.rotationHours+"h ／ "+b.gravity+"m/s² ／ "+b.temperatureC+"℃ ／ "+b.atmosphere+" ／ "+b.materials.join("・")+(system.visited.includes(b.id)?" ／ 訪問済":"");
   el.append(row,desc);targets.append(el);
  }
 }
 return {update:render,refresh:()=>render(true),close:()=>setOpen(false)};
}
