(() => {
"use strict";

const STORAGE_KEY = "frontier-world-creator-suite-v1";
const RELATIONSHIPS = ["acquaintance","companion","friend","lover","family"];
const DIALOGUE_CATEGORIES = ["intro","hello","work","life","proactive"];
const EVENT_CATEGORIES = ["low_stock","danger","crafted_complete","pregnancy","baby_care","wedding","funeral"];

const configs = {
  characters: {
    eyebrow:"PEOPLE", title:"キャラクターエディタ", description:"役割・性格・成長段階・スキル・見た目の参照情報を編集します。",
    fields:[
      f("id","ID","text","","英数字と _ を推奨"), f("name","表示名","text"),
      f("role","役割","text","","gatherer / guard / merchant など"), f("ageStage","成長段階","select","adult","",["baby","child","teen","adult","elder"]),
      f("traits","性格タグ","tags",[],"comma区切り"), f("skills","得意分野","tags",[]),
      f("spriteId","スプライトID","text"), f("homeId","初期住居ID","text"),
      f("notes","設計メモ","textarea","","",null,true)
    ]
  },
  items: {
    eyebrow:"CONTENT", title:"アイテムエディタ", description:"素材・食料・道具・武器・衣服・アクセサリーなどの共通定義です。",
    fields:[
      f("id","ID","text"), f("name","名前","text"), f("category","カテゴリ","select","material","",["material","food","tool","weapon","ammo","clothes","accessory","book","seed","misc"]),
      f("icon","アイコン","text","📦"), f("weight","重量 kg","number",0), f("basePrice","基準価格","number",0),
      f("stackMax","最大スタック","number",99), f("tags","タグ","tags",[]), f("notes","説明 / 効果","textarea","","",null,true)
    ]
  },
  recipes: {
    eyebrow:"CRAFT", title:"制作・料理レシピ", description:"必要素材、完成品、作業台、技能条件を編集します。",
    fields:[
      f("id","ID","text"), f("name","名前","text"), f("category","カテゴリ","select","craft","",["craft","cooking","smithing","tailoring","jewelry"]),
      f("station","設備","text","workbench"), f("duration","制作時間","number",10), f("requiredSkill","必要スキル","text"),
      f("requiredLevel","必要Lv","number",0), f("ingredients","材料 id:個数","pairs",{}), f("outputs","完成品 id:個数","pairs",{}),
      f("notes","品質・ミニゲーム等のメモ","textarea","","",null,true)
    ]
  },
  buildings: {
    eyebrow:"BUILD", title:"建物・家具エディタ", description:"サイズ、入口、衝突、室内設備を定義します。",
    fields:[
      f("id","ID","text"), f("name","名前","text"), f("type","種別","select","building","",["tent","building","castle","wall","furniture","facility"]),
      f("width","幅","number",2), f("height","高さ","number",2), f("entranceX","入口X","number",0),
      f("entranceY","入口Y","number",1), f("collision","衝突あり","checkbox",true), f("indoor","室内あり","checkbox",true),
      f("facilities","設備タグ","tags",[]), f("notes","配置制約 / 用途","textarea","","",null,true)
    ]
  },
  gambits: {
    eyebrow:"AUTOMATION", title:"AI・ガンビットエディタ", description:"条件 → 行動、継続終了値、優先度、割り込み可否をデータ化します。",
    fields:[
      f("id","ID","text"), f("name","表示名","text"), f("condition","開始条件","text","always"),
      f("threshold","開始値","number",0), f("endThreshold","終了値","number",0), f("action","行動","text"),
      f("priority","優先度","number",50), f("radius","行動半径","number",12), f("interruptible","割り込み可","checkbox",true),
      f("notes","条件式 / 対象選択メモ","textarea","","",null,true)
    ]
  },
  schedules: {
    eyebrow:"LIFE AI", title:"個人予定表エディタ", description:"1日を3時間×8ブロックで編集します。操作キャラを外れたNPCの自律生活にも使う設計です。",
    fields:[
      f("id","ID","text"), f("characterId","キャラクターID","text"),
      f("h00","00:00–03:00","select","sleep","",["auto","sleep","housework","bath","laundry","cleaning","leisure"]),
      f("h03","03:00–06:00","select","sleep","",["auto","sleep","housework","bath","laundry","cleaning","leisure"]),
      f("h06","06:00–09:00","select","auto","",["auto","sleep","housework","bath","laundry","cleaning","leisure"]),
      f("h09","09:00–12:00","select","auto","",["auto","sleep","housework","bath","laundry","cleaning","leisure"]),
      f("h12","12:00–15:00","select","auto","",["auto","sleep","housework","bath","laundry","cleaning","leisure"]),
      f("h15","15:00–18:00","select","auto","",["auto","sleep","housework","bath","laundry","cleaning","leisure"]),
      f("h18","18:00–21:00","select","leisure","",["auto","sleep","housework","bath","laundry","cleaning","leisure"]),
      f("h21","21:00–24:00","select","sleep","",["auto","sleep","housework","bath","laundry","cleaning","leisure"]),
      f("notes","生活バランス / 幸福度メモ","textarea","","",null,true)
    ]
  },
  quests: {
    eyebrow:"QUEST", title:"クエストエディタ", description:"受注条件、段階、完了条件、報酬を編集します。",
    fields:[
      f("id","ID","text"), f("name","クエスト名","text"), f("giver","依頼人ID","text"), f("trigger","開始条件","text"),
      f("conditions","受注条件","list",[]), f("steps","進行ステップ","list",[]), f("rewards","報酬","pairs",{}),
      f("repeatable","繰り返し可","checkbox",false), f("notes","演出 / 分岐メモ","textarea","","",null,true)
    ]
  },
  events: {
    eyebrow:"EVENT", title:"イベントエディタ", description:"結婚、出産、成人、葬儀、襲撃などの世界イベントを定義します。",
    fields:[
      f("id","ID","text"), f("name","イベント名","text"), f("type","種類","select","world","",["world","family","ceremony","combat","seasonal","story"]),
      f("trigger","発火条件","text"), f("conditions","追加条件","list",[]), f("steps","処理 / 演出","list",[]),
      f("rewards","結果 / 報酬","pairs",{}), f("repeatable","繰り返し可","checkbox",false), f("notes","メモ","textarea","","",null,true)
    ]
  },
  economy: {
    eyebrow:"ECONOMY", title:"経済・店エディタ", description:"店ごとの在庫、売値・買値、補充量を調整します。",
    fields:[
      f("id","ID","text"), f("name","商品表示名","text"), f("itemId","アイテムID","text"), f("shop","店ID","text","merchant"),
      f("buyPrice","店から買う","number",10), f("sellPrice","店へ売る","number",5), f("stock","在庫","number",10),
      f("restock","日次補充","number",2), f("tags","タグ","tags",[]), f("notes","価格変動条件","textarea","","",null,true)
    ]
  }
};

function f(key,label,type="text",def="",hint="",options=null,wide=false){ return {key,label,type,default:def,hint,options,wide}; }
const deepClone = v => JSON.parse(JSON.stringify(v));

function makeDialogueSkeleton(){
  const relationships = {};
  RELATIONSHIPS.forEach(r => {
    relationships[r] = {};
    DIALOGUE_CATEGORIES.forEach(c => relationships[r][c] = []);
  });
  const characters = {};
  ["mio","riku","guard","merchant"].forEach(id => characters[id] = {relationships:deepClone(relationships)});
  const events = {}; EVENT_CATEGORIES.forEach(k => events[k] = []);
  return {
    pack_version:1, updated_at:new Date().toISOString(), status:"staging_not_runtime_loaded",
    instructions:"Edited with Frontier World Creator Suite.",
    characters, exchanges:[], gift_thanks:{acquaintance:[],companion:[],friend:[],lover:[],family:[]}, events
  };
}

function makeDefaultState(){
  return {
    schema_version:1,
    meta:{project:"Frontier World",editor:"Creator Suite",updated_at:new Date().toISOString()},
    characters:[
      {id:"mio",name:"Mio",role:"gatherer_cook",ageStage:"adult",traits:["kind","practical"],skills:["gathering","cooking"],spriteId:"mio_base",homeId:"",notes:"採集・料理寄り"},
      {id:"riku",name:"Riku",role:"builder_crafter",ageStage:"adult",traits:["steady"],skills:["crafting","building"],spriteId:"",homeId:"",notes:"制作・建築寄り"},
      {id:"guard",name:"Guard",role:"guard",ageStage:"adult",traits:["watchful"],skills:["sword","bow","patrol"],spriteId:"",homeId:"",notes:"警備・訓練"},
      {id:"merchant",name:"Merchant",role:"merchant",ageStage:"adult",traits:["businesslike"],skills:["trade"],spriteId:"",homeId:"",notes:"売買"}
    ],
    sprites:[{id:"mio_base",characterId:"mio",fileName:"",frameW:64,frameH:64,fps:8,animations:{idle:[0,0],walk_down:[0,3],walk_left:[4,7],walk_right:[8,11],walk_up:[12,15]}}],
    items:[
      {id:"wood",name:"木",category:"material",icon:"🪵",weight:3,basePrice:4,stackMax:99,tags:["resource"],notes:""},
      {id:"stone",name:"石",category:"material",icon:"🪨",weight:4,basePrice:5,stackMax:99,tags:["resource"],notes:""},
      {id:"food",name:"食料",category:"food",icon:"🍎",weight:1,basePrice:6,stackMax:99,tags:["resource","edible"],notes:""},
      {id:"water",name:"水",category:"food",icon:"💧",weight:1,basePrice:3,stackMax:99,tags:["resource"],notes:""},
      {id:"fiber",name:"繊維",category:"material",icon:"🧵",weight:.5,basePrice:4,stackMax:99,tags:["resource"],notes:""},
      {id:"fish",name:"魚",category:"food",icon:"🐟",weight:1.2,basePrice:9,stackMax:99,tags:["resource","edible"],notes:""},
      {id:"seed",name:"種",category:"seed",icon:"🌱",weight:.1,basePrice:3,stackMax:99,tags:["farming"],notes:""},
      {id:"fertilizer",name:"肥料",category:"material",icon:"🪴",weight:.8,basePrice:8,stackMax:99,tags:["farming"],notes:""}
    ],
    recipes:[],
    buildings:[
      {id:"tent",name:"テント",type:"tent",width:2,height:2,entranceX:1,entranceY:1,collision:true,indoor:true,facilities:["bed"],notes:"初期の生活拠点"},
      {id:"house",name:"家",type:"building",width:4,height:4,entranceX:2,entranceY:3,collision:true,indoor:true,facilities:["bed","chest","workbench"],notes:""}
    ],
    gambits:[
      {id:"rest_low_stamina",name:"疲れたら休む",condition:"stamina_below",threshold:30,endThreshold:100,action:"rest",priority:90,radius:12,interruptible:true,notes:"ヒステリシス例"},
      {id:"gather_wood",name:"木を集める",condition:"stock_wood_below",threshold:30,endThreshold:60,action:"gather_wood",priority:40,radius:18,interruptible:true,notes:""}
    ],
    schedules:[
      {id:"mio_default",characterId:"mio",h00:"sleep",h03:"sleep",h06:"auto",h09:"auto",h12:"auto",h15:"auto",h18:"housework",h21:"sleep",notes:""}
    ],
    quests:[], events:[],
    economy:[],
    world:{width:40,height:24,placements:[{x:4,y:5,type:"spawn",ref:"player"},{x:10,y:8,type:"building",ref:"tent"},{x:12,y:8,type:"npc",ref:"mio"}]},
    dialogue:null
  };
}

let state = loadState();
let currentGeneric = "characters";
let selectedIndex = {};
let spriteIndex = 0;
let spriteImage = null;
let worldPainting = false;
let saveTimer = null;

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

function normalizeState(raw){
  const base = makeDefaultState();
  const out = {...base,...raw};
  ["characters","sprites","items","recipes","buildings","gambits","schedules","quests","events","economy"].forEach(k => {
    if(!Array.isArray(out[k])) out[k] = base[k];
  });
  if(!out.world || typeof out.world !== "object") out.world = base.world;
  if(!Array.isArray(out.world.placements)) out.world.placements = [];
  out.world.width = clampInt(out.world.width,8,120,40);
  out.world.height = clampInt(out.world.height,8,120,24);
  if(!out.meta) out.meta = base.meta;
  return out;
}

function loadState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? normalizeState(JSON.parse(raw)) : makeDefaultState();
  }catch(e){ console.warn(e); return makeDefaultState(); }
}

