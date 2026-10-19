import {Multiverse} from "../core.mjs";
import {Planet} from "../planet/planet-core.mjs";
import {Terrain} from "../planet/terrain-engine.mjs";
import {Weather} from "../planet/weather-engine.mjs";
import {ExplorerController} from "./controller.mjs?v=0.8k-ship-helm-r2";
import {findLand,terrainSurface} from "./geo.mjs?v=0.8b-river-valley";
import {ExplorerRenderer} from "./render.mjs?v=0.8m-ship-cabin-visuals";
import {Actions} from "./actions.mjs?v=0.8e-saw";
import {ResourceHarvest} from "./resource-harvest.mjs?v=0.8e-kg";
import {ConstructionSystem,FACILITIES} from "./construction-system.mjs?v=0.8h-church";
import {ConstructionPlacement} from "./construction-ui.mjs";
import {Earthworks} from "./earthworks.mjs";
import {BattleTest} from "./battle-test.mjs";
import {installWorldFeedbackUI} from "./world-feedback-ui.mjs";
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
import {installFrontierInteractions} from "./frontier-interaction-ui.mjs";
import {bindViewportGestures} from "./viewport-gestures.mjs?v=0.8j-map-gesture-r2";
import {installMapDirectoryUI} from "./map-directory-ui.mjs?v=0.8j-map-ui";
import {descentVisuals,ORBIT_GROUND_CUTOFF_M} from "./descent-visuals.mjs";
import {ArrowProjectiles,ARROW_RECOVERY_SECONDS} from "./arrow-projectiles.mjs?v=0.8k-arrow-ttl";
import {chooseWorkPoint} from "./terrain-collision.mjs";
import {FaunaWorld} from "./fauna.mjs?v=0.8f-animals";
import {installFaunaUI} from "./fauna-ui.mjs?v=0.8g-feed";
import {AgricultureWorld} from "./agriculture.mjs?v=0.8g-farming";
import {installAgricultureUI} from "./agriculture-ui.mjs?v=0.8g-panel";
import {MarineWorld,BOATS,resolveLanding} from "./marine.mjs?v=0.8m-ship-life-navigation";

