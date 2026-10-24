import {Multiverse} from "../core.mjs";
import {Planet} from "../planet/planet-core.mjs";
import {Terrain} from "../planet/terrain-engine.mjs?v=0.8p-islands";
import {Weather} from "../planet/weather-engine.mjs";
import {ExplorerController} from "./controller.mjs?v=0.8y-harbor";
import {findLand,terrainSurface} from "./geo.mjs?v=0.8y-harbor";
import {ExplorerRenderer} from "./render.mjs?v=0.9g-guard-defense";
import {Actions} from "./actions.mjs?v=0.8e-saw";
import {ResourceHarvest} from "./resource-harvest.mjs?v=0.8e-kg";
import {ConstructionSystem,FACILITIES} from "./construction-system.mjs?v=0.8h-church";
import {ConstructionPlacement} from "./construction-ui.mjs";
import {Earthworks} from "./earthworks.mjs";
import {OwnerWorld} from "./owner-world.mjs?v=0.9c-asset-v2";
import {TerritoryEconomy} from "./territory-economy.mjs?v=0.9f-territory";
import {FactionStrategy} from "./faction-strategy.mjs?v=0.9g-strategy";
import {installStrategyUI} from "./faction-strategy-ui.mjs?v=0.9g-strategy";
import {installTerritoryUI} from "./territory-ui.mjs?v=0.9f-territory";
import {installOwnerEditor} from "./owner-editor-ui.mjs?v=0.9c-asset-v2";
import {installAssetStudio} from "./asset-studio-ui.mjs?v=0.9c-asset-v2";
import {BattleTest} from "./battle-test.mjs?v=0.9g-defense";
import {installWorldFeedbackUI} from "./world-feedback-ui.mjs?v=0.9g-guards";
import {joystickMovement} from "./stick-input.mjs";
import {HutAccess,HUT} from "./buildings.mjs";
import {BOOK_MAP,BookCollection,pagesForBook} from "./books.mjs";
import {Lifestyle} from "./lifestyle.mjs?v=0.8e-chest-mass";
import {advanceVitals,eatVitals,healVitals,restVitals,normalizeVitals} from "./character-vitals.mjs?v=0.8h-satiety-rest-r2";
import {installLifestyleUI} from "./lifestyle-ui.mjs";
import {createAppearance,restoreAppearance,withOutfit,withAppearanceSlot,OUTFITS} from "./wardrobe.mjs";
import {ExpressionController,EXPRESSIONS} from "./expression.mjs";
import {CameraController,CAMERA_MODES} from "./camera-controller.mjs";
import {SquadEngine,RULE_METRICS,RULE_OPERATORS,RULE_ACTIONS} from "./squad.mjs?v=0.8h-hunger-mental-r2";
import {installGroupUI} from "./groups-ui.mjs";
import {installFrontierInteractions} from "./frontier-interaction-ui.mjs?v=0.9h-disarm";
import {bindViewportGestures} from "./viewport-gestures.mjs?v=0.8j-map-gesture-r2";
import {installMapDirectoryUI} from "./map-directory-ui.mjs?v=0.8j-map-ui";
import {settlementDestinations,destinationById} from "./settlements.mjs?v=0.8y-harbor";
import {installSettlementTravelUI} from "./settlement-travel-ui.mjs?v=0.8r-towns";
import {installOrbitalCitiesUI} from "./orbital-cities-ui.mjs?v=0.8u-city-globe";
import {TownLife} from "./town-life.mjs?v=0.8s-towns";
import {installTownInteractionUI} from "./town-interaction-ui.mjs?v=0.8s-towns";
import {absoluteMinutes,RailwaySystem,stationById,nextDepartures,formatClock} from "./railway.mjs?v=0.8z-crossing";
import {railwayJourneyPose,railwayNetworkDistanceKm} from "./railway-world.mjs?v=0.8x-rail-safety";
import {installRailwayUI} from "./railway-ui.mjs?v=0.8y-station";
import {RailwaySecurity,RAIL_BAIL_FINE,railwaySafeExit} from "./railway-security.mjs?v=0.9g-rail-law";
import {chooseSettlementSpawn} from "./settlement-spawn.mjs?v=0.8z-safe-spawn";
import {gameDaysForRealSeconds,normalizeTimeScale,DEFAULT_TIME_SCALE} from "./game-time.mjs?v=0.8x-real-time";
import {descentVisuals,ORBIT_GROUND_CUTOFF_M} from "./descent-visuals.mjs";
import {ArrowProjectiles,ARROW_RECOVERY_SECONDS} from "./arrow-projectiles.mjs?v=0.8k-arrow-ttl";
import {chooseWorkPoint} from "./terrain-collision.mjs";
import {FaunaWorld} from "./fauna.mjs?v=0.8f-animals";
import {installFaunaUI} from "./fauna-ui.mjs?v=0.8g-feed";
import {AgricultureWorld} from "./agriculture.mjs?v=0.8g-farming";
import {installAgricultureUI} from "./agriculture-ui.mjs?v=0.8g-panel";
import {MarineWorld,BOATS,resolveLanding} from "./marine.mjs?v=0.8v-alpine-horizon";
import {SWIM_STYLES,DIVE_GEAR,SEA_SITE_TYPES} from "./ocean-exploration.mjs?v=0.8o-seabed";
import {shipLocalToWorld,shipWorldToLocal,SHIP_HELM} from "./shipboard.mjs?v=0.8n-crew-walking";
import {FISH_CATALOG} from "./ship-life.mjs?v=0.8p-cast-reel";
import {mapToWorld,routePreview} from "./map-navigation.mjs?v=0.8q-map-goal";
import {installRouteMapUI} from "./map-route-ui.mjs?v=0.8q-chart";
import {writeSlot,readSlot,eraseSlot,slotIndex} from "./save-slots.mjs?v=0.8y-slots";
import {PassengerFerry,ferryLocation,ferryDepartures,ferryDockArrival} from "./passenger-ferry.mjs?v=0.8y-ferry";
import {WHARVES} from "./harbor-geometry.mjs?v=0.8y-harbor";
import {LawSystem,GUARD_POSTS} from "./law-system.mjs?v=0.9h-dialogue";
import {installLawUI} from "./law-ui.mjs?v=0.9h-dialogue";
import {installXRUI} from "./xr-ui.mjs?v=0.9i-xr";
import {sweptWeaponContacts,contactDamage} from "./melee-contact.mjs?v=0.9e-guard";