function touch(){
  state.meta.updated_at = new Date().toISOString();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try{
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      $("#saveStatus").textContent = "localStorage 保存済み " + new Date().toLocaleTimeString();
    }catch(e){
      $("#saveStatus").textContent = "保存失敗: " + e.message;
    }
  },120);
  updateStats();
}

function toast(msg){
  const el=$("#toast"); el.textContent=msg; el.classList.add("show");
  clearTimeout(toast.t); toast.t=setTimeout(()=>el.classList.remove("show"),1800);
}

function clampInt(v,min,max,fallback){ const n=parseInt(v,10); return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback; }
function esc(v){ return String(v??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[ch])); }
function slug(s){ return String(s||"").trim().toLowerCase().replace(/\s+/g,"_").replace(/[^a-z0-9_\-]/g,""); }

function showView(name){
  $$(".view").forEach(v=>v.classList.remove("active"));
  $$(".nav").forEach(n=>n.classList.toggle("active",n.dataset.view===name));
  if(configs[name]){
    currentGeneric=name;
    $("#view-generic").classList.add("active");
    renderGeneric();
  }else{
    const v=$("#view-"+name); if(v) v.classList.add("active");
    if(name==="dashboard") renderDashboard();
    if(name==="sprites") renderSprites();
    if(name==="dialogue") renderDialogue();
    if(name==="world") renderWorld();
    if(name==="validate") refreshJson();
  }
}
$$(".nav").forEach(n=>n.addEventListener("click",()=>showView(n.dataset.view)));

