import test from "node:test";
import assert from "node:assert/strict";
import {ConstructionSystem} from "../planet-explorer/construction-system.mjs";
import {ConstructionPlacement} from "../planet-explorer/construction-ui.mjs";
function element(value=""){
 const handlers={};return {value,hidden:false,textContent:"",pressed:false,
   handlers,addEventListener:(type,fn)=>{handlers[type]=fn;},
   setAttribute:(name,value)=>{if(name==="aria-pressed")this.pressed=value;}};
}
function harness(rtsMode=false){
 const canvas=element(),toggle=element(),cancel=element(),status=element(),kindSelect=element("stone-wall");
 const scene=new ConstructionSystem(),materials={wood:100,stone:150,metal:20},messages=[];
 const ui=new ConstructionPlacement({canvas,system:scene,kindSelect,toggle,cancel,status,
  rts:()=>rtsMode,pick:(x,y)=>({x,z:y}),
  surface:(x,z)=>({elevationM:300,lat:25+x*.0001,lon:40+z*.0001}),
  resources:()=>materials,existing:()=>[],commit:()=>messages.push("saved"),log:msg=>messages.push(msg)});
 return {ui,scene,materials,canvas,toggle,cancel,status,kindSelect,messages};
}
test("TPV taps place one 2m stone wall and spend the existing craft stones",()=>{
 const t=harness();
 t.toggle.handlers.click();
 assert.equal(t.ui.kind,"stone-wall");
 assert.equal(t.ui.tap(3,4),true);
 assert.equal(t.scene.structures.length,1);
 assert.equal(t.materials.stone,148);
 assert.ok(t.messages.includes("saved"));
 t.cancel.handlers.click();
 assert.equal(t.ui.tap(20,10),false);
});
test("RTS drag gesture places multiple wall units along a chosen line",()=>{
 const t=harness(true);t.ui.setKind("stone-wall");
 t.canvas.handlers.pointerdown({pointerId:1,clientX:10,clientY:30});
 assert.equal(t.ui.dragging(),true);
 t.canvas.handlers.pointerup({pointerId:1,clientX:30,clientY:30});
 assert.equal(t.scene.structures.length,10);
 assert.equal(t.materials.stone,130);
 assert.equal(t.ui.dragging(),false);
 assert.ok(t.scene.structures.every(s=>s.kind==="stone-wall"));
});
test("specialty shops and warehouses use one point in either UI mode",()=>{
 const t=harness(true);
 t.kindSelect.value="warehouse";t.toggle.handlers.click();
 assert.equal(t.ui.tap(10,20),true);
 assert.equal(t.scene.structures[0].kind,"warehouse");
 assert.equal(t.materials.wood,86);
 assert.equal(t.materials.stone,141);
});