const $=id=>document.getElementById(id);
const SAVE_KEY="universal-engine:explorer:v0.7i";
const PRE_FRONTIER_SAVE_KEY="universal-engine:explorer:v0.7g";
const V07D_SAVE_KEY="universal-engine:explorer:v0.7d";
const LIFE_JOURNAL_KEY="universal-engine:explorer:life:v1";
const WORLD_JOURNAL_KEY="universal-engine:explorer:earthworks:v0.8a";
const STRUCTURES_JOURNAL_KEY="universal-engine:explorer:construction:v0.8e";
const FAUNA_JOURNAL_KEY="universal-engine:explorer:fauna:v0.8f";
const FARM_JOURNAL_KEY="universal-engine:explorer:agriculture:v0.8g";
const MARINE_JOURNAL_KEY="universal-engine:explorer:marine:v0.8g";
const V07C_SAVE_KEY="universal-engine:explorer:v0.7c";
const V07B_SAVE_KEY="universal-engine:explorer:v0.7b";
const PREVIOUS_SAVE_KEY="universal-engine:explorer:v0.7a";
const LEGACY_SAVE_KEY="universal-engine:explorer:v1";
let planet,terrain,weather,controller,renderer,universe,simWorld,actions,squad,access,battle,projectiles,harvest,earthworks,constructions;
let constructionUI=null,fauna=null,faunaUI=null,farm=null,farmUI=null,mapDirectoryUI=null,vitalsSaveElapsed=0,marine=null;
let books=new BookCollection(),activeBookId=null,life=new Lifestyle(),lifeUI=null;
function saveMarineJournal(){
 try{if(marine)localStorage.setItem(MARINE_JOURNAL_KEY,JSON.stringify(marine.snapshot()));}
 catch(_){log("船の保存に失敗しました");}
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
const resourceNames={wood:"🪵 木材",stone:"🪨 石材",fiber:"🌿 繊維",clay:"🧱 粘土",metal:"⚙️ 金属",ironOre:"⛏️ 鉄鉱石",plank:"🪚 板材",soil:"🟫 土",wheat:"🌾 小麦",straw:"🟡 麦わら",carrot:"🥕 ニンジン",apple:"🍎 リンゴ",fish:"🐟 魚"};
const keys=new Set(),touches=new Set();
const manualHarvest=new Map(),pendingArrowPickup=new Map();
let viewportGestures=null,orbitSelection=null;
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
  manualHarvest.clear();pendingArrowPickup.clear();resourceByOrigin.clear();cachedResourceArray=null;viewportGestures?.cancel();
  orbitSelection=null;
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
   harvest=new ResourceHarvest(restoredWorld?.resources||null);
  controller=saved?ExplorerController.fromSnapshot(terrain,saved.explorer):new ExplorerController(terrain);
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
   if(journal?.resources&&!saved){
    for(const k of ["wood","stone","fiber","clay","metal","ironOre","plank","soil","wheat","straw","carrot","apple","fish"])
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
  simWorld.addSystem("solar-time",(_world,dt)=>planet.advance(dt*Number($("days-per-second").value)*.02));
  simWorld.clock.paused=!running;
  renderer=new ExplorerRenderer($("world"),planet,terrain);
   renderer.resourceHarvest=harvest;renderer.sceneWeather=weather;renderer.fauna=fauna;renderer.farm=farm;renderer.marine=marine;
   renderer.constructionSystem=constructions;
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
  renderer.squad=squad;
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
  const input=$("book-overlay").hidden&&$("life-overlay").hidden?inputVector():{forward:0,strafe:0,turn:0};
  const ship=marine?.boarded;
  // Cruise supplies forward power while manual steering stays authoritative.
  const travelInput=marine?.cabinId?
   {forward:running&&ship?.cruise&&!ship.anchor?1:0,strafe:0,turn:0}:
   running&&ship?.kind==="sailing_ship"&&ship.cruise&&!ship.anchor&&
    ship.sailTrim>0&&Math.abs(input.forward)<.1?{...input,forward:1}:input;
   const previous={x:controller.x,z:controller.z,lat:controller.lat,lon:controller.lon};
  const manualLead=!marine?.cabinId&&(Math.abs(input.forward)+Math.abs(input.strafe)+Math.abs(input.turn)>.1);
   if(manualLead)cancelHarvestOrder("player");
  const priorResources={...actions.resources};
   const hpBefore=new Map(squad.agents.map(a=>[a.id,a.id==="player"?battle.playerHp:a.hp]));
  marine?.update(0,controller,terrain);
  controller.boatSpeed=marine?.sailingSpeed()??4.2;
  controller.mountRiding=Boolean(fauna?.mount)&&controller.travelMode==="walk";controller.walkSpeed=fauna?.speed()??5;
  for(const agent of squad?.agents||[])agent.control.placedWalls=constructions.structures;
  squad?.advance(running?dt:0,{manualLead});
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
   renderer.cameraController.pan(dt,marine?.cabinId?0:input.forward,marine?.cabinId?0:input.strafe);
   controller.update(dt,{forward:running&&ship?.cruise&&!ship.anchor?1:0,strafe:0,turn:0});
  }else controller.update(dt,travelInput);
  marine?.update(running?dt:0,controller,terrain);
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
    battle.advance(dt,controller,attackInProgress,squad);
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
    for(const attack of battle.consumeEnemyHits().slice(0,5)){
     log("🛡️ "+attack.message);
     worldUI?.float({kind:"hurt",text:"−"+attack.damage+" HP",
      actorId:attack.actorId||"player",duration:1.45});
     if(!attack.actorId||attack.actorId==="player")renderer.playerHitSeconds=.48;
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
     enemies:battle.enemies,
     onEnemyHit:(enemy,damage)=>battle.damage(enemy,damage)
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
   life.advance(dt,marine?.cabinId?false:controller.moving);
   if(running){
    for(const actor of squad.agents){
     const p=squad.frontier.person(actor.id),actualHp=actor.id==="player"?battle.playerHp:actor.hp;
     const damage=Math.max(0,(hpBefore.get(actor.id)??actualHp)-actualHp);
     const outcome=advanceVitals(p,dt,{hp:actualHp,maxHp:actor.id==="player"?100:actor.maxHp,
      moving:Boolean(actor.control.moving),working:Boolean(actor.task||actor.id==="player"&&actions.active),
      resting:actor.task?.kind==="rest_home",damage,externalStamina:true});
     if(actor.id==="player")battle.playerHp=outcome.hp;
     else actor.hp=outcome.hp;
    }
    vitalsSaveElapsed+=dt;
    if(vitalsSaveElapsed>=10){vitalsSaveElapsed=0;saveLifeJournal();}
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
  if(running)universe.advance(dt);
  try{
   const next=renderer.frame(controller,dt);
   updateActorMarker(renderer.actorMarker);
   updateOrbitLandingMarker(renderer.screenLanding);
   updateDescentOverlay(controller.altitudeM);
   updateRtsMarkers(renderer.screenActors);
   worldUI?.frame(running?dt:0);
   $("world-hit-flash").style.opacity=String(Math.min(.85,Math.max(0,(renderer.playerHitSeconds||0)/.48))*.83);
   if(next!==displayMode){
    displayMode=next;
    $("mode").textContent=next==="orbit"?"宇宙・惑星モード":"地表メッシュモード";
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
   $("fps").textContent=fps+" fps";frameTime=0;frameCount=0;lastHud=t;
  }
 }
 requestAnimationFrame(doFrame);
}
function updateHUD(){
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
  $("avatar-inventory").textContent=backpack.length?backpack.join(" / "):"リュックは空です（共有資材は下の資材欄）";
 $("coords").textContent=controller.lat.toFixed(5)+"°, "+controller.lon.toFixed(5)+"°";
 $("height").textContent=Math.round(controller.altitudeM).toLocaleString("ja-JP")+" m";
 $("ground-height").textContent=Math.round(g.elevationM).toLocaleString("ja-JP")+" m";
 $("biome").textContent=({ocean:"海",river:"川",forest:"森林",mountain:"山",
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
   " / 繊維 "+actions.resources.fiber+" / 粘土 "+actions.resources.clay+" / 金属 "+actions.resources.metal+" / 土 "+(actions.resources.soil||0);
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
  $("marine-oxygen").value=marine.oxygen;
  $("marine-oxygen-label").textContent=Math.round(marine.oxygen)+"%";
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
  $("marine-fish-cast").disabled=!isSurface||cabin||fishing.casting||controller.travelMode==="swim"||controller.travelMode==="dive";
  $("marine-fish-reel").disabled=!isSurface||cabin||!fishing.hook;
  $("marine-fish-stop").disabled=!fishing.casting;
  $("marine-fishing-status").textContent=fishing.hook?
   "🐟 アタリ！引き上げてください（残り"+Math.ceil(fishing.hookLeft)+"秒）":
   fishing.casting?"🎣 アタリ待ち… 約"+Math.ceil(Math.max(0,fishing.nextBite-fishing.elapsed))+"秒":
    "釣果 "+fishing.caught+"匹／魚の所持数 "+(actions.resources.fish||0)+
    "匹。甲板または浜辺で仕掛けを投げられます";
 }
 $("play").textContent=running?"⏸ 時間を停止":"▶ 時間を再生";
 $("ground-button").disabled=isSurface&&controller.targetAltitudeM<=12;
 $("walk-note").textContent=renderer.cameraController.mode==="free"?
  "自由視点：スティック/WASDでカメラ移動。画面ドラッグで視線を回転。人物の位置は変わりません。":
  !isSurface?(controller.altitudeM>23000?
   "宇宙視点：惑星をタップして地点を選択し「この地点へ降下」。ダブルタップなら直接降下。":
   "地表へ降下中です。歩行操作は到着後に有効になります。"):
  rtsMode?"RTS：人物・敵・資源は1回タップ、地面はダブルタップで移動指示。2本指で拡大縮小。":
   controlMode==="tap"?"地面をダブルタップで移動。1本指ドラッグで視点回転、2本指で拡大縮小。":
  "スティック/WASDで移動。地面をダブルタップで目的地設定、2本指ピンチで拡大縮小。";
}
function setAltitude(m){
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
$("next-day").addEventListener("click",()=>{planet.advance(1);log("惑星時間を1日進めました。");updateHUD();});
$("next-season").addEventListener("click",()=>{planet.advance(90);log("惑星時間を90日進めました。");updateHUD();});
$("play").addEventListener("click",()=>{
 running=!running;simWorld.clock.paused=!running;updateHUD();
});
$("save").addEventListener("click",()=>{
 try{
  const data={format:"ue/explorer-demo",version:1,
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
        v0_8h:{schemaVersion:1,playerHp:battle.playerHp}};
  localStorage.setItem(SAVE_KEY,JSON.stringify(data));
   saveFaunaJournal();saveFarmJournal();saveMarineJournal();
  log("v0.7i：GLB割当・会話/プレゼント・5枠装備・RTSカメラを保存しました。旧v0.7gのデータは保持。");
 }catch(e){log("保存に失敗: "+e.message);}
});
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
  try{localStorage.removeItem(LIFE_JOURNAL_KEY);localStorage.removeItem(WORLD_JOURNAL_KEY);localStorage.removeItem(STRUCTURES_JOURNAL_KEY);localStorage.removeItem(FAUNA_JOURNAL_KEY);}catch(_){}
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
 $("orbit-landing-preview").hidden=true;
 $("orbit-pick-marker").hidden=true;
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
 orbitSelection={pickedLat:geo.lat,pickedLon:geo.lon,site:null};
 updateOrbitSelection();updateHUD();return true;
}
$("landing-water-mode").addEventListener("change",updateOrbitSelection);
function confirmOrbitLanding(){
 if(!orbitSelection?.site)return;
 try{
  const site=orbitSelection.site;
  // Validate capacity before changing the player's current landing location.
  if(site.mode==="sea-ship"&&marine.boats.length>=64&&
   !marine.nearby({origin:{lat:site.lat,lon:site.lon},x:0,z:0,terrain},14)
     .some(b=>b.kind==="sailing_ship"))
   throw Error("船の上限64隻です。別の船を利用してください");
  marine.boardedId=null;marine.diving=false;marine.depthM=0;marine.oxygen=100;
  controller.setLanding(site.lat,site.lon,{allowWater:site.mode==="sea"||site.mode==="sea-ship"});
  if(site.mode==="sea-ship"){
   const started=marine.spawnLandingShip(controller,terrain);
   if(!started.ok)throw Error(started.message);
  }
  marine.update(0,controller,terrain);
  access.insideId=null;access.pendingDoorId=null;
  squad?.repositionAfterLanding();
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
/** Read-only directory browsing until the player explicitly selects an action. */
function openMapEntry(entry){
 if(entry.source==="animal"){
  const animal=fauna?.get(entry.id);
  if(!animal)return {ok:false,message:"動物が移動したか見つかりません。リストを更新してください"};
  mapDirectoryUI?.close();farmUI?.close();faunaUI?.open(animal.id);
  renderer.mapFocus={x:animal.x,z:animal.z};
  return {ok:true};
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
  if(entry.source==="hut"&&Math.hypot(entry.x-controller.x,entry.z-controller.z)<7){
   mapDirectoryUI?.close();tapDoor(entry.entityId);return {ok:true};
  }
  return {ok:true,message:entry.icon+" "+entry.title+"をマップ上で強調しました。"+
    " 「向かう」から近くへ移動できます（約"+Math.round(entry.distanceM)+"m）"};
 }
 return {ok:false,message:"この対象には操作がありません"};
}
function moveToMapEntry(entry){
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
function handleSceneTap({x,y,shiftKey=false}){
 if(!renderer)return;
 if(controller?.altitudeM>ORBIT_GROUND_CUTOFF_M){
  selectOrbitLanding(x,y);return;
 }
 if(!controller?.nearGround)return;
 if(marine?.cabinId){
  const furniture=renderer.pickMarineFurniture(x,y);
  if(furniture)useShipFurniture(furniture.kind);
  return;
 }
 if(constructionUI?.tap(x,y))return;
 const arrow=renderer.pickArrow(x,y);
 if(arrow){orderArrowPickup(arrow);return;}
 if(frontierUI?.selectTargetAt(x,y)){renderer.selectedResource=null;return;}
 if(rtsMode&&screenActorAt(x,y)){commandRtsTap(x,y,shiftKey);return;}
 const animal=renderer.pickAnimal(x,y);
 if(animal){mapDirectoryUI?.close();farmUI?.close();faunaUI?.open(animal.id);return;}
 const pickedFarm=renderer.pickFarm(x,y);
 if(pickedFarm){mapDirectoryUI?.close();faunaUI?.close();farmUI?.open(pickedFarm.id);return;}
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
function handleSceneDoubleTap({x,y,shiftKey=false}){
 if(!renderer)return;
 if(marine?.cabinId)return; // Leave cabin before ordering ground movement.
 if(controller?.altitudeM>ORBIT_GROUND_CUTOFF_M){
  if(selectOrbitLanding(x,y))confirmOrbitLanding();
  return;
 }
 if(!controller?.nearGround)return;
 if(constructionUI?.kind)return;
 // A double tap orders ground movement even when an animal or building overlaps.
 const ground=renderer.pickGround(x,y);
 if(!ground){log("地面を指定できません。");return;}
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
$("viewport-auto").addEventListener("click",()=>openAutoEditor($("auto-panel").hidden));
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
 if(e.target.closest("#viewport-rts,#viewport-auto,#viewport-books,#viewport-life,#viewport-menu,#viewport-directory"))setQuickMenu(false);
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
 frontierUI=installFrontierInteractions({
 get:()=>({controller,renderer,squad,actions,life,lifeUI,terrain,battle,projectiles,rtsMode,syncMode,
  manualInputActive:Math.abs(stick.x)+Math.abs(stick.y)>.16||["w","a","s","d","ArrowUp","ArrowDown"].some(k=>keys.has(k)||touches.has(k)),
  sample:(lat,lon)=>terrainSurface(terrain,lat,lon)}),
 log,updateHUD,openBookLibrary,saveLifeJournal,
 showSpeech:(id,text)=>worldUI?.speak(id,text),
 showEffect:effect=>worldUI?.float(effect)
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
mapDirectoryUI=installMapDirectoryUI({
 get:()=>({controller,fauna,squad,renderer,constructions,actions}),
 onOpen:openMapEntry,onMove:moveToMapEntry,notify:log
});
$("viewport-directory").addEventListener("click",()=>{
 faunaUI?.close();farmUI?.close();
 $("marine-panel").hidden=true;$("marine-toggle").setAttribute("aria-expanded","false");
});
$("farm-toggle").addEventListener("click",()=>{mapDirectoryUI?.close();faunaUI?.close();$("marine-panel").hidden=true;});
$("fauna-toggle").addEventListener("click",()=>{mapDirectoryUI?.close();farmUI?.close();$("marine-panel").hidden=true;});
window.addEventListener("pagehide",saveFaunaJournal);
window.addEventListener("pagehide",saveFarmJournal);
$("marine-toggle").addEventListener("click",()=>{
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
  if(result.ok){renderer.patchKey=null;saveMarineJournal();saveLifeJournal();}
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
$("marine-cruise").addEventListener("click",()=>shipAction(()=>marine.setCruise(!marine.boarded?.cruise)));
$("marine-anchor").addEventListener("click",()=>shipAction(()=>marine.setAnchor(!marine.boarded?.anchor)));
for(const [id,angle] of [["marine-steer-left",-Math.PI/15],["marine-steer-right",Math.PI/15]]){
 $(id).addEventListener("click",()=>shipAction(()=>marine.steer(angle,controller)));
}
// Living quarters are attached to the moving ship; entering never stops cruise.
$("marine-cabin-toggle").addEventListener("click",()=>{
 const result=marine.cabinId?marine.exitCabin():marine.enterCabin();
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
$("marine-fish-cast").addEventListener("click",()=>shipAction(()=>marine.castLine(controller,terrain)));
$("marine-fish-stop").addEventListener("click",()=>shipAction(()=>marine.stopFishing()));
$("marine-fish-reel").addEventListener("click",()=>{
 const result=marine.reelFish(actions.resources);
 log(result.message);
 if(result.ok){
  worldUI?.float({kind:"gain",text:"🐟 魚 +1",actorId:"player",duration:1.6});
  saveLifeJournal();
  saveMarineJournal();
 }
 updateHUD();
});
window.addEventListener("pagehide",saveMarineJournal);
init();requestAnimationFrame(doFrame);

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