const $=id=>document.getElementById(id);
const SAVE_KEY="universal-engine:explorer:v0.7i";
const FOG_MODE_KEY="universal-engine:explorer:fog:v1";
const PRE_FRONTIER_SAVE_KEY="universal-engine:explorer:v0.7g";
const V07D_SAVE_KEY="universal-engine:explorer:v0.7d";
const LIFE_JOURNAL_KEY="universal-engine:explorer:life:v1";
const WORLD_JOURNAL_KEY="universal-engine:explorer:earthworks:v0.8a";
const STRUCTURES_JOURNAL_KEY="universal-engine:explorer:construction:v0.8e";
const OWNER_JOURNAL_KEY="universal-engine:explorer:owner:v0.8w";
const FAUNA_JOURNAL_KEY="universal-engine:explorer:fauna:v0.8f";
const FARM_JOURNAL_KEY="universal-engine:explorer:agriculture:v0.8g";
const MARINE_JOURNAL_KEY="universal-engine:explorer:marine:v0.8g";
const FERRY_JOURNAL_KEY="universal-engine:explorer:ferry:v0.8y";
const TOWN_JOURNAL_KEY="universal-engine:explorer:town:v0.8s";
const RAILWAY_JOURNAL_KEY="universal-engine:explorer:railway:v0.8t";
const RAILWAY_SECURITY_JOURNAL_KEY="universal-engine:explorer:railway-security:v0.8x";
const LAW_JOURNAL_KEY="universal-engine:explorer:law:v0.9d";
const TERRITORY_JOURNAL_KEY="universal-engine:explorer:territory:v0.9f";
const FACTION_JOURNAL_KEY="universal-engine:explorer:factions:v0.9g";
const TIME_SCALE_KEY="universal-engine:explorer:time-scale:v0.8x";
const V07C_SAVE_KEY="universal-engine:explorer:v0.7c";
const V07B_SAVE_KEY="universal-engine:explorer:v0.7b";
const PREVIOUS_SAVE_KEY="universal-engine:explorer:v0.7a";
const LEGACY_SAVE_KEY="universal-engine:explorer:v1";
let planet,terrain,weather,controller,renderer,universe,simWorld,actions,squad,access,battle,projectiles,harvest,earthworks,constructions;
let xrUI=null;
let ownerWorld=null,ownerUI=null,assetStudio=null,ferry=null;
let constructionUI=null,fauna=null,faunaUI=null,farm=null,farmUI=null,mapDirectoryUI=null,routeMapUI=null,settlementTravelUI=null,railwayUI=null,settlementLocations=null,activeSettlementId="pioneer",vitalsSaveElapsed=0,marine=null,railway=null,railwaySecurity=null;
let books=new BookCollection(),activeBookId=null,life=new Lifestyle(),lifeUI=null;
let townLife=new TownLife(),townUI=null,law=new LawSystem(),lawUI=null;
let lastGuardStrike=null;
let territoryEconomy=null,territoryUI=null,factionStrategy=null,factionUI=null;
function loadTerritoryJournal(){
 try{return JSON.parse(localStorage.getItem(TERRITORY_JOURNAL_KEY)||"null");}catch(_){return null;}
}
function saveTerritoryJournal(){
 try{if(territoryEconomy)localStorage.setItem(TERRITORY_JOURNAL_KEY,JSON.stringify(territoryEconomy.snapshot()));}
 catch(_){log("領地台帳の自動保存に失敗しました");}
}
function loadFactionJournal(){
 try{return JSON.parse(localStorage.getItem(FACTION_JOURNAL_KEY)||"null");}catch(_){return null;}
}
function saveFactionJournal(){
 try{if(factionStrategy)localStorage.setItem(FACTION_JOURNAL_KEY,JSON.stringify(factionStrategy.snapshot()));}
 catch(_){log("国家外交・軍事データを保存できませんでした");}
}
function saveLawJournal(){try{localStorage.setItem(LAW_JOURNAL_KEY,JSON.stringify(law.snapshot()));}catch(_){log("治安・継承データを保存できませんでした");}lawUI?.refresh();}
function loadLawJournal(){try{return JSON.parse(localStorage.getItem(LAW_JOURNAL_KEY)||"null");}catch(_){return null;}}
function saveRailwayJournal(){
 try{if(railway)localStorage.setItem(RAILWAY_JOURNAL_KEY,JSON.stringify(railway.snapshot()));}
 catch(_){log("鉄道の乗車記録を保存できませんでした");}
}
function loadRailwayJournal(){
 try{return JSON.parse(localStorage.getItem(RAILWAY_JOURNAL_KEY)||"null");}catch(_){return null;}
}
function saveRailwaySecurityJournal(){
 try{if(railwaySecurity)localStorage.setItem(RAILWAY_SECURITY_JOURNAL_KEY,JSON.stringify(railwaySecurity.snapshot()));}
 catch(_){log("鉄道保安の記録を保存できませんでした");}
}
function loadRailwaySecurityJournal(){
 try{return JSON.parse(localStorage.getItem(RAILWAY_SECURITY_JOURNAL_KEY)||"null");}catch(_){return null;}
}
function saveTownJournal(){
 try{localStorage.setItem(TOWN_JOURNAL_KEY,JSON.stringify(townLife.snapshot()));}
 catch(_){log("街の記録の保存に失敗しました");}
}
function loadTownJournal(){
 try{return JSON.parse(localStorage.getItem(TOWN_JOURNAL_KEY)||"null");}catch(_){return null;}
}
function saveMarineJournal(){
 try{if(marine)localStorage.setItem(MARINE_JOURNAL_KEY,JSON.stringify(marine.snapshot()));}
 catch(_){log("船の保存に失敗しました");}
}
function saveFerryJournal(){
 try{if(ferry)localStorage.setItem(FERRY_JOURNAL_KEY,JSON.stringify(ferry.snapshot()));}
 catch(_){log("旅客船の運航記録を保存できませんでした");}
}
function loadFerryJournal(){
 try{return JSON.parse(localStorage.getItem(FERRY_JOURNAL_KEY)||"null");}catch(_){return null;}
}
function loadMarineJournal(){
 try{return JSON.parse(localStorage.getItem(MARINE_JOURNAL_KEY)||"null");}catch(_){return null;}
}
function loadLifeJournal(){
 try{return JSON.parse(localStorage.getItem(LIFE_JOURNAL_KEY)||"null");}catch(_){return null;}
}
function saveLifeJournal(){
 try{localStorage.setItem(LIFE_JOURNAL_KEY,JSON.stringify({life:life.snapshot(),resources:actions.resources,vitals:squad?.frontier?.people||null,playerHp:battle?.playerHp??100}));}
 catch(_){log("生活データの自動保存に失敗しました。");}
}
const BOOK_JOURNAL_KEY="universal-engine:explorer:reading:v1";
function loadBookJournal(){
 try{return JSON.parse(localStorage.getItem(BOOK_JOURNAL_KEY)||"null");}
 catch(_){return null;}
}
function saveBookJournal(){
 try{localStorage.setItem(BOOK_JOURNAL_KEY,JSON.stringify(books.snapshot()));}
 catch(_){log("しおりの自動保存ができません。ゲーム全体の保存をお試しください。");}
}
function loadWorldJournal(){
 try{return JSON.parse(localStorage.getItem(WORLD_JOURNAL_KEY)||"null");}catch(_){return null;}
}
function saveWorldJournal(){
 try{localStorage.setItem(WORLD_JOURNAL_KEY,JSON.stringify({resources:harvest.snapshot(),earthworks:earthworks.snapshot()}));}
 catch(_){log("環境の自動保存ができません。ゲームの保存をお試しください。");}
}
function saveOwnerJournal(){
 try{if(ownerWorld)localStorage.setItem(OWNER_JOURNAL_KEY,JSON.stringify(ownerWorld.snapshot()));}
 catch(_){log("オーナー編集の自動保存に失敗しました");}
}
function loadOwnerJournal(){try{return JSON.parse(localStorage.getItem(OWNER_JOURNAL_KEY)||"null");}catch(_){return null;}}
function emitHarvestEffect(node,result,agent=null){
 if(result.stage==="felled")renderer?.beginTreeFall(node);
 const isRock=node.kind==="stone";
 worldUI?.float({kind:result.stage==="collected"?"gain":"damage",
  text:result.stage==="collected"?(isRock?"🪨":"🪵")+" +"+Object.values(result.drops||{}).reduce((a,b)=>a+b,0):
   result.stage==="felled"?"🌲 倒木":result.stage==="broken"?"💥 砕石":(isRock?"⛏️ −1":"🪓 −1"),
  actorId:agent?.id||"player",duration:1.1});
 const host=document.getElementById("harvest-fx-layer");
 const screen=renderer?.screenResources?.find(n=>n.id===node.id);
 if(!host||!screen?.onScreen)return;
 for(let i=0;i<7;i++){
  const el=document.createElement("span");el.className="harvest-spark"+(isRock?" rock":" wood");
  el.style.left=(screen.u*100)+"%";el.style.top=(screen.v*100)+"%";
  el.style.setProperty("--dx",((i%4-1.5)*15)+"px");
  el.style.setProperty("--dy",(-18-Math.floor(i/4)*22)+"px");
  host.append(el);setTimeout(()=>el.remove(),700);
 }
}
function updateHarvestWorld(result,node,who="開拓者"){
 if(!result?.ok){log(result?.message||"資源を利用できません");return;}
 for(const [kind,amount] of Object.entries(result.drops||{})){
  actions.resources[kind]=(actions.resources[kind]||0)+amount;
 }
 renderer.patchKey=null;renderer.selectedResource=null;
 emitHarvestEffect(node,result,squad?.get("player"));
 log(who+"："+result.message);saveWorldJournal();saveLifeJournal();
}
function nearbyWorldResource(kind,who=controller){
 const type=kind==="mine"?"stone":"wood";
 return (renderer?.resourceNodes||[]).filter(n=>n.kind===type&&Math.hypot(n.x-who.x,n.z-who.z)<5.2)
  .sort((a,b)=>Math.hypot(a.x-who.x,a.z-who.z)-Math.hypot(b.x-who.x,b.z-who.z))[0]||null;
}
function doEarthwork(mode,site){
 const center=site||controller.locationAt(controller.x+Math.sin(controller.yaw)*3,
  controller.z+Math.cos(controller.yaw)*3);
 const base=terrain.sample(center.lat,center.lon);
 if(base.water||base.river){log("水面・河床はこの掘削モードでは編集できません");return;}
 if(mode==="fill"&&(actions.resources.soil||0)<1){log("盛り土には土×1が必要です");return;}
 const r=earthworks.change(center.lat,center.lon,mode,14);
 if(!r.ok){log(r.message);return;}
 for(const [name,n] of Object.entries(r.material))actions.resources[name]=Math.max(0,(actions.resources[name]||0)+n);
 renderer.patchKey=null;log(r.message);saveWorldJournal();saveLifeJournal();updateHUD();
}
let rtsMode=false,rtsPreviousCamera="follow",rtsMulti=false,rallyPicking=false,syncMode=false,autoActorId="player";
let controlMode="stick",stick={x:0,y:0},stickPointer=null;
let running=true,lastTime=0,frameTime=0,frameCount=0,displayMode="",lastHud=0,voyageSaveElapsed=0;
let avatarStyle="pioneer",appearance=createAppearance(),lastExpressionPreset="neutral";
let frontierUI=null,worldUI=null,groupUI=null;
const lastNpcStatus=new Map();
const resourceNames={wood:"🪵 木材",stone:"🪨 石材",fiber:"🌿 繊維",clay:"🧱 粘土",metal:"⚙️ 金属",ironOre:"⛏️ 鉄鉱石",plank:"🪚 板材",soil:"🟫 土",wheat:"🌾 小麦",straw:"🟡 麦わら",carrot:"🥕 ニンジン",apple:"🍎 リンゴ",fish:"🐟 魚",ancientCoins:"🪙 古代金貨",dragonRelic:"🐉 竜人文明遺物"};
const keys=new Set(),touches=new Set();
const manualHarvest=new Map(),pendingArrowPickup=new Map();
let viewportGestures=null,orbitSelection=null,pendingWaterEntry=null,orbitalCitiesUI=null;
let cachedResourceArray=null;const resourceByOrigin=new Map();
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function log(msg){
 worldUI?.append(msg);
 const li=document.createElement("li");li.textContent=msg;
 $("log").prepend(li);while($("log").children.length>8)$("log").lastElementChild.remove();
}
function saveFaunaJournal(){
 try{if(fauna)localStorage.setItem(FAUNA_JOURNAL_KEY,JSON.stringify(fauna.snapshot()));}catch(_){}
}
function loadFarmJournal(){
 try{return JSON.parse(localStorage.getItem(FARM_JOURNAL_KEY)||"null");}catch(_){return null;}
}
function saveFarmJournal(){
 try{if(farm)localStorage.setItem(FARM_JOURNAL_KEY,JSON.stringify(farm.snapshot()));}catch(_){}
}
function faunaGroundPassable(fx,fz,tx,tz){
 if(!controller)return false;
 const sample=(x,z)=>{const p=controller.locationAt(x,z);return terrainSurface(terrain,p.lat,p.lon);};
 const before=sample(fx,fz),after=sample(tx,tz),step=Math.hypot(tx-fx,tz-fz);
 return !after.water&&!after.river&&after.elevationM<2800&&
  Math.abs(after.elevationM-before.elevationM)<=Math.max(.12,step*.74);
}
function init(saved=null){
 try{
  manualHarvest.clear();pendingArrowPickup.clear();resourceByOrigin.clear();cachedResourceArray=null;lastGuardStrike=null;viewportGestures?.cancel();
  orbitSelection=null;
  orbitalCitiesUI?.reset();
  $("orbit-landing-preview").hidden=true;
  $("orbit-pick-marker").hidden=true;
  if(renderer)renderer.destroy();
  worldUI?.clear();lastNpcStatus.clear();$("world-hit-flash").style.opacity="0";
  planet=saved?Planet.fromSnapshot(saved.planet):new Planet({seed:77,name:"Terra Nova",timeDays:0.24});
  terrain=new Terrain(planet);weather=new Weather(planet);
   // This seed-specific starter valley remains at a fixed planet coordinate
   // even when the player later lands on another continent.
   terrain.landscapeAnchor=findLand(terrain);
   const restoredWorld=saved?.v0_8a||(saved?null:loadWorldJournal());
   let constructionSnapshot=saved?.v0_8e?.construction||null;
   if(!constructionSnapshot&&!saved)try{constructionSnapshot=JSON.parse(localStorage.getItem(STRUCTURES_JOURNAL_KEY)||"null");}catch(_){}
   constructions=new ConstructionSystem(constructionSnapshot);
   earthworks=new Earthworks(restoredWorld?.earthworks||null);
   terrain.earthworks=earthworks;
   ownerWorld=new OwnerWorld(saved?.v0_8w?.owner||(!saved?loadOwnerJournal():null));
   terrain.ownerWorld=ownerWorld;
   ownerUI?.reset();
   harvest=new ResourceHarvest(restoredWorld?.resources||null);
  controller=saved?ExplorerController.fromSnapshot(terrain,saved.explorer):new ExplorerController(terrain);
  townLife=new TownLife(saved?.v0_8s||(!saved?loadTownJournal():null));
   law=new LawSystem(saved?.v0_9d||(!saved?loadLawJournal():null));
  railway=new RailwaySystem(saved?.v0_8t||(!saved?loadRailwayJournal():null));
  railwaySecurity=new RailwaySecurity(saved?.v0_8x?.security||(!saved?loadRailwaySecurityJournal():null));
  townUI?.close(true);lawUI?.close();$("town-interior-exit").hidden=true;
   activeSettlementId=saved?.v0_8r?.destinationId||"pioneer";
   if(!destinationById(activeSettlementId)&&activeSettlementId!=="wilderness")activeSettlementId="pioneer";
    territoryEconomy=new TerritoryEconomy(saved?.v0_9f?.territory||(!saved?loadTerritoryJournal():null),planet.timeDays);
    territoryEconomy.syncOwnerBuildings(ownerWorld);
    territoryUI?.close();
    factionStrategy=new FactionStrategy(territoryEconomy,
     saved?.v0_9g?.factions||(!saved?loadFactionJournal():null),planet.timeDays);
    factionUI?.close();
   settlementLocations=null;
  ferry=new PassengerFerry(saved?.v0_8y?.ferry||(!saved?loadFerryJournal():null));
  marine=new MarineWorld(saved?.v0_8g?.marine||(!saved?loadMarineJournal():null));
  marine.update(0,controller,terrain);
  controller.boatSpeed=marine.sailingSpeed();
  let faunaJournal=null;
  if(!saved)try{faunaJournal=JSON.parse(localStorage.getItem(FAUNA_JOURNAL_KEY)||"null");}catch(_){}
  fauna=new FaunaWorld(saved?.v0_8f?.fauna||faunaJournal);
  farm=new AgricultureWorld(saved?.v0_8g?.farm||(saved?null:loadFarmJournal()));
  controller.mountRiding=Boolean(fauna.mount);controller.walkSpeed=fauna.speed();
  actions=saved?.actions?Actions.fromSnapshot(saved.actions):new Actions();
   actions.worldHarvestEnabled=true;
  battle=new BattleTest();
   const savedHp=saved?.v0_8h?.playerHp;
   if(Number.isFinite(savedHp))battle.playerHp=clamp(savedHp,0,100);
   projectiles=new ArrowProjectiles(saved?.v0_7t?.projectiles||null);
   syncMode=Boolean(saved?.v0_7t?.syncMode);
   access=new HutAccess(actions,{insideId:saved?.v0_7e?.insideId??null});
   books=new BookCollection(saved?.v0_7f||loadBookJournal());
   const journal=!saved?loadLifeJournal():null;
   life=new Lifestyle(saved?.v0_7g||journal?.life||null);
  if(marine.cabinId){
   life.activity=({bed:"sleep",chair:"sit",table:"eat",bookshelf:"read",kitchen:"cook"})[marine.cabinActivity]||"idle";
  }
   if(journal?.resources&&!saved){
    for(const k of ["wood","stone","fiber","clay","metal","ironOre","plank","soil","wheat","straw","carrot","apple","fish","ancientCoins","dragonRelic"])
     if(Number.isSafeInteger(journal.resources[k])&&journal.resources[k]>=0)actions.resources[k]=journal.resources[k];
   }
   for(const hut of actions.structures.filter(h=>h.progress>=1))life.ensureHut(hut);
   activeBookId=null;
   $("book-overlay").hidden=true;
   $("life-overlay").hidden=true;
  universe=saved?Multiverse.fromSnapshot(saved.universe):new Multiverse();
  simWorld=universe.getWorld("terra-nova")||universe.createWorld({
   id:"terra-nova",name:"Terra Nova",clock:{tickSeconds:.05,maxTicksPerAdvance:10}
  });
  let storedTimeScale=null;
  try{storedTimeScale=localStorage.getItem(TIME_SCALE_KEY);}catch(_){}
  const timeScale=normalizeTimeScale(saved?.v0_8x?.timeScale??storedTimeScale??DEFAULT_TIME_SCALE);
  $("days-per-second").value=String(timeScale);
  simWorld.addSystem("solar-time",(_world,dt)=>
   planet.advance(gameDaysForRealSeconds(dt,$("days-per-second").value)));
  simWorld.clock.paused=!running;
  renderer=new ExplorerRenderer($("world"),planet,terrain);
  try{renderer.setFogMode(localStorage.getItem(FOG_MODE_KEY)||"auto");}
  catch(_){renderer.setFogMode("auto");}
  $("fog-mode").value=renderer.fogMode;
   renderer.settlementId=activeSettlementId;
   renderer.townInterior=null;
   renderer.ferry=ferry;
   renderer.railway=railway;
   renderer.railwaySecurity=railwaySecurity;
    renderer.railwayLocations=settlementLocations||=settlementDestinations(terrain);
    renderer.railwayRouteKm=railwayNetworkDistanceKm(terrain,renderer.railwayLocations);
   renderer.trainInterior=railway.boarded?railway.status(planet.timeDays):null;
   renderer.resourceHarvest=harvest;renderer.sceneWeather=weather;renderer.fauna=fauna;renderer.farm=farm;renderer.marine=marine;
   renderer.constructionSystem=constructions;
   renderer.ownerWorld=ownerWorld;
   if(constructionUI)constructionUI.system=constructions;
  avatarStyle=["pioneer","scout","artisan"].includes(saved?.avatarStyle)?saved.avatarStyle:avatarStyle;
  appearance=saved?.v0_7b?.appearance?restoreAppearance(saved.v0_7b.appearance,avatarStyle):
    createAppearance(avatarStyle,avatarStyle);
  renderer.setAppearance(appearance);
  renderer.expression=saved?.v0_7b?.expression?
    ExpressionController.fromSnapshot(saved.v0_7b.expression):new ExpressionController();
  syncCustomizationControls();
  renderer.sceneActions=actions;renderer.sceneLife=life;renderer.battle=battle;
   renderer.arrowWorld=projectiles;
   renderer.interiorBuildingId=access.insideId;
  squad=new SquadEngine(terrain,controller,actions,saved?.v0_7d?.squad||null);
  squad.onEquippedImpact=(agent,task)=>{
    if(task.kind==="equipped_bow"){launchArrow(agent,task);return;}
     if(task.resourceNode){
      const node=harvest.visual(task.resourceNode),kind=task.kind==="equipped_mine"?"mine":"axe";
      const result=node?harvest.hit(node,kind):{ok:false,message:"採集済み"};
      if(result.ok){
       for(const [k,n] of Object.entries(result.drops||{})){
        const bag=squad.frontier.person(agent.id).inventory;
        bag[k]=(bag[k]||0)+n;
       }
       emitHarvestEffect(task.resourceNode,result,agent);renderer.patchKey=null;saveWorldJournal();
      }
      if(result.stage==="collected"||!result.ok)cancelHarvestOrder(agent.id);
      return;
     }
    const weapon=task.kind.slice("equipped_".length);
    const hits=battle?.hitWeapon(agent.control,weapon,task.style||task.variant)||[];
    for(const hit of hits){
     log("🎯 "+agent.name+"： "+hit.message);
     worldUI?.float({kind:hit.guarded?"guard":"damage",
      text:(hit.guarded?"🛡️ −":"−")+hit.damage+(hit.defeated?" ✦":""),enemyId:hit.id,duration:1.4});
    }
   };
  // The two existing companions board alongside the player on a sea-ship start.
  if(marine.boarded?.kind==="sailing_ship"){
   marine.shipboard.init(marine.boardedId,squad.agents.slice(1).map(a=>a.id));
   if(marine.cabinId&&marine.shipboard.player.zone!=="cabin"){
    // v0.8m saved only "inside cabin", without a vessel-relative position.
    marine.shipboard.player.zone="cabin";marine.shipboard.player.x=0;marine.shipboard.player.z=1.65;
   }
   if(!marine.shipboard.member(marine.shipboard.helmId))marine.shipboard.assignHelm("scout");
  }
  renderer.squad=squad;
  renderer.law=law;
  squad.attachLifestyle(life);renderer.sceneFrontier=squad.frontier;
   for(const actor of squad.agents){
    const p=squad.frontier.person(actor.id),stored=!saved?journal?.vitals?.[actor.id]:null;
    if(stored)Object.assign(p,normalizeVitals(stored));
    else if(saved?.v0_7d?.squad?.frontier?.people?.[actor.id]?.hunger===undefined)
     p.hunger=100-life.stats.hunger;
   }
   if(!saved&&Number.isFinite(journal?.playerHp))battle.playerHp=clamp(journal.playerHp,0,100);
   vitalsSaveElapsed=0;
   // Keep pre-existing book/kitchen/table/sleep actions in sync with the
   // new inverted satiety system. No lifestyle item is consumed twice.
   for(const method of ["use","useItem","useCamp"]){
    const original=life[method].bind(life);
    life[method]=(...args)=>{
     const beforeHunger=life.stats.hunger,beforeStamina=life.stats.stamina;
     const result=original(...args);
     if(result?.ok){
      const p=squad.frontier.person("player");
      p.hunger=clamp(p.hunger+(beforeHunger-life.stats.hunger),0,100);
      p.stamina=clamp(p.stamina+(life.stats.stamina-beforeStamina),0,100);
      if(life.activity==="sleep")p.mental=clamp(p.mental+12,0,100);
      saveLifeJournal();
     }
     return result;
    };
   }
   squad.frontier.attachWorld({
    list:(origin,radius)=>{
     const nodes=renderer.resourceNodes||[];
     if(cachedResourceArray!==nodes){resourceByOrigin.clear();cachedResourceArray=nodes;}
     const key=origin.x.toFixed(2)+":"+origin.z.toFixed(2)+":"+radius;
     if(resourceByOrigin.has(key))return resourceByOrigin.get(key);
     const radiusSquared=radius*radius;
     const found=nodes.filter(n=>(n.x-origin.x)**2+(n.z-origin.z)**2<=radiusSquared);
     if(resourceByOrigin.size>120)resourceByOrigin.clear();
     resourceByOrigin.set(key,found);return found;
    },
    hit:(node,kind,agent)=>{
     const current=harvest.visual(node);
     if(!current)return {ok:false,message:"採集済みです"};
     const result=harvest.hit(current,kind);
     if(result.ok){renderer.patchKey=null;saveWorldJournal();}
     return result;
    },
    effect:(node,result,agent)=>{
     if(!result?.ok)return;
     emitHarvestEffect(node,result,agent);
     log(agent.name+"："+result.message);
    },
    storageChanged:()=>{saveLifeJournal();renderAutoEditor();}
   });
  if(squad.activeGroup())syncMode=squad.activeGroup().sync;
  groupUI?.reset();
  frontierUI?.restore(saved?.v0_7i||null);
  void frontierUI?.loadModels(renderer);
  renderer.cameraController=saved?.v0_7c?.camera?
    CameraController.fromSnapshot(saved.v0_7c.camera):new CameraController();
  if(!saved)renderer.cameraController.setMode("follow",controller,
    terrainSurface(terrain,controller.lat,controller.lon).elevationM);
  syncCameraControls();
  rtsMode=false;rtsMulti=false;rallyPicking=false;
  autoActorId=squad.selectedAgents()[0]?.id||"player";
  if(!lawUI)lawUI=installLawUI({
    get:()=>({law,settlementId:activeSettlementId,squad,playerPosition:{x:controller.x,z:controller.z},payFine:amount=>{
      if(townLife.coins<amount)return false;townLife.coins-=amount;saveTownJournal();return true;
    },serveTime:days=>{planet.advance(days);saveLawJournal();updateHUD();}
    }),notify:log,onChange:()=>{saveLawJournal();updateHUD();},
    onDetain:()=>{controller.clearMoveTarget();running=false;simWorld.clock.paused=true;saveLawJournal();lawUI?.open();},
    onSuccession:heirId=>completeSuccession(heirId),
    onFight:()=>startGuardCombat(),
    onWarningCompliance:(id,kind)=>handleGuardWarningCompliance(id,kind)
   });
   lawUI.refresh();
   if(!territoryUI)territoryUI=installTerritoryUI({
    get:()=>({economy:territoryEconomy,ownerWorld,controller,planet,activeSettlementId}),
    save:saveTerritoryJournal,notify:log
   });
   if(!factionUI)factionUI=installStrategyUI({
    get:()=>({strategy:factionStrategy,economy:territoryEconomy,planet}),
    save:()=>{saveFactionJournal();saveTerritoryJournal();territoryUI?.refresh();},
    notify:log
   });
   if(!faunaUI)faunaUI=installFaunaUI({
   state:()=>({fauna,controller,actions}),log,save:saveFaunaJournal,
   refreshHud:updateHUD,passable:faunaGroundPassable,onResourcesChange:saveLifeJournal
  });
  if(!farmUI)farmUI=installAgricultureUI({
   get:()=>({farm,controller,planet,harvest,actions}),notify:log,
   onChange:()=>{saveFarmJournal();saveWorldJournal();saveLifeJournal();updateHUD();},
   canPlant:(x,z)=>faunaGroundPassable(controller.x,controller.z,x,z),
   cutLog:lengthM=>{
    if(fauna?.mount)return {ok:false,message:"製材するには馬から降りてください"};
    const node=(renderer?.resourceNodes||[]).filter(n=>n.state==="fallen"&&
     Math.hypot(n.x-controller.x,n.z-controller.z)<5.2)
     .sort((a,b)=>Math.hypot(a.x-controller.x,a.z-controller.z)-
      Math.hypot(b.x-controller.x,b.z-controller.z))[0];
    if(!node)return {ok:false,message:"5.2m以内の倒木を探してください。まず斧で木を倒します"};
    if(!actions.start("saw",controller,(lat,lon)=>terrainSurface(terrain,lat,lon)))
     return {ok:false,message:actions.message};
    actions.active.resourceNode=node;actions.active.cutLengthM=lengthM;
    return {ok:true,message:"🪚 "+lengthM+"mの切断作業を開始しました"};
   }
  });
  faunaUI.refresh();farmUI.refresh();
  syncSquadUi();
  keys.clear();touches.clear();stick={x:0,y:0};
  $("fatal").hidden=true;$("world").hidden=false;
  $("landing").textContent=controller.origin.lat.toFixed(3)+"°, "+controller.origin.lon.toFixed(3)+"°";
  log(saved?"探索状態と人物設定を読み込みました。":"v0.7c：カメラ6モードを設定から選べます。v0.7b・v0.7a・v0.6へ戻れます。");
 }catch(e){$("fatal").hidden=false;$("fatal").textContent="3D初期化エラー: "+e.message;log(e.message);running=false;}
}
function updateHarborUI(){
 const panel=$("harbor-panel");if(!panel||!ferry||!planet||!controller)return;
 const inPort=activeSettlementId==="port",terminal=$("harbor-terminal").value,
  pose=ferryLocation(planet.timeDays),next=ferryDepartures(terminal,planet.timeDays,1)[0],
  aboard=Boolean(ferry.boarded);
 const clock=m=>String(Math.floor((m%1440+1440)%1440/60)).padStart(2,"0")+":"+
  String(Math.floor((m%60+60)%60)).padStart(2,"0");
 $("harbor-schedule").textContent=!inPort?"この街には旅客船ターミナルがありません":
  "🚢 "+(pose.mode==="stopped"?(WHARVES.find(w=>w.id===pose.dockId)?.name||"港")+"に停泊中":
  "湾内を航海中 "+Math.round(pose.progress*100)+"%")+" ／ 次便 "+clock(next.departureMinute)+
  " 発（あと"+Math.ceil(Math.max(0,next.countdownMinutes))+"分）";
 $("harbor-status").textContent=aboard?
  "🚢 客船で航海中。行先："+WHARVES.find(w=>w.id===ferry.boarded.destinationId)?.name+
  "。船内を歩けます。停泊したら下船してください。":
  !inPort?"港町「セレノート」に向かってください":
  ferry.checkedIn?"🎫 改札通過済み。客船の到着を待って乗船してください":
  ferry.ticket?"🎫 乗船券があります。桟橋の改札を通ってください":
  ferry.terminalId?"🧑‍✈️ 乗船窓口で切符を購入してください":"⚓ 桟橋を選び、乗船窓口に入ってください";
 for(const id of ["harbor-approach","harbor-office","harbor-buy","harbor-gate","harbor-wait"])
  $(id).disabled=!inPort||aboard||controller.altitudeM>12;
 $("harbor-buy").disabled||=ferry.terminalId!==terminal;
 $("harbor-gate").disabled||=!ferry.ticket||ferry.terminalId!==terminal;
 $("harbor-wait").disabled||=!ferry.checkedIn;
 $("harbor-board").disabled=!inPort||aboard||!ferry.checkedIn||
  pose.mode!=="stopped"||pose.dockId!==terminal;
 $("harbor-alight").disabled=!aboard||pose.mode!=="stopped"||pose.dockId!==ferry.boarded.destinationId;
 $("harbor-talk").disabled=!aboard;
}
function harborAction(fn){
 const result=fn();log(result?.message||"港で操作できませんでした");
 if(result?.ok){saveFerryJournal();updateHUD();}
 return result;
}
function walkToHarborWharf(id){
 if(activeSettlementId!=="port"||ferry.boarded||railway.boarded||marine.boarded||
  railwaySecurity?.wanted||railwaySecurity?.jailed)
  return {ok:false,message:"港町の地上で、乗り物を降りてから桟橋へ向かってください"};
 const wharf=WHARVES.find(w=>w.id===id);if(!wharf)return {ok:false,message:"桟橋を選択してください"};
 controller.x=wharf.x;controller.z=130;
 const geo=controller.locationAt(controller.x,controller.z);
 controller.lat=geo.lat;controller.lon=geo.lon;controller.travelMode="walk";
 controller.altitudeM=2.5;controller.targetAltitude(2.5);controller.clearMoveTarget();
 squad.repositionAfterLanding();renderer.patchKey=null;
 return {ok:true,message:"⚓ "+wharf.name+"の旅客ターミナル入口に到着しました"};
}
function inputVector(){
 const on=k=>keys.has(k)||touches.has(k);
 const axes=controlMode==="stick"?joystickMovement(stick):{forward:0,strafe:0};
 return {forward:(on("w")||on("arrowup")?1:0)-(on("s")||on("arrowdown")?1:0)+axes.forward,
  strafe:(on("d")?1:0)-(on("a")?1:0)+axes.strafe,
  turn:(on("e")||on("right")?1:0)-(on("q")||on("left")?1:0)};
}
function doFrame(t){
 const dt=lastTime?clamp((t-lastTime)/1000,0,.08):0;lastTime=t;
 if(controller&&renderer){
  const onTrain=Boolean(railway?.boarded),onFerry=Boolean(ferry?.boarded),
   inConcourse=Boolean(railway?.concourse===activeSettlementId&&!railway?.platform&&!onTrain);
  const detained=Boolean(railwaySecurity?.jailed||law?.custody||law?.pendingDeath||law?.gameOver);
  const input=!detained&&$("asset-studio").hidden&&$("book-overlay").hidden&&$("life-overlay").hidden&&$("town-interaction-panel").hidden&&$("railway-panel").hidden&&$("harbor-panel").hidden?inputVector():{forward:0,strafe:0,turn:0};
  const xrAxes=xrUI?.inputVector?.();
  if(xrAxes&&!detained){
   input.forward=clamp(input.forward+xrAxes.forward,-1,1);
   input.strafe=clamp(input.strafe+xrAxes.strafe,-1,1);
   input.turn=clamp(input.turn+xrAxes.turn,-1,1);
  }
  if(onTrain)railway.walk(running?dt:0,input);
  if(onFerry)ferry.walk(running?dt:0,input);
  if(inConcourse)railway.walkConcourse(running?dt:0,input);
  if(townLife.inside)townLife.walk(running?dt:0,input);
  const ship=marine?.boarded;
  const onShip=ship?.kind==="sailing_ship"&&marine.shipboard.shipId===marine.boardedId;
  if(onShip){
   for(const message of marine.shipboard.advance(running?dt:0,
    renderer.cameraController.mode==="free"?{forward:0,strafe:0,turn:0}:input))log(message);
   if(marine.shipboard.player.moving&&life.activity!=="idle"){
    life.activity="idle";life.activityFurnitureId=null;marine.cabinActivity="idle";
   }
  }
  const helming=onShip&&marine.shipboard.canHelm();
  // When walking on deck, input belongs to the pedestrian, not the hull.
  // With an NPC at the wheel, the ship follows its cruise/course instructions.
  const travelInput=onTrain||onFerry||inConcourse?{forward:0,strafe:0,turn:0}:onShip?{
    forward:running&&helming&&ship.cruise&&!ship.anchor?1:helming&&marine.shipboard.helmId==="player"?input.forward:0,
    strafe:0,
    turn:helming&&marine.shipboard.helmId==="player"?input.turn:0
   }:marine?.cabinId?
    {forward:running&&ship?.cruise&&!ship.anchor?1:0,strafe:0,turn:0}:
    running&&ship?.kind==="sailing_ship"&&ship.cruise&&!ship.anchor&&
     ship.sailTrim>0&&Math.abs(input.forward)<.1?{...input,forward:1}:input;
   const previous={x:controller.x,z:controller.z,lat:controller.lat,lon:controller.lon};
  const manualLead=!onTrain&&!onFerry&&!inConcourse&&!townLife.inside&&!marine?.shipboard?.active&&!marine?.cabinId&&(Math.abs(input.forward)+Math.abs(input.strafe)+Math.abs(input.turn)>.1);
   if(manualLead)cancelHarvestOrder("player");
  const priorResources={...actions.resources};
   const hpBefore=new Map(squad.agents.map(a=>[a.id,a.id==="player"?battle.playerHp:a.hp]));
  marine?.update(0,controller,terrain);
  controller.boatSpeed=marine?.sailingSpeed()??4.2;
  controller.mountRiding=Boolean(fauna?.mount)&&controller.travelMode==="walk";controller.walkSpeed=fauna?.speed()??5;
  for(const agent of squad?.agents||[])agent.control.placedWalls=constructions.structures;
  // Crew use the local vessel walk map, never inland auto-harvest while afloat.
  if(!onShip&&!onTrain&&!onFerry&&!inConcourse&&!detained)squad?.advance(running?dt:0,{manualLead});
  if(running){
   for(const a of squad?.agents||[]){
    if(a.id==="player")continue;
    const prior=lastNpcStatus.get(a.id),now=a.status||"";
    if(now!==prior){
     const found=now.match(/(木材|石材)\s*\+(\d+)/);
     if(found)worldUI?.float({kind:"gain",actorId:a.id,
      text:"+"+found[2]+" "+(found[1]==="木材"?"🪵 木材":"🪨 石材")});
     lastNpcStatus.set(a.id,now);
    }
   }
  }
  frontierUI?.updateCamera();
  if(renderer.cameraController.mode==="free"){
   renderer.cameraController.pan(dt,marine?.cabinId||townLife.inside||inConcourse||onFerry?0:input.forward,marine?.cabinId||townLife.inside||inConcourse||onFerry?0:input.strafe);
   controller.update(dt,onShip?{...travelInput,turn:0}:{
    forward:running&&ship?.cruise&&!ship.anchor?1:0,strafe:0,turn:0
   });
  }else controller.update(dt,townLife.inside||onTrain||onFerry||inConcourse?{forward:0,strafe:0,turn:0}:travelInput);
  for(const event of railwaySecurity?.advance(dt,{
   stationId:activeSettlementId,x:controller.x,z:controller.z,
   stamina:squad.frontier.person("player").stamina,
   eligible:controller.altitudeM<=12&&!onTrain&&!onFerry&&!inConcourse&&!detained&&!townLife.inside&&!marine?.cabinId&&
    !marine?.boarded&&controller.travelMode==="walk"
  })||[])handleRailwaySecurityEvent(event);
  renderer.railwaySecurity=railwaySecurity;
  if(running&&law&&!law.custody&&!law.pendingDeath&&!law.gameOver){
    const vitals=squad.frontier.person("player");
    const events=law.advance(dt,{day:planet.timeDays,settlementId:activeSettlementId,
      x:controller.x,z:controller.z,stamina:vitals.stamina,hp:battle.playerHp,
      playerEligible:railwaySecurity?.state==="clear",
      armedWeapons:frontierUI?.armedWeapons("player")||[],
      restrictedZone:Boolean(GUARD_POSTS[activeSettlementId]&&
       Math.hypot(controller.x-GUARD_POSTS[activeSettlementId].x,
                  controller.z-GUARD_POSTS[activeSettlementId].z)<5),
      hostiles:battle.enemies,passable:faunaGroundPassable,
      eligible:controller.altitudeM<=12&&!townLife.inside&&!railway?.boarded&&!ferry?.boarded&&!marine?.boarded});
    for(const event of events){
      if(event.type==="guardAttack"){
       const enemy=battle.enemies.find(e=>e.id===event.targetId&&e.hp>0);
       if(enemy){const hit=battle.damage(enemy,event.damage);
        log(event.message+"：-"+hit.damage+" HP"+(hit.defeated?"（撃破）":""));
        worldUI?.float({kind:"damage",text:"−"+hit.damage,enemyId:enemy.id});}
       continue;
      }
      if(event.message)log(event.message);
      if(event.type==="guardHit"){
        vitals.stamina=Math.max(0,vitals.stamina-event.staminaDamage);
        battle.playerHp=Math.max(0,battle.playerHp-event.hpDamage);
        worldUI?.float({kind:"hurt",text:"−"+event.staminaDamage+" ⚡ / −"+event.hpDamage+" HP",actorId:"player"});
        if(vitals.stamina<=0&&battle.playerHp>0){const arrest=law.detain(activeSettlementId);if(arrest)events.push(arrest);}
      }
      if(event.type==="detained"){
        controller.clearMoveTarget();running=false;simWorld.clock.paused=true;
        lawUI?.closeEncounter();lawUI?.open();
      }
      if(event.speech&&event.speakerId)worldUI?.speak(event.speakerId,event.speech,5.5);
      if(event.type==="challenge"||event.type==="territoryWarning")lawUI?.openEncounter(event);
      if(event.type==="complied")lawUI?.closeEncounter();
      if(["challenge","territoryWarning","complied","detained"].includes(event.type))
       lawUI?.refresh();
    }
    if(events.length)saveLawJournal();
  }
  marine?.update(running?dt:0,controller,terrain);
  if(onShip){
   // Keep the squad's world-space controls co-located with moving ship for RTS,
   // interaction radius and inherited outfit/character identity.
   for(const a of squad.agents.slice(1)){
    const onboard=marine.shipboard.member(a.id);
    if(!onboard)continue;
    const place=shipLocalToWorld(controller.x,controller.z,controller.yaw,onboard.x,onboard.z);
    a.control.x=place.x;a.control.z=place.z;
    const geo=controller.locationAt(place.x,place.z);
    a.control.lat=geo.lat;a.control.lon=geo.lon;
    a.control.yaw=controller.yaw+onboard.yaw;
    a.control.moveTarget=null;a.control.travelMode="boat";
   }
  }
  if(running){
   const fishingEvent=marine?.tickFishing(dt,planet.seed);
   if(fishingEvent)log(fishingEvent.message);
   if(marine?.justCompletedLap){
    log("🌐 惑星一周達成！ 出発地点の海域に戻りました（"+marine.voyage.laps+"周）");
    worldUI?.float({kind:"gain",text:"🌐 世界一周！",actorId:"player",duration:4});
    saveMarineJournal();
   }
   if(marine?.boarded?.kind==="sailing_ship"){
    voyageSaveElapsed+=dt;
    if(voyageSaveElapsed>10){voyageSaveElapsed=0;saveMarineJournal();}
   }
  }
  if(running){
   fauna?.advance(dt,controller,faunaGroundPassable);
   processHarvestOrders();processArrowPickups();
  }
  const transition=access.guard(previous,controller);
   if(transition==="enter")log("🏠 ドアを通って小屋に入りました。");
   if(transition==="exit")log("🌿 ドアから小屋の外に出ました。");
   if(life.guardCamp(controller)==="exit")log("⛺ テントの外に出ました。");
   if(access.pendingDoorId&&!access.inside&&controller.nearGround){
    const b=access.find(access.pendingDoorId);
    if(!b)access.pendingDoorId=null;
    else if(Math.hypot(controller.x-b.x,controller.z-b.z-HUT.halfDepth-.13)<=HUT.reach){
     access.pendingDoorId=null;if(!b.doorOpen)log(access.toggle(b,controller).message);
    }else if(!controller.moveTarget)access.pendingDoorId=null;
   }
   renderer.interiorBuildingId=access.insideId;
   frontierUI?.updateTarget();
   const attackInProgress=actions.active;
   const completed=actions.advance(dt);
   if(running&&attackInProgress?.kind==="bow"&&!attackInProgress.arrowReleased&&
     attackInProgress.time/attackInProgress.duration>=.81){
    attackInProgress.arrowReleased=true;
    launchArrow(squad.get("player"),attackInProgress);
   }
   if(running&&battle){
    battle.advance(dt,controller,attackInProgress,squad,{
      guardTargets:law.guardTargets(activeSettlementId),
      onGuardHit:(id,damage)=>{
       const hit=law.damageGuard(activeSettlementId,id,damage,{source:"enemy"});
       if(hit.ok)saveLawJournal();
       return hit;
      }
     });
    battle.advanceAllies(dt,squad,{launchArrow:(soldier,target)=>{
     if(!frontierUI?.hasTacticalArrow(soldier.id))return false;
     const shot=launchArrow(soldier,{targetId:target.id});
     if(shot)frontierUI.consumeTacticalArrow(soldier.id);
     return Boolean(shot);
    }});
    for(const hit of attackInProgress?.kind==="bow"?[]:battle.resolveAttack(attackInProgress,controller)){
     log("🎯 "+hit.message);
     worldUI?.float({kind:hit.guarded?"guard":"damage",
      text:(hit.guarded?"🛡️ −":"−")+hit.damage+(hit.defeated?" ✦":""),enemyId:hit.id,duration:1.4});
    }
    // Resolve guard damage at the actual impact frame, not every redraw.
    if(attackInProgress&&["sword","axe","spear","greatsword"].includes(attackInProgress.kind)
      &&attackInProgress.time/attackInProgress.duration>=.62&&lastGuardStrike!==attackInProgress){
      lastGuardStrike=attackInProgress;
      const kind=attackInProgress.kind,variant=attackInProgress.variant||"overhead";
      const guards=law.guardTargets(activeSettlementId);
      let targets=[];
      if(kind==="spear"||kind==="greatsword"){
       targets=sweptWeaponContacts(controller,guards,kind,variant==="combo"?"overhead":variant)
         .map(c=>c.target);
      }else{
       const range=kind==="axe"?2.7:2.6,arc=variant==="sweep"?1.65:1.05;
       targets=guards.filter(g=>{
        const dx=g.x-controller.x,dz=g.z-controller.z;
        const bearing=Math.atan2(dx,dz)-controller.yaw;
        return Math.hypot(dx,dz)<range+g.radius&&
         Math.abs(Math.atan2(Math.sin(bearing),Math.cos(bearing)))<arc;
       });
      }
      for(const guard of targets.slice(0,3)){
       const damage=kind==="spear"||kind==="greatsword"?
         contactDamage(kind,variant==="combo"?"overhead":variant):kind==="axe"?22:18;
       const result=law.damageGuard(activeSettlementId,guard.id,damage,
        {attackerX:controller.x,attackerZ:controller.z});
       if(result.ok){log("⚔️ "+result.message);
        worldUI?.float({kind:"damage",text:"−"+damage,enemyId:guard.id});
        saveLawJournal();}
      }
      // The railway officer has a real collider and HP, just like town guards.
      const officer=railwaySecurity?.wanted?railwaySecurity.guard:null;
      if(officer){
       const dx=officer.x-controller.x,dz=officer.z-controller.z;
       const distance=Math.hypot(dx,dz),bearing=Math.atan2(dx,dz)-controller.yaw;
       const style=variant==="combo"?"overhead":variant;
       const weaponHit=["spear","greatsword"].includes(kind)?
        sweptWeaponContacts(controller,[{id:"rail-officer",x:officer.x,z:officer.z,
         radius:.56,hp:officer.hp}],kind,style).length>0:
        distance<(kind==="axe"?3.25:3.15)&&
         Math.abs(Math.atan2(Math.sin(bearing),Math.cos(bearing)))<(style==="sweep"?1.65:1.05);
       if(weaponHit){
        const damage=["spear","greatsword"].includes(kind)?contactDamage(kind,style):kind==="axe"?22:18;
        const hit=damageRailwayGuard(damage,{attackerX:controller.x,attackerZ:controller.z});
        if(hit?.ok)log("⚔️ "+hit.message);
       }
      }
    }
    for(const attack of battle.consumeEnemyHits().slice(0,5)){
     log("🛡️ "+attack.message);
     worldUI?.float({kind:"hurt",text:"−"+attack.damage+" HP",
      ...(attack.guardId?{enemyId:attack.guardId}:{actorId:attack.actorId||"player"}),duration:1.45});
     if(!attack.guardId&&(!attack.actorId||attack.actorId==="player"))renderer.playerHitSeconds=.48;
    }
    for(const event of battle.consumeTacticalEvents().slice(0,6)){
     worldUI?.float({kind:event.kind==="heal"?"heal":"damage",
      text:(event.kind==="heal"?"+":"−")+event.amount,
      actorId:event.actorId,enemyId:event.enemyId,duration:1.1});
    }
    if(renderer.playerHitSeconds>0)renderer.playerHitSeconds=Math.max(0,renderer.playerHitSeconds-dt);
   }
   if(running&&projectiles){
    const events=projectiles.advance(dt,{
     groundHeight:terrainAt,
     trees:renderer.resourceNodes||[],
     buildings:actions.structures,
     enemies:[...battle.enemies,...law.guardTargets(activeSettlementId),
       ...(railwaySecurity?.wanted&&railwaySecurity.guard?[{
        ...railwaySecurity.guard,id:"railway-security:"+activeSettlementId,type:"railsecurity",
        radius:.56,height:2.1}]:[])],
     onEnemyHit:(enemy,damage)=>{
       if(enemy.type==="railsecurity")return damageRailwayGuard(damage);
       if(enemy.type!=="lawguard")return battle.damage(enemy,damage);
       const result=law.damageGuard(activeSettlementId,enemy.id,damage);
       if(result.ok)saveLawJournal();
       return result;
      }
    });
    for(const event of events){
     if(event.hit){
      log("🎯 "+event.hit.message);
      worldUI?.float({kind:event.hit.guarded?"guard":"damage",
       text:"−"+event.hit.damage+(event.hit.defeated?" ✦":""),enemyId:event.hit.id,duration:1.4});
     }else if(event.surface==="target")log("🎯 的に矢が命中しました。タップして回収できます。");
    }
   }
   if(running){
    for(const [kind,label] of Object.entries(resourceNames)){
     const delta=(actions.resources[kind]||0)-(priorResources[kind]||0);
     if(delta>0)worldUI?.float({kind:"gain",text:"+"+delta+" "+label,actorId:"player",duration:1.6});
    }
   }
   for(const hut of actions.structures.filter(h=>h.progress>=1))life.ensureHut(hut);
   life.advance(dt,onTrain?false:onShip?marine.shipboard.player.moving:controller.moving);
   if(running){
    for(const actor of squad.agents){
     const p=squad.frontier.person(actor.id),actualHp=actor.id==="player"?battle.playerHp:actor.hp;
     const damage=Math.max(0,(hpBefore.get(actor.id)??actualHp)-actualHp);
     const outcome=advanceVitals(p,dt,{hp:actualHp,maxHp:actor.id==="player"?100:actor.maxHp,
      moving:Boolean(onShip?(marine.shipboard.member(actor.id)?.moving||false):actor.control.moving),
       working:Boolean(!onShip&&(actor.task||actor.id==="player"&&actions.active)),
      resting:actor.task?.kind==="rest_home",damage,externalStamina:true});
     if(actor.id==="player")battle.playerHp=outcome.hp;
     else actor.hp=outcome.hp;
    }
    if(battle.playerHp<=0&&!law.pendingDeath&&!law.gameOver){
      const heirs=law.die({cause:"戦闘による死亡"});
      running=false;simWorld.clock.paused=true;saveLawJournal();lawUI?.refresh();
      document.getElementById("law-panel").hidden=false;
      log(heirs.length?"🪦 主人公死亡。治安・手配パネルから継承者を選択してください。":"🪦 継承者がいません。ゲームオーバーです。");
    }
    vitalsSaveElapsed+=dt;
    if(vitalsSaveElapsed>=10){vitalsSaveElapsed=0;saveLifeJournal();saveLawJournal();}
   }
   // Lifestyle uses an inverse hunger gauge: 100 means very hungry.
   life.stats.hunger=100-squad.frontier.person("player").hunger;
   life.stats.stamina=squad.frontier.person("player").stamina;
   renderer.sceneLife=life;
  if(completed){
    if(completed==="axe"||completed==="mine"||completed==="saw"){
     if(attackInProgress?.resourceNode){
      const node=harvest.visual(attackInProgress.resourceNode);
      const result=node?(completed==="saw"?harvest.cutLog(node,attackInProgress.cutLengthM||1):harvest.hit(node,completed)):{ok:false,message:"採集済み"};
      if(result.ok)updateHarvestWorld(result,attackInProgress.resourceNode);
      if(!result.ok||result.stage==="collected")cancelHarvestOrder("player");
     }
     else log("採集対象がありません。木や石をタップするか、近づいて道具を使用してください。");
    }else if(completed==="dig"||completed==="fill")doEarthwork(completed,attackInProgress?.earthwork);
    else log(actions.message);
    saveLifeJournal();
   }
  const ferryTimeBefore=planet.timeDays*1440;
  if(running)universe.advance(dt);
  if(onFerry&&running){
   const target=ferry.boarded.destinationId,offset=target==="central"?0:60;
   const nextArrival=offset+120*Math.ceil((ferryTimeBefore+.001-offset)/120);
   if(ferryTimeBefore<nextArrival&&planet.timeDays*1440>=nextArrival){
    planet.timeDays=(nextArrival+.12)/1440;
    running=false;simWorld.clock.paused=true;saveFerryJournal();
    log("⚓ 客船が"+(WHARVES.find(w=>w.id===target)?.name||"目的地")+
     "に入港しました。時間を停止しました。乗船パネルから下船できます。");
   }
  }
  for(const event of railway?.advance(planet.timeDays)||[]){
   if(event.type==="arrival")handleRailwayArrival(event);
  }
  renderer.trainInterior=railway?.boarded?railway.status(planet.timeDays):null;
  renderer.railJourney=railway?.boarded?{
   pose:railwayJourneyPose(terrain,
    settlementLocations||=settlementDestinations(terrain),renderer.trainInterior,planet.timeDays),
   locations:settlementLocations
  }:null;
  try{
   // While the headset owns the WebGL framebuffer, its XR animation callback
   // renders both eyes. The existing RAF still runs simulation and HUD logic.
   const next=xrUI?.active?displayMode:renderer.frame(controller,dt);
   orbitalCitiesUI?.setActive(next==="orbit");
   if(next==="orbit")orbitalCitiesUI?.frame(renderer.orbitCityMarkers(orbitalCitiesUI.destinations));
   updateActorMarker(renderer.actorMarker);
   updateOrbitLandingMarker(renderer.screenLanding);
   updateDescentOverlay(controller.altitudeM);
   updateRtsMarkers(renderer.screenActors);
   worldUI?.frame(running?dt:0);
   $("world-hit-flash").style.opacity=String(Math.min(.85,Math.max(0,(renderer.playerHitSeconds||0)/.48))*.83);
   if(next!==displayMode){
    displayMode=next;
    $("mode").textContent=next==="orbit"?"宇宙・惑星モード":next==="train-interior"?"列車内モード":
     next==="train-exterior"?"列車追従モード":next==="railway-concourse"?"駅構内・切符売場":
      next==="ferry-interior"?"客船・船内モード":next==="railway-jail"?"駅留置所":"地表メッシュモード";
    if(next==="ground")log("地表詳細メッシュへ移行。同じ緯度・経度を使用しています。");
   }
  }catch(e){
   running=false;simWorld.clock.pause();
   $("fatal").hidden=false;$("fatal").textContent="描画エラー: "+e.message;
  }
  frameTime+=dt;frameCount++;
  if(t-lastHud>240){
   updateHUD();
   const fps=frameTime?Math.round(frameCount/frameTime):0;
   renderer.reportFPS(fps,frameTime);
   $("fps").textContent=fps+" fps";
   $("fog-detail").textContent=(renderer.fogMode==="off"?"フォグなし":({auto:"自動",light:"軽量",realistic:"リアル"}[renderer.fogMode]||""))+
     " / "+["高精細","中精細","軽量"][renderer.adaptiveTerrainLOD.level]+
     (renderer.fogMode==="off"?"":" / 視程 約"+Math.round((renderer.lastFog?.endM||0)/100)/10+"km");
   frameTime=0;frameCount=0;lastHud=t;
  }
 }
 requestAnimationFrame(doFrame);
}
function refreshShipCrewChoices(){
 const board=marine?.shipboard;
 if(!board?.active||!squad)return;
 const members=[{id:"player",name:squad.get("player")?.name||"自分"},
  ...board.crew.filter(c=>squad.get(c.id)).map(c=>({id:c.id,name:squad.get(c.id).name}))];
 const key=members.map(c=>c.id+":"+c.name).join("|");
 for(const id of ["marine-helm-member","marine-talk-member"]){
  const field=$(id);
  if(field.dataset.roster!==key){
   const old=field.value;
   field.replaceChildren(...members.filter(c=>id!=="marine-talk-member"||c.id!=="player")
    .map(c=>{const option=document.createElement("option");option.value=c.id;
     option.textContent=(c.id==="player"?"🧍 ":"👥 ")+c.name;return option;}));
   field.dataset.roster=key;
   if([...field.options].some(o=>o.value===old))field.value=old;
   else field.value=id==="marine-helm-member"?board.helmId:members[1]?.id||"";
  }
 }
}
function updateHUD(){
  if(territoryEconomy&&ownerWorld){
   const changed=territoryEconomy.syncOwnerBuildings(ownerWorld);
   const months=territoryEconomy.collectUntil(planet?.timeDays);
   const strategyMonths=factionStrategy?.advanceUntil(planet?.timeDays)||0;
   if(changed||months||strategyMonths){
    saveTerritoryJournal();if(strategyMonths)saveFactionJournal();
    territoryUI?.refresh();factionUI?.refresh();
   }
  }
  lawUI?.refresh();
 const g=terrainSurface(terrain,controller.lat,controller.lon);
 const climate=weather.sample(controller.lat,controller.lon,g.elevationM);
 const isSurface=controller.altitudeM<=12;
  const agent=rtsMode?squad.selectedAgents()?.[0]||squad.get("player"):squad.get("player");
  const person=squad.frontier.person(agent.id);
  const hp=agent.id==="player"?(battle?.playerHp??agent.hp):(agent.hp??100);
  const maxHp=agent.id==="player"?100:(agent.maxHp||100);
  const hpPct=Math.max(0,Math.min(100,Math.round(hp/maxHp*100)));
  const stamina=Math.round(person.stamina||0),mental=Math.round(person.mental??100),hunger=Math.round(person.hunger??78);
  for(const [id,value] of [["avatar-hp",hpPct],["avatar-stamina",stamina],["avatar-mental",mental],["avatar-hunger",hunger]]){
   $(id).value=value;$(id+"-label").textContent=value+"%";
  }
  $("avatar-load").textContent=squad.frontier.loadKg(agent.id).toFixed(1)+"kg";
   $("vitals-potion").textContent="🧪 薬 ×"+(person.healingPotions??2);
  const backpack=Object.entries(person.inventory||{}).filter(([,n])=>n>0)
   .map(([k,n])=>(resourceNames[k]||k)+" ×"+n);
  if(agent.id==="player"&&marine?.ownedGear?.includes("scuba"))
   backpack.push("🤿 アクアラング ×1"+(marine.diveGear==="scuba"?"（装備中）":"（手持ち）"));
  $("avatar-inventory").textContent=backpack.length?backpack.join(" / "):"リュックは空です（共有資材は下の資材欄）";
 $("coords").textContent=controller.lat.toFixed(5)+"°, "+controller.lon.toFixed(5)+"°";
 $("height").textContent=Math.round(controller.altitudeM).toLocaleString("ja-JP")+" m";
 $("ground-height").textContent=Math.round(g.elevationM).toLocaleString("ja-JP")+" m";
 $("biome").textContent=({ocean:"海",river:"川",island:"🏝️ 島",forest:"森林",mountain:"山",
    "mountain-range":"山脈",hills:"丘陵",highland:"高地",plain:"平野",plains:"平野",
    grassland:"草原",valley:"谷",canyon:"渓谷",coast:"海岸",tundra:"ツンドラ"}[g.landform||g.category]||g.landform||g.category);
 $("temp").textContent=climate.temperatureC.toFixed(1)+" °C";
 const sunLevel=planet.illumination(controller.lat,controller.lon);
 $("sunlight").textContent=Math.round(sunLevel*100)+"%";
 $("world").dataset.sky=sunLevel<.08?"night":sunLevel<.35?"dusk":"day";
 $("day").textContent=planet.timeDays.toFixed(2)+" 日";
 $("walked").textContent=controller.totalDistanceM.toFixed(1)+" m";
 $("jump-state").textContent=controller.jumpY>.01?"空中 "+controller.jumpY.toFixed(2)+" m":"接地";
 $("action-state").textContent=access.inside?"🏠 屋内（小屋 #"+access.inside.id+"）":actions.message;
 $("battle-status").textContent="味方 "+(squad?.agents?.filter(a=>a.hp>0).length||0)+"/"+(squad?.agents?.length||0)+"人 / 敵 "+(battle?.count()||0)+"体 / 操作者HP "+(battle?.playerHp??100);
  syncDoorUi();
 $("customization-status").textContent=
   (OUTFITS.find(x=>x.id===appearance.presetId)?.name||appearance.presetId)+"・"+
   (EXPRESSIONS.find(x=>x[0]===renderer.expression.preset)?.[1]||renderer.expression.preset);
 $("materials").textContent="木 "+actions.resources.wood+" / 石 "+actions.resources.stone+
   " / 繊維 "+actions.resources.fiber+" / 粘土 "+actions.resources.clay+" / 金属 "+actions.resources.metal+" / 土 "+(actions.resources.soil||0)+
   " / 🪙古代金貨 "+(actions.resources.ancientCoins||0)+" / 🐉遺物 "+(actions.resources.dragonRelic||0);
  lifeUI?.updateStats();
 $("building-count").textContent=String(actions.structures.filter(b=>b.progress>=1).length);
 if(faunaUI&&!$("fauna-panel").hidden)faunaUI.refresh();
 if(farmUI&&!$("farm-panel").hidden)farmUI.refresh();
 $("control-state").textContent=renderer.cameraController.mode==="free"?"自由カメラ移動":
   controlMode==="stick"?"スティック移動":"ダブルタップ移動"+(controller.moveTarget?"（移動中）":"");
 $("camera-status").textContent=CAMERA_MODES.find(x=>x[0]===renderer.cameraController.mode)?.[1]||"従来";
 $("camera-mode").value=renderer.cameraController.mode;
 $("mode-stick").setAttribute("aria-pressed",String(controlMode==="stick"));
 $("mode-tap").setAttribute("aria-pressed",String(controlMode==="tap"));
 $("viewport-controls").textContent=controlMode==="stick"?"● スティック":"◎ ダブルタップ";
 $("viewport-controls").setAttribute("aria-label","移動方法の切替。現在："+(controlMode==="stick"?"スティック":"タップ"));
 $("stick-area").hidden=rtsMode||controlMode!=="stick"||!isSurface;
 $("action-pad").hidden=rtsMode||!isSurface;
  if(rtsMode||!isSurface)setToolMenu(false);
 $("rts-controls").hidden=!rtsMode||!isSurface;
 groupUI?.refresh();
 const selectedGroups=squad.selectedGroups();
 $("rts-summary").textContent=selectedGroups.length?
  "👥 "+selectedGroups.map(g=>g.name).join("・")+" / "+squad.selected.size+"人":
  "選択: "+squad.selectedAgents().map(a=>a.name).join("・");
 $("viewport-rts").setAttribute("aria-pressed",String(rtsMode));
 frontierUI?.quick();
 $("viewport-rts").textContent=rtsMode?"⚓ RTS終了":"⚓ RTS視点";
 $("rts-multi").setAttribute("aria-pressed",String(rtsMulti));
  $("rts-sync").setAttribute("aria-pressed",String(syncMode));
  $("rts-sync").textContent=syncMode?"🔗 シンクロON":"🔗 シンクロOFF";
 $("rts-rally").setAttribute("aria-pressed",String(rallyPicking));
 $("rts-rally").textContent=rallyPicking?"地面をタップ":"集合地点";
 $("walk-status").textContent=controller.blocked?"通行不可：海岸・急斜面など":isSurface?({
  boat:"🛶 航海中",swim:"🏊 水泳中",dive:"🤿 潜水中"
 }[controller.travelMode]|| (g.elevationM>2800?"高山：徒歩移動不可":"歩行可能")):"降下中／宇宙視点";
 if(marine){
  $("marine-status").textContent=({walk:"🏝️ 陸上",swim:"🏊 水泳",dive:"🤿 潜水 "+marine.depthM.toFixed(1)+"m",
    boat:"🛶 "+(BOATS[marine.boarded?.kind]?.name||"航海中")})[controller.travelMode]||
   "🌊 海洋";
  $("marine-oxygen").max=marine.gear.air;
  $("marine-oxygen").value=marine.oxygen;
  $("marine-oxygen-label").textContent=Math.round(marine.oxygen)+"/"+marine.gear.air;
  if(document.activeElement!==$("marine-swim-style"))$("marine-swim-style").value=marine.swimStyle;
  if(document.activeElement!==$("marine-gear-equip"))$("marine-gear-equip").value=marine.diveGear;
  $("marine-depth-status").textContent="水深 "+marine.depthM.toFixed(1)+"m / 目標 "+
   marine.targetDepthM.toFixed(1)+"m / 海底 "+marine._floorDepth?.toFixed(1)+"m / 装備限界 "+
   marine.gear.maxDepth+"m"+(marine.seabedWalking?" / 海底作業中":"");
  $("marine-gear-inventory").textContent="所有装備："+marine.ownedGear.map(k=>DIVE_GEAR[k].name).join("・");
  $("marine-descend").disabled=!isSurface||!marine.diving;
  $("marine-ascend").disabled=!isSurface||!marine.diving;
  $("marine-scan").disabled=!isSurface||!marine.diving;
  $("marine-salvage").disabled=!isSurface||!marine.diving;
  if(!$("marine-panel").hidden){
   const near=marine.sitesNear(controller,terrain,180)[0];
   $("marine-discovery-status").textContent=near?
    SEA_SITE_TYPES[near.kind].symbol+" "+near.name+" / 距離 "+
    near.distanceM.toFixed(0)+"m / 水深 "+near.depthM.toFixed(0)+"m"+
    (marine.salvagedSites.has(near.id)?"（回収済み）":""):
    "近くの海底遺跡・沈没船を捜索できます";
  }
  const wetHud=isSurface&&["swim","dive"].includes(controller.travelMode);
  $("marine-swim-hud").hidden=!wetHud;
  $("marine-swim-hud-status").textContent=controller.travelMode==="dive"?
   "🤿 "+marine.depthM.toFixed(1)+"m / O₂ "+Math.round(marine.oxygen):
   "🌊 水面 / O₂ "+Math.round(marine.oxygen);
  $("marine-hud-dive").disabled=!wetHud||marine.diving;
  $("marine-hud-down").disabled=!wetHud||!marine.diving;
  $("marine-hud-up").disabled=!wetHud||!marine.diving;
  $("marine-hud-surface").disabled=!wetHud||!marine.diving;
  $("marine-dive").disabled=!isSurface||controller.travelMode==="boat"||controller.travelMode==="walk";
  $("marine-dive").textContent=marine.diving?"↑ 水面へ浮上":"↓ 潜る";
  $("marine-board").disabled=!isSurface||Boolean(marine.boarded);
  $("marine-leave").disabled=!isSurface||!marine.boarded;
  $("marine-craft").disabled=!isSurface;
  const helm=marine.boarded,ship=helm?.kind==="sailing_ship";
  $("marine-sail-controls").hidden=!ship;
  if(ship){
   const degrees=Math.round((((helm.yaw||0)*180/Math.PI)%360+360)%360);
   const sail=Math.round(helm.sailTrim*100);
   const speed=marine.sailingSpeed(helm);
   $("marine-sail-value").textContent=sail+"%";
   if(document.activeElement!==$("marine-sail-trim"))$("marine-sail-trim").value=String(sail);
   $("marine-helm-status").textContent="方位 "+degrees+"° ／ 帆 "+sail+"% ／ "+(controller.moving?speed.toFixed(1):"0.0")+
    " m/s ／ "+(helm.anchor?"投錨中":helm.cruise?"巡航中":"手動操船");
   $("marine-cruise").textContent=helm.cruise?"■ 巡航停止":"▶ 巡航開始";
   $("marine-anchor").textContent=helm.anchor?"⚓ 揚錨する":"⚓ 投錨する";
   $("marine-cruise").setAttribute("aria-pressed",String(helm.cruise));
   $("marine-anchor").setAttribute("aria-pressed",String(helm.anchor));
  }
  const board=marine.shipboard;
  $("marine-crew-controls").hidden=!ship;
  if(ship){
   refreshShipCrewChoices();
   const pilot=squad.get(board.helmId)?.name||"不在";
   const p=board.player,zone=p.zone==="cabin"?"🛏️ 船室":"⛵ 甲板";
   $("marine-shipboard-status").textContent=zone+" ／ 操舵 "+pilot+
    " ／ 仲間 "+board.crew.length+"人 ／ 船内位置 X"+p.x.toFixed(1)+
    " Z"+p.z.toFixed(1)+" ／ "+(p.moving?"歩行中":"停止中");
   $("marine-ship-door").textContent=board.doorOpen?"🚪 扉を閉める":"🚪 扉を開く";
   $("marine-ship-passage").textContent=p.zone==="cabin"?"🚶 甲板へ出る":"🚶 船室へ入る";
   $("marine-helm-assign").disabled=false;
   $("marine-helm-walk").disabled=board.helmId==="player"||p.zone==="cabin";
  }
  const cabin=Boolean(marine.cabinId&&ship);
  $("marine-cabin-controls").hidden=!ship;
  $("marine-cabin-furniture").hidden=!cabin;
  $("marine-cabin-toggle").textContent=cabin?"🚪 船室から甲板へ出る":"🚪 船室に入る";
  $("marine-cabin-status").textContent=cabin?
   "🚢 船室内・"+(marine.cabinActivity==="idle"?"生活設備が使えます":marine.cabinActivity+"を使用"):
   "⛵ 甲板上。航海中にも入室できます";
  $("marine-voyage-controls").hidden=!ship;
  if(ship){
   const p=marine.voyage.progress(terrain.planet.radiusM);
   $("marine-voyage-status").textContent="航行 "+
    (p.distanceM/1000).toFixed(1)+"km ／ 経度方向の進捗 "+p.percent.toFixed(1)+
    "% ／ 一周達成 "+p.laps+"回 ／ "+controller.lat.toFixed(3)+"°, "+controller.lon.toFixed(3)+"°";
   $("marine-voyage-progress").value=p.percent;
  }
  const fishing=marine.fishing;
  $("fishing-reel-hud").hidden=!fishing.casting||!isSurface;
  $("fishing-hud-state").textContent=fishing.hook?"🐟 ヒット！":
   fishing.casting?"🎣 "+Math.round(100*fishing.approach)+"% 接近":"🎣 仕掛け待機";
  $("fishing-hud-line").textContent="糸 "+(fishing.lineOutM||0).toFixed(1)+"m";
  $("fishing-mini-reel").setAttribute("aria-valuenow",String(fishing.casting?Math.round(100*(1-
   fishing.lineOutM/(3+fishing.power*26))):0));
  $("marine-fish-cast").disabled=!isSurface||cabin||fishing.casting||controller.travelMode==="swim"||controller.travelMode==="dive";
  $("marine-fish-reel").disabled=!isSurface||cabin||!fishing.casting;
  $("marine-fish-stop").disabled=!fishing.casting;
  const total=3+(fishing.power||.65)*26;
  const progress=fishing.casting?Math.round(100*(1-(fishing.lineOutM||0)/total)):0;
  $("marine-fish-line-progress").value=Math.max(0,Math.min(100,progress));
  $("marine-reel-dial").setAttribute("aria-valuenow",String(Math.max(0,Math.min(100,progress))));
  $("marine-reel-dial").setAttribute("aria-valuetext",fishing.casting?
    "残り "+fishing.lineOutM.toFixed(1)+"メートル":"仕掛けを投げる前");
  $("marine-fish-phase").textContent=fishing.hook?"🐟 ヒット！":
   fishing.casting?fishing.castMotion<1?"🎣 キャスト中":
    "🐟 魚が近づく "+Math.round(100*fishing.approach)+"%":"投げる準備";
  $("marine-fish-distance").textContent="糸："+(fishing.lineOutM||0).toFixed(1)+"m";
  if(document.activeElement!==$("marine-fish-power"))$("marine-fish-power-label").textContent=
   $("marine-fish-power").value+"%";
  $("marine-fishing-status").textContent=fishing.hook?
   "🐟 ヒット！ダイヤルを時計回りに回して巻き取る（残り"+Math.ceil(fishing.hookLeft)+"秒）":
   fishing.casting?"🎣 魚が近寄る… 約"+Math.ceil(Math.max(0,fishing.nextBite-fishing.elapsed))+"秒":
    "釣果 "+fishing.caught+"匹／魚の所持数 "+(actions.resources.fish||0)+
    "匹。直近の釣果："+(FISH_CATALOG[fishing.lastCatch]?.name||"なし")+". 甲板・浜辺で釣れます";
 }
 $("play").textContent=running?"⏸ 時間を停止":"▶ 時間を再生";
 $("ground-button").disabled=isSurface&&controller.targetAltitudeM<=12;
 $("walk-note").textContent=renderer.cameraController.mode==="free"?
  "自由視点：スティック/WASDでカメラ移動。画面ドラッグで視線を回転。人物の位置は変わりません。":
  !isSurface?(controller.altitudeM>23000?
   "宇宙視点：「🏙️ 都市・村を選ぶ」で街へ降下。何もない場所もタップして自由降下でき、ダブルタップなら直接降下。海・船も選択可。":
   "地表へ降下中です。歩行操作は到着後に有効になります。"):
  rtsMode?"RTS：人物・敵・資源は1回タップ、地面はダブルタップで移動指示。2本指で拡大縮小。":
   controlMode==="tap"?"地面をダブルタップで移動。1本指ドラッグで視点回転、2本指で拡大縮小。":
  "スティック/WASDで移動。地面をダブルタップで目的地設定、2本指ピンチで拡大縮小。";
 railwayUI?.refresh();
 updateHarborUI();
 updateRailwaySecurityHUD();
}
function setAltitude(m){
 if(railway?.boarded||ferry?.boarded){log("🚂🚢 乗り物を降りてから高度を変更してください。");return;}
 if(railwaySecurity?.jailed||railwaySecurity?.wanted){log("🚨 鉄道保安の追跡・勾留中は高度を変更できません。");return;}
 controller.targetAltitude(m);
 log(m<=12?"着陸地点へ降下します。":"高度 "+Math.round(m).toLocaleString("ja-JP")+"m を目標にします。");
}
$("ground-button").addEventListener("click",()=>{
 if(orbitSelection)confirmOrbitLanding();
 else setAltitude(2.5);
});
$("orbit-button").addEventListener("click",()=>{
 clearOrbitSelection();setAltitude(15000000);
});
$("orbit-landing-confirm").addEventListener("click",confirmOrbitLanding);
$("orbit-landing-clear").addEventListener("click",clearOrbitSelection);
$("zoom-in").addEventListener("click",()=>controller.zoom(.35));
$("zoom-out").addEventListener("click",()=>controller.zoom(2.8));
$("days-per-second").addEventListener("change",()=>{
 const scale=normalizeTimeScale($("days-per-second").value);
 $("days-per-second").value=String(scale);
 try{localStorage.setItem(TIME_SCALE_KEY,String(scale));}catch(_){}
 log(scale===1?"⏱️ 実時間：現実1秒＝ゲーム1秒":
  scale<1?"⏱️ スロー再生 ×"+scale:"⏩ 早回し ×"+scale);
 updateHUD();
});
$("next-day").addEventListener("click",()=>{
 if(railway?.boarded){log("🚂 乗車中は次駅への到着を待ってください。");return;}
 planet.advance(1);log("惑星時間を1日進めました。");updateHUD();
});
$("next-season").addEventListener("click",()=>{
 if(railway?.boarded){log("🚂 乗車中は次駅への到着を待ってください。");return;}
 planet.advance(90);log("惑星時間を90日進めました。");updateHUD();
});
$("play").addEventListener("click",()=>{
 if(law?.custody||law?.pendingDeath||law?.gameOver){log("勾留中・継承待ち・ゲームオーバー中は再生できません");return;}
 running=!running;simWorld.clock.paused=!running;updateHUD();
});
function damageRailwayGuard(damage,options={}){
 const result=railwaySecurity?.damageGuard(damage,options);
 if(!result?.ok)return result||{ok:false,message:"保安員はいません"};
 law.reportCrime(activeSettlementId,"attackGuard",{reporter:"railway-guard"});
 if(result.defeated)law.reportCrime(activeSettlementId,"killGuard",{reporter:"railway-guard"});
 saveLawJournal();saveRailwaySecurityJournal();
 return result;
}
function handleGuardWarningCompliance(id,kind){
 const checked=law.respondWarning(id,"comply");
 if(!checked.ok)return checked;
 if(kind==="weapon"){
  const outcome=frontierUI?.stowWeapons("player")||{ok:false,message:"装備画面がまだ利用できません"};
  if(outcome.ok)saveLifeJournal();
  return outcome;
 }
 if(kind==="restricted"){
  const post=GUARD_POSTS[id];
  if(!post)return {ok:false,message:"警備区画が見つかりません"};
  const dx=controller.x-post.x,dz=controller.z-post.z,dist=Math.hypot(dx,dz)||1;
  const target={x:post.x+dx/dist*11,z:post.z+dz/dist*11};
  if(!controller.setMoveTarget(target.x,target.z))
   return {ok:false,message:"退出先へ歩けません。手動で警備区画から出てください"};
  return {ok:true,message:"🚶 警備区画の外へ向かいます"};
 }
 return {ok:false,message:"指示に対応できません"};
}
function startGuardCombat(){
 if(law?.custody||law?.pendingDeath||law?.gameOver)return {ok:false,message:"現在は戦闘できません"};
 const district=law.district(activeSettlementId);
 const guard=district?.deployed.find(g=>Math.hypot(g.x-controller.x,g.z-controller.z)<3.6);
 if(!guard)return {ok:false,message:"武器で攻撃するには衛兵に接近してください"};
 controller.yaw=Math.atan2(guard.x-controller.x,guard.z-controller.z);
 const wanted=law.level(activeSettlementId);
 if(wanted>0){const result=law.respond(activeSettlementId,"refuse");if(result?.ok)saveLawJournal();}
 const started=actions.start("sword",controller,(lat,lon)=>terrainSurface(terrain,lat,lon),
   frontierUI?.attackVariantFor("player","sword")||"overhead");
 if(started){
  const p=squad.frontier.person("player");p.stamina=clamp(p.stamina-3,0,100);
  return {ok:true,message:"⚔️ 剣で戦闘開始。攻撃の命中時に衛兵のHPが減少します"};
 }
 return {ok:false,message:actions.message};
}
function completeSuccession(id){
 const candidate=squad?.get(id);
 if(!candidate||candidate.hp<=0)return {ok:false,message:"その人物は生存していません"};
 const result=law.succeed(id);
 if(!result.ok)return result;
 const player=squad.get("player"),vitals=squad.frontier.person("player"),heirVitals=squad.frontier.person(id);
 Object.assign(vitals,normalizeVitals(heirVitals));
 battle.playerHp=Math.max(1,Math.min(100,candidate.hp));player.name=result.person.name;
 controller.x=candidate.control.x;controller.z=candidate.control.z;
 const loc=controller.locationAt(controller.x,controller.z);controller.lat=loc.lat;controller.lon=loc.lon;
 candidate.hp=0;
 squad.repositionAfterLanding();running=true;simWorld.clock.paused=false;
 saveLawJournal();saveLifeJournal();updateHUD();return result;
}
function captureGame(){
  return {format:"ue/explorer-demo",version:1,
   planet:planet.snapshot(),explorer:controller.snapshot(),universe:universe.snapshot(),actions:actions.snapshot(),avatarStyle,
   v0_7b:{schemaVersion:1,appearance:{...appearance},expression:renderer.expression.snapshot()},
   v0_7c:{schemaVersion:1,camera:renderer.cameraController.snapshot()},
   v0_7d:{schemaVersion:1,squad:squad.snapshot()},v0_7e:access.snapshot(),
    v0_7f:books.snapshot(),v0_7g:life.snapshot(),v0_7i:frontierUI?.snapshot(),
    v0_7t:{schemaVersion:1,syncMode,projectiles:projectiles.snapshot()},
     v0_8a:{schemaVersion:1,resources:harvest.snapshot(),earthworks:earthworks.snapshot()},
      v0_8e:{schemaVersion:1,construction:constructions.snapshot()},
       v0_8f:{schemaVersion:1,fauna:fauna.snapshot()},
       v0_8g:{schemaVersion:1,farm:farm.snapshot(),marine:marine.snapshot()},
        v0_8h:{schemaVersion:1,playerHp:battle.playerHp},
         v0_8r:{schemaVersion:1,destinationId:activeSettlementId},v0_8s:townLife.snapshot(),v0_8t:railway.snapshot(),
         v0_8x:{schemaVersion:1,timeScale:normalizeTimeScale($("days-per-second").value),security:railwaySecurity.snapshot()},
         v0_8w:{schemaVersion:1,owner:ownerWorld.snapshot()},
          v0_9f:{schemaVersion:1,territory:territoryEconomy.snapshot()},
           v0_9g:{schemaVersion:1,factions:factionStrategy.snapshot()},
   v0_8y:{schemaVersion:1,ferry:ferry.snapshot()},v0_9d:law.snapshot()};
}
$("save").addEventListener("click",()=>{
 try{
  const data=captureGame();
  localStorage.setItem(SAVE_KEY,JSON.stringify(data));saveTownJournal();saveRailwayJournal();saveRailwaySecurityJournal();saveOwnerJournal();saveTerritoryJournal();saveFactionJournal();
   saveFaunaJournal();saveFarmJournal();saveMarineJournal();saveFerryJournal();saveLawJournal();
  log("v0.8x：切符・鉄道保安・時間倍率を含めて保存しました。旧保存キーは保持しています。");
 }catch(e){log("保存に失敗: "+e.message);}
});
/** Save slots are independent from the historical quick save. */
function renderSaveSlots(){
 const host=$("save-slot-list");if(!host)return;
 host.replaceChildren();
 for(const {id,slot,error} of slotIndex(localStorage)){
  const row=document.createElement("div");row.className="save-slot-row";
  const input=document.createElement("input");input.type="text";input.maxLength=40;
  input.setAttribute("aria-label","スロット"+id+"の名前");input.value=slot?.name||"冒険 "+id;
  const description=document.createElement("small");
  description.textContent=error?"⚠️ "+error:slot?
   new Date(slot.updatedAt).toLocaleString("ja-JP")+" ／ "+slot.settlementId:"空きスロット";
  const save=document.createElement("button");save.type="button";save.textContent="💾 保存";
  save.addEventListener("click",()=>{
   if(slot&&!window.confirm("スロット"+id+"を上書きしますか？"))return;
   try{writeSlot(localStorage,id,captureGame(),input.value);log("💾 スロット"+id+"に保存しました");renderSaveSlots();}
   catch(e){log("スロット保存失敗: "+e.message);}
  });
  const load=document.createElement("button");load.type="button";load.textContent="📂 読込";load.disabled=!slot;
  load.addEventListener("click",()=>{
   if(!window.confirm("スロット"+id+"を読み込むと、現在の未保存の進行状況は失われます。続けますか？"))return;
   try{const selected=readSlot(localStorage,id);
    if(!selected)throw Error("スロットが空です");
    running=false;init(selected.game);updateHUD();log("📂 スロット"+id+"を読み込みました");
   }catch(e){log("スロット読込失敗: "+e.message);}
  });
  const remove=document.createElement("button");remove.type="button";remove.textContent="削除";remove.disabled=!slot;
  remove.addEventListener("click",()=>{
   if(!window.confirm("スロット"+id+"を削除しますか？"))return;
   try{eraseSlot(localStorage,id);renderSaveSlots();log("スロット"+id+"を削除しました");}
   catch(e){log("削除失敗: "+e.message);}
  });
  row.append(document.createTextNode("No."+id+" "),input,description,save,load,remove);
  host.append(row);
 }
}
$("save-slots-refresh").addEventListener("click",renderSaveSlots);
renderSaveSlots();

