import {absoluteMinutes,formatClock,formatCountdown,nextDepartures,routeSummary,
 RAIL_CARRIAGES,RAILWAY_LOOP_KM,stationById} from "./railway.mjs?v=0.8t-timetable";

/** Timetable, live train board and the compact onboard HUD. */
export function installRailwayUI({get,onWait,onBoard,onAlight,onChangeCarriage,onOpen=()=>{},notify=()=>{}}){
 const $=id=>document.getElementById(id);
 const panel=$("railway-panel"),toggle=$("viewport-railway"),body=$("railway-timetable-body");
 const status=$("railway-status"),board=$("railway-board"),carriage=$("railway-carriage");
 let departures=[],selectedService=null;

 function setStatus(message){status.textContent=message||"";}
 function trainLabel(state){
  if(state.mode==="stopped")return state.station.icon+" "+state.station.name+"に停車中 ／ "+
   formatClock(state.departureMinute)+"発";
  return state.fromStation.name.replace(/中央駅|駅/g,"")+" → "+state.nextStation.name.replace(/中央駅|駅/g,"")+
   " "+Math.round(state.progress*100)+"% ／ "+formatClock(state.nextArrivalMinute)+"着";
 }
 function refreshLive(railway,timeDays){
  const host=$("railway-live-status");host.replaceChildren();
  for(const state of railway.live(timeDays)){
   const article=document.createElement("article"),title=document.createElement("strong"),detail=document.createElement("span");
   title.textContent="🚂 "+state.service.name+"（"+state.service.directionName+"）";
   detail.textContent=trainLabel(state);article.append(title,detail);host.append(article);
  }
 }
 function refreshTimetable(railway,station,timeDays,boarded){
  departures=station?nextDepartures(station.id,timeDays,6):[];body.replaceChildren();
  if(!departures.length){
   const row=document.createElement("tr"),cell=document.createElement("td");cell.colSpan=5;
   cell.textContent=station?"発車予定を取得できません":"環状線の駅がある街を訪れてください";
   row.append(cell);body.append(row);return;
  }
  departures.forEach((departure,index)=>{
   const row=document.createElement("tr");
   for(const value of [departure.time,departure.directionName,departure.destinationName,
    formatCountdown(departure.countdownMinutes)]){
    const cell=document.createElement("td");cell.textContent=value;row.append(cell);
   }
   const action=document.createElement("td"),wait=document.createElement("button");
   wait.type="button";wait.dataset.departure=String(index);wait.textContent="駅で待つ";
   wait.disabled=Boolean(boarded);wait.title=departure.serviceName+"の到着時刻まで進め、駅で時間を停止します";
   action.append(wait);row.append(action);body.append(row);
  });
 }
 function refreshOnboard(railway,timeDays){
  const state=railway.status(timeDays),hud=$("railway-onboard-hud");hud.hidden=!state;
  if(!state)return;
  $("railway-onboard-title").textContent=state.carriageInfo.icon+" "+state.service.name+"・"+state.carriageInfo.name;
  $("railway-onboard-detail").textContent=state.mode==="stopped"?
   state.station.name+"に停車中 ／ 次は"+state.nextStation.name+" ／ "+formatClock(state.departureMinute)+"発":
   "次は "+state.nextStation.name+" ／ 到着 "+formatClock(state.nextArrivalMinute)+"（"+
    formatCountdown(state.nextArrivalMinute-absoluteMinutes(timeDays))+"）";
  $("railway-onboard-progress").value=state.mode==="travel"?Math.round(state.progress*100):0;
  $("railway-hud-alight").disabled=state.mode!=="stopped";
 }
 function refresh(){
  const {railway,timeDays,stationId,controller}=get(),station=stationById(stationId),boarded=railway.boarded;
  refreshOnboard(railway,timeDays);
  if(panel.hidden)return;
  const now=absoluteMinutes(timeDays);
  $("railway-clock").textContent="惑星標準時 "+formatClock(now,{withDay:true});
  $("railway-route").textContent=routeSummary()+" ／ 環状 "+RAILWAY_LOOP_KM.toFixed(1)+"km";
  $("railway-station-name").textContent=station?station.icon+" "+station.name:"🚉 現在地に環状線の駅はありません";
  const distance=station&&controller?Math.hypot(controller.x-station.site.x,controller.z-station.site.z):Infinity;
  $("railway-station-detail").textContent=station?
   station.townName+" ／ ホームまで約"+Math.round(distance)+"m ／ 1番線 外回り・2番線 内回り":
   "塔の街・草原の村・王都・港町の4駅を結びます。街・村メニューから移動できます。";
  refreshLive(railway,timeDays);refreshTimetable(railway,station,timeDays,boarded);
  const stopped=station?railway.stoppedAt(station.id,timeDays):[];
  if(stopped.length&&!selectedService)selectedService=stopped[0].service.id;
  board.disabled=Boolean(boarded)||!station||!stopped.some(item=>item.service.id===selectedService);
  board.textContent=boarded?"乗車中":stopped.length?"🚂 停車中の列車に乗る":"列車の到着を待ってください";
  $("railway-alight").disabled=!boarded||railway.status(timeDays)?.mode!=="stopped";
  $("railway-alight").hidden=!boarded;
  if(boarded&&document.activeElement!==carriage)carriage.value=boarded.carriage;
 }
 function open(){panel.hidden=false;toggle.setAttribute("aria-expanded","true");onOpen();refresh();}
 function close(){panel.hidden=true;toggle.setAttribute("aria-expanded","false");}
 toggle.addEventListener("click",()=>panel.hidden?open():close());
 $("railway-close").addEventListener("click",close);
 body.addEventListener("click",event=>{
  const button=event.target.closest("button[data-departure]");if(!button||!body.contains(button))return;
  const departure=departures[Number(button.dataset.departure)];if(!departure)return;
  const result=onWait(departure);setStatus(result?.message||"列車を待てませんでした");
  if(result?.ok)selectedService=departure.serviceId;
  notify(status.textContent);refresh();
 });
 board.addEventListener("click",()=>{
  const result=onBoard(selectedService,carriage.value);setStatus(result?.message||"乗車できませんでした");
  notify(status.textContent);refresh();if(result?.ok)close();
 });
 function alight(){
  const result=onAlight();setStatus(result?.message||"降車できませんでした");
  notify(status.textContent);refresh();
 }
 $("railway-alight").addEventListener("click",alight);$("railway-hud-alight").addEventListener("click",alight);
 carriage.addEventListener("change",()=>{
  if(!get().railway.boarded)return;
  const result=onChangeCarriage(carriage.value);setStatus(result?.message||"車両を移動できませんでした");
  notify(status.textContent);refresh();
 });
 $("railway-hud-open").addEventListener("click",open);
 return {open,close,refresh,setStatus,get isOpen(){return !panel.hidden;}};
}
