import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {Script} from "node:vm";
import {CAD_PALETTE,cadToShip,shipToCad,planeHit,paletteHit,shipRay,validSpatialState} from "../planet-explorer/ship-spatial-cad.mjs";
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7);
test("spatial CAD round-trips signed millimetres and a tabletop offset",()=>{
 const p=[23,-54,10];shipToCad(cadToShip(p)).forEach((v,i)=>near(v,p[i]));
 const origin=cadToShip([0,0,0]);near(origin[1],1.14);
});
test("spatial CAD ray picks XY and arbitrary offset plane in UV millimetres",()=>{
 const b={o:[0,0,10],u:[1,0,0],v:[0,1,0],n:[0,0,1]};
 const ray={o:cadToShip([20,30,400]),d:[0,-1,0]},p=planeHit(ray,b);near(p.u,20);near(p.v,30);
 const q=planeHit({o:cadToShip([400,30,20]),d:[-1,0,0]},{o:[10,0,0],u:[0,1,0],v:[0,0,1],n:[1,0,0]});near(q.u,30);near(q.v,20);
 assert.equal(planeHit({...ray,d:[1,0,0]},b),null);
 assert.equal(planeHit({...ray,d:[0,1,0]},b),null);
});
test("spatial palette hit is bounded and selects the actual rendered control",()=>{
 for(const b of CAD_PALETTE){assert.equal(paletteHit({o:[b.x,b.y,b.z+1],d:[0,0,-1]}).id,b.id);}
 assert.equal(paletteHit({o:[10,1,0],d:[0,0,-1]}),null);
 const identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
 assert.deepEqual(shipRay(identity,identity),{o:[0,0,0],d:[0,0,-1]});
 assert.equal(validSpatialState({plane:{o:[0,0,0],u:[1,0,0],v:[0,1,0],n:[0,0,1]},lines:[]}),true);
 assert.equal(validSpatialState({plane:{o:[NaN,0,0]},lines:[]}),false);
});
test("embedded CAD inline scripts parse and spatial bridge retains same-origin boundary",()=>{
 const html=readFileSync(new URL("../model-lab/cad/index.html",import.meta.url),"utf8");
 for(const m of html.matchAll(/<script>([\s\S]*?)<\/script>/g))new Script(m[1]);
 assert.match(html,/e\.origin!==location\.origin\|\|e\.source!==parent/);
 assert.match(html,/ue-spatial-cad-suspend/);
 assert.match(html,/cam\.normal/);
 const ui=readFileSync(new URL("../planet-explorer/ship-modeling-bench-ui.mjs",import.meta.url),"utf8");
 assert.match(ui,/if\(!near\(\)\|\|model\.grip\)return false/);
 assert.match(ui,/if\(wasNear&&!allowed\)/);
});