function renderDashboard(){
  const stats=[
    ["🧑","キャラクター",state.characters.length],["🎒","アイテム",state.items.length],["🛠️","レシピ",state.recipes.length],["🏠","建物・家具",state.buildings.length],
    ["🤖","ガンビット",state.gambits.length],["🕒","予定表",state.schedules.length],["📜","クエスト",state.quests.length],["🗺️","配置物",state.world.placements.length]
  ];
  $("#dashboardCards").innerHTML=stats.map(x=>'<div class="card"><div>'+x[0]+' '+esc(x[1])+'</div><div class="count">'+x[2]+'</div><small>records</small></div>').join("");
}

function updateStats(){
  $("#projectStats").textContent = "characters "+state.characters.length+" / items "+state.items.length+" / world "+state.world.placements.length;
}

function newEntity(config){
  const o={};
  config.fields.forEach(field=>o[field.key]=deepClone(field.default));
  o.id = "new_" + Date.now().toString(36);
  if("name" in o) o.name="新規";
  return o;
}

function renderGeneric(){
  const cfg=configs[currentGeneric], arr=state[currentGeneric];
  $("#genericEyebrow").textContent=cfg.eyebrow;
  $("#genericTitle").textContent=cfg.title;
  $("#genericDescription").textContent=cfg.description;
  if(selectedIndex[currentGeneric] == null) selectedIndex[currentGeneric]=0;
  if(arr.length===0) selectedIndex[currentGeneric]=-1;
  if(selectedIndex[currentGeneric]>=arr.length) selectedIndex[currentGeneric]=arr.length-1;
  renderEntityList();
  renderEntityForm();
}

