import {mapToWorld,worldToMap,routePreview} from "./map-navigation.mjs?v=0.8q-map-goal";
/** Small actionable overhead chart. Computes tiles only on demand, never per animation frame. */
export function installRouteMapUI({getController,getTerrain,onGo,onOpen=()=>{},notify=()=>{}}){
 const $=id=>document.getElementById(id);
 const panel=$("map-route-panel"),canvas=$("route-map-canvas"),status=$("map-route-status");
 const zoom=$("map-route-range"),go=$("map-route-go");
 const ctx=canvas.getContext("2d");
 let chosen=null,keys={u:.5,v:.5},active=false;
 const setStatus=message=>{status.textContent=message;};
 function paint(){
  const control=getController(),terrain=getTerrain();
  if(!control||!terrain||!ctx)return;
  const R=Number(zoom.value)||160,size=canvas.width,cells=40,step=size/cells;
  const theme={sea:"#164b75",river:"#2c85aa",island:"#c9c07a",coast:"#c5b279",
   plain:"#397854",forest:"#205d42",mountain:"#8d9292"};
  ctx.clearRect(0,0,size,size);
  for(let row=0;row<cells;row++)for(let col=0;col<cells;col++){
   const p=mapToWorld((col+.5)/cells,(row+.5)/cells,control,R);
   const geo=control.locationAt(p.x,p.z),land=terrain.sample(geo.lat,geo.lon);
   ctx.fillStyle=land.water?theme.sea:land.river?theme.river:
    land.category==="island"?theme.island:
    land.elevationM<100?theme.coast:
    land.elevationM>2500?theme.mountain:
    land.category==="forest"?theme.forest:theme.plain;
   ctx.fillRect(col*step,row*step,step+.4,step+.4);
  }
  ctx.strokeStyle="#ffffff36";ctx.lineWidth=1;
  for(let i=0;i<=4;i++){
   const k=i*size/4;ctx.beginPath();ctx.moveTo(k,0);ctx.lineTo(k,size);
   ctx.moveTo(0,k);ctx.lineTo(size,k);ctx.stroke();
  }
  const center=worldToMap(control.x,control.z,control,R);
  const px=center.u*size,py=center.v*size;
  ctx.beginPath();ctx.arc(px,py,6,0,2*Math.PI);
  ctx.fillStyle="#fff";ctx.fill();ctx.lineWidth=2;ctx.strokeStyle="#2b95ed";ctx.stroke();
  const yaw=control.yaw||0;
  ctx.beginPath();ctx.moveTo(px+12*Math.sin(yaw),py-12*Math.cos(yaw));
  ctx.lineTo(px+7*Math.sin(yaw+2.5),py-7*Math.cos(yaw+2.5));
  ctx.lineTo(px+7*Math.sin(yaw-2.5),py-7*Math.cos(yaw-2.5));ctx.closePath();
  ctx.fillStyle="#fff";ctx.fill();
  if(chosen){
   const p=worldToMap(chosen.x,chosen.z,control,R);
   const x=p.u*size,y=p.v*size;
   if(x>=0&&x<=size&&y>=0&&y<=size){
    ctx.strokeStyle="#ffe18d";ctx.lineWidth=3;
    ctx.beginPath();ctx.arc(x,y,9,0,Math.PI*2);ctx.stroke();
    ctx.beginPath();ctx.moveTo(x-14,y);ctx.lineTo(x+14,y);
    ctx.moveTo(x,y-14);ctx.lineTo(x,y+14);ctx.stroke();
    ctx.strokeStyle="#ffe18d88";ctx.setLineDash([6,5]);
    ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(x,y);ctx.stroke();ctx.setLineDash([]);
   }
  }
  ctx.fillStyle="#fff";ctx.font="bold 14px system-ui";ctx.fillText("N ↑",8,18);
  ctx.font="11px system-ui";ctx.fillText("東 →",size-50,size-10);
  ctx.fillText("中心から ±"+R+"m",9,size-10);
 }
 function choose(u,v){
  const control=getController(),terrain=getTerrain(),radius=Number(zoom.value)||160;
  if(!control||!terrain)return;
  chosen=mapToWorld(Math.max(0,Math.min(1,u)),Math.max(0,Math.min(1,v)),control,radius);
  const preview=routePreview(control,terrain,chosen.x,chosen.z);
  go.disabled=!preview.ok||control.altitudeM>12;
  setStatus(control.altitudeM>12?"地表へ降下してから行き先を設定してください":preview.message);
  paint();
 }
 function open(){
  onOpen();
  panel.hidden=false;active=true;chosen=null;go.disabled=true;
  $("viewport-route-map").setAttribute("aria-expanded","true");
  zoom.value=getController()?.travelMode==="boat"?"1200":"160";
  setStatus("🗺️ マップをタップして行き先を選んでください。青は水面、緑は陸地です。");
  paint();
 }
 function close(){
  panel.hidden=true;active=false;chosen=null;go.disabled=true;
  $("viewport-route-map").setAttribute("aria-expanded","false");
 }
 $("viewport-route-map").addEventListener("click",()=>active?close():open());
 $("map-directory-route").addEventListener("click",open);
 $("map-route-close").addEventListener("click",close);
 $("map-route-refresh").addEventListener("click",paint);
 zoom.addEventListener("change",()=>{chosen=null;go.disabled=true;paint();});
 $("map-route-clear").addEventListener("click",()=>{chosen=null;go.disabled=true;paint();});
 canvas.addEventListener("click",e=>{
  const box=canvas.getBoundingClientRect();
  choose((e.clientX-box.left)/box.width,(e.clientY-box.top)/box.height);
 });
 canvas.addEventListener("keydown",e=>{
  if(!["ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Enter"," "].includes(e.key))return;
  e.preventDefault();
  const diff={ArrowUp:[0,-.04],ArrowDown:[0,.04],ArrowLeft:[-.04,0],ArrowRight:[.04,0]}[e.key];
  if(diff){keys.u=Math.max(0,Math.min(1,keys.u+diff[0]));keys.v=Math.max(0,Math.min(1,keys.v+diff[1]));}
  choose(keys.u,keys.v);
 });
 go.addEventListener("click",()=>{
  const control=getController(),terrain=getTerrain();
  if(!chosen||!control||!terrain)return;
  const preview=routePreview(control,terrain,chosen.x,chosen.z);
  const result=preview.ok?onGo(chosen,preview):{ok:false,message:preview.message};
  const message=result?.message||"目的地を設定できませんでした";
  setStatus(message);notify(message);
  if(result?.ok)close();
  else go.disabled=true;
 });
 return {open,close,paint,get isOpen(){return active;}};
}
