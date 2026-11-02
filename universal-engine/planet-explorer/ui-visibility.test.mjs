import test from "node:test";
import assert from "node:assert/strict";
import {UI_VISIBILITY_STORAGE_KEY,parseUiVisibility,installUiVisibility} from "./ui-visibility.mjs";

test("invalid stored preferences fail safely and only false flags survive",()=>{
 assert.deepEqual(parseUiVisibility("not JSON"),{});
 assert.deepEqual(parseUiVisibility("[]"),{});
 assert.deepEqual(parseUiVisibility('{"stick-area":false,"abc":true,"other":"false","bad key":false}'),{"stick-area":false});
});

class Element{
 constructor(id=""){
  this.id=id;this.hidden=false;this.children=[];this.attrs={};this.listeners={};
  this.dataset={};this.textContent="";this.isConnected=true;
 }
 getAttribute(key){return this.attrs[key]??null;}
 setAttribute(key,value){this.attrs[key]=String(value);}
 removeAttribute(key){delete this.attrs[key];}
 addEventListener(event,fn){(this.listeners[event]??=[]).push(fn);}
 emit(event){for(const fn of this.listeners[event]??[])fn({target:this});}
 click(){this.emit("click");}
 focus(){this.focused=true;}
 closest(){return null;}
 querySelector(){return null;}
 append(...items){this.children.push(...items);}
 replaceChildren(...items){this.children=[...items];}
}
function fixture(initial=null){
 const ids=new Map();
 for(const name of ["ui-display-panel","ui-display-list","ui-display-access","ui-display-close",
  "ui-display-all-show","ui-display-all-hide","ui-display-reset","stick-area",
  "mobile-action-buttons","viewport-quick-toggle","viewport-quick-panel"]){
  ids.set(name,new Element(name));
 }
 ids.get("ui-display-panel").hidden=true;
 ids.get("viewport-quick-panel").hidden=true;
 const canvas=new Element("canvas-wrap");
 const world=new Element("world");world.setAttribute("aria-hidden","true");
 canvas.children.push(world,ids.get("stick-area"),ids.get("mobile-action-buttons"));
 const saved=new Map(initial==null?[]:[[UI_VISIBILITY_STORAGE_KEY,JSON.stringify(initial)]]);
 const store={
  getItem:key=>saved.get(key)??null,
  setItem:(key,val)=>saved.set(key,val),
  removeItem:key=>saved.delete(key)
 };
 const doc={
  defaultView:{addEventListener(){},removeEventListener(){},
   MutationObserver:class{observe(){} disconnect(){}}},
  getElementById:key=>ids.get(key)??null,
  querySelector:sel=>sel===".canvas-wrap"?canvas:null,
  querySelectorAll:()=>[],
  createElement:()=>new Element(),
  createTextNode:text=>({textContent:text})
 };
 return {doc,ids,canvas,store,saved};
}

test("toggles persist independently of the runtime hidden flag",()=>{
 const f=fixture();
 const controls=installUiVisibility({doc:f.doc,store:f.store});
 const stick=f.ids.get("stick-area"),mobile=f.ids.get("mobile-action-buttons");
 mobile.hidden=true;
 controls.setVisible("stick-area",false);
 controls.setVisible("mobile-action-buttons",false);
 assert.equal(stick.getAttribute("data-ui-user-hidden"),"true");
 assert.equal(mobile.hidden,true);
 assert.equal(JSON.parse(f.saved.get(UI_VISIBILITY_STORAGE_KEY))["stick-area"],false);
 controls.setVisible("mobile-action-buttons",true);
 assert.equal(mobile.getAttribute("data-ui-user-hidden"),null);
 assert.equal(mobile.hidden,true,"visibility preference must not force hidden runtime controls on");
 const restored=installUiVisibility({doc:f.doc,store:f.store});
 assert.equal(restored.getVisible("stick-area"),false);
 assert.equal(stick.getAttribute("data-ui-user-hidden"),"true");
 controls.destroy();restored.destroy();
});

test("hide all retains a recovery control; show all and reset restore defaults",()=>{
 const f=fixture();
 const controls=installUiVisibility({doc:f.doc,store:f.store});
 f.ids.get("ui-display-all-hide").click();
 assert.equal(f.ids.get("stick-area").getAttribute("data-ui-user-hidden"),"true");
 assert.equal(f.ids.get("ui-display-access").getAttribute("data-ui-user-hidden"),null);
 assert.equal(f.ids.get("ui-display-panel").getAttribute("data-ui-user-hidden"),null);
 f.ids.get("ui-display-access").click();
 assert.equal(f.ids.get("ui-display-panel").hidden,false);
 f.ids.get("ui-display-all-show").click();
 assert.equal(f.ids.get("stick-area").getAttribute("data-ui-user-hidden"),null);
 controls.setVisible("stick-area",false);
 f.ids.get("ui-display-reset").click();
 assert.equal(f.saved.has(UI_VISIBILITY_STORAGE_KEY),false);
 assert.equal(controls.getVisible("stick-area"),true);
 controls.destroy();
});

test("newly added viewport panels can be discovered and controlled",()=>{
 const f=fixture();
 const controls=installUiVisibility({doc:f.doc,store:f.store});
 const futurePanel=new Element("future-ui-panel");
 futurePanel.setAttribute("aria-label","Future feature");
 f.canvas.children.push(futurePanel);
 controls.refresh();
 controls.setVisible("future-ui-panel",false);
 assert.equal(futurePanel.getAttribute("data-ui-user-hidden"),"true");
 controls.destroy();
});