$("restore").addEventListener("click",()=>{
 try{
  const data=JSON.parse(localStorage.getItem(SAVE_KEY)||localStorage.getItem(PRE_FRONTIER_SAVE_KEY)||"null");
  if(data?.format!=="ue/explorer-demo"||data.version!==1)throw Error("対応する保存データがありません。");
  running=false;init(data);updateHUD();
 }catch(e){log("復元失敗: "+e.message);}
});
$("import-v07d-save").addEventListener("click",()=>{
  try{
   const data=JSON.parse(localStorage.getItem(V07D_SAVE_KEY)||"null");
   if(data?.format!=="ue/explorer-demo"||data.version!==1)throw Error("旧v0.7dセーブがありません。");
   running=false;init(data);updateHUD();
   log("v0.7dセーブを取り込みました。元の保存データは変更していません。");
  }catch(e){log("v0.7d読込失敗: "+e.message);}
 });
 $("import-v07c-save").addEventListener("click",()=>{
 try{
  const data=JSON.parse(localStorage.getItem(V07C_SAVE_KEY)||"null");
  if(data?.format!=="ue/explorer-demo"||data.version!==1)throw Error("旧v0.7cデータがありません。");
  running=false;init(data);updateHUD();
  log("v0.7c保存を読み込みました（旧保存は書き換えません）。");
 }catch(e){log("v0.7c読込失敗: "+e.message);}
});
$("import-v06-save").addEventListener("click",()=>{
 try{
  const old=localStorage.getItem(LEGACY_SAVE_KEY);
  if(!old)throw Error("v0.6の保存データが見つかりません。");
  const data=JSON.parse(old);
  if(data?.format!=="ue/explorer-demo"||data.version!==1)throw Error("非対応のv0.6セーブです。");
  running=false;init(data);updateHUD();
  log("v0.6のセーブを読み込みました（読み取りのみ）。v0.7c保存で新版に記録できます。");
 }catch(e){log("旧セーブの読み込み失敗: "+e.message)}
});
$("import-v07b-save").addEventListener("click",()=>{
 try{
  const old=localStorage.getItem(V07B_SAVE_KEY);
  if(!old)throw Error("v0.7bの保存データがありません。");
  const data=JSON.parse(old);
  if(data?.format!=="ue/explorer-demo"||data.version!==1)throw Error("非対応のセーブデータです。");
  running=false;init(data);updateHUD();
  log("v0.7bの衣装・表情・進行状況を読み込みました。旧セーブは変更していません。");
 }catch(e){log("v0.7b読込失敗: "+e.message)}
});
$("import-v07a-save").addEventListener("click",()=>{
 try{
  const old=localStorage.getItem(PREVIOUS_SAVE_KEY);
  if(!old)throw Error("v0.7aの保存データが見つかりません。");
  const data=JSON.parse(old);
  if(data?.format!=="ue/explorer-demo"||data.version!==1)throw Error("非対応のv0.7aセーブです。");
  running=false;init(data);updateHUD();
  log("v0.7aの進行データを読み取り専用で取り込みました。旧版セーブは変更していません。");
 }catch(e){log("v0.7aの読み込み失敗: "+e.message)}
});
$("reset").addEventListener("click",()=>{
  try{localStorage.removeItem(LIFE_JOURNAL_KEY);localStorage.removeItem(WORLD_JOURNAL_KEY);localStorage.removeItem(STRUCTURES_JOURNAL_KEY);localStorage.removeItem(FAUNA_JOURNAL_KEY);localStorage.removeItem(TOWN_JOURNAL_KEY);localStorage.removeItem(RAILWAY_JOURNAL_KEY);localStorage.removeItem(LAW_JOURNAL_KEY);localStorage.removeItem(TERRITORY_JOURNAL_KEY);localStorage.removeItem(FACTION_JOURNAL_KEY);}catch(_){}
  running=true;init();updateHUD();
 });
