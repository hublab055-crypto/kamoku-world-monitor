import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {DESTINATIONS,destinationById,settlementLayout} from "../planet-explorer/settlements.mjs";
import {planWorldScenery,VILLAGE_SITES} from "../planet-explorer/world-scenery.mjs";
import {observationTowerGeometry,settlementResidentsGeometry} from "../planet-explorer/settlement-geometry.mjs";
import {installSettlementTravelUI} from "../planet-explorer/settlement-travel-ui.mjs";

const green=()=>({water:false,river:false,elevationM:350,category:"plain"});
test("travel desk has unique named destinations and original tower city",()=>{
 assert.equal(DESTINATIONS.length,7);
 assert.equal(new Set(DESTINATIONS.map(p=>p.id)).size,7);
 assert.equal(destinationById("tower").name,"塔の街ルミナス");
 assert.equal(destinationById("missing"),null);
 for(const city of DESTINATIONS)assert.ok(city.icon&&city.description&&city.region);
});
test("settlement layouts are deterministic, populated and specific to each region",()=>{
 const city=settlementLayout("tower");
 assert.ok(city.buildings.length>30);
 assert.ok(city.residents.length>=20);
 assert.deepEqual(city,settlementLayout("tower"));
 assert.deepEqual(city.landmark,{x:0,z:105});
 const village=settlementLayout("forest");
 assert.ok(village.buildings.length>3);
 assert.ok(village.residents.length>5);
 assert.equal(village.landmark,null);
 assert.deepEqual(settlementLayout("pioneer").buildings,[]);
});
test("world streaming replaces the starter village only at named destinations",()=>{
 const params={seed:77,cx:0,cz:0,radius:160,groundAt:()=>350,biomeAt:green};
 const pioneer=planWorldScenery({...params,settlementId:"pioneer"});
 assert.equal(pioneer.buildings.length,VILLAGE_SITES.filter(s=>Math.abs(s.x)<153.6&&Math.abs(s.z)<153.6).length);
 assert.equal(pioneer.landmark,null);
 const tower=planWorldScenery({...params,settlementId:"tower"});
 assert.ok(tower.buildings.length>4);
 assert.ok(tower.people.length>5);
 assert.ok(tower.landmark&&Number.isFinite(tower.landmark.elevationM));
 const wilderness=planWorldScenery({...params,settlementId:"wilderness"});
 assert.equal(wilderness.buildings.length,0);
 assert.equal(wilderness.people.length,0);
});
test("landmark and people are real indexed WebGL 3D meshes",()=>{
 const tower=observationTowerGeometry({x:0,z:105,y:350});
 assert.ok(tower.indices.length>300);
 assert.equal(tower.positions.length,tower.normals.length);
 assert.equal(tower.indices.length*3,tower.positions.length);
 const yMax=Math.max(...tower.positions.filter((_,i)=>i%3===1));
 assert.ok(yMax>430);
 const people=settlementResidentsGeometry(settlementLayout("tower").residents,()=>350);
 assert.ok(people.indices.length>1000);
 assert.equal(people.positions.length,people.colors.length);
});
test("browser UI and save wiring offer a deliberate named-destination visit",()=>{
 assert.equal(typeof installSettlementTravelUI,"function");
 const dir=new URL("../planet-explorer/",import.meta.url);
 const html=readFileSync(new URL("index.html",dir),"utf8");
 const app=readFileSync(new URL("app.mjs",dir),"utf8");
 const render=readFileSync(new URL("render.mjs",dir),"utf8");
 const css=readFileSync(new URL("style.css",dir),"utf8");
 for(const id of ["viewport-settlements","settlement-travel-panel","settlement-travel-close",
  "settlement-travel-list","settlement-travel-preview","settlement-travel-go","settlement-travel-status"])
  assert.ok(html.includes('id="'+id+'"'),id);
 assert.match(app,/function visitSettlement\(/);
 assert.match(app,/settlementTravelUI=installSettlementTravelUI/);
 assert.match(app,/v0_8r:\{schemaVersion:1,destinationId:activeSettlementId\}/);
 assert.match(render,/observationTowerGeometry/);
 assert.match(render,/settlementResidentsGeometry/);
 assert.match(css,/\.settlement-travel-panel/);
});
