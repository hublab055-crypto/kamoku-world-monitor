import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL("../planet-explorer/"+path,import.meta.url),"utf8");
const html=read("index.html"),app=read("app.mjs"),render=read("render.mjs");

test("fog selector exposes OFF, light, realistic and automatic modes",()=>{
 assert.match(html,/id="fog-mode"/);
 for(const mode of ["off","light","realistic","auto"])assert.match(html,new RegExp('value="'+mode+'"'));
 assert.match(html,/id="fog-detail"/);
 assert.match(app,/renderer\.setFogMode\(/);
 assert.match(app,/FOG_MODE_KEY/);
 assert.match(app,/localStorage\.setItem\(FOG_MODE_KEY,mode\)/);
});

test("fog is computed for ground only and respects existing orbital render path",()=>{
 assert.match(render,/uFogParams/);
 assert.match(render,/uFogColor/);
 assert.match(render,/vDepth=gl_Position\.w/);
 assert.match(render,/uniform3fv\(this\.uFogParams,new Float32Array\(\[0,1,0\]\)\)/);
 assert.match(render,/fogForGround\(/);
 assert.match(render,/this\.distantLandscape/);
 assert.match(render,/this\.drawMesh\(this\.distantLandscape/);
});

test("performance setting drives terrain resolution and tree LOD without save migrations",()=>{
 assert.match(render,/this\.adaptiveTerrainLOD\.level/);
 assert.match(render,/sceneryRadiusForQuality\(radius,detail\)/);
 assert.match(app,/renderer\.reportFPS\(fps,frameTime\)/);
 assert.match(app,/const SAVE_KEY="universal-engine:explorer:v0\.7i"/);
 assert.match(html,/versions\/v0\.6/);
});