window.addEventListener("keydown",e=>{
 if(e.target?.closest?.("input,select,textarea,[contenteditable=true]"))return;
 const k=e.key.toLowerCase();
 if(["w","a","s","d","q","e","arrowup","arrowdown","arrowleft","arrowright","+","-"].includes(k)){
  if(e.target===document.body)e.preventDefault();
  if(k==="arrowleft")keys.add("q");
  else if(k==="arrowright")keys.add("e");
  else keys.add(k);
 }
 if(k==="f"){e.preventDefault();interactDoor();return;}
  if(k==="+"||k==="=")zoomScene(.65);
 if(k==="-")zoomScene(1.55);
});
window.addEventListener("keyup",e=>{
 const k=e.key.toLowerCase();keys.delete(k);
 if(k==="arrowleft")keys.delete("q");
 if(k==="arrowright")keys.delete("e");
});
document.addEventListener("visibilitychange",()=>{if(document.hidden){keys.clear();touches.clear();lastTime=0;}});
for(const button of document.querySelectorAll("[data-move]")){
 const key=button.dataset.move;
 const down=e=>{e.preventDefault();button.setPointerCapture?.(e.pointerId);touches.add(key);};
 const up=e=>{e.preventDefault();touches.delete(key);};
 button.addEventListener("pointerdown",down);
 for(const action of ["pointerup","pointercancel","lostpointercapture"])button.addEventListener(action,up);
}
/* Shared canvas gestures for TPV and RTS. */
function terrainAt(x,z){
 const place=controller.locationAt(x,z);
 return Math.max(0,terrainSurface(terrain,place.lat,place.lon).elevationM);
}
function launchArrow(agent,plan={}){
 if(!agent||!projectiles)return null;
 const enemy=battle?.enemies.find(e=>e.id===plan.targetId&&e.hp>0);
 const point=plan.targetPoint|| (enemy?{x:enemy.x,y:terrainAt(enemy.x,enemy.z)+(enemy.height||1.8)*.65,z:enemy.z}:null);
 const shot=projectiles.launch({shooterId:agent.id,actor:agent.control,
  groundY:terrainAt(agent.control.x,agent.control.z)+(agent.id==="player"&&fauna?.mount?1.15:0),target:point,mode:plan.trajectory||"auto",
  arrowType:plan.arrowType||"wood"});
 if(!shot)log("矢を発射できませんでした（画面内の矢が多すぎます）。");
 return shot;
}
function orderArrowPickup(arrow){
 const who=rtsMode?squad.selectedAgents()[0]:squad.get("player");
 if(!who)return;
 const distance=Math.hypot(who.control.x-arrow.x,who.control.z-arrow.z);
 if(distance>3.0){
  if(!squad.orderMove([who.id],arrow.x,arrow.z)){log("矢の位置まで移動できません。");return;}
  pendingArrowPickup.set(who.id,arrow.id);
  log("➶ "+who.name+"が矢の回収地点に向かいます（残り約"+Math.ceil(arrow.recoverLeft??ARROW_RECOVERY_SECONDS)+"秒）。");
 }else collectArrow(who,arrow.id);
}
function collectArrow(who,id){
 if(!projectiles.embedded.some(a=>a.id===id))return;
 const embedded=projectiles.embedded.find(a=>a.id===id);
 const result=frontierUI?.addRecoveredArrow(who.id,embedded?.arrowType||"wood");
 if(!result?.ok){log("矢筒が満杯で回収できません。");return;}
 projectiles.recover(id);pendingArrowPickup.delete(who.id);
 log("➶ "+who.name+"が"+({wood:"木の矢",iron:"鉄の矢",fire:"火矢"}[embedded?.arrowType]||"矢")+"を1本回収しました。");
}
function processArrowPickups(){
 for(const [id,arrowId] of [...pendingArrowPickup]){
  const who=squad?.get(id),arrow=projectiles?.embedded.find(a=>a.id===arrowId);
  if(!who||!arrow){pendingArrowPickup.delete(id);if(who)log("➶ 回収予定の矢は回収済み、または期限切れで消えました。");continue;}
  if(Math.hypot(who.control.x-arrow.x,who.control.z-arrow.z)<=3){
   who.control.clearMoveTarget();collectArrow(who,arrowId);
  }else if(!who.control.moveTarget)pendingArrowPickup.delete(id);
 }
}
function cancelHarvestOrder(id){
 const a=squad?.get(id);
 if(a)a.manualHarvest=false;
 manualHarvest.delete(id);
}
function commandResourceTap(resource){
 if(!controller.nearGround||!resource)return false;
 const selected=rtsMode?squad.selectedAgents():[squad.get("player")];let count=0;
 for(const agent of selected){
  if(!agent)continue;
  const control=agent.control;
  const canStand=(x,z)=>{const p=control.locationAt(x,z),g=terrainSurface(terrain,p.lat,p.lon);
   return !g.water&&!g.river&&g.elevationM<2800;};
  const work=chooseWorkPoint(control,resource,canStand,{reach:2.6});
  if(!work){log(agent.name+"：斜面が急で資源へ接近できません");continue;}
  const range=Math.hypot(control.x-resource.x,control.z-resource.z);
  if(range>2.6&&!control.setMoveTarget(work.x,work.z)){log("資源まで移動できません");continue;}
  squad.frontier?.cancel(agent);
  if(range<=2.6)control.clearMoveTarget();
  manualHarvest.set(agent.id,{id:resource.id,kind:resource.kind,x:resource.x,z:resource.z,work});
  agent.manualHarvest=true;agent.cooldown=0;count++;
 }
 if(count){renderer.selectedResource=resource;
  log("🧺 "+resource.name+"へ移動し、"+(resource.kind==="stone"?"つるはしで採掘":"斧で伐採")+"："+count+"人");}
 return count>0;
}
function processHarvestOrders(){
 for(const [id,order] of [...manualHarvest]){
  const agent=squad?.get(id);if(!agent||!agent.control.nearGround){cancelHarvestOrder(id);continue;}
  const node=renderer.resourceNodes.find(n=>n.id===order.id);
  const current=node?harvest.visual(node):null;
  if(!current){cancelHarvestOrder(id);continue;}
  const ctl=agent.control,dist=Math.hypot(ctl.x-node.x,ctl.z-node.z);
  if(dist>2.6){
   if(ctl.blocked){cancelHarvestOrder(id);log(agent.name+"：急斜面・地形障害のため採集地点へ進めません");continue;}
   if(!ctl.moveTarget){
    const destination=order.work;
    if(!destination||!ctl.setMoveTarget(destination.x,destination.z)){
     cancelHarvestOrder(id);log(agent.name+"：斜面のため到達できません");continue;
    }
   }
   continue;
  }
  ctl.clearMoveTarget();
  const kind=node.kind==="stone"?"mine":"axe";
  if(id==="player"){
   if(actions.active)continue;
   if(!actions.start(kind,controller,(lat,lon)=>terrainSurface(terrain,lat,lon)))continue;
   actions.active.resourceNode=node;
  }else{
   if(agent.task||agent.cooldown>0)continue;
   if(!squad.performEquippedAction(id,kind))continue;
   agent.task.resourceNode=node; // hit only when axe/pick motion reaches impact
  }
  log(agent.name+"："+(kind==="mine"?"⛏️ 採掘":"🪓 伐採")+"を実行");
 }
}
function screenActorAt(x,y){
 const r=$("world").getBoundingClientRect();
 if(!r.width||!r.height)return false;
 const u=(x-r.left)/r.width,v=(y-r.top)/r.height;
 return (renderer.screenActors||[]).some(p=>p.onScreen&&
  Math.hypot((p.u-u)*r.width,(p.v-v)*r.height)<42);
}
/** A pending selection is a UI preview, not an actor teleport or saved state. */
function clearOrbitSelection(){
 orbitSelection=null;
 if(renderer)renderer.selectedLanding=null;
 orbitalCitiesUI?.clearChoice();
 $("orbit-landing-preview").hidden=true;
 $("orbit-pick-marker").hidden=true;
 $("landing-water-mode").closest("label").hidden=false;
 $("orbit-landing-confirm").textContent="↓ この地点へ降下";
}
function updateDescentOverlay(altitudeM){
 const state=descentVisuals(altitudeM);
 const layer=$("descent-atmosphere");
 layer.style.setProperty("--descent-fog",state.fog.toFixed(3));
 layer.style.setProperty("--descent-clouds",state.clouds.toFixed(3));
 layer.style.setProperty("--descent-air",state.atmosphere.toFixed(3));
 layer.style.setProperty("--descent-glow",state.glow.toFixed(3));
 const stage=$("descent-phase");
 if(stage.textContent!==state.stage)stage.textContent=state.stage;
}
function updateOrbitLandingMarker(info){
 const marker=$("orbit-pick-marker");
 if(!orbitSelection||!info?.onScreen||controller?.altitudeM<=ORBIT_GROUND_CUTOFF_M){
  marker.hidden=true;return;
 }
 marker.hidden=false;
 marker.style.left=(info.u*100).toFixed(3)+"%";
 marker.style.top=(info.v*100).toFixed(3)+"%";
}
function updateOrbitSelection(){
 if(!orbitSelection)return;
 if(orbitSelection.cityId){
  const chosen=destinationById(orbitSelection.cityId),site=orbitSelection.site;
  renderer.selectedLanding={lat:site.lat,lon:site.lon};
  $("orbit-landing-coords").textContent=chosen.icon+" "+chosen.name;
  $("orbit-landing-terrain").textContent="🏘️ "+chosen.region+"へ降下 / 座標 "+
   site.lat.toFixed(3)+"°, "+site.lon.toFixed(3)+"°";
  $("landing-water-mode").closest("label").hidden=true;
  $("orbit-landing-confirm").disabled=false;
  $("orbit-landing-confirm").textContent="↓ この都市へ降下";
  $("orbit-landing-preview").hidden=false;
  return;
 }
 $("landing-water-mode").closest("label").hidden=false;
 $("orbit-landing-confirm").textContent="↓ この地点へ降下";
 const mode=$("landing-water-mode").value;
 const site=resolveLanding(terrain,orbitSelection.pickedLat,orbitSelection.pickedLon,mode);
 orbitSelection.site=site.ok?site:null;
 renderer.selectedLanding=site.ok?{lat:site.lat,lon:site.lon}:
  {lat:orbitSelection.pickedLat,lon:orbitSelection.pickedLon};
 const coords=(v,pos,neg)=>Math.abs(v).toFixed(3)+"°"+(v>=0?pos:neg);
 const lat=site.ok?site.lat:orbitSelection.pickedLat,lon=site.ok?site.lon:orbitSelection.pickedLon;
 $("orbit-landing-coords").textContent="📍 "+coords(lat,"N","S")+" / "+coords(lon,"E","W");
 const sample=site.ok?terrainSurface(terrain,lat,lon):null;
 $("orbit-landing-terrain").textContent=!site.ok?site.message:
  (site.mode==="sea-ship"?"⛵ 中型帆船の甲板から開始":
  site.mode==="sea"?"🌊 海上・泳いで開始":"🏝️ 陸上・標高"+Math.round(sample.elevationM)+"m")+
  (site.movedM?" ／ 安全な陸地へ"+Math.round(site.movedM/1000)+"km補正":"");
 $("orbit-landing-confirm").disabled=!site.ok;
 $("orbit-landing-preview").hidden=false;
}
function selectOrbitLanding(x,y){
 const geo=renderer?.pickOrbit(x,y);
 if(!geo)return false;
 // Ordinary land/sea/ship descent stays unchanged even after a city preview.
 orbitalCitiesUI?.clearChoice();
 orbitSelection={pickedLat:geo.lat,pickedLon:geo.lon,site:null};
 updateOrbitSelection();updateHUD();return true;
}
function selectOrbitCity(place){
 if(!controller||controller.altitudeM<=ORBIT_GROUND_CUTOFF_M)
  return {ok:false,message:"宇宙から惑星を表示して都市を選んでください"};
 const selected=(settlementLocations||=settlementDestinations(terrain)).find(d=>d.id===place?.id);
 if(!selected)return {ok:false,message:"都市の座標がありません"};
 const sample=terrainSurface(terrain,selected.lat,selected.lon);
 if(sample.water||sample.river||sample.elevationM>=2800)
  return {ok:false,message:"都市の安全な着陸地が見つかりません"};
 orbitSelection={cityId:selected.id,pickedLat:selected.lat,pickedLon:selected.lon,
  site:{ok:true,lat:selected.lat,lon:selected.lon,mode:"land"}};
 renderer.setOrbitLandingFocus(selected.lat,selected.lon);
 updateOrbitSelection();updateHUD();
 return {ok:true};
}
$("landing-water-mode").addEventListener("change",updateOrbitSelection);
function confirmOrbitLanding(){
 if(!orbitSelection?.site)return;
 if(railway?.boarded){log("🚂 列車を降りてから別の地点へ降下してください。");return;}
 if(railwaySecurity?.wanted||railwaySecurity?.jailed){log("🚨 鉄道保安の追跡・勾留中は別地点へ移動できません。");return;}
 if(orbitSelection.cityId){
  const result=visitSettlement(destinationById(orbitSelection.cityId),{fromOrbit:true});
  if(result.ok)clearOrbitSelection();
  log(result.message);
  return;
 }
 try{
  const site=orbitSelection.site;
  // Validate capacity before changing the player's current landing location.
  if(site.mode==="sea-ship"&&marine.boats.length>=64&&
   !marine.nearby({origin:{lat:site.lat,lon:site.lon},x:0,z:0,terrain},14)
     .some(b=>b.kind==="sailing_ship"))
   throw Error("船の上限64隻です。別の船を利用してください");
  marine.boardedId=null;marine.cabinId=null;marine.cabinActivity="idle";marine.diving=false;marine.depthM=0;marine.oxygen=100;
  controller.setLanding(site.lat,site.lon,{allowWater:site.mode==="sea"||site.mode==="sea-ship"});
   activeSettlementId="wilderness";renderer.settlementId=activeSettlementId;
  if(site.mode==="sea-ship"){
   const started=marine.spawnLandingShip(controller,terrain);
   if(!started.ok)throw Error(started.message);
  }
  marine.update(0,controller,terrain);
  access.insideId=null;access.pendingDoorId=null;
  townLife.leave();renderer.townInterior=null;townUI?.close(true);$("town-interior-exit").hidden=true;
  squad?.repositionAfterLanding();
  if(marine.boarded?.kind==="sailing_ship")marine.shipboard.init(marine.boardedId,squad.agents.slice(1).map(a=>a.id));
  controller.targetAltitude(2.5);
  renderer.patchKey=null;renderer.setOrbitLandingFocus(site.lat,site.lon);renderer.interiorBuildingId=null;
  renderer.cameraController.resetFreeAnchor(controller,
   terrainSurface(terrain,site.lat,site.lon).elevationM);
  $("landing").textContent=controller.lat.toFixed(3)+"°, "+controller.lon.toFixed(3)+"°";
  clearOrbitSelection();updateHUD();saveMarineJournal();
  log(site.mode==="sea-ship"?"⛵ 中型帆船の甲板に到着しました。操船パネルで舵・帆・巡航・投錨を操作できます。":
   site.mode==="sea"?"🌊 海上降下：水面に出ました。泳ぐ・潜る・船で航海できます。":
    "🏝️ 陸上への降下を開始します"+(site.movedM?"（海を避け、近隣の陸地へ移動）":""));
 }catch(e){log("地点降下エラー: "+e.message);}
}
/** Planetary travel to named settlements. The local waypoint map is unaffected. */
function visitSettlement(place,{byRail=false,fromOrbit=false}={}){
 if(!place||!destinationById(place.id))return {ok:false,message:"未登録の行き先です"};
 if(railway?.boarded&&!byRail)return {ok:false,message:"列車を降りてから別の街へ移動してください"};
 if((railwaySecurity?.wanted||railwaySecurity?.jailed)&&!byRail)
  return {ok:false,message:"鉄道保安の追跡・勾留中は別の街へ移動できません"};
 try{
  const actual=(settlementLocations||=settlementDestinations(terrain)).find(d=>d.id===place.id);
  if(!actual)return {ok:false,message:"行き先が見つかりません"};
  const ground=terrainSurface(terrain,actual.lat,actual.lon);
  if(ground.water||ground.river||ground.elevationM>=2800)
   return {ok:false,message:"安全な着陸地がありません"};
  marine.boardedId=null;marine.cabinId=null;marine.cabinActivity="idle";
  marine.diving=false;marine.depthM=0;marine.targetDepthM=4;marine.oxygen=100;
  marine.fishing?.stop();
  const orbitalDescent=Boolean(fromOrbit&&controller.altitudeM>ORBIT_GROUND_CUTOFF_M);
  controller.setLanding(actual.lat,actual.lon);
  const spawn=chooseSettlementSpawn(terrain,controller.origin,actual.id);
  if(spawn){controller.x=spawn.x;controller.z=spawn.z;controller.lat=spawn.lat;controller.lon=spawn.lon;controller.yaw=spawn.yaw;}
  if(!orbitalDescent)controller.altitudeM=2.5;
  controller.targetAltitude(2.5);
  access.insideId=null;access.pendingDoorId=null;
  townLife.leave();renderer.townInterior=null;townUI?.close(true);$("town-interior-exit").hidden=true;
  squad?.repositionAfterLanding();
  marine.update(0,controller,terrain);
  activeSettlementId=actual.id;renderer.settlementId=actual.id;
  renderer.patchKey=null;renderer.interiorBuildingId=null;renderer.mapFocus=null;
  if(orbitalDescent)renderer.setOrbitLandingFocus(actual.lat,actual.lon);
  renderer.cameraController.resetFreeAnchor(controller,spawn?.elevationM??ground.elevationM);
  $("landing").textContent=controller.lat.toFixed(3)+"°, "+controller.lon.toFixed(3)+"°";
  routeMapUI?.close();mapDirectoryUI?.close();farmUI?.close();faunaUI?.close();
  $("marine-panel").hidden=true;
  saveMarineJournal();updateHUD();
  return {ok:true,message:orbitalDescent?"🌌 宇宙から"+actual.name+"への連続降下を開始しました。地表までズームします。":
   "🏘️ "+actual.name+"に到着。住居や市場を探索できます。"};
 }catch(error){return {ok:false,message:"来訪できませんでした: "+error.message};}
}
function placeAtRailwayPlatform(stationId){
 const station=stationById(stationId);if(!station)return false;
 controller.x=station.site.x+5.8;controller.z=station.site.z;controller.yaw=-Math.PI*.5;
 const geo=controller.locationAt(controller.x,controller.z);
 controller.lat=geo.lat;controller.lon=geo.lon;controller.travelMode="walk";
 controller.altitudeM=2.5;controller.targetAltitude(2.5);controller.clearMoveTarget();
 squad?.repositionAfterLanding();renderer.patchKey=null;renderer.mapFocus=null;
 renderer.cameraController.resetFreeAnchor(controller,
  terrainSurface(terrain,controller.lat,controller.lon).elevationM);
 return true;
}
function enterRailwayStation(){
 const station=stationById(activeSettlementId);
 if(!station)return {ok:false,message:"現在の街に駅がありません"};
 if(railway?.boarded||marine?.boarded||railwaySecurity?.wanted||railwaySecurity?.jailed)
  return {ok:false,message:"乗り物に乗っている時や保安員の追跡中は入場できません"};
 if(controller.altitudeM>12)return {ok:false,message:"地表に降下してください"};
 if(Math.hypot(controller.x-station.site.x,controller.z-station.site.z)>40)
  return {ok:false,message:"駅舎の入口（40m以内）まで歩いてください"};
 const result=railway.enterConcourse(station.id);
 if(result.ok){controller.clearMoveTarget();controller.x=station.site.x+9;controller.z=station.site.z-7;
  const geo=controller.locationAt(controller.x,controller.z);controller.lat=geo.lat;controller.lon=geo.lon;
  renderer.patchKey=null;saveRailwayJournal();updateHUD();}
 return result;
}
function exitRailwayStation(){
 const result=railway.leaveConcourse();if(result.ok){saveRailwayJournal();updateHUD();}
 return result;
}
function skipRailwayArrival(departure){
 const station=stationById(activeSettlementId),now=absoluteMinutes(planet.timeDays);
 if(!station||!railway.platform||railway.platform.stationId!==station.id||
  railway.platform.serviceId!==departure?.serviceId)
  return {ok:false,message:"改札を通った後、ホームで駅員に話してください"};
 if(railway?.boarded)return {ok:false,message:"すでに列車に乗っています"};
 const next=nextDepartures(station.id,planet.timeDays,12).find(item=>item.serviceId===departure.serviceId);
 if(!next)return {ok:false,message:"選んだ列車の時刻を確認できません"};
 const target=Math.max(now,next.arrivalMinute+.2);
 if(target>now){planet.timeDays=target/1440;running=false;simWorld.clock.paused=true;}
 updateHUD();saveRailwayJournal();
 return {ok:true,message:"🧑‍✈️ 駅員「"+next.serviceName+"は"+formatClock(next.arrivalMinute)+"到着です。時間を進めました。」"};
}
function waitForRailwayDeparture(departure){
 const station=stationById(activeSettlementId),now=absoluteMinutes(planet.timeDays);
 if(!station||departure?.stationId!==station.id)return {ok:false,message:"この街には選択した列車の駅がありません"};
 if(railway?.boarded)return {ok:false,message:"すでに列車内です"};
 if(railwaySecurity?.wanted||railwaySecurity?.jailed)return {ok:false,message:"鉄道保安の追跡・勾留中は改札を通れません"};
 if(controller.altitudeM>12)return {ok:false,message:"地表へ降下してから駅へ向かってください"};
 if(marine?.boarded)return {ok:false,message:"船を降りてから駅へ向かってください"};
 if(fauna?.mount)return {ok:false,message:"馬から降りてから駅へ向かってください"};
 if(access.insideId||townLife.inside||marine?.cabinId)return {ok:false,message:"建物・船室の外へ出てから駅へ向かってください"};
 const gate=railway.enterPlatform(station.id,departure.serviceId,departure.departureMinute);
 if(!gate.ok)return gate;
 placeAtRailwayPlatform(station.id);
 renderer.trainInterior=null;updateHUD();
 saveRailwayJournal();
 return {ok:true,message:gate.message+" ホームで列車を待てます。駅員に話すと到着まで時間を進めることもできます。"};
}
function buyRailwayTicket(departure,destinationId){
 const station=stationById(activeSettlementId);
 if(!station||departure?.stationId!==station.id)return {ok:false,message:"この駅では購入できない切符です"};
 if(railwaySecurity?.jailed)return {ok:false,message:"勾留中は切符を購入できません"};
 const result=railway.buyTicket(station.id,destinationId,departure.serviceId,planet.timeDays);
 if(result.ok)saveRailwayJournal();
 return result;
}
function boardRailwayTrain(serviceId,carriage){
 const station=stationById(activeSettlementId);
 if(!station)return {ok:false,message:"この街には環状線の駅がありません"};
 if(railwaySecurity?.wanted||railwaySecurity?.jailed)return {ok:false,message:"鉄道保安の追跡・勾留中は乗車できません"};
 if(Math.hypot(controller.x-station.site.x,controller.z-station.site.z)>24)
  return {ok:false,message:"先に時刻表の「駅で待つ」でホームへ向かってください"};
 const result=railway.board(station.id,planet.timeDays,carriage,serviceId);
 if(!result.ok)return result;
 controller.clearMoveTarget();townUI?.close(true);settlementTravelUI?.close();
 renderer.townInterior=null;renderer.trainInterior=railway.status(planet.timeDays);
 $("town-interior-exit").hidden=true;
 running=true;simWorld.clock.paused=false;saveRailwayJournal();updateHUD();
 return {...result,message:"🚂 "+result.message+"。発車後、次駅到着時に自動停止します。"};
}
function alightRailwayTrain(){
 const result=railway.alight(planet.timeDays);if(!result.ok)return result;
 activeSettlementId=result.stationId;renderer.settlementId=result.stationId;
 renderer.trainInterior=null;placeAtRailwayPlatform(result.stationId);
 saveRailwayJournal();updateHUD();
 return {...result,message:"🚉 "+result.message+"。ホームに降りました。"};
}
function changeRailwayCarriage(carriage){
 const result=railway.changeCarriage(carriage,planet.timeDays);
 if(result.ok){renderer.trainInterior=railway.status(planet.timeDays);saveRailwayJournal();updateHUD();}
 return result;
}
function handleRailwayArrival(event){
 if(!railway?.boarded)return;
 // Snap to the first crossed arrival and pause, even at ultra-fast planet time.
 planet.timeDays=(event.minute+.25)/1440;running=false;simWorld.clock.paused=true;
 const result=visitSettlement(destinationById(event.stationId),{byRail:true});
 if(!result.ok){log("🚂 到着処理エラー: "+result.message);return;}
 placeAtRailwayPlatform(event.stationId);
 renderer.trainInterior=railway.status(planet.timeDays);saveRailwayJournal();
 log("🚉 "+event.station.name+"に到着。時間を停止しました。降車するか、再生して次駅へ進めます。");
 updateHUD();
}
function handleRailwaySecurityEvent(event){
 if(event.type==="pursuit"){
  const crime=law.reportCrime(event.stationId,"trespass",{witnessed:true,reporter:"railway-security"});
  if(crime.ok)saveLawJournal();
 }
 if(event.type==="securityHit"){
  const vitals=squad.frontier.person("player");
  vitals.stamina=Math.max(0,vitals.stamina-(event.staminaDamage||0));
  battle.playerHp=Math.max(0,battle.playerHp-(event.hpDamage||0));
  renderer.playerHitSeconds=.48;
  worldUI?.float({kind:"hurt",text:"−"+event.staminaDamage+" ⚡ / −"+event.hpDamage+" HP",
   actorId:"player",duration:1.2});
 }
 if(event.message)log(event.message);
 if(event.speech&&event.speakerId)worldUI?.speak(event.speakerId,event.speech,5.5);
 if(event.type==="jailed"){
  controller.clearMoveTarget();actions.cancel?.();townLife.leave();renderer.townInterior=null;
  townUI?.close(true);railwayUI?.close();mapDirectoryUI?.close();routeMapUI?.close();
  $("town-interior-exit").hidden=true;
  running=false;simWorld.clock.paused=true;
 }
 saveRailwaySecurityJournal();updateRailwaySecurityHUD();
}
function updateRailwaySecurityHUD(){
 const hud=$("railway-security-hud");if(!hud||!railwaySecurity)return;
 const state=railwaySecurity.state,jailed=state==="jailed",chased=state==="wanted"||state==="challenged";
 if(state==="clear"){hud.hidden=true;return;}
 hud.hidden=false;
 for(const [id,show] of [
  ["railway-bail",jailed],["railway-serve",jailed],
  ["railway-comply",state==="warned"],
  ["railway-surrender",chased],["railway-flee",chased&&!railwaySecurity.fleeing],
  ["railway-resist",chased&&!railwaySecurity.resisting]
 ])$(id).hidden=!show;
 const title=$("railway-security-title"),detail=$("railway-security-detail");
 if(jailed){
  const fine=railwaySecurity.jailed?.fine??RAIL_BAIL_FINE;
  title.textContent="🔒 駅留置所";
  detail.textContent="線路侵入の勾留。罰金または服役による釈放が可能です。所持金："+railway.fundsLabel;
  $("railway-bail").textContent="罰金 "+fine+"G を支払う";
 }else if(state==="challenged"){
  title.textContent="🛡️ 保安員からの投降要求";
  detail.textContent="あなたには逮捕状がでている。武器をしまい投降しなさい。選択するまで自動拘束されません。";
 }else if(chased){
  title.textContent="🚨 鉄道保安が追跡中";
  detail.textContent=railwaySecurity.resisting?
   "保安員が制圧を試みています。スタミナとHPが減ります。剣などで反撃も可能です。":
   railwaySecurity.fleeing?
   "逃走中です。距離を取れば追跡は中断します。":
   "警告を無視したため追跡中。接近されると投降要求が始まります。";
 }else{
  title.textContent="⚠️ 鉄道保安の警告 "+railwaySecurity.warningCount+"/3";
  detail.textContent="柵内は危険です。警告に従って線路の外へ戻れます。踏切の横断は合法です。";
 }
}
function releaseRailwayCustody(result){
 if(!result.ok){log("釈放できませんでした: "+result.message);return;}
 if(result.settleReport){law.settleRailTrespass(result.stationId);saveLawJournal();}
 if(result.days)planet.advance(result.days);
 const station=stationById(result.stationId);
 if(station){
  activeSettlementId=station.id;renderer.settlementId=station.id;
  controller.x=station.site.x+14;controller.z=station.site.z-7;controller.yaw=-Math.PI*.5;
  const geo=controller.locationAt(controller.x,controller.z);
  controller.lat=geo.lat;controller.lon=geo.lon;
  controller.clearMoveTarget();renderer.patchKey=null;renderer.mapFocus=null;
  squad?.repositionAfterLanding();
 }
 saveRailwayJournal();saveRailwaySecurityJournal();log("🔓 "+result.message);updateHUD();
}
function payRailwayBail(){
 const result=railwaySecurity.payFine(amount=>railway.charge(amount));
 releaseRailwayCustody(result);
}
function serveRailwaySentence(){
 releaseRailwayCustody(railwaySecurity.serveSentence());
}
function respondRailwaySecurity(choice){
 const result=railwaySecurity.respond(choice);
 if(!result.ok){log(result.message);return;}
 if(result.action==="exit"){
  const position=railwaySafeExit(activeSettlementId,controller.x,controller.z);
  if(!position||!controller.setMoveTarget(position.x,position.z))
   log("柵外への移動ができません。操作して線路から離れてください。");
  else log("🚶 柵の外へ移動します。");
 }else if(result.type==="jailed")handleRailwaySecurityEvent(result);
 else{
  if(result.action==="flee"||result.action==="resist"){
   law.reportCrime(activeSettlementId,"escape",{reporter:"railway-security"});saveLawJournal();
  }
  log(result.message);
 }
 saveRailwaySecurityJournal();updateRailwaySecurityHUD();
}
$("railway-bail").addEventListener("click",payRailwayBail);
$("railway-serve").addEventListener("click",serveRailwaySentence);
for(const [button,choice] of [
 ["railway-comply","comply"],["railway-surrender","surrender"],
 ["railway-flee","flee"],["railway-resist","resist"]
 ])$(button).addEventListener("click",()=>respondRailwaySecurity(choice));
