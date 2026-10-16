import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const file=name=>readFileSync(new URL("../planet-explorer/"+name,import.meta.url),"utf8");
const html=file("index.html"),app=file("app.mjs"),css=file("style.css"),render=file("render.mjs");

test("RTS command buttons and automation panel live inside the 3D viewport",()=>{
 const canvas=html.indexOf('<div class="canvas-wrap">');
 const panel=html.indexOf('<div id="auto-panel"');
 const toolbar=html.indexOf('<div class="toolbar"');
 assert.ok(canvas>=0&&panel>canvas&&toolbar>panel);
 for(const id of ["viewport-rts","viewport-auto","rts-markers","rts-all","rts-multi",
  "rts-rally","rts-stop","auto-panel","auto-actor","auto-enabled","auto-rule-list",
  "auto-all-on","auto-all-off","auto-close","auto-status","import-v07c-save"]){
  assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1,id);
 }
});
test("tactical mode distinguishes selectable units and issues ground commands",()=>{
 for(const expr of [/commandRtsTap\(/,/squad\.choose\(/,/squad\.selectAll\(/,
  /squad\.orderMove\(/,/squad\.halt\(/,/rtsMode/,/setCameraMode\("tactical"\)/,
  /renderer\.screenActors/,/renderer\.squad=squad/]){
  assert.match(app,expr);
 }
 assert.match(render,/this\.screenActors\.push/);
 assert.match(render,/this\.selectionRing/);
 assert.match(render,/this\.npcAnimators/);
 assert.match(css,/\.rts-label\.selected/);
 assert.match(css,/\.rts-controls/);
});
test("rules editor includes per-actor on/off, slot assignment and rally",()=>{
 assert.match(app,/squad\.setRule\(/);
 assert.match(app,/squad\.setAuto\(/);
 assert.match(app,/squad\.setRally\(/);
 assert.match(app,/actor\.rules\.map/);
 assert.match(app,/data-field="enabled"/);
 assert.match(app,/RULE_OPERATORS/);
 assert.match(app,/RULE_ACTIONS/);
});
test("v0.7d save stays separate and all prior save imports remain available",()=>{
 assert.match(app,/const SAVE_KEY="universal-engine:explorer:v0\.7g"/);
 assert.match(app,/const V07D_SAVE_KEY="universal-engine:explorer:v0\.7d"/);
 assert.ok(html.includes('id="import-v07d-save"'));
 assert.match(app,/const V07C_SAVE_KEY="universal-engine:explorer:v0\.7c"/);
 assert.match(app,/v0_7d:\{schemaVersion:1,squad:squad\.snapshot\(\)\}/);
 for(const id of ["import-v07c-save","import-v07b-save","import-v07a-save","import-v06-save"]){
  assert.ok(html.includes('id="'+id+'"'));
 }
});