function renderEntityList(){
  const arr=state[currentGeneric], q=($("#entitySearch").value||"").toLowerCase();
  const idx=selectedIndex[currentGeneric];
  $("#entityList").innerHTML = arr.map((o,i)=>({o,i})).filter(({o})=>{
    const hay=(String(o.id||"")+" "+String(o.name||"")+" "+String(o.role||"")+" "+String(o.category||"")).toLowerCase();
    return hay.includes(q);
  }).map(({o,i})=>'<button class="entity-row '+(i===idx?"active":"")+'" data-i="'+i+'"><span><b>'+esc(o.name||o.id||("(record "+(i+1)+")"))+'</b><br><small>'+esc(o.id||"")+'</small></span><small>#'+(i+1)+'</small></button>').join("") || '<p class="hint">レコードがありません。</p>';
  $$("#entityList .entity-row").forEach(btn=>btn.onclick=()=>{selectedIndex[currentGeneric]=+btn.dataset.i;renderEntityList();renderEntityForm();});
}

function renderEntityForm(){
  const cfg=configs[currentGeneric], arr=state[currentGeneric], idx=selectedIndex[currentGeneric], form=$("#entityForm");
  form.innerHTML="";
  if(idx<0 || !arr[idx]){ form.innerHTML='<p class="hint">「＋ 追加」で新しいデータを作成できます。</p>'; return; }
  const obj=arr[idx];
  cfg.fields.forEach(field=>{
    const label=document.createElement("label");
    label.className="field"+(field.wide?" wide":"");
    const cap=document.createElement("span"); cap.textContent=field.label; label.appendChild(cap);
    let input;
    if(field.type==="textarea" || field.type==="pairs" || field.type==="list"){
      input=document.createElement("textarea"); input.rows=field.type==="textarea"?5:4;
      input.value = field.type==="pairs" ? pairsToText(obj[field.key]) : field.type==="list" ? (Array.isArray(obj[field.key])?obj[field.key].join("\n"):"") : (obj[field.key]??"");
    }else if(field.type==="select"){
      input=document.createElement("select");
      (field.options||[]).forEach(op=>{const option=document.createElement("option");option.value=op;option.textContent=op;input.appendChild(option);});
      input.value=obj[field.key]??field.default;
    }else if(field.type==="checkbox"){
      label.className="checkbox"+(field.wide?" wide":""); input=document.createElement("input"); input.type="checkbox"; input.checked=!!obj[field.key];
      label.insertBefore(input,cap); cap.textContent=field.label;
    }else{
      input=document.createElement("input"); input.type=field.type==="number"?"number":"text";
      if(field.type==="number") input.step="any";
      input.value=field.type==="tags" ? (Array.isArray(obj[field.key])?obj[field.key].join(", "):"") : (obj[field.key]??"");
    }
    input.dataset.key=field.key; input.dataset.type=field.type;
    input.addEventListener("input",onGenericInput); input.addEventListener("change",onGenericInput);
    label.appendChild(input);
    if(field.hint){ const hint=document.createElement("small"); hint.className="hint"; hint.textContent=field.hint; label.appendChild(hint); }
    form.appendChild(label);
  });
}