/** Read-only directory browsing until the player explicitly selects an action. */
function openMapEntry(entry){
 if(entry.source==="animal"){
  const animal=fauna?.get(entry.id);
  if(!animal)return {ok:false,message:"動物が移動したか見つかりません。リストを更新してください"};
  mapDirectoryUI?.close();farmUI?.close();faunaUI?.open(animal.id);
  renderer.mapFocus={x:animal.x,z:animal.z};
  return {ok:true};
 }
 if(entry.source==="resident"){
  renderer.mapFocus={x:entry.x,z:entry.z};
  mapDirectoryUI?.close();townUI?.open(entry);
  return {ok:true,message:"🧑 街の住民に話しかける準備ができました"};
 }
 if(entry.source==="person"){
  const agent=squad?.get(entry.id);
  if(!agent)return {ok:false,message:"人物が見つかりません。リストを更新してください"};
  squad.choose(agent.id,{add:false});
  autoActorId=agent.id;renderAutoEditor();updateHUD();
  renderer.mapFocus={x:agent.control.x,z:agent.control.z};
  mapDirectoryUI?.close();
  return {ok:true,message:"🧍 "+agent.name+"を選択しました"};
 }
 if(entry.source==="resource"){
  const resource=(renderer?.resourceNodes||[]).find(node=>node.id===entry.id);
  if(!resource)return {ok:false,message:"資源が回収済み、または描画範囲外です。リストを更新してください"};
  if(!controller?.nearGround)return {ok:false,message:"地表へ降りてから資源を選択してください"};
  const ordered=commandResourceTap(resource);
  if(ordered){renderer.mapFocus={x:resource.x,z:resource.z};mapDirectoryUI?.close();}
  return {ok:ordered,message:ordered?"":"この資源には近づけません"};
 }
 if(entry.category==="buildings"){
  renderer.mapFocus={x:entry.x,z:entry.z};
  if(entry.source==="village"&&activeSettlementId!=="pioneer"&&activeSettlementId!=="wilderness"){
   mapDirectoryUI?.close();townUI?.open(entry);
   return {ok:true,message:"🏠 "+entry.title+"：近くで入室・買い物できます"};
  }
  if(entry.source==="hut"&&Math.hypot(entry.x-controller.x,entry.z-controller.z)<7){
   mapDirectoryUI?.close();tapDoor(entry.entityId);return {ok:true};
  }
  return {ok:true,message:entry.icon+" "+entry.title+"をマップ上で強調しました。"+
    " 「向かう」から近くへ移動できます（約"+Math.round(entry.distanceM)+"m）"};
 }
 return {ok:false,message:"この対象には操作がありません"};
}
function moveToMapEntry(entry){
 if(townLife.inside)return {ok:false,message:"建物の中です。まず外へ出てください"};
 if(!controller?.nearGround)return {ok:false,message:"地表へ降りてから移動を指示してください"};
 const canStand=(x,z)=>{const geo=controller.locationAt(x,z),g=terrainSurface(terrain,geo.lat,geo.lon);
  return !g.water&&!g.river&&g.elevationM<2800;};
 const reach=entry.category==="buildings"?5:entry.category==="resources"?2.6:0;
 const destination=reach?chooseWorkPoint(controller,entry,canStand,{reach}):{x:entry.x,z:entry.z};
 if(!destination)return {ok:false,message:"目標付近に立てる安全な場所がありません"};
 renderer.mapFocus={x:entry.x,z:entry.z};
 if(rtsMode){
  for(const id of squad.selected)cancelHarvestOrder(id);
  const groups=squad.selectedGroups();
  const n=groups.length>1?squad.orderGroups(groups.map(g=>g.id),"move",destination):
   groups.length===1?squad.orderGroupMove(groups[0].id,destination.x,destination.z):
   squad.orderMove([...squad.selected],destination.x,destination.z);
  updateHUD();
  return {ok:Boolean(n),message:n?"📍 "+entry.title+"へ"+n+"人を移動させます":
   "移動できません（水域・急斜面・距離などを確認してください）"};
 }
 cancelHarvestOrder("player");
 const ok=controller.setMoveTarget(destination.x,destination.z);
 updateHUD();
 return {ok,message:ok?"📍 "+entry.title+"の近くへ移動します":
  "移動できません（水域・急斜面・距離などを確認してください）"};
}
/** Ship cabin commands work while under sail and use existing vitals/items. */
function useShipFurniture(kind){
 if(!marine?.cabinId){log("船室に入ってから家具を使ってください");return;}
 const p=squad.frontier.person("player"),meal=life.inventory.meal||0;
 if(kind==="table"&&!meal){log("🍽️ 料理がありません。まず船室の調理台で魚料理を作ってください");return;}
 if(kind==="kitchen"&&((actions.resources.fish||0)<1||(actions.resources.wood||0)<1)){
  log("🍳 魚を調理するには釣った魚×1と薪（木材）×1が必要です");return;
 }
 const result=marine.cabinUse(kind);
 if(!result.ok){log(result.message);return;}
 let effect=result;
 if(kind==="bed"){
  effect=restVitals(p,{sleep:true});
  if(effect.ok){life.activity="sleep";life.activityFurnitureId=null;}
 }else if(kind==="chair"){
  effect=restVitals(p);
  if(effect.ok){life.activity="sit";life.activityFurnitureId=null;}
 }else if(kind==="table"){
  effect=eatVitals(p,{quality:"meal"});
  if(effect.ok){
   life.inventory.meal--;
   life.inventory.dirtyPlate=(life.inventory.dirtyPlate||0)+1;
   life.activity="eat";life.activityFurnitureId=null;
  }
 }else if(kind==="kitchen"){
  actions.resources.fish--;actions.resources.wood--;life.inventory.meal++;
  life.activity="cook";life.activityFurnitureId=null;
  effect={ok:true,message:"🍳 魚×1と薪×1で魚料理を作りました。食卓で食べられます"};
 }else if(kind==="bookshelf"){
  const progress=marine.voyage.progress(terrain.planet.radiusM),page=Math.floor(progress.distanceM/5000);
  const newPage=life.readPage("航海日誌",page);
  if(newPage)p.mental=clamp((p.mental||0)+1.5,0,100);
  life.activity="read";life.activityFurnitureId=null;
  effect={ok:true,message:"📚 航海日誌：出航後 "+
   (progress.distanceM/1000).toFixed(1)+"kmを航行。現在 "+
   controller.lat.toFixed(3)+"°, "+controller.lon.toFixed(3)+"°。"+
   (newPage?" 新しい航路を記録しました。":" この海域の記録を読み返しました。")};
  if(books.carried?.length>0)openBookLibrary();
 }
 if(!effect.ok)marine.cabinActivity="idle";
 else{
  if(kind==="bed")life.stats.stamina=p.stamina;
  if(kind==="bed"||kind==="chair")life.stats.hunger=100-p.hunger;
  saveLifeJournal();saveMarineJournal();
 }
 log(effect.message);updateHUD();
}
/** Ship actions are resolved in vessel coordinates, independent of global terrain. */
function interactOnShip(hit){
 const board=marine?.shipboard;
 if(!board?.active||!marine.boarded)return false;
 let result=null;
 if(hit.type==="crew"){
  const name=squad.get(hit.id)?.name||hit.name||"仲間";
  result=board.talk(hit.id,name);
  if(!result.ok){
   const crew=board.member(hit.id);
   if(crew?.zone===board.player.zone){
    const distance=Math.hypot(crew.x-board.player.x,crew.z-board.player.z);
    if(distance>3.5){
     const target={x:crew.x+Math.sin(crew.yaw||0)*1.8,z:crew.z+Math.cos(crew.yaw||0)*1.8};
     result=board.setDestination(target.x,target.z);
     if(result.ok)result.message="🚶 "+name+"に近づきます。近くで再びタップすると会話できます";
    }
   }
  }
  if(result?.ok&&result.speech)worldUI?.speak(hit.id,result.speech);
 }else if(hit.type==="door"){
  // First tap opens the visible door; next tap walks through the opening.
  if(!board.doorOpen)result=board.toggleDoor();
  else{
   result=board.player.zone==="cabin"?marine.exitCabin():marine.enterCabin();
   if(result.ok){
    life.activity="idle";life.activityFurnitureId=null;
    renderer.cameraController.smoothEye=null;renderer.cameraController.smoothTarget=null;
   }
  }
 }else if(hit.type==="helm"){
  result=board.assignHelm("player");
 }else return false;
 log(result.message);
 if(result.ok)saveMarineJournal();
 updateHUD();return true;
}
function handleSceneTap({x,y,shiftKey=false}){
 if(!renderer)return;
 if(townLife.inside){townUI?.open();return;}
 if(controller?.altitudeM>ORBIT_GROUND_CUTOFF_M){
  selectOrbitLanding(x,y);return;
 }
 if(!controller?.nearGround)return;
 if(marine?.boarded?.kind==="sailing_ship"&&marine.shipboard.shipId===marine.boardedId){
  const target=renderer.pickShipboard(x,y);
  if(target&&interactOnShip(target))return;
  if(marine.shipboard.player.zone==="cabin"){
   const furniture=renderer.pickMarineFurniture(x,y);
   if(furniture)useShipFurniture(furniture.kind);
  }
  return; // Ocean terrain under the hull is not a harvest/movement target.
 }
 if(marine?.cabinId){
  const furniture=renderer.pickMarineFurniture(x,y);
  if(furniture)useShipFurniture(furniture.kind);
  return;
 }
 if(ownerUI?.tap(x,y))return;
 if(constructionUI?.tap(x,y))return;
 const arrow=renderer.pickArrow(x,y);
 if(arrow){orderArrowPickup(arrow);return;}
 const tappedGuard=renderer.pickGuard(x,y);
 if(tappedGuard){
  const current=law.level(activeSettlementId);
  log(current?"🛡️ "+tappedGuard.name+"があなたを警戒しています。":"🛡️ "+tappedGuard.name+"「街の安全を守っています」");
  lawUI?.open();return;
 }
 if(frontierUI?.selectTargetAt(x,y)){renderer.selectedResource=null;return;}
 if(rtsMode&&screenActorAt(x,y)){commandRtsTap(x,y,shiftKey);return;}
 const animal=renderer.pickAnimal(x,y);
 if(animal){mapDirectoryUI?.close();farmUI?.close();faunaUI?.open(animal.id);return;}
 const pickedFarm=renderer.pickFarm(x,y);
 if(pickedFarm){mapDirectoryUI?.close();faunaUI?.close();farmUI?.open(pickedFarm.id);return;}
 if(!rtsMode){
  const townHit=renderer.pickTownTarget(x,y);
  if(townHit){mapDirectoryUI?.close();townUI?.open(townHit);return;}
 }
 if(!rtsMode){
  const hit=renderer.pickLife(x,y);
  if(hit){
   if(hit.type==="furniture"&&hit.kind==="bookshelf")openBookLibrary();
   else lifeUI.open(hit.type==="camp"?"camp":"home",hit.id);
   return;
  }
  if(access.inside&&renderer.pickBookshelf(x,y)){openBookLibrary();return;}
  const door=renderer.pickDoor(x,y);
  if(door){tapDoor(door.id);return;}
 }
 const resource=renderer.pickResource(x,y);
 if(resource){commandResourceTap(resource);return;}
 if(rtsMode&&rallyPicking)commandRtsTap(x,y,shiftKey);
}
function offerSeaEntry(hit){
 if(!hit)return false;
 const at=controller.locationAt(hit.x,hit.z);
 const water=terrainSurface(terrain,at.lat,at.lon);
 if(!water.water&&!water.river)return false;
 const max=marine.boarded?32:14;
 const distance=Math.hypot(hit.x-controller.x,hit.z-controller.z);
 if(distance>max){log("🌊 水面へ飛び込むには"+max+"m以内の水面を指定してください");return true;}
 if(controller.travelMode==="dive"){log("🤿 潜水中です。浮上ボタンで水面へ戻れます");return true;}
 const alreadySwimming=controller.travelMode==="swim";
 pendingWaterEntry=alreadySwimming?{kind:"dive"}:{kind:"jump",x:hit.x,z:hit.z};
 $("water-entry-title").textContent=alreadySwimming?"🤿 潜水しますか？":"🌊 飛び込みますか？";
 $("water-entry-description").textContent=alreadySwimming?
  "酸素を確認して水中へ潜ります。":"飛び込むと、跳躍モーションの後に水面で泳ぎ始めます。";
 $("water-entry-accept").textContent=alreadySwimming?"🤿 潜水する":"🏊 飛び込む";
 $("water-entry-confirm").hidden=false;
 return true;
}
function dismissSeaEntry(){pendingWaterEntry=null;$("water-entry-confirm").hidden=true;}
$("water-entry-cancel").addEventListener("click",dismissSeaEntry);
$("water-entry-accept").addEventListener("click",()=>{
 const request=pendingWaterEntry;dismissSeaEntry();
 if(!request)return;
 const result=request.kind==="dive"?marine.dive(controller,terrain):
  marine.jumpIntoWater(controller,terrain,request);
 log(result.message);
 if(result.ok){renderer.patchKey=null;saveMarineJournal();updateHUD();}
});
function handleSceneDoubleTap({x,y,shiftKey=false}){
 if(!renderer)return;
 if(townLife.inside){townUI?.open();return;}
 if(marine?.boarded?.kind==="sailing_ship"&&marine.shipboard.shipId===marine.boardedId){
  const floor=renderer.pickShipboardFloor(x,y);
  if(floor){
   const result=marine.shipboard.setDestination(floor.x,floor.z);
   log(result.message);if(result.ok)saveMarineJournal();updateHUD();return;
  }
  if(marine.cabinId)return;
  if(offerSeaEntry(renderer.pickGround(x,y)))return;
  log("甲板・船室の歩ける床、または海面をダブルタップしてください");return;
 }
 if(marine?.cabinId)return;
 if(controller?.altitudeM>ORBIT_GROUND_CUTOFF_M){
  if(selectOrbitLanding(x,y))confirmOrbitLanding();
  return;
 }
 if(!controller?.nearGround)return;
 if(ownerUI?.active){ownerUI.tap(x,y);return;}
 if(constructionUI?.kind)return;
 // A double tap orders ground movement even when an animal or building overlaps.
 const ground=renderer.pickGround(x,y);
 if(!ground){log("地面を指定できません。");return;}
 if(offerSeaEntry(ground))return;
 renderer.selectedResource=null;
 faunaUI?.close();farmUI?.close();mapDirectoryUI?.close();
 if(rtsMode){
  for(const id of squad.selected)cancelHarvestOrder(id);
  commandRtsTap(x,y,shiftKey,true);
 }else{
  cancelHarvestOrder("player");
  if(controller.setMoveTarget(ground.x,ground.z))log("📍 目的地を設定しました。移動を開始します。");
  else log("移動できない地点です（水域・急斜面・距離を確認してください）。");
 }
}
constructionUI=new ConstructionPlacement({
 canvas:$("world"),system:constructions,kindSelect:$("construction-kind"),
 toggle:$("construction-mode"),cancel:$("construction-cancel"),status:$("construction-status"),
 rts:()=>rtsMode,pick:(x,y)=>renderer.pickGround(x,y),
 surface:(x,z)=>{const p=controller.locationAt(x,z);return {...terrainSurface(terrain,p.lat,p.lon),lat:p.lat,lon:p.lon};},
 resources:()=>actions.resources,existing:()=>actions.structures.filter(a=>a.progress>=1),
 commit:()=>{
  try{localStorage.setItem(STRUCTURES_JOURNAL_KEY,JSON.stringify(constructions.snapshot()));}
  catch(_){log("建築物の自動保存に失敗しました");}
  updateHUD();saveLifeJournal();
 },log
});
ownerUI=installOwnerEditor({
 getWorld:()=>ownerWorld,getTerrain:()=>terrain,getController:()=>controller,getRenderer:()=>renderer,
 onEnter:()=>constructionUI?.setKind(null),
 onCommit:()=>{if(renderer)renderer.patchKey=null;saveOwnerJournal();},log
});
assetStudio=installAssetStudio({getWorld:()=>ownerWorld,
 onCommit:()=>{ownerUI?.reset();if(renderer)renderer.patchKey=null;saveOwnerJournal();},log});
