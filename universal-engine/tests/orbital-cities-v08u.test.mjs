import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {projectOrbitalCities} from "../planet-explorer/orbital-city-markers.mjs";
import {installOrbitalCitiesUI} from "../planet-explorer/orbital-cities-ui.mjs";
import {perspective,lookAt,multiply4} from "../planet-explorer/render.mjs";
import {DESTINATIONS} from "../planet-explorer/settlements.mjs";

const vp=()=>multiply4(perspective(53*Math.PI/180,1.6,20,6000),
 lookAt([0,0,1800],[0,0,0]));
test("globe pins use actual projected coordinates and exclude rear hemisphere",()=>{
 const entries=[
  {id:"front",lat:0,lon:90},{id:"rear",lat:0,lon:-90},
  {id:"edge",lat:0,lon:0},{id:"north",lat:80,lon:90}
 ];
 const result=projectOrbitalCities(entries,{
  viewProjection:vp(),camera:[0,0,1800],radius:600});
 assert.equal(result.length,4);
 assert.equal(result[0].id,"front");
 assert.equal(result[0].onScreen,true);
 assert.ok(Math.abs(result[0].u-.5)<1e-6);
 assert.ok(Math.abs(result[0].v-.5)<1e-6);
 assert.equal(result[1].onScreen,false);
 assert.equal(result[2].onScreen,false);
 assert.equal(result[3].onScreen,false);
});
test("planet spin offset projects the native longitude correctly",()=>{
 const info={viewProjection:vp(),camera:[0,0,1800],radius:600,spinOffsetDeg:35};
 const [center,reverse]=projectOrbitalCities([
  {id:"center",lat:0,lon:55},{id:"reverse",lat:0,lon:-125}
 ],info);
 assert.equal(center.onScreen,true);
 assert.ok(Math.abs(center.u-.5)<1e-5);
 assert.equal(reverse.onScreen,false);
 assert.deepEqual(projectOrbitalCities([],{...info}),[]);
 assert.deepEqual(projectOrbitalCities(DESTINATIONS,{}),[]);
});

test("UI pin click selects a preview only; free mode returns to globe picking",()=>{
 class FakeElement{
  constructor(){this.children=[];this.listeners={};this.attributes={};this.dataset={};
   this.style={};this.hidden=true;this.textContent="";}
  append(...items){this.children.push(...items);}
  replaceChildren(...items){this.children=[...items];}
  setAttribute(name,value){this.attributes[name]=String(value);}
  addEventListener(name,handler){this.listeners[name]=handler;}
  closest(selector){return selector==="button[data-city-id]"&&this.dataset.cityId?this:null;}
  click(target=this){this.listeners.click?.({target});}
 }
 const ids=["orbit-city-controls","orbit-city-toggle","orbit-city-menu","orbit-city-list",
  "orbit-city-pins","orbit-city-free","orbit-city-hint"];
 const elements=Object.fromEntries(ids.map(id=>[id,new FakeElement()]));
 const previous=globalThis.document;
 globalThis.document={
  getElementById:id=>elements[id],
  createElement:()=>new FakeElement()
 };
 try{
  const places=[{id:"tower",name:"塔の街",region:"中心部",icon:"🗼",lat:24,lon:30}];
  const previews=[],freeCalls=[];
  const ui=installOrbitalCitiesUI({
   getDestinations:()=>places,
   onSelect:place=>{previews.push(place.id);return {ok:true};},
   onFree:()=>freeCalls.push("free")
  });
  assert.equal(previews.length,0);
  ui.setActive(true);
  assert.equal(elements["orbit-city-controls"].hidden,false);
  assert.equal(elements["orbit-city-list"].children.length,1);
  elements["orbit-city-toggle"].click();
  assert.equal(elements["orbit-city-menu"].hidden,false);
  const row=elements["orbit-city-list"].children[0].children[0];
  elements["orbit-city-list"].click(row);
  assert.deepEqual(previews,["tower"]);
  assert.equal(ui.selectedId,"tower");
  assert.equal(elements["orbit-city-menu"].hidden,true);
  const pin=elements["orbit-city-pins"].children[0];
  ui.frame([{id:"tower",u:.3,v:.6,onScreen:true}]);
  assert.equal(pin.hidden,false);
  assert.equal(pin.style.left,"30.000%");
  ui.frame([{id:"tower",onScreen:false}]);
  assert.equal(pin.hidden,true);
  elements["orbit-city-free"].click();
  assert.equal(ui.selectedId,null);
  assert.deepEqual(freeCalls,["free"]);
  assert.deepEqual(previews,["tower"],"preview click does not trigger landing");
  ui.setActive(false);
  assert.equal(elements["orbit-city-controls"].hidden,true);
 }finally{globalThis.document=previous;}
});

test("planet UI keeps landmark browsing and arbitrary free-land/sea/ship selection",()=>{
 assert.equal(typeof installOrbitalCitiesUI,"function");
 const dir=new URL("../planet-explorer/",import.meta.url);
 const html=readFileSync(new URL("index.html",dir),"utf8");
 const app=readFileSync(new URL("app.mjs",dir),"utf8");
 const render=readFileSync(new URL("render.mjs",dir),"utf8");
 const css=readFileSync(new URL("style.css",dir),"utf8");
 for(const id of ["orbit-city-pins","orbit-city-controls","orbit-city-toggle","orbit-city-hint",
  "orbit-city-menu","orbit-city-list","orbit-city-free","landing-water-mode",
  "orbit-landing-preview","orbit-landing-confirm","orbit-landing-clear"])
  assert.ok(html.includes('id="'+id+'"'),id);
 for(const mode of ["land","sea","sea-ship"])
  assert.ok(html.includes('value="'+mode+'"'),mode);
 assert.match(app,/orbitalCitiesUI=installOrbitalCitiesUI/);
 assert.match(app,/function selectOrbitCity\(/);
 assert.match(app,/function selectOrbitLanding\(/);
 assert.match(app,/function confirmOrbitLanding\(/);
 assert.match(app,/activeSettlementId="wilderness"/);
 assert.match(app,/selectOrbitLanding\(x,y\)\)confirmOrbitLanding\(\)/);
 assert.match(render,/projectOrbitalCities/);
 assert.match(render,/orbitCityMarkers\(/);
 assert.match(css,/\.orbit-city-pin/);
});