function onGenericInput(e){
  const obj=state[currentGeneric][selectedIndex[currentGeneric]], key=e.target.dataset.key, type=e.target.dataset.type;
  let val;
  if(type==="checkbox") val=e.target.checked;
  else if(type==="number") val=Number(e.target.value||0);
  else if(type==="tags") val=e.target.value.split(",").map(s=>s.trim()).filter(Boolean);
  else if(type==="pairs") val=textToPairs(e.target.value);
  else if(type==="list") val=e.target.value.split("\n").map(s=>s.trim()).filter(Boolean);
  else val=e.target.value;
  obj[key]=val; touch(); renderEntityList();
}
function pairsToText(v){ return v && typeof v==="object" ? Object.entries(v).map(([k,n])=>k+":"+n).join("\n") : ""; }
function textToPairs(text){
  const o={}; String(text||"").split(/\n+/).forEach(line=>{const m=line.trim().match(/^([^:]+):\s*(.+)$/); if(m)o[m[1].trim()]=Number.isNaN(Number(m[2]))?m[2].trim():Number(m[2]);}); return o;
}

$("#entitySearch").addEventListener("input",renderEntityList);
$("#btnAddEntity").onclick=()=>{const arr=state[currentGeneric];arr.push(newEntity(configs[currentGeneric]));selectedIndex[currentGeneric]=arr.length-1;touch();renderGeneric();};
$("#btnDuplicateEntity").onclick=()=>{const arr=state[currentGeneric],i=selectedIndex[currentGeneric];if(i<0||!arr[i])return;const copy=deepClone(arr[i]);copy.id=(copy.id||"item")+"_copy";if(copy.name)copy.name+=" コピー";arr.splice(i+1,0,copy);selectedIndex[currentGeneric]=i+1;touch();renderGeneric();};
$("#btnDeleteEntity").onclick=()=>{const arr=state[currentGeneric],i=selectedIndex[currentGeneric];if(i<0||!arr[i])return;if(!confirm("このレコードを削除しますか？"))return;arr.splice(i,1);selectedIndex[currentGeneric]=Math.min(i,arr.length-1);touch();renderGeneric();};