function vitalsActor(){
 return rtsMode?(squad.selectedAgents()?.[0]||squad.get("player")):squad.get("player");
}
function applyVitalsHeal(kind){
 const actor=vitalsActor(),p=squad.frontier.person(actor.id);
 const current=actor.id==="player"?battle.playerHp:actor.hp;
 const atChurch=constructions.structures.some(site=>site.kind==="church"&&
  Math.hypot(site.x-actor.control.x,site.z-actor.control.z)<=8);
 const effect=healVitals(p,current,actor.id==="player"?100:actor.maxHp,kind,{atChurch});
 if(effect.ok){
  if(actor.id==="player")battle.playerHp=effect.hp;else actor.hp=effect.hp;
  worldUI?.float({kind:"heal",text:"+"+Math.round(effect.healed)+" HP",actorId:actor.id,duration:1.4});
  saveLifeJournal();
 }
 $("vitals-action-status").textContent=effect.message;log(actor.name+"："+effect.message);updateHUD();
}
function applyVitalsMeal(){
 const actor=vitalsActor(),p=squad.frontier.person(actor.id);
 const old=p.hunger;
 if(old>=99.99){log("満腹です");return;}
 let food=null,location=null;
 if((p.inventory.food||0)>0){food="food";location=p.inventory;}
 else if((life.inventory.meal||0)>0){food="meal";location=life.inventory;}
 else for(const kind of ["apple","carrot"]){
  if((actions.resources[kind]||0)>0){food=kind;location=actions.resources;break;}
 }
 if(!food&&(life.inventory.rawFood||0)>0){food="rawFood";location=life.inventory;}
 if(!food){log("食料がありません。料理、リンゴ、ニンジン、採集食材を用意してください");return;}
 const result=eatVitals(p,{quality:food});
 if(result.ok){location[food]--;life.stats.hunger=100-p.hunger;saveLifeJournal();}
 $("vitals-action-status").textContent=result.message;log(result.message);updateHUD();
}
$("vitals-brew").addEventListener("click",()=>{
 const actor=vitalsActor(),p=squad.frontier.person(actor.id);
 const nearby=constructions.structures.some(site=>site.kind==="apothecary"&&
  Math.hypot(site.x-actor.control.x,site.z-actor.control.z)<=8);
 if(!nearby){log("回復薬の調合には薬屋の8m以内へ移動してください");return;}
 if((life.inventory.water||0)<1||(actions.resources.fiber||0)<3){
  log("回復薬の調合には水1・繊維3が必要です");return;
 }
 if(p.healingPotions>=999){log("回復薬をこれ以上持てません");return;}
 life.inventory.water--;actions.resources.fiber-=3;p.healingPotions++;
 log("🌿 薬屋で回復薬を1個調合しました");saveLifeJournal();updateHUD();
});
$("vitals-eat").addEventListener("click",applyVitalsMeal);
for(const type of ["potion","magic","church"])
 $("vitals-"+type).addEventListener("click",()=>applyVitalsHeal(type));
$("vitals-rest").addEventListener("click",()=>{
 const p=squad.frontier.person(vitalsActor().id),effect=restVitals(p);
 $("vitals-action-status").textContent=effect.message;log(effect.message);saveLifeJournal();updateHUD();
});
$("vitals-sleep").addEventListener("click",()=>{
 const actor=vitalsActor(),control=actor.control;
 const inHut=actions.structures.some(h=>h.kind==="hut"&&h.progress>=1&&Math.hypot(h.x-control.x,h.z-control.z)<=7);
 const camp=life.deployments.some(c=>["bedroll","tent"].includes(c.kind)&&
  Math.hypot(c.x-control.x,c.z-control.z)<=5);
 if(!inHut&&!camp){log("睡眠には小屋・テント・ベッドロールの近くへ移動してください");return;}
 const p=squad.frontier.person(actor.id),effect=restVitals(p,{sleep:true});
 $("vitals-action-status").textContent=effect.message;log(effect.message);saveLifeJournal();updateHUD();
});
$("warehouse-deposit").addEventListener("click",()=>{
 if(!controller?.nearGround){log("倉庫に近づいてから収納してください");return;}
 const site=constructions.nearestWarehouse(controller.x,controller.z,8);
 if(!site){$("warehouse-status").textContent="8m以内に共同倉庫がありません";return;}
 const person=squad.frontier.person("player"),kg=squad.frontier.loadKg("player");
 const result=constructions.depositWarehouse(site.id,person.inventory,kg);
 if(result.ok){
  person.massAdjustmentKg=0;
  try{localStorage.setItem(STRUCTURES_JOURNAL_KEY,JSON.stringify(constructions.snapshot()));}catch(_){}
  updateHUD();
 }
 $("warehouse-status").textContent=result.message;log(result.message);
});
viewportGestures=bindViewportGestures($("world"),{
 deferTap:true,onTap:handleSceneTap,onDoubleTap:handleSceneDoubleTap,
 onDrag:(dx,dy)=>{
  if(!renderer||!controller)return;
  if(constructionUI?.dragging())return;
  if(controller.altitudeM>ORBIT_GROUND_CUTOFF_M)renderer.panOrbit(dx,dy);
  else if(renderer.cameraController.mode==="legacy")controller.turn(dx*.006);
  else renderer.cameraController.rotate(dx,dy);
 },
 onPinch:factor=>{if(renderer&&controller){zoomScene(factor);syncCameraControls();}}
});
$("world").addEventListener("wheel",e=>{
 e.preventDefault();zoomScene(e.deltaY>0?1.3:.77);syncCameraControls();
},{passive:false});
$("landing-select").addEventListener("change",()=>{
 clearOrbitSelection();
 const p=$("landing-select").value.split(",").map(Number);
 try{
  const site=findLand(terrain,p[0],p[1]);
  const safe=resolveLanding(terrain,site.lat,site.lon,"land");
  if(!safe.ok)throw new Error(safe.message);
  marine.boardedId=null;marine.diving=false;
  controller.setLanding(safe.lat,safe.lon);
  marine.update(0,controller,terrain);
  squad?.repositionAfterLanding();
  controller.targetAltitude(15000000);controller.altitudeM=15000000;
  renderer.patchKey=null;renderer.orbitPan=null;renderer.orbitFocus=null;renderer.lastOrbitCenter=null;
  renderer.cameraController.resetFreeAnchor(controller,
    Math.max(0,terrainSurface(terrain,controller.lat,controller.lon).elevationM));
  $("landing").textContent=controller.lat.toFixed(3)+"°, "+controller.lon.toFixed(3)+"°";
  log("架空惑星の新しい着陸候補へ移動しました。");
 }catch(e){log("着陸地変更不可: "+e.message);}
});
$("landing-select").addEventListener("focus",()=>{keys.clear();touches.clear();});

function syncCustomizationControls(){
 $("avatar-style").value=appearance.baseModelId;
 $("outfit-select").value=appearance.presetId;
 for(const slot of ["hairStyle","headwear","cape","bag"]){
  const id=slot==="hairStyle"?"hair-style":slot;
  $(id).value=appearance[slot];
 }
 for(const [slot,id] of [["outer","outer-color"],["legs","legs-color"],["feet","feet-color"],["hairColor","hair-color"]])
  $(id).value=appearance[slot];
 $("expression-preset").value=renderer.expression.preset;
 $("gaze-x").value=String(renderer.expression.gazeX);
 $("auto-blink").checked=renderer.expression.autoBlink;
}
function applyAppearance(next,label){
 try{
  const restored=restoreAppearance(next);
  renderer.setAppearance(restored);
  appearance=restored;
  avatarStyle=restored.baseModelId;
  syncCustomizationControls();updateHUD();
  if(label)log(label);
 }catch(e){log("外見変更に失敗: "+e.message)}
}
$("avatar-style").addEventListener("change",()=>{
 const base=$("avatar-style").value;
 applyAppearance({...appearance,baseModelId:base},"人物の素体を変更しました。");
});
$("outfit-select").addEventListener("change",()=>{
 try{applyAppearance(withOutfit(appearance,$("outfit-select").value),"衣装を変更しました。");}
 catch(e){log(e.message)}
});
for(const [id,slot] of [["hair-style","hairStyle"],["headwear","headwear"],["cape","cape"],["bag","bag"],
 ["outer-color","outer"],["legs-color","legs"],["feet-color","feet"],["hair-color","hairColor"]]){
 $(id).addEventListener("change",()=>{
  try{applyAppearance(withAppearanceSlot(appearance,slot,$(id).value),"部位別の衣装・色を変更しました。");}
  catch(e){log(e.message)}
 });
}
$("expression-preset").addEventListener("change",()=>{
 try{renderer.expression.setPreset($("expression-preset").value);updateHUD();}
 catch(e){log("表情の変更失敗: "+e.message)}
});
$("gaze-x").addEventListener("input",()=>{
 renderer.expression.setGaze(Number($("gaze-x").value));
});
$("auto-blink").addEventListener("change",()=>renderer.expression.setAutoBlink($("auto-blink").checked));
$("reset-appearance").addEventListener("click",()=>{
 renderer.expression=new ExpressionController();
 applyAppearance(createAppearance("pioneer","pioneer"),"人物の外見と表情を初期化しました。");
});

function zoomScene(factor){
 if(renderer.cameraController.mode==="legacy")controller.zoom(factor);
 else if(controller.altitudeM>ORBIT_GROUND_CUTOFF_M)controller.zoom(factor);
 else renderer.cameraController.zoom(factor);
}
function updateActorMarker(info){
 const marker=$("actor-marker");
 if(!info||!info.onScreen){
  if(!info){marker.hidden=true;return;}
  marker.hidden=false;
  marker.style.left=(Math.max(.04,Math.min(.96,info.u))*100)+"%";
  marker.style.top=(Math.max(.08,Math.min(.92,info.v))*100)+"%";
  marker.textContent="↗ アバター";
  return;
 }
 marker.hidden=false;
 marker.style.left=(info.u*100)+"%";
 marker.style.top=(info.v*100)+"%";
 marker.textContent="◆ アバター";
}
function syncCameraControls(){
 const camera=renderer.cameraController.config;
 $("camera-mode").value=camera.mode;
 $("camera-distance").value=String(camera.distanceM);
 $("camera-fov").value=String(camera.fieldOfViewDeg);
 $("camera-height").value=String(camera.tacticalHeightM);
 $("camera-follow-strength").value=String(camera.followStrength);
 $("camera-indicator").checked=camera.indicator;
 $("camera-distance-label").textContent=camera.distanceM.toFixed(1)+"m";
 $("camera-fov-label").textContent=camera.fieldOfViewDeg+"°";
 $("camera-height-label").textContent=Math.round(camera.tacticalHeightM)+"m";
 $("camera-mode-label").textContent=CAMERA_MODES.find(x=>x[0]===camera.mode)?.[1]||camera.mode;
 const quickLabels={legacy:"従来",follow:"追従",shoulder:"肩越し",free:"自由",orbitTarget:"人物注視",tactical:"俯瞰"};
 $("viewport-camera").textContent="◉ "+(quickLabels[camera.mode]||"カメラ");
 $("viewport-camera").setAttribute("aria-label","カメラ切替。現在："+$("camera-mode-label").textContent);
}
function setCameraMode(mode){
 try{
  const ground=Math.max(0,terrainSurface(terrain,controller.lat,controller.lon).elevationM);
  renderer.cameraController.setMode(mode,controller,ground);
  syncCameraControls();updateHUD();
  log("カメラを「"+$("camera-mode-label").textContent+"」へ切り替えました。");
 }catch(e){log("カメラ設定失敗: "+e.message)}
}
$("camera-mode").addEventListener("change",()=>setCameraMode($("camera-mode").value));
$("fog-mode").addEventListener("change",()=>{
 const mode=renderer.setFogMode($("fog-mode").value);
 try{localStorage.setItem(FOG_MODE_KEY,mode);}catch(_){}
 log("遠景フォグ："+({off:"OFF",light:"軽量",realistic:"リアル",auto:"自動"}[mode]||mode));
});
$("camera-distance").addEventListener("input",()=>{
 renderer.cameraController.setValue("distanceM",Number($("camera-distance").value));
 syncCameraControls();
});
$("camera-fov").addEventListener("input",()=>{
 renderer.cameraController.setValue("fieldOfViewDeg",Number($("camera-fov").value));
 syncCameraControls();
});
$("camera-height").addEventListener("input",()=>{
 renderer.cameraController.setValue("tacticalHeightM",Number($("camera-height").value));
 syncCameraControls();
});
$("camera-follow-strength").addEventListener("input",()=>{
 renderer.cameraController.setValue("followStrength",Number($("camera-follow-strength").value));
 syncCameraControls();
});
$("camera-indicator").addEventListener("change",()=>{
 renderer.cameraController.setValue("indicator",$("camera-indicator").checked);
});
$("camera-face").addEventListener("click",()=>{
 setCameraMode("orbitTarget");
 renderer.cameraController.config.yawOffset=Math.PI;
 renderer.cameraController.setValue("distanceM",4);
 renderer.cameraController.config.pitchRad=.1;
 syncCameraControls();
 log("正面から表情を確認するカメラに切り替えました。");
});
$("camera-home").addEventListener("click",()=>{
 renderer.cameraController.resetFreeAnchor(controller,Math.max(0,
  terrainSurface(terrain,controller.lat,controller.lon).elevationM));
 if(renderer.cameraController.mode!=="free")setCameraMode("follow");
 syncCameraControls();
});
function setControlMode(mode){
 controlMode=mode;
 controller?.clearMoveTarget();
 stick={x:0,y:0};
 $("stick-nub").style.transform="translate(0px,0px)";
 updateHUD();
}
$("mode-stick").addEventListener("click",()=>setControlMode("stick"));
$("mode-tap").addEventListener("click",()=>setControlMode("tap"));
$("jump").addEventListener("click",()=>{
 if(fauna?.mount){log("騎乗中はジャンプできません。降馬してから操作してください。");return;}
 if(!controller.jump())log("ジャンプは地上でのみ可能です。");
});
for(const [button,kind] of [["action-sword","sword"],["action-axe","axe"],["action-saw","saw"],["action-mine","mine"],["action-build","build"],["action-dig","dig"],["action-fill","fill"]]){
  $(button).addEventListener("click",()=>{
    const node=kind==="saw"?(renderer?.resourceNodes||[]).find(n=>n.state==="fallen"&&Math.hypot(n.x-controller.x,n.z-controller.z)<5.2):["axe","mine"].includes(kind)?nearbyWorldResource(kind):null;
    if(["axe","mine","saw"].includes(kind)&&!node){
     log(kind==="saw"?"ノコギリ：近くの倒木を選択してください":kind==="axe"?"斧：近くの木か低木を選択してください":"つるはし：近くの岩を選択してください");
     return;
    }
    const started=actions.start(kind,controller,(lat,lon)=>terrainSurface(terrain,lat,lon),
     frontierUI?.attackVariantFor("player",kind)||"overhead");
    if(started){
      const p=squad.frontier.person("player"),cost={
       sword:3,axe:2,saw:2,mine:4,dig:5,fill:5,build:6
      }[kind]||1;
      p.stamina=clamp(p.stamina-cost,0,100);
     }
     if(started&&node)actions.active.resourceNode=node;
    if(started&&["dig","fill"].includes(kind))actions.active.earthwork=
      controller.locationAt(controller.x+Math.sin(controller.yaw)*3,controller.z+Math.cos(controller.yaw)*3);
    log(actions.message);
    updateHUD();
  });
}
$("spawn-enemy").addEventListener("click",()=>{
 const result=battle.spawn(controller,$("enemy-type").value);
 log(result.message);updateHUD();
});
$("spawn-enemy-unit").addEventListener("click",()=>{
 const result=battle.spawnUnit(controller,$("enemy-unit-type").value);
 log(result.message);updateHUD();
});
$("clear-test-enemies").addEventListener("click",()=>{
 battle.clear();log("👾 テスト敵を消しました。");updateHUD();
});
/* Cabin interaction: tapping the door approaches/opens it; buttons handle entry/exit. */
 function performDoor(result){log(result.message);updateHUD();}
 function tapDoor(id){
  const hut=access.find(id);if(!hut)return;
  if(access.inside){
   if(access.inside.id===hut.id)performDoor(access.toggle(hut,controller));
   return;
  }
  if(access.nearby(controller)?.id===hut.id){performDoor(access.toggle(hut,controller));return;}
  if(controller.setMoveTarget(hut.x,hut.z+HUT.halfDepth+1.08)){
   access.pendingDoorId=hut.id;log("🚶 ドアに向かいます。近づいたら開きます。");
  }else log("ドアまで移動できませんでした。");
 }
 function interactDoor(){
  const hut=access.inside||access.nearby(controller);
  if(!hut){log("🚪 完成した小屋の入口へ近づいてください。");return;}
  performDoor(access.toggle(hut,controller));
 }
 function syncDoorUi(){
  const inside=access.inside,near=inside||access.nearby(controller);
  const node=$("door-controls");if(!node)return;
  const active=controller.nearGround&&!rtsMode&&Boolean(near);
  node.hidden=!active;
  if(!active){setDoorMenu(false);return;}
  $("door-toggle").textContent=near.doorOpen?"🚪 閉める":"🚪 開ける";
  $("door-enter").hidden=!!inside||!near.doorOpen;
  $("door-exit").hidden=!inside;
  $("door-shelf").hidden=!inside;
 }
 $("door-toggle").addEventListener("click",interactDoor);
 $("door-enter").addEventListener("click",()=>{
  const hut=access.nearby(controller);if(hut)performDoor(access.enter(hut,controller));
 });
 $("door-exit").addEventListener("click",()=>performDoor(access.exit(controller)));
 
