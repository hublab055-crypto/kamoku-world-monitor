import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import {ShipboardWorld,isShipWalkable,shipLocalToWorld,shipWorldToLocal,
 SHIP_DOOR,SHIP_HELM,deckHalfWidth} from "../planet-explorer/shipboard.mjs";
import {MarineWorld} from "../planet-explorer/marine.mjs";
import {ExplorerController} from "../planet-explorer/controller.mjs";
const makeSea=()=>({planet:{seed:77,radiusM:6371000,gravity:9.8},sample(lat,lon){
 const water=lon>0;return {water,river:false,elevationM:water?0:150,category:water?"ocean":"plain"};
}});
const launch=()=>{
 const t=makeSea(),c=new ExplorerController(t,{startLat:0,startLon:-.03});
 c.setLanding(0,.04,{allowWater:true});
 const m=new MarineWorld();
 assert.ok(m.spawnLandingShip(c,t).ok);
 return {t,c,m,b:m.shipboard};
};
test("landing aboard ship includes scout and artisan, scout steering, player walks separately",()=>{
 const {c,m,b}=launch();
 assert.deepEqual(b.crew.map(a=>a.id),["scout","artisan"]);
 assert.equal(b.shipId,m.boardedId);
 assert.equal(b.helmId,"scout");
 assert.equal(b.canHelm(),true);
 const start={x:c.x,z:c.z,px:b.player.x,pz:b.player.z};
 b.advance(.08,{forward:1});
 assert.notEqual(b.player.z,start.pz,"player walks relative to hull");
 assert.equal(c.x,start.x);assert.equal(c.z,start.z);
 assert.equal(b.crew.find(x=>x.id==="scout").task,"steer");
});
test("deck railing and closed cabin walls prevent walking off moving ship",()=>{
 const board=new ShipboardWorld();board.init("boat-1",["scout","artisan"]);
 assert.equal(isShipWalkable(0,-6.1,"deck"),true);
 assert.equal(isShipWalkable(3,-6.1,"deck"),false);
 assert.equal(isShipWalkable(0,7.7,"deck"),false);
 assert.equal(isShipWalkable(1.6,1.9,"cabin"),true);
 assert.equal(isShipWalkable(1.7,1.9,"cabin"),false);
 board.player.x=deckHalfWidth(-4.2)-.26;board.player.z=-4.2;
 for(let i=0;i<100;i++)board.advance(.1,{strafe:1});
 assert.ok(isShipWalkable(board.player.x,board.player.z,"deck"));
});
test("physical door only opens nearby, and crossing switches between cabin and deck",()=>{
 const board=new ShipboardWorld();board.init("boat-1",["scout"]);
 board.player.x=-1.2;board.player.z=-6.9;
 assert.equal(board.toggleDoor().ok,false);
 board.player.x=0;board.player.z=SHIP_DOOR.deck.z-.5;
 assert.equal(board.passage().ok,false,"closed door blocks passage");
 assert.equal(board.toggleDoor().ok,true);
 assert.equal(board.doorOpen,true);
 assert.equal(board.passage().ok,true);
 assert.equal(board.player.zone,"cabin");
 assert.equal(board.player.z,SHIP_DOOR.cabin.z);
 assert.equal(board.passage().ok,true);
 assert.equal(board.player.zone,"deck");
 assert.equal(board.toggleDoor().ok,true);
 assert.equal(board.doorOpen,false);
});
test("taking the wheel requires walking near it, and other crew then roams freely",()=>{
 const board=new ShipboardWorld();board.init("boat-1",["scout","artisan"]);
 const first=board.assignHelm("player");
 assert.ok(first.ok);assert.equal(first.walking,true);
 assert.equal(board.helmId,"scout","NPC retains helm until player arrives");
 const messages=[];
 for(let i=0;i<300;i++)messages.push(...board.advance(.05,{}));
 assert.equal(board.helmId,"player");
 assert.ok(messages.some(m=>m.includes("舵輪")));
 assert.equal(board.canHelm(),true);
 assert.equal(board.player.x,SHIP_HELM.x);
 assert.equal(board.player.z,SHIP_HELM.z);
 const crew=board.crew.find(x=>x.id==="scout");
 for(let i=0;i<170;i++)board.advance(.05,{});
 assert.ok(crew.task!=="steer");
 assert.ok(board.assignHelm("artisan").ok);
 assert.equal(board.helmId,"artisan");
 assert.equal(board.canHelm(),true);
});
test("talking with a companion requires shared zone and proximity",()=>{
 const board=new ShipboardWorld();board.init("boat-1",["scout","artisan"]);
 const artisan=board.member("artisan");
 board.player.zone=artisan.zone;
 board.player.x=artisan.x+.4;board.player.z=artisan.z+.4;
 const reply=board.talk("artisan","職人");
 assert.equal(reply.ok,true);
 assert.ok(reply.message.includes("職人"));
 assert.ok(reply.speech);
 board.player.zone=board.player.zone==="cabin"?"deck":"cabin";
 assert.equal(board.talk("artisan","職人").ok,false);
});
test("NPCs roam deck/cabin independently, positions and helm recover from save",()=>{
 const board=new ShipboardWorld();board.init("boat-1",["scout","artisan"]);
 board.player.x=.5;board.player.z=-4;
 board.assignHelm("artisan");
 for(let i=0;i<300;i++)board.advance(.07,{});
 const crew=board.crew.find(c=>c.id==="scout");
 assert.ok(crew.zone==="deck"||crew.zone==="cabin");
 const raw=JSON.parse(JSON.stringify(board.snapshot()));
 const copy=new ShipboardWorld(raw);copy.init("boat-1",["scout","artisan"]);
 assert.equal(copy.helmId,"artisan");
 assert.equal(copy.player.x,board.player.x);
 assert.equal(copy.player.z,board.player.z);
 assert.equal(copy.crew.length,2);
 assert.equal(copy.crew.find(c=>c.id==="scout").zone,crew.zone);
});
test("ship relative coordinate transform correctly moves crew with rotated hull",()=>{
 for(const angle of [0,Math.PI/2,Math.PI,Math.PI*1.7]){
  const w=shipLocalToWorld(500,250,angle,1.3,-4.8);
  const p=shipWorldToLocal(500,250,angle,w.x,w.z);
  assert.ok(Math.abs(p.x-1.3)<1e-9);
  assert.ok(Math.abs(p.z+4.8)<1e-9);
 }
});
test("MarineWorld preserves ship crew even after cabin, voyage and save/restore",()=>{
 const {c,t,m,b}=launch();
 assert.ok(b.assignHelm("player").ok);
 for(let i=0;i<260;i++)b.advance(.05,{});
 assert.equal(b.helmId,"player");
 assert.ok(m.setCruise(true).ok);
 b.assignHelm("scout");
 b.player.x=0;b.player.z=-2.75;
 assert.ok(m.enterCabin().ok);
 assert.equal(b.player.zone,"cabin");
 const resumed=new MarineWorld(JSON.parse(JSON.stringify(m.snapshot())));
 assert.equal(resumed.shipboard.helmId,"scout");
 assert.equal(resumed.shipboard.crew.length,2);
 assert.equal(resumed.shipboard.player.zone,"cabin");
 assert.equal(resumed.cabinId,resumed.boardedId);
 assert.ok(resumed.exitCabin().ok);
 assert.equal(resumed.shipboard.player.zone,"deck");
 assert.ok(resumed.leave(c,t).ok);
});
test("app, index and renderer provide operational helm/crew UI with deck-walking surface",()=>{
 const base=new URL("../planet-explorer/",import.meta.url);
 const html=readFileSync(new URL("index.html",base),"utf8");
 const app=readFileSync(new URL("app.mjs",base),"utf8");
 const render=readFileSync(new URL("render.mjs",base),"utf8");
 for(const id of ["marine-crew-controls","marine-helm-member","marine-talk-member",
  "marine-shipboard-status","marine-helm-assign","marine-helm-walk",
  "marine-ship-door","marine-ship-passage","marine-talk"])
  assert.ok(html.includes('id="'+id+'"'),id);
 for(const key of ["marine.shipboard.advance","marine.shipboard.assignHelm",
  "marine.shipboard.talk","renderer.pickShipboardFloor(x,y)"])
  assert.ok(app.includes(key),key);
 assert.ok(render.includes("drawShipboardObjects(vp,light,s,waterY)"));
 assert.ok(render.includes("pickShipboard(clientX,clientY)"));
 assert.ok(render.includes("pickShipboardFloor(clientX,clientY)"));
 assert.ok(render.includes("this.screenShipCrew.push("));
});

test("browser JavaScript modules parse cleanly before Safari loads them",()=>{
 const base=new URL("../planet-explorer/",import.meta.url);
 for(const filename of ["app.mjs","render.mjs","marine.mjs","shipboard.mjs","ship-cabin-geometry.mjs"]){
  const filenameOnDisk=fileURLToPath(new URL(filename,base));
  const p=spawnSync(process.execPath,["--check",filenameOnDisk],{encoding:"utf8"});
  assert.equal(p.status,0,filename+" syntax error: "+p.stderr);
 }
});