function renderSprites(){
  if(!state.sprites.length) state.sprites.push({id:"sprite_"+Date.now().toString(36),characterId:"",fileName:"",frameW:64,frameH:64,fps:8,animations:{}});
  spriteIndex=Math.max(0,Math.min(spriteIndex,state.sprites.length-1));
  const sel=$("#spriteSelect");
  sel.innerHTML=state.sprites.map((s,i)=>'<option value="'+i+'">'+esc(s.id||("sprite_"+i))+'</option>').join("");
  sel.value=String(spriteIndex);
  const s=state.sprites[spriteIndex];
  $("#spriteCharacter").value=s.characterId||"";
  $("#spriteFileName").value=s.fileName||"";
  $("#spriteFrameW").value=s.frameW||64; $("#spriteFrameH").value=s.frameH||64; $("#spriteFps").value=s.fps||8;
  $("#spriteAnimations").value=Object.entries(s.animations||{}).map(([k,v])=>k+"="+(Array.isArray(v)?v.join("-"):v)).join("\n");
  drawSprite();
}
$("#spriteSelect").onchange=e=>{spriteIndex=+e.target.value;spriteImage=null;renderSprites();};
$("#btnAddSprite").onclick=()=>{state.sprites.push({id:"sprite_"+Date.now().toString(36),characterId:"",fileName:"",frameW:64,frameH:64,fps:8,animations:{idle:[0,0]}});spriteIndex=state.sprites.length-1;touch();renderSprites();};
["spriteCharacter","spriteFileName","spriteFrameW","spriteFrameH","spriteFps","spriteAnimations"].forEach(id=>{
  $("#"+id).addEventListener("input",()=>{
    const s=state.sprites[spriteIndex];
    s.characterId=$("#spriteCharacter").value;
    s.fileName=$("#spriteFileName").value;
    s.frameW=Math.max(1,Number($("#spriteFrameW").value||1));
    s.frameH=Math.max(1,Number($("#spriteFrameH").value||1));
    s.fps=Math.max(1,Number($("#spriteFps").value||1));
    const anim={}; $("#spriteAnimations").value.split(/\n+/).forEach(line=>{const m=line.trim().match(/^([^=]+)=\s*(\d+)\s*-\s*(\d+)$/);if(m)anim[m[1].trim()]=[+m[2],+m[3]];}); s.animations=anim;
    touch(); drawSprite();
  });
});
$("#spriteImageInput").onchange=e=>{
  const file=e.target.files[0]; if(!file)return;
  state.sprites[spriteIndex].fileName=file.name; $("#spriteFileName").value=file.name; touch();
  const img=new Image(); img.onload=()=>{spriteImage=img;drawSprite();}; img.src=URL.createObjectURL(file);
};
function drawSprite(){
  const c=$("#spriteCanvas"),ctx=c.getContext("2d");ctx.clearRect(0,0,c.width,c.height);
  if(!spriteImage){ctx.fillStyle="#a9b29d";ctx.font="16px system-ui";ctx.fillText("PNGを選択するとフレーム境界を確認できます",24,36);return;}
  const pad=20,scale=Math.min((c.width-pad*2)/spriteImage.width,(c.height-pad*2)/spriteImage.height,4);
  const dw=spriteImage.width*scale,dh=spriteImage.height*scale,ox=(c.width-dw)/2,oy=(c.height-dh)/2;
  ctx.imageSmoothingEnabled=false;ctx.drawImage(spriteImage,ox,oy,dw,dh);
  const s=state.sprites[spriteIndex],fw=s.frameW*scale,fh=s.frameH*scale;
  ctx.strokeStyle="rgba(158,211,106,.85)";ctx.lineWidth=1;
  for(let x=0;x<=dw+.1;x+=fw){ctx.beginPath();ctx.moveTo(ox+x,oy);ctx.lineTo(ox+x,oy+dh);ctx.stroke();}
  for(let y=0;y<=dh+.1;y+=fh){ctx.beginPath();ctx.moveTo(ox,oy+y);ctx.lineTo(ox+dw,oy+y);ctx.stroke();}
}

async function loadDialogueFromRepo(){
  try{
    const res=await fetch("../data/dialogue-pack.json",{cache:"no-store"});
    if(!res.ok) throw new Error("HTTP "+res.status);
    state.dialogue=await res.json(); touch(); renderDialogue(); toast("既存 dialogue-pack.json を読み込みました");
  }catch(e){ toast("会話読込に失敗: "+e.message); }
}
$("#btnLoadDialogue").onclick=loadDialogueFromRepo;
function ensureDialogue(){ if(!state.dialogue) state.dialogue=makeDialogueSkeleton(); return state.dialogue; }

