import {absoluteMinutes,formatClock,formatCountdown,nextDepartures,routeSummary,
 RAIL_CARRIAGES,RAILWAY_LOOP_KM,stationById} from "./railway.mjs?v=0.8z-crossing";

/** Timetable, live train board and the compact onboard HUD. */
export function installRailwayUI({get,onWait,onEnterStation=()=>({ok:false}),onExitStation=()=>({ok:false}),onSkipArrival=()=>({ok:false}),onBuyTicket=()=>({ok:false}),onBoard,onAlight,onChangeCarriage,onCamera=()=>({ok:false}),onWalls=()=>({ok:false}),onTalk=()=>({ok:false}),onOpen=()=>{},notify=()=>{}}){
 const $=id=>document.getElementById(id);
 const panel=$("railway-panel"),toggle=$("viewport-railway"),body=$("railway-timetable-body");
 const status=$("railway-status"),board=$("railway-board"),carriage=$("railway-carriage");
 const destination=$("railway-destination"),buyTicket=$("railway-buy-ticket"),platform=$("railway-platform");
 let departures=[],selectedDeparture=null;

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
   wait.type="button";wait.dataset.departure=String(index);wait.textContent="選ぶ";
   wait.disabled=Boolean(boarded);wait.title=departure.serviceName+"を選び、行先切符を購入します";
   wait.setAttribute("aria-pressed",String(selectedDeparture?.departureMinute===departure.departureMinute&&
    selectedDeparture?.serviceId===departure.serviceId));
   action.append(wait);row.append(action);body.append(row);
  });
 }
 function refreshTicketOffice(railway,station,boarded){
  $("railway-funds").textContent="テスト所持金 "+railway.fundsLabel;
  const selection=selectedDeparture;
  const signature=selection?selection.serviceId+":"+selection.stationId:"";
  if(destination.dataset.route!==signature){
   const previous=railway.ticket?.serviceId===selection?.serviceId?railway.ticket.destinationId:destination.value;
   destination.replaceChildren();
   if(selection)for(const stop of selection.stops){
    const option=document.createElement("option");option.value=stop.id;option.textContent=stop.icon+" "+stop.name;
    destination.append(option);
   }
   if(previous&&selection?.stops.some(stop=>stop.id===previous))destination.value=previous;
   destination.dataset.route=signature;
  }
  destination.disabled=Boolean(boarded)||!station||!selection;
  buyTicket.disabled=destination.disabled||!destination.value||railway.concourse!==station?.id;
  const matching=Boolean(selection&&railway.ticketFor(station?.id,selection.serviceId));
  platform.disabled=Boolean(boarded)||!matching||railway.concourse!==station?.id;
  const ticket=railway.ticket;
  $("railway-ticket-status").textContent=boarded&&ticket?
   "改札済み："+stationById(ticket.destinationId).name+"まで":
   railway.platform&&matching?"改札済み。ホームで列車の到着を待っています。":
   matching?"購入済み："+stationById(ticket.destinationId).name+"まで（"+ticket.fare+"G）":
   selection?selection.serviceName+"を選択中。行先を選び切符を購入してください。":
   "時刻表から乗る列車を選んでください。";
 }
 function refreshOnboard(railway,timeDays){
  const state=railway.status(timeDays),hud=$("railway-onboard-hud");hud.hidden=!state;
  if(!state)return;
  $("railway-onboard-title").textContent=state.carriageInfo.icon+" "+state.service.name+"・"+state.carriageInfo.name;
  $("railway-onboard-detail").textContent=state.mode==="stopped"?
   state.station.name+"に停車中 ／ 行先 "+(state.destination?.name||state.nextStation.name)+" ／ "+formatClock(state.departureMinute)+"発":
   "次は "+state.nextStation.name+" ／ 到着 "+formatClock(state.nextArrivalMinute)+"（"+
    formatCountdown(state.nextArrivalMinute-absoluteMinutes(timeDays))+"）／ 行先 "+(state.destination?.name||"未設定");
  $("railway-onboard-progress").value=state.mode==="travel"?Math.round(state.progress*100):0;
  $("railway-hud-alight").disabled=state.mode!=="stopped";
  for(const button of document.querySelectorAll("[data-rail-camera]"))
   button.setAttribute("aria-pressed",String(button.dataset.railCamera===state.camera));
  $("railway-wall-toggle").textContent=state.hideWalls?"🧱 壁を表示":"🧱 壁を隠す";
  $("railway-wall-toggle").setAttribute("aria-pressed",String(state.hideWalls));
  const people=$("railway-people"),names=get().companions||[];
  const manifest=railway.people(names),signature=state.carriage+":"+names.join("|");
  if(people.dataset.manifest!==signature){
   people.replaceChildren();
   for(const actor of manifest){
    const option=document.createElement("option");option.value=actor.id;
    option.textContent=actor.kind==="companion"?"🤝 "+actor.name:"🧑 "+actor.name;people.append(option);
   }
   people.dataset.manifest=signature;
  }
  $("railway-talk").disabled=state.camera!=="interior"||!manifest.length;
  $("railway-people-controls").hidden=state.camera!=="interior";
  $("railway-experience-status").textContent=state.camera==="interior"?
   "車内で歩けます。位置："+state.pose.x.toFixed(1)+"m / "+state.pose.z.toFixed(1)+"m。話す相手へ近づいてください":
   ({follow:"列車を追いかけるカメラ",fixed:"線路沿いの定点カメラ",rts:"上空から列車と線路を見る"}[state.camera]||"");
 }
 function refresh(){
  const {railway,timeDays,stationId,controller}=get(),station=stationById(stationId),boarded=railway.boarded;
  refreshOnboard(railway,timeDays);
  if(panel.hidden)return;
  const now=absoluteMinutes(timeDays);
  $("railway-clock").textContent="惑星標準時 "+formatClock(now,{withDay:true});
  const routeKm=get().routeKm;
  $("railway-route").textContent=routeSummary()+" ／ 惑星上の路線距離 "+(Number.isFinite(routeKm)&&routeKm>0?routeKm:RAILWAY_LOOP_KM).toFixed(1)+"km";
  $("railway-station-name").textContent=station?station.icon+" "+station.name:"🚉 現在地に環状線の駅はありません";
  const distance=station&&controller?Math.hypot(controller.x-station.site.x,controller.z-station.site.z):Infinity;
  const inside=Boolean(station&&railway.concourse===station.id);
  $("railway-enter-station").disabled=Boolean(boarded)||!station||distance>40||controller?.altitudeM>12;
  $("railway-enter-station").hidden=inside;
  $("railway-exit-station").hidden=!inside||Boolean(railway.platform);
  $("railway-concourse-status").textContent=inside?
   railway.platform?"🚉 改札を通過しています。ホームで駅員に話せます":
    "🧑‍✈️ 駅構内です。移動キーやスティックで歩けます。窓口の駅員から切符を購入してください。":
   "駅舎の入口に近づいて「駅舎に入る」。そのあと切符の購入と改札です。";
  $("railway-station-detail").textContent=station?
   station.townName+" ／ ホームまで約"+Math.round(distance)+"m ／ 1番線 外回り・2番線 内回り":
   "塔の街・草原の村・王都・港町の4駅を結びます。街・村メニューから移動できます。";
  refreshLive(railway,timeDays);refreshTimetable(railway,station,timeDays,boarded);
  const stopped=station?railway.stoppedAt(station.id,timeDays):[];
  refreshTicketOffice(railway,station,boarded);
  const selectedService=selectedDeparture?.serviceId;
  const atPlatform=Boolean(railway.platform&&railway.platform.stationId===station?.id&&
   railway.platform.serviceId===selectedService);
  $("railway-skip-arrival").disabled=Boolean(boarded)||!atPlatform||
   !selectedDeparture||selectedDeparture.arrivalMinute<=now+.1;
  board.disabled=Boolean(boarded)||!station||!atPlatform||
   !stopped.some(item=>item.service.id===selectedService);
  board.textContent=boarded?"乗車中":!atPlatform?"駅員から切符を購入し改札へ":
   stopped.some(item=>item.service.id===selectedService)?"🚂 ホームから列車に乗る":"列車の到着を待ってください";
  $("railway-alight").disabled=!boarded||railway.status(timeDays)?.mode!=="stopped";
  $("railway-alight").hidden=!boarded;
  if(boarded&&document.activeElement!==carriage)carriage.value=boarded.carriage;
 }
 function open(){panel.hidden=false;toggle.setAttribute("aria-expanded","true");onOpen();refresh();}
 function close(){panel.hidden=true;toggle.setAttribute("aria-expanded","false");}
 toggle.addEventListener("click",()=>panel.hidden?open():close());
 $("railway-close").addEventListener("click",close);
 $("railway-enter-station").addEventListener("click",()=>{
  const result=onEnterStation();setStatus(result?.message||"駅舎に入れませんでした");
  notify(status.textContent);refresh();
 });
 $("railway-exit-station").addEventListener("click",()=>{
  const result=onExitStation();setStatus(result?.message||"退出できませんでした");
  notify(status.textContent);refresh();
 });
 $("railway-skip-arrival").addEventListener("click",()=>{
  if(!selectedDeparture)return;
  const result=onSkipArrival(selectedDeparture);
  setStatus(result?.message||"駅員が到着時刻を確認できませんでした");
  notify(status.textContent);refresh();
 });
 body.addEventListener("click",event=>{
  const button=event.target.closest("button[data-departure]");if(!button||!body.contains(button))return;
  const departure=departures[Number(button.dataset.departure)];if(!departure)return;
  selectedDeparture=departure;
  setStatus(departure.serviceName+"（"+departure.directionName+"・"+departure.time+"発）を選びました。行先切符を購入してください。");
  refresh();
 });
 buyTicket.addEventListener("click",()=>{
  if(!selectedDeparture)return;
  const result=onBuyTicket(selectedDeparture,destination.value);
  setStatus(result?.message||"切符を購入できませんでした");notify(status.textContent);refresh();
 });
 platform.addEventListener("click",()=>{
  if(!selectedDeparture)return;
  const result=onWait(selectedDeparture);setStatus(result?.message||"ホームへ入れませんでした");
  notify(status.textContent);refresh();
 });
 board.addEventListener("click",()=>{
  const result=onBoard(selectedDeparture?.serviceId,carriage.value);setStatus(result?.message||"乗車できませんでした");
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
 $("railway-view-controls").addEventListener("click",event=>{
  const camera=event.target.closest("button[data-rail-camera]");
  let result;
  if(camera)result=onCamera(camera.dataset.railCamera);
  else if(event.target.closest("#railway-wall-toggle"))result=onWalls();
  else if(event.target.closest("#railway-talk"))result=onTalk($("railway-people").value);
  else return;
  setStatus(result?.message||"列車の操作に失敗しました");
  if(result?.message)notify(result.message);
  refresh();
 });
 return {open,close,refresh,setStatus,get isOpen(){return !panel.hidden;}};
}
