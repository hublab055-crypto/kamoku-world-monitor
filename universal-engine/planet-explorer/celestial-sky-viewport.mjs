import {skyFromSurface} from "./solar-system.mjs";
const angle=x=>((x+540)%360)-180;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function installCelestialSkyViewport({get}){
 const css=document.createElement("style");
 css.textContent="#celestial-sky-viewport{position:absolute;top:0;left:0;width:100%;height:36%;z-index:5;pointer-events:none;opacity:.93}#celestial-sky-viewport[hidden]{display:none!important}@media(max-width:650px){#celestial-sky-viewport{height:30%}}";
 document.head.append(css);
 const canvas=document.createElement("canvas");canvas.id="celestial-sky-viewport";canvas.width=960;canvas.height=190;
 canvas.setAttribute("aria-hidden","true");
 document.querySelector(".canvas-wrap")?.append(canvas);
 const ctx=canvas.getContext("2d");let key="";
 function update(force=false){
  const data=get();
  if(!data?.solarSystem||!data?.planet||!data?.controller){canvas.hidden=true;return;}
  const {planet,controller,inside=false,xrActive=false}=data;
  const now=planet.timeDays;
  const off=inside||xrActive||controller.altitudeM>12.01||controller.travelMode==="dive";
  canvas.hidden=off;
  if(off){key="";return;}
  const yaw=((controller.yaw||0)*180/Math.PI+360)%360;
  const next=planet.id+":"+Math.floor(now*86400/20)+":"+Math.round(yaw*2);
  if(!force&&key===next)return;key=next;
  const sky=skyFromSurface(planet.id,planet,controller.lat,controller.lon,now).filter(x=>x.visible);
  const sunlight=sky.find(s=>s.kind==="star")?.altitudeDeg??-90;
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.font="14px system-ui";ctx.textAlign="center";
  const fov=125,w=canvas.width,h=canvas.height;
  ctx.strokeStyle="#92c2d452";ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(0,h*.91);ctx.lineTo(w,h*.91);ctx.stroke();
  for(const s of sky){
   const relative=angle(s.azimuthDeg-yaw);
   if(Math.abs(relative)>fov/2)continue;
   const x=w/2+relative/fov*w;
   const y=clamp(h*.91-s.altitudeDeg/90*h*.80,9,h-13);
   const isMoon=s.kind==="moon",isSun=s.kind==="star";
   if(!isSun&&!isMoon&&sunlight>4)continue;
   const radius=isSun?16:isMoon?clamp(s.diameterDeg*10,4,19):3.4;
   ctx.save();ctx.globalAlpha=isSun?1:isMoon?.94:.8;
   ctx.shadowBlur=isSun?21:isMoon?13:9;ctx.shadowColor=s.color;
   ctx.fillStyle=s.color;ctx.beginPath();ctx.arc(x,y,radius,0,Math.PI*2);ctx.fill();
   if(isSun){
    ctx.lineWidth=2;ctx.strokeStyle="#fff0b3b0";
    ctx.beginPath();ctx.arc(x,y,radius+5,0,Math.PI*2);ctx.stroke();
   }
   ctx.restore();
   ctx.fillStyle="#e7eff7";ctx.shadowColor="#050a10";ctx.shadowBlur=4;
   ctx.fillText(s.name,x,clamp(y+radius+17,13,h-3));
  }
  ctx.textAlign="left";ctx.font="12px system-ui";ctx.fillStyle="#bcd8ea";
  ctx.fillText("☼ 天体観測ガイド / 方位 "+Math.round(yaw)+"°",12,17);
  ctx.shadowBlur=0;
 }
 return {update,reset:()=>{key="";canvas.hidden=true;}};
}
