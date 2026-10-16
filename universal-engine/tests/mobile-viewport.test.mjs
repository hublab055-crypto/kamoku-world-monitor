import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const html=readFileSync(new URL("../planet-explorer/index.html",import.meta.url),"utf8");
const css=readFileSync(new URL("../planet-explorer/style.css",import.meta.url),"utf8");
const app=readFileSync(new URL("../planet-explorer/app.mjs",import.meta.url),"utf8");
const render=readFileSync(new URL("../planet-explorer/render.mjs",import.meta.url),"utf8");

test("iPhone web view respects edge safe areas",()=>{
 assert.match(html,/viewport-fit=cover/);
 assert.match(css,/safe-area-inset-bottom/);
 assert.match(css,/safe-area-inset-top/);
 assert.match(css,/height:100dvh/);
 assert.match(css,/max-height:44dvh/);
});
test("HUD actions are available within the 3D canvas and remain accessible",()=>{
 for(const id of ["viewport-expand","viewport-camera","viewport-controls","viewport-menu"]){
  assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1,id);
 }
 assert.match(html,/id="viewport-toolbar"/);
 assert.match(html,/aria-controls="viewport-toolbar"/);
 assert.match(app,/viewport-camera"\)\.addEventListener\("click"/);
 assert.match(app,/viewport-controls"\)\.addEventListener\("click"/);
 assert.match(app,/viewport-menu"\)\.addEventListener\("click"/);
});
test("first mobile visit is game first, with reversible session-only preference",()=>{
 assert.match(app,/matchMedia\("\(max-width:760px\) and \(pointer:coarse\)"\)/);
 assert.match(app,/if\(pref!=="0"\)setCssImmersive\(true\)/);
 assert.match(app,/rememberViewport\(false\)/);
 assert.match(app,/sessionStorage/);
 assert.match(app,/syncFullscreenButton/);
 assert.doesNotMatch(app,/localStorage\.setItem\(mobileViewportPref/);
});
test("terrain sky shows daylight without modifying space background",()=>{
 assert.match(render,/alpha:true/);
 assert.match(render,/const inOrbit=state\.altitudeM>23000/);
 assert.match(render,/clearColor\(\.011,\.032,\.071,inOrbit\?1:0\)/);
 assert.match(css,/#world\{background:linear-gradient/);
});
test("archived rollback URLs and versioned game saves are preserved",()=>{
 for(const archived of ["v0.7b","v0.7a","v0.6"]){
  assert.ok(html.includes("../versions/"+archived+"/planet-explorer/"),archived);
 }
 assert.match(app,/const SAVE_KEY="universal-engine:explorer:v0\.7g"/);
 assert.match(app,/const V07D_SAVE_KEY="universal-engine:explorer:v0\.7d"/);
 assert.ok(html.includes('id="import-v07d-save"'));
 assert.match(app,/const V07C_SAVE_KEY="universal-engine:explorer:v0\.7c"/);
 assert.match(app,/const V07B_SAVE_KEY="universal-engine:explorer:v0\.7b"/);
});
