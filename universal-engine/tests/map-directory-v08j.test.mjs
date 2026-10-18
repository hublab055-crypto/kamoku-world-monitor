import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {ViewportGestures} from "../planet-explorer/viewport-gestures.mjs";
import {mapDirectoryEntries,MAP_CATEGORIES,metres} from "../planet-explorer/map-directory.mjs";
import {installMapDirectoryUI} from "../planet-explorer/map-directory-ui.mjs";

const pointer=(id,x,y,type="touch")=>({pointerId:id,clientX:x,clientY:y,pointerType:type});
function clockHarness(){
 let time=0,next=0;const jobs=new Map(),events=[];
 const g=new ViewportGestures({deferTap:true,now:()=>time,
  schedule:(fn,delay)=>{const id=++next;jobs.set(id,{time:time+delay,fn});return id;},
  unschedule:id=>jobs.delete(id),
  onTap:p=>events.push(["single",p.x,p.y]),
  onDoubleTap:p=>events.push(["double",p.x,p.y])});
 function wait(delay){
  time+=delay;
  for(const [id,job]of [...jobs].sort((a,b)=>a[1].time-b[1].time)){
   if(job.time<=time){jobs.delete(id);job.fn();}
  }
 }
 return {g,events,wait,remaining:()=>jobs.size};
}
test("deferred single tap fires after double tap window but never early",()=>{
 const {g,events,wait,remaining}=clockHarness();
 g.down(pointer(1,100,110));g.up(pointer(1,100,110));
 assert.deepEqual(events,[]);assert.equal(remaining(),1);
 wait(319);assert.deepEqual(events,[]);
 wait(1);assert.deepEqual(events,[["single",100,110]]);
});
test("double tap over animal performs only movement, no first-tap modal or other action",()=>{
 const {g,events,wait,remaining}=clockHarness();
 g.down(pointer(1,100,110));g.up(pointer(1,100,110));
 wait(180);
 g.down(pointer(2,103,112));g.up(pointer(2,103,112));
 assert.deepEqual(events,[["double",103,112]]);
 assert.equal(remaining(),0);
 wait(600);assert.deepEqual(events,[["double",103,112]]);
});
test("two separated taps or pointer types are correctly treated as singles",()=>{
 const {g,events,wait}=clockHarness();
 g.down(pointer(1,0,0));g.up(pointer(1,0,0));
 wait(90);
 g.down(pointer(2,90,90));g.up(pointer(2,90,90));
 assert.deepEqual(events,[["single",0,0]]);
 wait(350);assert.deepEqual(events,[["single",0,0],["single",90,90]]);
 g.down(pointer(3,90,90));g.up(pointer(3,90,90));
 wait(100);
 g.down(pointer(4,90,90,"mouse"));g.up(pointer(4,90,90,"mouse"));
 assert.equal(events.length,3);
 wait(350);assert.equal(events.length,4);
 assert.ok(events.every(e=>e[0]==="single"));
});
test("pinch and explicit cancel discard pending selection",()=>{
 const {g,events,wait}=clockHarness();
 g.down(pointer(1,25,30));g.up(pointer(1,25,30));
 g.down(pointer(2,25,30));g.down(pointer(3,130,30));
 g.up(pointer(2,25,30));g.up(pointer(3,130,30));
 wait(500);assert.deepEqual(events,[]);
 g.down(pointer(4,42,55));g.up(pointer(4,42,55));
 g.cancel();wait(500);assert.deepEqual(events,[]);
});
test("camera drag after one quick tap cancels a pending animal selection",()=>{
 const {g,events,wait}=clockHarness();
 g.down(pointer(1,25,30));g.up(pointer(1,25,30));
 wait(70);
 g.down(pointer(2,25,30));g.move(pointer(2,47,41));g.up(pointer(2,47,41));
 wait(420);
 assert.deepEqual(events,[]);
});
const context=()=>({
 controller:{x:0,z:0},
 fauna:{animals:[{id:"h1",kind:"horse",x:15,z:0,tame:true,grazing:true},
  {id:"c1",kind:"cattle",x:80,z:0,tame:false},{id:"h2",kind:"horse",x:600,z:0}]},
 squad:{agents:[{id:"player",name:"開拓者",control:{x:0,z:0}},
   {id:"scout",name:"斥候",auto:true,control:{x:45,z:0}}]},
 renderer:{resourceNodes:[{id:"tree-1",name:"大木",kind:"wood",x:12,z:0},
   {id:"stone-1",name:"大岩",kind:"stone",x:2,z:0},
   {id:"tree-2",name:"倒木",kind:"wood",x:35,z:0,state:"fallen"},
   {id:"far",name:"小石",kind:"stone",x:1500,z:0}]},
 constructions:{structures:[{id:7,kind:"warehouse",x:20,z:5}]},
 actions:{structures:[{id:1,kind:"hut",x:30,z:5,progress:1},
   {id:2,kind:"hut",x:35,z:5,progress:.5}]}
});
test("map index groups buildings, animals, characters and actual harvest nodes",()=>{
 const c=context();
 assert.deepEqual(MAP_CATEGORIES.map(x=>x.id),["buildings","animals","people","resources"]);
 const animals=mapDirectoryEntries(c,{category:"animals",radiusM:100});
 assert.equal(animals.total,2);
 assert.equal(animals.items[0].id,"h1");
 assert.equal(animals.items[0].distanceM,15);
 assert.equal(mapDirectoryEntries(c,{category:"animals",radiusM:30}).total,1);
 assert.equal(mapDirectoryEntries(c,{category:"animals",radiusM:100,search:"オーロックス"}).total,1);
 const people=mapDirectoryEntries(c,{category:"people",radiusM:100});
 assert.deepEqual(people.items.map(x=>x.id),["player","scout"]);
 const buildings=mapDirectoryEntries(c,{category:"buildings",radiusM:100});
 assert.ok(buildings.items.some(x=>x.title==="共同倉庫"));
 assert.ok(buildings.items.some(x=>x.source==="hut"));
 assert.ok(buildings.items.some(x=>x.source==="village"));
 assert.ok(!buildings.items.some(x=>x.id==="hut-2"),"unfinished huts not in the map directory");
 const resources=mapDirectoryEntries(c,{category:"resources",radiusM:100});
 assert.deepEqual(resources.items.map(x=>x.id),["stone-1","tree-1","tree-2"]);
 assert.deepEqual(mapDirectoryEntries(c,{category:"resources",radiusM:100,search:"倒木"}).items.map(x=>x.id),["tree-2"]);
 assert.equal(mapDirectoryEntries(c,{category:"resources",radiusM:100,limit:1}).items.length,1);
 assert.equal(metres(1200),"1.20km");
});
test("published UI wires delayed single tap, object-agnostic ground double tap, and directory opening",()=>{
 assert.equal(typeof installMapDirectoryUI,"function");
 const html=readFileSync(new URL("../planet-explorer/index.html",import.meta.url),"utf8");
 const app=readFileSync(new URL("../planet-explorer/app.mjs",import.meta.url),"utf8");
 const css=readFileSync(new URL("../planet-explorer/style.css",import.meta.url),"utf8");
 const render=readFileSync(new URL("../planet-explorer/render.mjs",import.meta.url),"utf8");
 for(const id of ["viewport-directory","map-directory-panel","map-directory-tabs","map-directory-list",
  "map-directory-status","map-directory-filter","map-directory-radius","map-directory-refresh",
  "map-directory-close"])assert.ok(html.includes('id="'+id+'"'),id);
 for(const cat of MAP_CATEGORIES)assert.ok(html.includes('data-map-category="'+cat.id+'"'),cat.id);
 assert.match(app,/deferTap:true,onTap:handleSceneTap/);
 assert.match(app,/installMapDirectoryUI/);
 assert.match(app,/mapDirectoryUI\?\.open|mapDirectoryUI=installMapDirectoryUI/);
 const doubleHandler=app.slice(app.indexOf("function handleSceneDoubleTap("),
  app.indexOf("constructionUI=new ConstructionPlacement"));
 assert.match(doubleHandler,/pickGround\(x,y\)/);
 assert.doesNotMatch(doubleHandler,/pickAnimal\(|selectTargetAt\(/);
 assert.match(doubleHandler,/commandRtsTap\(x,y,shiftKey,true\)/);
 assert.match(app,/if\(nearest&&!rallyPicking&&!groundOnly\)/);
 assert.match(css,/\.map-directory-panel/);
 assert.match(render,/this\.mapFocus/);
});
