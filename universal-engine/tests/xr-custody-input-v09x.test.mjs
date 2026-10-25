import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {xrControllerSources,xrVRMovement,xrButtonEdges} from "../planet-explorer/xr-quest-controls.mjs";
const contentOf=file=>readFileSync(new URL("../planet-explorer/"+file,import.meta.url),"utf8");
const pad=(x=0,y=0,buttons=[])=>({mapping:"xr-standard",axes:[0,0,x,y],
 buttons:Array.from({length:6},(_,i)=>({pressed:buttons.includes(i)}))});
test("Quest tracked left hand is shared by walking and action-button edges",()=>{
 const left={handedness:"left",gamepad:pad(0,-.8,[4])};
 const right={handedness:"right",gamepad:pad(.6,0,[5])};
 const sources=xrControllerSources({inputSources:[right],trackedSources:[left]});
 assert.equal(sources.length,2);
 assert.ok(xrVRMovement(sources).forward>.6);
 assert.ok(xrVRMovement(sources).turn>.4);
 assert.deepEqual(xrButtonEdges(sources).pressed.sort(),["left:4","right:5"]);
});
test("Quest inputSources with active gamepad take precedence over tracked-only duplicate",()=>{
 const tracked={handedness:"left",gamepad:pad(0,-1)};
 const active={handedness:"left",gamepad:pad(0,-.6)};
 const sources=xrControllerSources({inputSources:[active],trackedSources:[tracked]});
 assert.deepEqual(sources,[active]);
 const fallback=xrControllerSources({inputSources:[{handedness:"left"}],trackedSources:[tracked]});
 assert.deepEqual(fallback,[tracked]);
});
test("No controller produces neutral motion and never fabricates a walking input",()=>{
 const sources=xrControllerSources({inputSources:[],trackedSources:[]});
 assert.deepEqual(sources,[]);
 assert.deepEqual(xrVRMovement(sources),{forward:0,strafe:0,turn:0,tableTurn:0});
 assert.deepEqual(xrButtonEdges(sources).pressed,[]);
});
test("Invalid and duplicate left controllers never cause duplicated action presses",()=>{
 const left={handedness:"left",gamepad:pad(0,0,[4])};
 const sources=xrControllerSources({inputSources:[left,left,{handedness:"none"}],trackedSources:[left]});
 assert.equal(sources.length,1);
 assert.deepEqual(xrButtonEdges(sources).pressed,["left:4"]);
});
test("VR diagnostics distinguish custody, XR focus and controller presence",()=>{
 const runtime=contentOf("xr-ui.mjs");
 assert.match(runtime,/xrControllerSources\(session\)/);
 assert.match(runtime,/vrButtonsFrame\(controllerSources\)/);
 assert.match(runtime,/const sources=controllerSources/);
 assert.match(runtime,/visible"/);
 assert.match(runtime,/フォーカス外の可能性/);
 assert.match(runtime,/movement\.detained&&!movement\.jailWalkable&&movement\.restraintReason\?\.includes\("勾留"\)/);
 assert.match(runtime,/罰金を払って釈放/);
 assert.match(runtime,/服役して釈放/);
});
test("Custody permits confined walking without world-coordinate movement",()=>{
 const app=contentOf("app.mjs");
 assert.match(app,/const detained=Boolean\(vrRestraintReason\)/);
 assert.match(app,/if\(xrAxes&&\(!detained\|\|jailCellActive\)\)/);
 assert.match(app,/detained,jailWalkable:jailCellActive,jailStunned,restraintReason:vrRestraintReason/);
});
test("Game entrypoints bust cached Quest control modules",()=>{
 assert.match(contentOf("app.mjs"),/xr-ui\.mjs\?v=[^"]*quest-resume-v09x/);
 assert.match(contentOf("index.html"),/app\.mjs\?v=[^"]*quest-resume-v09x/);
});
