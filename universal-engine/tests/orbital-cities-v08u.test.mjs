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