/* v0.7f - reader is inside the game, not an external web page. */
let bookDialogReturnFocus=null;
function closeBookDialog(){
 $("book-overlay").hidden=true;
 activeBookId=null;
 bookDialogReturnFocus?.focus?.();
}
function openBookLibrary(){
 bookDialogReturnFocus=document.activeElement;
 controller.clearMoveTarget();
 keys.clear();touches.clear();stick={x:0,y:0};
 $("stick-nub").style.transform="translate(0px,0px)";
 $("book-overlay").hidden=false;
 activeBookId=null;
 renderBookLibrary();
 $("book-close").focus();
}
function renderBookLibrary(){
 $("book-reading").hidden=true;$("book-library").hidden=false;
 const hut=access.inside,library=books.available(hut),list=$("book-library-list");
 list.replaceChildren();
 $("book-heading").textContent=hut?"📚 小屋の本棚と持ち物":"📖 持ち歩いている本";
 $("book-library-status").textContent=hut?
  "表紙を選ぶと本を開けます。持ち出すと、野外でも「📖 読書」から開けます。":
  "持ち歩いている本はどこでも読めます。小屋の本棚で本を手に取ってください。";
 if(!library.length){
  const empty=document.createElement("p");empty.className="book-library-status";
  empty.textContent="まだ本がありません。小屋の中に入って、本棚を開きましょう。";
  list.append(empty);return;
 }
 for(const book of library){
  const card=document.createElement("article");card.className="book-volume";
  const title=document.createElement("h3");title.textContent="📕 "+book.title;
  const author=document.createElement("small");author.textContent=book.author+" ／ "+book.genre;
  const summary=document.createElement("p");summary.textContent=book.summary;
  const total=pagesForBook(book).length,page=books.page(book.id)+1;
  const progress=document.createElement("small");
  progress.textContent="しおり "+page+" / "+total+" ページ"+(books.carried.includes(book.id)?"　🎒 所持中":"　📚 本棚");
  const buttons=document.createElement("div");buttons.className="book-buttons";
  const open=document.createElement("button");open.type="button";open.dataset.bookOpen=book.id;
  open.textContent=page>1?"📖 続きから読む":"📖 読み始める";
  buttons.append(open);
  if(hut){
   const carry=document.createElement("button");carry.type="button";
   if(books.carried.includes(book.id)){
    carry.dataset.bookReturn=book.id;carry.textContent="📚 本棚に戻す";
   }else{
    carry.dataset.bookTake=book.id;carry.textContent="🎒 持ち出す";
   }
   buttons.append(carry);
  }
  card.append(title,author,summary,progress,buttons);list.append(card);
 }
}
function openBook(bookId){
 const book=BOOK_MAP.get(bookId);if(!book||!books.has(bookId,access.inside))return;
 activeBookId=bookId;
 if(life.readPage(bookId,books.page(bookId)))saveLifeJournal();
 $("book-library").hidden=true;$("book-reading").hidden=false;
 $("book-heading").textContent="📖 読書中";
 $("book-title").textContent=book.title;
 $("book-author").textContent=book.author;
 renderBookPage();
 $("book-paper").focus();
}
function renderBookPage(){
 const book=BOOK_MAP.get(activeBookId);if(!book)return;
 const pages=pagesForBook(book),index=Math.min(books.page(book.id),pages.length-1);
 const current=pages[index],root=$("book-text");
 $("book-chapter").textContent=current.chapter;
 root.replaceChildren();
 for(const text of current.text.split(/\n\n/)){
  const p=document.createElement("p");p.textContent=text;root.append(p);
 }
 root.style.setProperty("--book-font-size",books.fontSize+"px");
 $("book-page-no").textContent=(index+1)+" / "+pages.length;
 $("book-prev").disabled=index===0;
 $("book-next").disabled=index===pages.length-1;
 $("book-paper").scrollTop=0;
}
function moveBookPage(delta){
 const book=BOOK_MAP.get(activeBookId);if(!book)return;
 const target=Math.max(0,Math.min(pagesForBook(book).length-1,books.page(book.id)+delta));
 if(books.bookmark(book.id,target)){
   if(life.readPage(book.id,target))saveLifeJournal();
   saveBookJournal();renderBookPage();
  }
}
$("viewport-books").addEventListener("click",openBookLibrary);
$("toolbar-books").addEventListener("click",openBookLibrary);
$("door-shelf").addEventListener("click",openBookLibrary);
$("book-close").addEventListener("click",closeBookDialog);
$("book-back").addEventListener("click",()=>{
 activeBookId=null;renderBookLibrary();$("book-close").focus();
});
$("book-prev").addEventListener("click",()=>moveBookPage(-1));
$("book-next").addEventListener("click",()=>moveBookPage(1));
$("book-font-down").addEventListener("click",()=>{
 books.fontSize=Math.max(15,books.fontSize-2);saveBookJournal();renderBookPage();
});
$("book-font-up").addEventListener("click",()=>{
 books.fontSize=Math.min(26,books.fontSize+2);saveBookJournal();renderBookPage();
});
$("book-library-list").addEventListener("click",event=>{
 const button=event.target.closest("button");if(!button)return;
 const id=button.dataset.bookOpen||button.dataset.bookTake||button.dataset.bookReturn;
 if(!id||!BOOK_MAP.has(id))return;
 if(button.dataset.bookOpen){openBook(id);return;}
 const hut=access.inside;
 if(!hut)return;
 if(button.dataset.bookTake){
  if(books.take(id,hut)){saveBookJournal();log("📚 「"+BOOK_MAP.get(id).title+"」を持ち物に入れました。");}
 }else if(button.dataset.bookReturn){
  if(books.putBack(id,hut)){saveBookJournal();log("📚 「"+BOOK_MAP.get(id).title+"」を本棚に戻しました。");}
 }
 renderBookLibrary();
});
window.addEventListener("keydown",event=>{
 if($("book-overlay").hidden)return;
 if(event.key==="Escape"){event.preventDefault();closeBookDialog();}
 else if(activeBookId&&event.key==="ArrowRight"){event.preventDefault();moveBookPage(1);}
 else if(activeBookId&&event.key==="ArrowLeft"){event.preventDefault();moveBookPage(-1);}
 else if(["w","a","s","d","q","e","f","ArrowUp","ArrowDown"].includes(event.key))event.preventDefault();
 event.stopImmediatePropagation();
},true);

 const stickArea=$("stick-area"),nub=$("stick-nub");
function updateStick(e){
 const r=stickArea.getBoundingClientRect();
 const cx=r.left+r.width/2,cy=r.top+r.height/2;
 const radius=Math.max(1,Math.min(r.width,r.height)*.32);
 const dx=e.clientX-cx,dy=e.clientY-cy,mag=Math.hypot(dx,dy);
 const scale=mag>radius?radius/mag:1;
 const px=dx*scale,py=dy*scale;
 stick={x:px/radius,y:py/radius};
 nub.style.transform="translate("+px.toFixed(1)+"px,"+py.toFixed(1)+"px)";
}
function releaseStick(){stickPointer=null;stick={x:0,y:0};nub.style.transform="translate(0px,0px)";}
stickArea.addEventListener("pointerdown",e=>{
 if(controlMode!=="stick")return;
 e.preventDefault();stickPointer=e.pointerId;
 stickArea.setPointerCapture?.(e.pointerId);controller.clearMoveTarget();updateStick(e);
});
stickArea.addEventListener("pointermove",e=>{if(e.pointerId===stickPointer)updateStick(e);});
for(const t of ["pointerup","pointercancel","lostpointercapture"]){
 stickArea.addEventListener(t,e=>{if(stickPointer===e.pointerId)releaseStick();});
}

/* ⚓ Tactical RTS controls and eight-slot IF -> THEN automation editor. */
const RTS_METRICS={always:"常に (1)",hunger:"🍽️満腹%",mental:"🧠メンタル%",wood:"木材",stone:"石材",houses:"完成小屋",idle:"待機 0/1",distance:"隊長との距離(m)",walked:"累計歩行(m)",stamina:"⚡スタミナ%",load_kg:"🎒重量kg",resource_nearby:"🌿半径内の資源数"};
const RTS_ACTIONS={gather_wood:"木材を採集",gather_stone:"石材を採集",build:"小屋を建築",
 move_rally:"集合地点へ移動",follow:"隊長を追従",patrol:"集合地点付近を巡回",wait:"待機",rest_home:"💤家で100%まで休息",store_chest:"📦チェストに全収納",gather_nearby:"🧺範囲内の資源を全回収"};

function renderFrontierEditor(actor){
 let panel=document.getElementById("fw-life-gambit");
 if(!panel){
  panel=document.createElement("div");panel.id="fw-life-gambit";panel.className="fw-life-gambit";
  panel.style.cssText="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin:8px 0;padding:8px;background:#15394a;border:1px solid #6ca5ad;border-radius:9px;font-size:11px";
  panel.innerHTML='<strong style="width:100%">🌿 Frontier World 生活AI</strong>'+
    '<span data-fw="stats" style="flex:1 1 100%"></span>'+
    '<button type="button" data-fw="preset">💤休息→📦収納→🧺全回収</button>'+
    '<label>半径 <output data-fw="radiusText"></output> <input type="range" data-fw="radius" min="5" max="100" style="width:95px;accent-color:#8fe5c3"></label>'+
    '<button type="button" data-fw="origin">📍現在地を中心に</button>';
  document.getElementById("auto-rule-list").before(panel);
  panel.addEventListener("click",event=>{
   const button=event.target.closest("button[data-fw]");if(!button)return;
   const id=autoActorId;
   if(button.dataset.fw==="preset"){
    squad.frontier.applyPreset(id);$("auto-status").textContent="優先1：30%以下→100%まで休息 / 2：18kg以上→指定チェストに全収納 / 3：「常に」範囲内全回収（4〜8は維持）";
   }
   if(button.dataset.fw==="origin")squad.frontier.setOrigin(id);
   renderAutoEditor();
  });
  panel.querySelector('[data-fw="radius"]').addEventListener("change",event=>{
   squad.frontier.setRadius(autoActorId,event.target.value);renderAutoEditor();
  });
 }
 const fw=squad.frontier.person(actor.id),home=squad.frontier.home(actor);
  const chestSelect=$("auto-chest-target"),chests=squad.frontier.chests(actor,$("auto-chest-sort").value);
  chestSelect.replaceChildren();
  const fallback=document.createElement("option");fallback.value="";fallback.textContent="現在地に近いチェストを自動選択";
  chestSelect.append(fallback);
  for(const chest of chests){
   const option=document.createElement("option");option.value=String(chest.id);
   option.textContent=chest.name+" / 約"+Math.round(chest.distance)+"m / 小屋 #"+chest.buildingId;
   chestSelect.append(option);
  }
  chestSelect.value=fw.chestId&&chests.some(c=>c.id===fw.chestId)?String(fw.chestId):"";
  const selected=chests.find(c=>c.id===Number(chestSelect.value));
  $("auto-chest-name").value=selected?.name||"";
  $("auto-chest-contents").textContent=selected?"収納数 "+Object.values(life.chestInventory(selected.id)).reduce((a,b)=>a+b,0)+"個":(chests.length?"収納先：自動":"※まず小屋とチェストを設置してください");
 const stored=squad.frontier.stored();
 panel.querySelector('[data-fw="stats"]').textContent="⚡ "+fw.stamina.toFixed(1)+"% / 🎒 "+squad.frontier.loadKg(actor.id)+"kg / 🌲 資源"+squad.frontier.metrics(actor).resource_nearby+" / "+(home.kind==="hut"?"🏠家":"⛺仮拠点")+" / 収納:木"+stored.wood+" 石"+stored.stone+" 食材"+stored.food;
 panel.querySelector('[data-fw="radius"]').value=fw.radius;
 panel.querySelector('[data-fw="radiusText"]').textContent=fw.radius+"m";
}

function renderAutoEditor(){
 if(!squad)return;
 const actor=squad.get(autoActorId)||squad.get("player");
 const actorSelect=$("auto-actor");
 if(actorSelect.options.length!==squad.agents.length){
  actorSelect.replaceChildren();
  for(const a of squad.agents){
   const option=document.createElement("option");option.value=a.id;
   option.textContent=a.name+" ("+a.role+")";actorSelect.append(option);
  }
 }
 actorSelect.value=actor.id;
 $("auto-enabled").checked=actor.auto;
 renderFrontierEditor(actor);
 $("auto-actor-list").replaceChildren();
 const quickActors=squad.agents.length>14?
  [...squad.agents.slice(0,8),...squad.agents.filter(a=>a.id===actor.id&&!squad.agents.slice(0,8).includes(a))]:
  squad.agents;
 for(const a of quickActors){
  const btn=document.createElement("button");btn.type="button";
  btn.textContent=a.name+" "+(a.auto?"● 自動":"○ 手動")+" / "+a.status;
  btn.className=a.id===actor.id?"current":"";
  btn.addEventListener("click",()=>{
   autoActorId=a.id;squad.choose(a.id);renderAutoEditor();updateHUD();
  });
  $("auto-actor-list").append(btn);
 }
 const options=(items,selected,labeler)=>items.map(v=>
  '<option value="'+v+'"'+(v===selected?' selected':'')+'>'+labeler(v)+'</option>').join("");
 $("auto-rule-list").innerHTML=actor.rules.map((rule,index)=>
  '<div class="auto-rule" data-slot="'+index+'">'+
  '<label class="rule-enable"><input type="checkbox" data-field="enabled"'+(rule.enabled?' checked':'')+'> '+(index+1)+'</label>'+
  '<label>IF <select data-field="metric">'+options(RULE_METRICS,rule.metric,v=>RTS_METRICS[v])+'</select></label>'+
  '<label>比較 <select data-field="op">'+options(RULE_OPERATORS,rule.op,v=>v)+'</select></label>'+
  '<label>値 <input type="number" data-field="value" step="any" min="-1000000" max="1000000" value="'+rule.value+'"></label>'+
  '<label>THEN <select data-field="action">'+options(RULE_ACTIONS,rule.action,v=>RTS_ACTIONS[v])+'</select></label>'+
  '</div>').join("");

 $("auto-rule-list").querySelectorAll(".auto-rule").forEach((row,i)=>{
  const wrap=document.createElement("div");wrap.style.cssText="display:flex;grid-column:1/-1;justify-content:flex-end;gap:5px";
  for(const delta of [-1,1]){
   const b=document.createElement("button");b.type="button";b.textContent=delta<0?"↑ 優先":"↓ 優先";
   b.dataset.order=String(delta);b.disabled=(i===0&&delta<0)||(i===actor.rules.length-1&&delta>0);
   b.style.cssText="padding:3px 9px;min-height:27px";wrap.append(b);
  }
  row.append(wrap);
 });
}
function syncSquadUi(){renderAutoEditor();updateHUD();}
function openAutoEditor(open){
 $("auto-panel").hidden=!open;
 $("viewport-auto").setAttribute("aria-expanded",String(open));
 if(open){renderAutoEditor();$("auto-status").textContent="選択中の人物の条件を編集できます。";}
}
$("viewport-auto").addEventListener("click",()=>{railwayUI?.close();openAutoEditor($("auto-panel").hidden);});
$("toolbar-auto").addEventListener("click",()=>openAutoEditor(true));
$("auto-close").addEventListener("click",()=>openAutoEditor(false));
$("auto-actor").addEventListener("change",()=>{
 autoActorId=$("auto-actor").value;squad.choose(autoActorId);renderAutoEditor();updateHUD();
});
$("auto-chest-target").addEventListener("change",()=>{
  const id=$("auto-chest-target").value;
  squad.frontier.setChest(autoActorId,id?Number(id):null);
  const chosen=squad.frontier.chests(squad.get(autoActorId)).find(c=>c.id===Number(id));
  $("auto-chest-name").value=chosen?.name||"";
  $("auto-chest-contents").textContent=chosen?"収納済み "+JSON.stringify(life.chestInventory(chosen.id)):"";
});
$("auto-chest-sort").addEventListener("change",renderAutoEditor);
$("auto-chest-rename").addEventListener("click",()=>{
  const id=$("auto-chest-target").value,oldName=$("auto-chest-name").value;
  const chest=id&&squad.frontier.chests(squad.get(autoActorId)).find(c=>c.id===Number(id));
  if(!chest){$("auto-status").textContent="名前変更するチェストを選択してください";return;}
  const result=life.renameChest(chest.id,oldName);
  $("auto-status").textContent=result.message;
  if(result.ok){saveLifeJournal();renderAutoEditor();}
});
$("auto-enabled").addEventListener("change",()=>{
 squad.setAuto([autoActorId],$("auto-enabled").checked);
 renderAutoEditor();updateHUD();
});
$("auto-rule-list").addEventListener("click",e=>{
 const button=e.target.closest("button[data-order]");if(!button)return;
 const row=button.closest("[data-slot]"),i=Number(row.dataset.slot),j=i+Number(button.dataset.order),actor=squad.get(autoActorId);
 if(j<0||j>=actor.rules.length)return;
 [actor.rules[i],actor.rules[j]]=[actor.rules[j],actor.rules[i]];
 squad.frontier.cancel(actor);renderAutoEditor();
});
$("auto-rule-list").addEventListener("change",e=>{
 const row=e.target.closest("[data-slot]");if(!row)return;
 const index=Number(row.dataset.slot);
 try{
  const rule={
   enabled:row.querySelector('[data-field="enabled"]').checked,
   metric:row.querySelector('[data-field="metric"]').value,
   op:row.querySelector('[data-field="op"]').value,
   value:Number(row.querySelector('[data-field="value"]').value),
   action:row.querySelector('[data-field="action"]').value
  };
  squad.setRule(autoActorId,index,rule);
  $("auto-status").textContent=(index+1)+"番の条件を更新しました。保存ボタンで記録できます。";
 }catch(err){$("auto-status").textContent="設定エラー: "+err.message;renderAutoEditor();}
});
$("auto-all-on").addEventListener("click",()=>{
 squad.setAuto(squad.agents.map(a=>a.id),true);renderAutoEditor();updateHUD();
});
$("auto-all-off").addEventListener("click",()=>{
 squad.setAuto(squad.agents.map(a=>a.id),false);renderAutoEditor();updateHUD();
});
$("auto-rally").addEventListener("click",()=>{
 squad.setRally(squad.selected.size?[...squad.selected]:[autoActorId],controller.x,controller.z);
 $("auto-status").textContent="隊長の現在地点を集合位置に設定しました。";
});
function toggleRts(){
 if(!rtsMode){
  if(!controller.nearGround){log("RTS操作は地表へ降下してから使えます。");setAltitude(2.5);return;}
  rtsPreviousCamera=renderer.cameraController.mode;
  rtsMode=true;
  setCameraMode("tactical");
  renderer.cameraController.setValue("tacticalHeightM",45);
  setControlMode("tap");
  log("⚓ RTS：人物・敵・資源はタップ、地面はダブルタップで移動。ピンチで拡大縮小。");
 }else{
  rtsMode=false;rtsMulti=false;rallyPicking=false;groupUI?.close();groupUI?.closeMulti();
  setCameraMode(rtsPreviousCamera==="tactical"?"follow":rtsPreviousCamera);
  setControlMode("stick");
 }
 updateHUD();
}
$("viewport-rts").addEventListener("click",toggleRts);
$("toolbar-rts").addEventListener("click",toggleRts);
$("rts-all").addEventListener("click",()=>{squad.selectAll();autoActorId="player";renderAutoEditor();updateHUD();});
$("rts-multi").addEventListener("click",()=>{rtsMulti=!rtsMulti;updateHUD();});
$("rts-sync").addEventListener("click",()=>{syncMode=!syncMode;updateHUD();
 for(const g of squad.selectedGroups())squad.updateGroup(g.id,{sync:syncMode});
 log(syncMode?"🔗 シンクロモード：対応装備のアバターが同じ行動を行います。":"🔗 個別操作に戻しました。");});
$("rts-rally").addEventListener("click",()=>{
 rallyPicking=!rallyPicking;updateHUD();
});
$("rts-stop").addEventListener("click",()=>{
 for(const id of squad.selected)cancelHarvestOrder(id);
 squad.halt([...squad.selected]);renderAutoEditor();updateHUD();log("選択した人物の移動と自動行動を停止しました。");
});
function commandRtsTap(clientX,clientY,shift=false,groundOnly=false){
 const rect=$("world").getBoundingClientRect();
 if(!rect.width||!rect.height)return;
 const u=(clientX-rect.left)/rect.width,v=(clientY-rect.top)/rect.height;
 const nearest=(renderer.screenActors||[])
  .filter(p=>p.onScreen&&Math.hypot((p.u-u)*rect.width,(p.v-v)*rect.height)<42)
  .sort((a,b)=>Math.hypot((a.u-u)*rect.width,(a.v-v)*rect.height)-
   Math.hypot((b.u-u)*rect.width,(b.v-v)*rect.height))[0];
 if(nearest&&!rallyPicking&&!groundOnly){
  squad.choose(nearest.id,{add:rtsMulti||shift});
  autoActorId=nearest.id;renderAutoEditor();
  if(!$("group-panel").hidden)groupUI?.loadDraft(null);
  log(nearest.name+" を選択しました。");updateHUD();
  return;
 }
 const hit=renderer.pickGround(clientX,clientY);
 if(!hit){log("地面をタップして指示してください。");return;}
 if(rallyPicking){
  const groups=squad.selectedGroups();
  if(groups.length)for(const g of groups)squad.setGroupRally(g.id,hit.x,hit.z);
  else squad.setRally([...squad.selected],hit.x,hit.z);
  rallyPicking=false;
  log(groups.length?"👥 "+groups.length+"部隊の集合地点を保存しました。":"選択した人物の集合地点を設定しました。");
 }else{
  const groups=squad.selectedGroups();
  const moved=groups.length>1?squad.orderGroups(groups.map(g=>g.id),"move",{x:hit.x,z:hit.z}):
   groups.length===1?squad.orderGroupMove(groups[0].id,hit.x,hit.z):
   squad.orderMove([...squad.selected],hit.x,hit.z);
  log(moved?moved+"人に"+(groups.length?"隊形つきの":"")+"移動を指示しました。":"移動不可：水域・急斜面・遠すぎる地点です。");
 }
 updateHUD();
}
const rtsNodes=new Map();
function updateRtsMarkers(projected){
 const root=$("rts-markers");
 if(!rtsMode||!controller.nearGround){root.hidden=true;return;}
 root.hidden=false;
 for(const agent of squad.agents){
  let node=rtsNodes.get(agent.id);
  if(!node){
   node=document.createElement("span");node.className="rts-label";
   root.append(node);rtsNodes.set(agent.id,node);
  }
  const point=projected?.find(p=>p.id===agent.id&&p.onScreen);
  const index=squad.agents.indexOf(agent);
  node.hidden=!point||(agent.id.startsWith("troop-")&&index%5!==0&&
   (squad.selected.size>15||!squad.selected.has(agent.id)));
  if(!point||node.hidden)continue;
  node.style.left=(point.u*100)+"%";node.style.top=(point.v*100)+"%";
  node.classList.toggle("selected",squad.selected.has(agent.id));
  node.textContent=agent.name+(Number.isFinite(agent.hp)?" ♡"+Math.ceil(agent.hp):"")+(agent.auto?" ⚙":"");
 }
}


/* v0.7h Compact HUD: collapse large toolbars, retaining all existing actions. */
const quickToggle=$("viewport-quick-toggle"),quickPanel=$("viewport-quick-panel");
const toolToggle=$("action-tools-toggle"),toolPanel=$("action-tool-list");
const doorToggle=$("door-actions-toggle"),doorPanel=$("door-options");
function setQuickMenu(open){
 quickPanel.hidden=!open;quickToggle.setAttribute("aria-expanded",String(open));
 quickToggle.setAttribute("aria-label",open?"操作メニューを閉じる":"操作メニューを開く");
 quickToggle.textContent=open?"× 閉じる":"☰ 操作";
 if(open){setToolMenu(false);setDoorMenu(false);}
}
function setToolMenu(open){
 toolPanel.hidden=!open;toolToggle.setAttribute("aria-expanded",String(open));
 toolToggle.setAttribute("aria-label",open?"道具メニューを閉じる":"道具メニューを開く");
 if(open){setQuickMenu(false);setDoorMenu(false);}
}
function setDoorMenu(open){
 doorPanel.hidden=!open;doorToggle.setAttribute("aria-expanded",String(open));
 doorToggle.setAttribute("aria-label",open?"ドア操作を閉じる":"ドア操作を開く");
 if(open){setQuickMenu(false);setToolMenu(false);}
}
function closeCompactMenus(){setQuickMenu(false);setToolMenu(false);setDoorMenu(false);}
quickToggle.addEventListener("click",()=>setQuickMenu(quickPanel.hidden));
toolToggle.addEventListener("click",()=>setToolMenu(toolPanel.hidden));
doorToggle.addEventListener("click",()=>setDoorMenu(doorPanel.hidden));
quickPanel.addEventListener("click",e=>{
 if(e.target.closest("#viewport-rts,#viewport-auto,#viewport-books,#viewport-life,#viewport-menu,#viewport-directory,#viewport-town,#viewport-settlements,#viewport-railway"))setQuickMenu(false);
});
toolPanel.addEventListener("click",e=>{if(e.target.closest("button"))setToolMenu(false);});
doorPanel.addEventListener("click",e=>{if(e.target.closest("button"))setDoorMenu(false);});
$("viewport-expand").addEventListener("click",closeCompactMenus);
document.addEventListener("pointerdown",e=>{
 if(!e.target.closest(".viewport-actions"))setQuickMenu(false);
 if(!e.target.closest(".action-pad"))setToolMenu(false);
 if(!e.target.closest(".door-controls"))setDoorMenu(false);
});