function renderDialogue(){
  const d=ensureDialogue();
  const charSel=$("#dlgCharacter");
  const charIds=Object.keys(d.characters||{});
  if(!charIds.length){ d.characters={mio:{relationships:{}}}; }
  const ids=Object.keys(d.characters);
  const oldChar=charSel.value && ids.includes(charSel.value)?charSel.value:ids[0];
  charSel.innerHTML=ids.map(id=>'<option value="'+esc(id)+'">'+esc(id)+'</option>').join(""); charSel.value=oldChar;
  $("#dlgRelationship").innerHTML=RELATIONSHIPS.map(x=>'<option>'+x+'</option>').join("");
  $("#dlgCategory").innerHTML=DIALOGUE_CATEGORIES.map(x=>'<option>'+x+'</option>').join("");
  $("#dlgEvent").innerHTML=EVENT_CATEGORIES.map(x=>'<option>'+x+'</option>').join("");
  ensureDialoguePath(charSel.value,$("#dlgRelationship").value||"acquaintance");
  renderDialogueLines(); renderEventDialogueLines();
}
function ensureDialoguePath(charId,rel){
  const d=ensureDialogue(); d.characters=d.characters||{};d.characters[charId]=d.characters[charId]||{relationships:{}};
  d.characters[charId].relationships=d.characters[charId].relationships||{};d.characters[charId].relationships[rel]=d.characters[charId].relationships[rel]||{};
  DIALOGUE_CATEGORIES.forEach(c=>{if(!Array.isArray(d.characters[charId].relationships[rel][c]))d.characters[charId].relationships[rel][c]=[];});
  d.events=d.events||{};EVENT_CATEGORIES.forEach(k=>{if(!Array.isArray(d.events[k]))d.events[k]=[];});
}
["dlgCharacter","dlgRelationship","dlgCategory"].forEach(id=>$("#"+id).onchange=()=>{ensureDialoguePath($("#dlgCharacter").value,$("#dlgRelationship").value);renderDialogueLines();});
$("#dlgEvent").onchange=renderEventDialogueLines;
function currentDialogueArray(){
  const c=$("#dlgCharacter").value,r=$("#dlgRelationship").value,k=$("#dlgCategory").value;ensureDialoguePath(c,r);return state.dialogue.characters[c].relationships[r][k];
}
function renderDialogueLines(){
  const arr=currentDialogueArray();
  $("#dialogueLines").innerHTML=arr.map((line,i)=>'<div class="panel dialogue-line"><span class="num">'+(i+1)+'</span><textarea data-i="'+i+'">'+esc(line)+'</textarea><button class="danger" data-del="'+i+'">×</button></div>').join("") || '<div class="panel"><p class="hint">このカテゴリにはまだセリフがありません。</p></div>';
  $$("#dialogueLines textarea").forEach(t=>t.oninput=()=>{arr[+t.dataset.i]=t.value;touch();});
  $$("#dialogueLines [data-del]").forEach(b=>b.onclick=()=>{arr.splice(+b.dataset.del,1);touch();renderDialogueLines();});
}
$("#btnDialogueAdd").onclick=()=>{const arr=currentDialogueArray();arr.push("");touch();renderDialogueLines();const all=$$("#dialogueLines textarea");if(all.length)all[all.length-1].focus();};
function renderEventDialogueLines(){
  ensureDialogue(); const key=$("#dlgEvent").value||EVENT_CATEGORIES[0]; if(!Array.isArray(state.dialogue.events[key]))state.dialogue.events[key]=[]; const arr=state.dialogue.events[key];
  $("#eventDialogueLines").innerHTML=arr.map((line,i)=>'<div class="dialogue-line"><span class="num">'+(i+1)+'</span><textarea data-i="'+i+'">'+esc(line)+'</textarea><button class="danger" data-del="'+i+'">×</button></div>').join("") || '<p class="hint">まだありません。</p>';
  $$("#eventDialogueLines textarea").forEach(t=>t.oninput=()=>{arr[+t.dataset.i]=t.value;touch();});
  $$("#eventDialogueLines [data-del]").forEach(b=>b.onclick=()=>{arr.splice(+b.dataset.del,1);touch();renderEventDialogueLines();});
}
$("#btnEventLineAdd").onclick=()=>{const key=$("#dlgEvent").value;state.dialogue.events[key].push("");touch();renderEventDialogueLines();};
$("#btnDialogueExport").onclick=()=>{const d=deepClone(ensureDialogue());d.pack_version=(Number(d.pack_version)||0)+1;d.updated_at=new Date().toISOString();downloadJson("dialogue-pack.json",d);toast("dialogue-pack.json を書き出しました");};

const worldIcons={water:"💧",tree:"🌲",stone:"🪨",food:"🍎",building:"🏠",npc:"🧑",enemy:"👹",spawn:"⭐"};
function renderWorld(){
  $("#worldWidth").value=state.world.width;$("#worldHeight").value=state.world.height;drawWorld();
}
$("#btnResizeWorld").onclick=()=>{state.world.width=clampInt($("#worldWidth").value,8,120,40);state.world.height=clampInt($("#worldHeight").value,8,120,24);state.world.placements=state.world.placements.filter(p=>p.x<state.world.width&&p.y<state.world.height);touch();drawWorld();};
$("#btnWorldClear").onclick=()=>{if(confirm("ワールド配置を全消去しますか？")){state.world.placements=[];touch();drawWorld();}};
const wc=$("#worldCanvas");
wc.addEventListener("contextmenu",e=>{e.preventDefault();paintWorld(e,true);});
wc.addEventListener("mousedown",e=>{worldPainting=true;paintWorld(e,e.button===2);});
wc.addEventListener("mousemove",e=>{if(worldPainting)paintWorld(e,e.buttons===2);});
window.addEventListener("mouseup",()=>worldPainting=false);
function worldCell(e){
  const rect=wc.getBoundingClientRect(),sx=wc.width/rect.width,sy=wc.height/rect.height,cell=24;
  return {x:Math.floor((e.clientX-rect.left)*sx/cell),y:Math.floor((e.clientY-rect.top)*sy/cell)};
}
function paintWorld(e,forceErase=false){
  const {x,y}=worldCell(e); if(x<0||y<0||x>=state.world.width||y>=state.world.height)return;
  const tool=forceErase?"erase":$("#worldTool").value;
  state.world.placements=state.world.placements.filter(p=>!(p.x===x&&p.y===y));
  if(tool!=="erase"&&tool!=="grass") state.world.placements.push({x,y,type:tool,ref:$("#worldRef").value.trim()});
  $("#worldSelection").textContent="選択: x="+x+" y="+y+" / "+tool+(($("#worldRef").value||"")?" / "+$("#worldRef").value:"");
  touch();drawWorld();
}
function drawWorld(){
  const cell=24,c=wc,ctx=c.getContext("2d");c.width=state.world.width*cell;c.height=state.world.height*cell;
  ctx.fillStyle="#1a2117";ctx.fillRect(0,0,c.width,c.height);
  ctx.strokeStyle="#2a3325";ctx.lineWidth=1;
  for(let x=0;x<=state.world.width;x++){ctx.beginPath();ctx.moveTo(x*cell,0);ctx.lineTo(x*cell,c.height);ctx.stroke();}
  for(let y=0;y<=state.world.height;y++){ctx.beginPath();ctx.moveTo(0,y*cell);ctx.lineTo(c.width,y*cell);ctx.stroke();}
  ctx.textAlign="center";ctx.textBaseline="middle";ctx.font="17px system-ui";
  state.world.placements.forEach(p=>{if(p.x<0||p.y<0||p.x>=state.world.width||p.y>=state.world.height)return;ctx.fillText(worldIcons[p.type]||"•",p.x*cell+cell/2,p.y*cell+cell/2);});
}

