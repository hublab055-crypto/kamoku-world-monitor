import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const get=name=>readFileSync(new URL("../planet-explorer/"+name,import.meta.url),"utf8");

test("VR walk reports the actual legal reason rather than accusing Quest thumbstick",()=>{
 const app=get("app.mjs"),xr=get("xr-ui.mjs");
 assert.match(app,/const vrRestraintReason=law\?\.custody\?/);
 assert.match(app,/railwaySecurity\?\.jailed\?"駅留置所で勾留/);
 assert.match(app,/law\?\.pendingDeath\?"後継者の選択待ち"/);
 assert.match(app,/restraintReason:vrRestraintReason/);
 assert.match(xr,/movement\.restraintReason\?"／"\+movement\.restraintReason/);
 assert.match(xr,/movement\.detained&&!movement\.jailWalkable\?movement\.restraintReason\|\|"行動制限中"/);
});

test("Custody routes stick motion to local cell but not planetary walking",()=>{
 const app=get("app.mjs");
 assert.match(app,/const detained=Boolean\(vrRestraintReason\)/);
 assert.match(app,/if\(xrAxes&&\(!detained\|\|jailCellActive\)\)/);
 assert.match(app,/input\.forward=xrAxes\.forward/);
 assert.match(app,/xrMoveResult=\{/);
 assert.match(app,/traveledM:jailCellActive\?renderer\.custodyCell\.movedM:Math\.hypot\(controller\.x-previous\.x,controller\.z-previous\.z\)/);
});

test("Headset last input is preserved if controllers disappear on session exit",()=>{
 const xr=get("xr-ui.mjs");
 assert.match(xr,/vrLastConnectedLeft="未取得"/);
 assert.match(xr,/if\(left\?\.gamepad\)/);
 assert.match(xr,/vrInputInfo=vrLastConnectedLeft/);
 assert.match(xr,/現在左コントローラー未検出（直近 /);
 assert.match(xr,/vrMark\(ending,\{force:true,log:!disposed\}\)/);
});

test("Law and railway custody require explicit legal release, and only then resume movement",()=>{
 const app=get("app.mjs"),law=get("law-ui.mjs");
 assert.match(law,/law\.payFine\(law\.custody\.faction,payFine\)/);
 assert.match(law,/law\.serveSentence\(law\.custody\.faction\)/);
 assert.match(app,/railwaySecurity\.payFine\(amount=>railway\.charge\(amount\)\)/);
 assert.match(app,/railwaySecurity\.serveSentence\(\)/);
 assert.match(app,/function finishCustody\(\)/);
 assert.match(app,/if\(!law\?\.custody&&!railwaySecurity\?\.jailed&&!law\?\.pendingDeath&&!law\?\.gameOver\)\{/);
 assert.match(app,/running=true;/);
});

test("Railway detainment also blocks VR weapons and item manipulation",()=>{
 const app=get("app.mjs");
 assert.match(app,/onVRHand:hand=>\{\s*if\(law\?\.custody\|\|railwaySecurity\?\.jailed/);
 assert.match(app,/onVRCommand:command=>\{\s*if\(law\?\.custody\|\|railwaySecurity\?\.jailed/);
 assert.match(app,/onVRGrab:\(item,hand\)=>\{\s*if\(law\?\.custody\|\|railwaySecurity\?\.jailed/);
});