lifeUI=installLifestyleUI({
  getContext:()=>({
   life,actions,access,controller,
   sample:(lat,lon)=>terrainSurface(terrain,lat,lon)
  }),
  onChange:()=>{saveLifeJournal();updateHUD();},
  onBook:openBookLibrary,
  onSleep:()=>{planet.advance(.25);updateHUD();},
  notify:log,
  getEquipmentInventory:()=>frontierUI?.equipmentInventory()||[],
  onEquipHand:(kind,hand)=>frontierUI?.equipHandFromInventory(kind,hand)||{ok:false,message:"まだ装備できません。"}
 });
function castFromEquippedRod(power=Number($("marine-fish-power").value)/100){
 const hands=renderer?.handEquipment?.player||{};
 if(!Object.values(hands).includes("fishingRod"))
  return {ok:false,message:"🎣 釣竿を持ち物画面から右手・左手に装備して「使う」を押してください"};
 if(marine.fishing.casting){
  $("fishing-reel-hud").hidden=false;
  return {ok:true,message:"🎣 巻き取りダイヤルを表示しました"};
 }
 const r=marine.castLine(controller,terrain,power);
 if(r.ok){saveMarineJournal();$("fishing-reel-hud").hidden=false;}
 return r;
}
frontierUI=installFrontierInteractions({
 get:()=>({controller,renderer,squad,actions,life,lifeUI,terrain,battle,projectiles,rtsMode,syncMode,
  manualInputActive:Math.abs(stick.x)+Math.abs(stick.y)>.16||["w","a","s","d","ArrowUp","ArrowDown"].some(k=>keys.has(k)||touches.has(k)),
  sample:(lat,lon)=>terrainSurface(terrain,lat,lon)}),
 log,updateHUD,openBookLibrary,saveLifeJournal,
 showSpeech:(id,text)=>worldUI?.speak(id,text),
 showEffect:effect=>worldUI?.float(effect),
 onFish:()=>castFromEquippedRod()
});
worldUI=installWorldFeedbackUI({
 getRenderer:()=>renderer,getController:()=>controller,
 onCommand:(name,arg)=>{
  if(name==="status")return "HP "+(battle?.playerHp??100)+"/100 / 敵 "+(battle?.count()||0)+
   "体 / 木材 "+(actions?.resources?.wood??0)+" / 石材 "+(actions?.resources?.stone??0);
  if(name==="spawn"){
   const result=battle?.spawn(controller,arg);
   if(result?.ok){log(result.message);updateHUD();}
   return result?.message||"戦闘テストが初期化されていません。";
  }
  return "不明なコマンドです。";
 }
});
for(const [id,preset] of [["deploy-party","party"],["deploy-company","company"]]){
 $(id).addEventListener("click",()=>{
  try{
   const deployed=squad.deployPreset(preset);
   frontierUI?.syncRoster();
   autoActorId=deployed.ids[0];
   syncSquadUi();groupUI?.loadDraft(deployed.group);
   log("👥 "+deployed.group.name+"："+deployed.ids.length+"人を配置しました。");
  }catch(error){log("部隊編成に失敗："+error.message);}
 });
}
groupUI=installGroupUI({
 get:()=>({squad,controller}),notify:log,update:updateHUD,
 onSelect:id=>{autoActorId=id;renderAutoEditor();},
 onSync:enabled=>{syncMode=enabled;},
 onPickRally:()=>{rallyPicking=true;updateHUD();},
 onAutoEditor:()=>openAutoEditor(false)
});
function syncTownState(){
 const room=townLife.inside;
 const building=room?townLife.find(room.townId,room.buildingId,"village"):null;
 renderer.townInterior=building?{type:building.type,title:building.title,pose:room.pose}:null;
 $("town-interior-exit").hidden=!building;
 if(room){controller.clearMoveTarget();renderer.mapFocus=null;}
 saveTownJournal();saveLifeJournal();updateHUD();
}
townUI=installTownInteractionUI({
 get:()=>({town:townLife,townId:activeSettlementId,controller,actions,life,day:planet.timeDays}),
 onChange:syncTownState,onNotice:log
});
$("town-interior-exit").addEventListener("click",()=>{
 const result=townLife.leave();
 if(result.ok){syncTownState();log(result.message);townUI?.refresh();}
});
$("viewport-town").addEventListener("click",()=>{
 settlementTravelUI?.close();railwayUI?.close();mapDirectoryUI?.close();routeMapUI?.close();
 faunaUI?.close();farmUI?.close();$("marine-panel").hidden=true;
});
mapDirectoryUI=installMapDirectoryUI({
 get:()=>({controller,fauna,squad,renderer,constructions,actions}),
 onOpen:openMapEntry,onMove:moveToMapEntry,notify:log
});
settlementTravelUI=installSettlementTravelUI({
 getDestinations:()=>settlementLocations||=settlementDestinations(terrain),
 onTravel:visitSettlement,notify:log
});
orbitalCitiesUI=installOrbitalCitiesUI({
 getDestinations:()=>settlementLocations||=settlementDestinations(terrain),
 onSelect:selectOrbitCity,onFree:clearOrbitSelection,notify:log
});
$("viewport-settlements").addEventListener("click",()=>{
 railwayUI?.close();mapDirectoryUI?.close();routeMapUI?.close();faunaUI?.close();farmUI?.close();
 $("marine-panel").hidden=true;
});
railwayUI=installRailwayUI({
 get:()=>({railway,timeDays:planet.timeDays,stationId:activeSettlementId,controller,
  routeKm:renderer?.railwayRouteKm,companions:squad?.agents?.slice(1).map(a=>a.name)||[]}),
 onWait:waitForRailwayDeparture,onEnterStation:enterRailwayStation,
 onExitStation:exitRailwayStation,onSkipArrival:skipRailwayArrival,onBuyTicket:buyRailwayTicket,
 onBoard:boardRailwayTrain,onAlight:alightRailwayTrain,
 onChangeCarriage:changeRailwayCarriage,
 onCamera:mode=>{
  const result=railway.setCamera(mode);
  if(result.ok){renderer.railCameraFixed=null;saveRailwayJournal();updateHUD();}
  return result;
 },
 onWalls:()=>{
  const result=railway.toggleWalls();
  if(result.ok){saveRailwayJournal();updateHUD();}
  return result;
 },
 onTalk:id=>{
  const result=railway.talk(id,squad?.agents?.slice(1).map(a=>a.name)||[]);
  if(result.ok)worldUI?.speak(id,result.message);
  return result;
 },notify:log,
 onOpen:()=>{
  settlementTravelUI?.close();mapDirectoryUI?.close();routeMapUI?.close();
  townUI?.close(true);faunaUI?.close();farmUI?.close();$("marine-panel").hidden=true;
 }
});
routeMapUI=installRouteMapUI({
 getController:()=>controller,getTerrain:()=>terrain,
 onOpen:()=>{
  settlementTravelUI?.close();railwayUI?.close();mapDirectoryUI?.close();faunaUI?.close();farmUI?.close();
  $("marine-panel").hidden=true;
 },
 onGo:(goal,preview)=>{
  if(controller.altitudeM>12)return {ok:false,message:"地表へ降下してから移動を指示してください"};
  if(marine.cabinId)return {ok:false,message:"🚪 船室から甲板へ出て航路を指定してください"};
  const valid=routePreview(controller,terrain,goal.x,goal.z);
  if(!valid.ok)return valid;
  cancelHarvestOrder("player");
  const ok=controller.setMoveTarget(goal.x,goal.z);
  if(ok)renderer.mapFocus={x:goal.x,z:goal.z};
  updateHUD();
  return {ok,message:ok?"📍 マップの目的地まで移動を開始します（直線移動・障害物では停止）":
   "移動できません。距離、船の航行可能海域、陸地を確認してください"};
 },
 notify:log
});
$("viewport-directory").addEventListener("click",()=>{
 settlementTravelUI?.close();railwayUI?.close();routeMapUI?.close();
 faunaUI?.close();farmUI?.close();
 $("marine-panel").hidden=true;$("marine-toggle").setAttribute("aria-expanded","false");
});
$("farm-toggle").addEventListener("click",()=>{railwayUI?.close();mapDirectoryUI?.close();faunaUI?.close();$("marine-panel").hidden=true;});
$("fauna-toggle").addEventListener("click",()=>{railwayUI?.close();mapDirectoryUI?.close();farmUI?.close();$("marine-panel").hidden=true;});
window.addEventListener("pagehide",saveFaunaJournal);
window.addEventListener("pagehide",saveFarmJournal);
for(const [id,fn] of [
 ["marine-hud-dive",()=>marine.dive(controller,terrain)],
 ["marine-hud-down",()=>marine.adjustDepth(5,controller,terrain)],
 ["marine-hud-up",()=>marine.adjustDepth(-5,controller,terrain)],
 ["marine-hud-surface",()=>marine.dive(controller,terrain)]
])$(id).addEventListener("click",()=>{
 const r=fn();log(r.message);
 if(r.ok){saveMarineJournal();updateHUD();}
});
$("marine-swim-style").addEventListener("change",()=>{
 const r=marine.setSwimStyle($("marine-swim-style").value);
 log(r.message);if(r.ok)saveMarineJournal();updateHUD();
});
function operateDive(fn){
 const r=fn();log(r.message);
 if(r.ok){saveMarineJournal();saveLifeJournal();updateHUD();}
 return r;
}
$("marine-equip").addEventListener("click",()=>operateDive(()=>
 marine.equipGear($("marine-gear-equip").value,controller)));
$("marine-gear-craft").addEventListener("click",()=>operateDive(()=>
 marine.craftGear($("marine-gear-equip").value,actions.resources)));
$("marine-descend").addEventListener("click",()=>operateDive(()=>
 marine.adjustDepth(5,controller,terrain)));
$("marine-ascend").addEventListener("click",()=>operateDive(()=>
 marine.adjustDepth(-5,controller,terrain)));
$("marine-scan").addEventListener("click",()=>operateDive(()=>
 marine.scan(controller,terrain)));
$("marine-salvage").addEventListener("click",()=>{
 const result=operateDive(()=>marine.salvage(controller,terrain,actions.resources));
 if(result.ok)worldUI?.float({kind:"gain",text:"🏛️ 発見物を回収！",actorId:"player",duration:2});
});
$("marine-toggle").addEventListener("click",()=>{
 railwayUI?.close();
 const panel=$("marine-panel");panel.hidden=!panel.hidden;
 $("marine-toggle").setAttribute("aria-expanded",String(!panel.hidden));
 if(!panel.hidden){mapDirectoryUI?.close();faunaUI?.close();farmUI?.close();}updateHUD();
});
$("marine-close").addEventListener("click",()=>{
 $("marine-panel").hidden=true;$("marine-toggle").setAttribute("aria-expanded","false");
});
for(const [id,act] of [
 ["marine-craft",()=>marine.craft($("marine-boat-kind").value,controller,terrain,actions.resources)],
 ["marine-board",()=>marine.board(controller,terrain)],
 ["marine-leave",()=>marine.leave(controller,terrain)],
 ["marine-dive",()=>marine.dive(controller,terrain)]
]){
 $(id).addEventListener("click",()=>{
  const result=act();log(result.message);
  if(result.ok){
   if(marine.boarded?.kind==="sailing_ship")
    marine.shipboard.init(marine.boardedId,squad.agents.slice(1).map(a=>a.id));
   renderer.patchKey=null;saveMarineJournal();saveLifeJournal();
  }
  updateHUD();
 });
}
// Ship helm is always enabled on deck, including while the vessel is moving.
const shipAction=fn=>{
 const result=fn();
 log(result.message);
 if(result.ok){controller.boatSpeed=marine.sailingSpeed();saveMarineJournal();}
 updateHUD();
};
$("marine-sail-trim").addEventListener("input",()=>{
 $("marine-sail-value").textContent=$("marine-sail-trim").value+"%";
});
$("marine-sail-trim").addEventListener("change",()=>{
 shipAction(()=>marine.setSails(Number($("marine-sail-trim").value)/100));
});
$("marine-cruise").addEventListener("click",()=>shipAction(()=>
 marine.boarded?.kind==="sailing_ship"&&!marine.shipboard.canHelm()?
 {ok:false,message:"操舵担当がまだ舵輪にいません"}:
 marine.setCruise(!marine.boarded?.cruise)));
$("marine-anchor").addEventListener("click",()=>shipAction(()=>marine.setAnchor(!marine.boarded?.anchor)));
for(const [id,angle] of [["marine-steer-left",-Math.PI/15],["marine-steer-right",Math.PI/15]]){
 $(id).addEventListener("click",()=>shipAction(()=>
  marine.boarded?.kind==="sailing_ship"&&!marine.shipboard.canHelm()?
   {ok:false,message:"操舵担当が舵輪にいません。乗組員を割り当ててください"}:
   marine.steer(angle,controller)));
}
// Helm and shipboard actions are local to the moving vessel.
const onboardAction=fn=>{
 const result=fn();log(result.message);
 if(result.ok)saveMarineJournal();
 updateHUD();return result;
};
$("marine-helm-assign").addEventListener("click",()=>{
 onboardAction(()=>marine.shipboard.assignHelm($("marine-helm-member").value));
});
$("marine-helm-walk").addEventListener("click",()=>{
 onboardAction(()=>marine.shipboard.assignHelm("player"));
});
$("marine-ship-door").addEventListener("click",()=>{
 onboardAction(()=>marine.shipboard.toggleDoor());
});
$("marine-ship-passage").addEventListener("click",()=>{
 const board=marine.shipboard;
 if(!board.doorOpen){log("🚪 まず船室の扉を開いてください");return;}
 const result=onboardAction(()=>board.player.zone==="cabin"?marine.exitCabin():marine.enterCabin());
 if(result.ok){
  life.activity="idle";life.activityFurnitureId=null;
  renderer.cameraController.smoothEye=null;renderer.cameraController.smoothTarget=null;
 }
});
$("marine-talk").addEventListener("click",()=>{
 const id=$("marine-talk-member").value,name=squad.get(id)?.name||"仲間";
 const result=onboardAction(()=>marine.shipboard.talk(id,name));
 if(result.ok&&result.speech)worldUI?.speak(id,result.speech);
});
// Living quarters are attached to the moving ship; entering never stops cruise.
$("marine-cabin-toggle").addEventListener("click",()=>{
 const wasInside=Boolean(marine.cabinId);
 const result=wasInside?marine.exitCabin():marine.enterCabin();
 if(result.ok){life.activity="idle";life.activityFurnitureId=null;}
 log(result.message);
 if(result.ok){
  renderer.cameraController.smoothEye=null;
  renderer.cameraController.smoothTarget=null;
  saveMarineJournal();
 }
 updateHUD();
});
$("marine-cabin-furniture").addEventListener("click",event=>{
 const button=event.target.closest("button[data-cabin-action]");
 if(button)useShipFurniture(button.dataset.cabinAction);
});
$("marine-fish-power").addEventListener("input",()=>{
 $("marine-fish-power-label").textContent=$("marine-fish-power").value+"%";
});
$("marine-find-island").addEventListener("click",()=>{
 const r=marine.findNearestIsland(controller,terrain,180000);
 log(r.message);$("marine-island-status").textContent=r.message;
});
$("marine-fish-cast").addEventListener("click",()=>shipAction(()=>castFromEquippedRod()));
$("marine-fish-stop").addEventListener("click",()=>shipAction(()=>marine.stopFishing()));
function dialReelTurn(angle){
 const result=marine.turnFishingDial(Math.max(0,Math.min(angle,Math.PI*5)),actions.resources);
 if(!result.ok||result.kind!=="reeling"&&result.kind!=="hold")log(result.message);
 if(result.ok&&result.kind!=="reeling"&&result.kind!=="hold"){saveLifeJournal();saveMarineJournal();}
 if(result.ok&&FISH_CATALOG[result.kind])
  worldUI?.float({kind:"gain",text:"🐟 魚 +1",actorId:"player",duration:1.6});
 if(result.ok&&result.kind==="reeling"){
  const fishing=marine.fishing;
  $("marine-fish-distance").textContent="糸："+fishing.lineOutM.toFixed(1)+"m";
  $("marine-fish-line-progress").value=Math.max(0,Math.round(100*
   (1-fishing.lineOutM/(3+fishing.power*26))));
 }else updateHUD();
 return result;
}
const reelDials=[$("marine-reel-dial"),$("fishing-mini-reel")];
let dialAngle=0;
for(const dial of reelDials){
 let active=false,last=null;
 const pointerAngle=e=>{
  const r=dial.getBoundingClientRect();
  return Math.atan2(e.clientY-(r.top+r.height/2),e.clientX-(r.left+r.width/2));
 };
 const rotate=delta=>{
  dialAngle+=delta*180/Math.PI;
  for(const target of reelDials)target.style.setProperty("--dial-angle",dialAngle.toFixed(1)+"deg");
  if(delta>.005)dialReelTurn(delta);
 };
 dial.addEventListener("pointerdown",e=>{
  if(!marine?.fishing?.casting)return;
  active=true;last=pointerAngle(e);
  try{dial.setPointerCapture(e.pointerId);}catch(_){}
  e.preventDefault();
 });
 dial.addEventListener("pointermove",e=>{
  if(!active)return;
  const next=pointerAngle(e),delta=Math.atan2(Math.sin(next-last),Math.cos(next-last));
  last=next;rotate(delta);e.preventDefault();
 });
 for(const type of ["pointerup","pointercancel","lostpointercapture"])
  dial.addEventListener(type,()=>{if(active)saveMarineJournal();active=false;last=null;});
 dial.addEventListener("keydown",e=>{
  if(!["ArrowRight","ArrowDown","ArrowUp","Enter"," "].includes(e.key))return;
  e.preventDefault();rotate(Math.PI/4);
 });
}
$("marine-fish-reel").addEventListener("click",()=>dialReelTurn(Math.PI*2));
$("fishing-hud-reel").addEventListener("click",()=>dialReelTurn(Math.PI*2));
$("fishing-hud-stop").addEventListener("click",()=>{
 const result=marine.stopFishing();log(result.message);
 if(result.ok)saveMarineJournal();updateHUD();
});
// Ferry route ticket, quay turnstile, boarding, walking, and passenger dialogue.
$("viewport-harbor").addEventListener("click",()=>{
 const panel=$("harbor-panel");panel.hidden=!panel.hidden;
 $("viewport-harbor").setAttribute("aria-expanded",String(!panel.hidden));
 if(!panel.hidden){railwayUI?.close();settlementTravelUI?.close();updateHUD();}
});
$("harbor-close").addEventListener("click",()=>{
 $("harbor-panel").hidden=true;$("viewport-harbor").setAttribute("aria-expanded","false");
});
$("harbor-terminal").addEventListener("change",updateHUD);
$("harbor-approach").addEventListener("click",()=>harborAction(()=>
 walkToHarborWharf($("harbor-terminal").value)));
$("harbor-office").addEventListener("click",()=>harborAction(()=>{
 const id=$("harbor-terminal").value,w=WHARVES.find(x=>x.id===id);
 if(!w||activeSettlementId!=="port"||Math.hypot(controller.x-w.x,controller.z-130)>35)
  return {ok:false,message:"選択した桟橋の入口まで移動してください"};
 return ferry.enterTerminal(id);
}));
$("harbor-buy").addEventListener("click",()=>harborAction(()=>
 ferry.purchase(planet.timeDays,amount=>railway.charge(amount))));
$("harbor-gate").addEventListener("click",()=>harborAction(()=>ferry.passGate()));
$("harbor-wait").addEventListener("click",()=>harborAction(()=>{
 const terminal=$("harbor-terminal").value,location=ferryLocation(planet.timeDays);
 if(!ferry.checkedIn||ferry.terminalId!==terminal)
  return {ok:false,message:"乗船券を購入して改札を通ってから港員に話してください"};
 if(location.mode==="stopped"&&location.dockId===terminal)
  return {ok:true,message:"🧑‍✈️ 港員「客船はすでに停泊しています。乗船できます。」"};
 const arrival=ferryDockArrival(terminal,planet.timeDays);
 if(arrival===null)return {ok:false,message:"時刻表を確認できません"};
 planet.timeDays=(arrival+.2)/1440;running=false;simWorld.clock.paused=true;
 return {ok:true,message:"🧑‍✈️ 港員「客船が入港しました。停泊中は時間を停止します。」"};
}));
$("harbor-board").addEventListener("click",()=>harborAction(()=>{
 if(activeSettlementId!=="port")return {ok:false,message:"港町で乗船してください"};
 if($("harbor-terminal").value!==ferry.terminalId)return {ok:false,message:"窓口と乗り場が異なります"};
 const result=ferry.board(planet.timeDays);
 if(result.ok){controller.clearMoveTarget();townUI?.close(true);running=true;simWorld.clock.paused=false;}
 return result;
}));
$("harbor-alight").addEventListener("click",()=>harborAction(()=>{
 const result=ferry.alight(planet.timeDays);
 if(!result.ok)return result;
 const wharf=WHARVES.find(w=>w.id===result.terminalId);
 controller.x=wharf.x;controller.z=130;controller.travelMode="walk";
 const geo=controller.locationAt(controller.x,controller.z);controller.lat=geo.lat;controller.lon=geo.lon;
 controller.altitudeM=2.5;controller.targetAltitude(2.5);controller.clearMoveTarget();
 squad.repositionAfterLanding();renderer.patchKey=null;
 $("harbor-terminal").value=result.terminalId;
 return result;
}));
let ferryDialogue=0;
$("harbor-talk").addEventListener("click",()=>harborAction(()=>
 ferry.talk(["steward","passenger","captain"][ferryDialogue++%3])));
window.addEventListener("pagehide",()=>{saveMarineJournal();saveRailwayJournal();saveFerryJournal();saveLawJournal();});
init();
xrUI=installXRUI({
 getRenderer:()=>renderer,getController:()=>controller,notify:log,
 onRTSSelect:(x,z)=>{
  if(!squad)return false;
  const distance=a=>Math.hypot(a.control.x-x,a.control.z-z);
  const nearest=squad.agents.reduce((best,a)=>distance(a)<(best?distance(best):Infinity)?a:best,null);
  // A 6 m world-space hit radius intentionally favors an explicit actor tap.
  if(!nearest||distance(nearest)>6)return false;
  squad.choose(nearest.id);updateHUD();
  log("🥽 MR卓上RTS："+nearest.name+"を選択しました");
  return true;
 }
});
requestAnimationFrame(doFrame);

/* v0.7c mobile patch: game-first viewport and explicit exit on iPhone Safari. */
const stage=document.querySelector(".view-panel");
const fullBtn=$("fullscreen-toggle");
const mobileViewportPref="universal-engine:mobile-expanded:v1";
let cssImmersive=false;
function enlarged(){return cssImmersive||document.fullscreenElement===stage;}
function setCssImmersive(on){
 cssImmersive=Boolean(on);
 stage.classList.toggle("immersive",cssImmersive);
 document.body.classList.toggle("immersive",cssImmersive);
}
function rememberViewport(on){
 try{sessionStorage.setItem(mobileViewportPref,on?"1":"0");}catch(e){/* Storage unavailable. */}
}
function syncFullscreenButton(){
 const on=enlarged();
 fullBtn.textContent=on?"⤡ 元の画面へ戻す":"⛶ 画面を広げる";
 fullBtn.setAttribute("aria-pressed",String(on));
 fullBtn.setAttribute("aria-label",on?"通常表示に戻す":"画面を最大化");
 $("viewport-expand").textContent=on?"⤡ 戻る":"⛶ 全画面";
 $("viewport-expand").setAttribute("aria-pressed",String(on));
 $("viewport-expand").setAttribute("aria-label",on?"通常表示に戻す":"画面を最大化");
 if(!on)stage.classList.remove("hud-tools-open");
 $("viewport-menu").setAttribute("aria-expanded",String(stage.classList.contains("hud-tools-open")));
}
async function switchFullscreen(){
 if(enlarged()){
  setCssImmersive(false);stage.classList.remove("hud-tools-open");
  if(document.fullscreenElement===stage&&document.exitFullscreen){
   try{await document.exitFullscreen();}catch(e){log("全画面の解除に失敗しました: "+e.message);}
  }
 }else{
  let nativeOpened=false;
  if(typeof stage.requestFullscreen==="function"){
   try{
    await stage.requestFullscreen({navigationUI:"hide"});
    nativeOpened=document.fullscreenElement===stage;
   }catch(e){/* iPhone Safari normally denies element fullscreen. */}
  }
  if(!nativeOpened)setCssImmersive(true);
 }
 rememberViewport(enlarged());syncFullscreenButton();lastTime=0;
}
fullBtn.addEventListener("click",()=>{void switchFullscreen();});
$("viewport-expand").addEventListener("click",()=>{void switchFullscreen();});
$("viewport-camera").addEventListener("click",()=>{
 const sequence=["follow","shoulder","orbitTarget","tactical","free","legacy"];
 const current=renderer.cameraController.mode;
 setCameraMode(sequence[(sequence.indexOf(current)+1)%sequence.length]);
});
$("viewport-controls").addEventListener("click",()=>setControlMode(controlMode==="stick"?"tap":"stick"));
$("viewport-menu").addEventListener("click",()=>{
 if(enlarged()){stage.classList.toggle("hud-tools-open");syncFullscreenButton();}
 else $("viewport-toolbar").scrollIntoView({behavior:"smooth",block:"nearest"});
});
document.addEventListener("fullscreenchange",()=>{
 if(document.fullscreenElement!==stage&&!cssImmersive){
  stage.classList.remove("immersive");document.body.classList.remove("immersive");
 }
 syncFullscreenButton();lastTime=0;
});
window.addEventListener("keydown",e=>{
 if(e.key!=="Escape")return;
 if(!quickPanel.hidden||!toolPanel.hidden||!doorPanel.hidden){
  closeCompactMenus();e.preventDefault();return;
 }
 if(cssImmersive){
  setCssImmersive(false);stage.classList.remove("hud-tools-open");
  rememberViewport(false);syncFullscreenButton();
 }
});
/* Mobile opens directly into the 3D play view once per tab, unless the player
   manually exited. This preference is separate from versioned game saves. */
if(typeof window.matchMedia==="function"&&window.matchMedia("(max-width:760px) and (pointer:coarse)").matches){
 let pref=null;
 try{pref=sessionStorage.getItem(mobileViewportPref);}catch(e){/* no storage */}
 if(pref!=="0")setCssImmersive(true);
}
syncFullscreenButton();