function validate(){
  const issues=[];
  const collections=["characters","sprites","items","recipes","buildings","gambits","schedules","quests","events","economy"];
  collections.forEach(k=>{
    const ids=new Map();
    state[k].forEach((o,i)=>{
      if(!o.id) issues.push({level:"err",text:k+" #"+(i+1)+" にIDがありません"});
      else if(ids.has(o.id)) issues.push({level:"err",text:k+" のID重複: "+o.id});
      else ids.set(o.id,i);
    });
  });
  const itemIds=new Set(state.items.map(x=>x.id)),charIds=new Set(state.characters.map(x=>x.id)),buildingIds=new Set(state.buildings.map(x=>x.id));
  state.recipes.forEach(r=>{
    Object.keys(r.ingredients||{}).forEach(id=>{if(!itemIds.has(id))issues.push({level:"warn",text:"recipe "+r.id+" の材料参照が未定義: "+id});});
    Object.keys(r.outputs||{}).forEach(id=>{if(!itemIds.has(id))issues.push({level:"warn",text:"recipe "+r.id+" の完成品参照が未定義: "+id});});
  });
  state.sprites.forEach(s=>{if(s.characterId&&!charIds.has(s.characterId))issues.push({level:"warn",text:"sprite "+s.id+" のcharacterIdが未定義: "+s.characterId});});
  state.schedules.forEach(s=>{if(s.characterId&&!charIds.has(s.characterId))issues.push({level:"warn",text:"schedule "+s.id+" のcharacterIdが未定義: "+s.characterId});});
  state.world.placements.forEach((p,i)=>{
    if(p.type==="npc"&&p.ref&&!charIds.has(p.ref))issues.push({level:"warn",text:"world #"+(i+1)+" のNPC参照が未定義: "+p.ref});
    if(p.type==="building"&&p.ref&&!buildingIds.has(p.ref))issues.push({level:"warn",text:"world #"+(i+1)+" の建物参照が未定義: "+p.ref});
  });
  if(!issues.length) issues.push({level:"ok",text:"重大な整合性エラーは見つかりませんでした。"});
  return issues;
}
function refreshJson(){
  $("#jsonEditor").value=JSON.stringify(state,null,2);
  const issues=validate();
  $("#validationResults").innerHTML=issues.map(x=>'<div class="'+x.level+'">'+esc(x.text)+'</div>').join("");
}
$("#btnValidate").onclick=()=>{refreshJson();toast("検証しました");};
$("#btnApplyJson").onclick=()=>{try{state=normalizeState(JSON.parse($("#jsonEditor").value));touch();renderDashboard();refreshJson();toast("JSONを適用しました");}catch(e){toast("JSONエラー: "+e.message);}};
function downloadJson(name,obj){
  const blob=new Blob([JSON.stringify(obj,null,2)],{type:"application/json"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},1000);
}
$("#btnExport").onclick=()=>{downloadJson("frontier-world-content.json",state);toast("プロジェクトJSONを書き出しました");};
$("#btnImport").onclick=()=>$("#fileImport").click();
$("#fileImport").onchange=async e=>{
  const file=e.target.files[0];if(!file)return;
  try{state=normalizeState(JSON.parse(await file.text()));touch();showView("dashboard");toast("プロジェクトを読み込みました");}catch(err){toast("読込失敗: "+err.message);}
  e.target.value="";
};

updateStats();
showView("dashboard");
if(!state.dialogue) loadDialogueFromRepo();
})();