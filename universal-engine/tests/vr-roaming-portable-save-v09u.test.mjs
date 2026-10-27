import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createPortableSave,parsePortableSave,MAX_PORTABLE_SAVE_BYTES} from "../planet-explorer/portable-save.mjs";
import {VoyageLog,seaDistance} from "../planet-explorer/circumnavigation.mjs";

const sample=()=>({format:"ue/explorer-demo",version:1,
 planet:{format:"ue/planet",version:1},universe:{format:"ue/multiverse",version:1},
 explorer:{format:"ue/explorer",version:1,x:12,z:3,yaw:.7,altitudeM:2.5,
  origin:{lat:28,lon:42},targetAltitudeM:2.5,totalDistanceM:130},
 v0_9u:{schemaVersion:1},v0_9z:{custodyFacility:null}});

test("portable phone-PC-Quest save round trips world and equipment without changing save schema",()=>{
 const game=sample(),wearables={format:"ue/wearable-inventory",version:1,items:[]};
 const json=createPortableSave(game,{wearables,exportedAt:"2026-10-27T00:00:00.000Z"});
 const parsed=parsePortableSave(json);
 assert.deepEqual(parsed.game,game);
 assert.deepEqual(parsed.wearables,wearables);
 assert.equal(parsed.exportedAt,"2026-10-27T00:00:00.000Z");
});
test("legacy raw explorer save is importable and current data stays unchanged",()=>{
 const game=sample();
 assert.deepEqual(parsePortableSave(JSON.stringify(game)).game,game);
 assert.equal(parsePortableSave(JSON.stringify(game)).wearables,null);
});
test("invalid or huge save cannot be imported or exported",()=>{
 assert.throws(()=>parsePortableSave("{bad"),/JSON/);
 assert.throws(()=>parsePortableSave(JSON.stringify({format:"wrong"})),/形式/);
 assert.throws(()=>parsePortableSave("x".repeat(MAX_PORTABLE_SAVE_BYTES+1)),/大きすぎ/);
 assert.throws(()=>createPortableSave({}),/対応/);
 const game=sample();game.explorer.x=Number.POSITIVE_INFINITY;
 assert.throws(()=>createPortableSave(game),/位置情報/);
});
test("on-foot geodesic journal crosses longitude seam without teleport",()=>{
 const walk=new VoyageLog(null,{lat:0,lon:179.999});
 const before=walk.snapshot().distanceM;
 walk.advance(0,-179.999,6371000);
 assert.ok(walk.distanceM>before);
 assert.ok(walk.distanceM<500);
 assert.ok(seaDistance({lat:0,lon:179.999},{lat:0,lon:-179.999},6371000)<500);
});
test("XR in-session globe and portable handoff are wired to the real runtime",()=>{
 const source=name=>readFileSync(new URL("../planet-explorer/"+name,import.meta.url),"utf8");
 const xr=source("xr-ui.mjs"),app=source("app.mjs"),html=source("index.html");
 assert.match(xr,/vrPlanetOverview=!vrPlanetOverview/);
 assert.match(xr,/onPlanetPick\(hit\.lat,hit\.lon\)/);
 assert.match(xr,/if\(onPlanetLand\(\)\)/);
 assert.match(xr,/vrMovement=xrVRMovement\(sources,\{rts:vrRTS\}\)/);
 assert.match(xr,/onVRGroundStart\(\)/);
 assert.match(app,/createPortableSave\(captureGame\(\),\{wearables\}\)/);
 assert.match(app,/footVoyage\?\.advance\(controller\.lat,controller\.lon/);
 assert.match(html,/id="xr-adventure"/);
 assert.match(html,/id="portable-save-import"/);
});
