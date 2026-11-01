import {test} from "node:test";
import assert from "node:assert/strict";
import {MUSIC_RECIPES,normalizeMusicInventory,craftMusicInstrument,
 takeMusicInstrument,returnMusicInstrument,extractAssetMusicControls,extractAssetMusicParts,presetMusicControls} from "./music-crafting.mjs";
import {newMusicStage,normalizeMusicStage,musicStageGeometry,musicStageRayHit,musicStageHandHit} from "./music-world.mjs";

test("recipes consume real materials and increment crafted item count",()=>{
 const resources={wood:12,metal:9,fiber:10},start=normalizeMusicInventory(null);
 const next=craftMusicInstrument(start,resources,"music-guitar");
 assert.equal(resources.wood,7);assert.equal(resources.fiber,6);assert.equal(resources.metal,8);
 assert.equal(next.items["music-guitar"],1);assert.equal(start.items["music-guitar"],0);
 const placed=takeMusicInstrument(next,"music-guitar");
 assert.equal(placed.items["music-guitar"],0);
 assert.equal(returnMusicInstrument(placed,"music-guitar").items["music-guitar"],1);
});

test("insufficient material leaves stock and resource inventory untouched",()=>{
 const resources={wood:1,metal:0,fiber:0},start=normalizeMusicInventory(null),before=JSON.stringify(resources);
 assert.throws(()=>craftMusicInstrument(start,resources,"music-stage"),/材料/);
 assert.equal(JSON.stringify(resources),before);assert.equal(start.items["music-stage"],0);
 assert.throws(()=>takeMusicInstrument(start,"music-stage"),/所持/);
});
test("creator mode bypasses all material costs and item consumption",()=>{
 const resources={wood:0,metal:0,fiber:0},start=normalizeMusicInventory(null);
 const next=craftMusicInstrument(start,resources,"music-stage",{creative:true});
 assert.equal(next.items["music-stage"],1);
 assert.deepEqual(resources,{wood:0,metal:0,fiber:0});
 assert.equal(takeMusicInstrument(next,"music-stage",{creative:true}).items["music-stage"],1);
 assert.equal(returnMusicInstrument(next,"music-stage",{creative:true}).items["music-stage"],1);
 assert.equal(MUSIC_RECIPES.length,5);
});
test("Asset-document keys, buttons and strings preserve placement and pitch",()=>{
 const doc={format:"ue/asset-document",version:2,meta:{assetType:"instrument"},
  nodes:[{type:"primitive",audioControl:{kind:"button",track:"drums",pitch:38},
   transform:{position:{x:.6,y:-.8,z:1}},geometry:{size:{x:.4,y:.6,z:.1}}},
  {type:"primitive",transform:{position:{x:0,y:0,z:0}},geometry:{size:{x:2,y:2,z:2}}}]};
 const controls=extractAssetMusicControls(doc);
 assert.equal(controls.length,1);
 assert.deepEqual(controls[0],{kind:"button",track:"drums",pitch:38,
  x:.6,y:1,z:-.8,width:.4,height:.1,depth:.6,yaw:0});
 assert.throws(()=>extractAssetMusicControls({...doc,meta:{assetType:"building"}}),/楽器/);
});
test("custom sound controls render and are hittable in XR",()=>{
 const controls=[{kind:"key",track:"keys",pitch:75,x:0,y:.95,z:0,width:.5,height:.1,depth:.4}];
 const stage=newMusicStage({planetId:"terra",lat:20,lon:40,yaw:0,heightM:33,item:"music-custom",controls});
 assert.deepEqual(normalizeMusicStage(stage).controls,controls.map(c=>({...c,yaw:0})));
 assert.ok(musicStageGeometry(controls).indices.length>0);
 const matrix=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
 const ray=[1,0,0,0,0,1,0,0,0,1,0,0,0,1.8,0,1];
 assert.equal(musicStageRayHit(ray,matrix,[0,0,0],0,{controls})?.pitch,75);
 const hand=[...matrix];hand[13]=1.05;
 assert.equal(musicStageHandHit(hand,matrix,[0,0,0],0,{controls})?.pitch,75);
});
test("keyboard guitar drum recipes expose distinct playable controls",()=>{
 assert.equal(presetMusicControls("music-keyboard").length,13);
 assert.equal(presetMusicControls("music-guitar").length,6);
 assert.equal(presetMusicControls("music-drums").length,4);
});

test("full Asset model includes decorative body geometry and rotated controls",()=>{
 const document={format:"ue/asset-document",version:2,meta:{assetType:"instrument"},nodes:[
  {audioControl:{kind:"key",track:"keys",pitch:72},
   transform:{position:{x:0,y:0,z:.95},rotation:{x:0,y:0,z:Math.PI/2}},
   geometry:{shape:"cube",size:{x:.5,y:.3,z:.1}},material:{baseColor:[1,1,1]}},
  {transform:{position:{x:0,y:0,z:0},rotation:{x:0,y:0,z:0}},
   geometry:{shape:"cylinder",size:{x:2,y:1,z:.85}},material:{baseColor:[.4,.2,.1]}}
 ]};
 const controls=extractAssetMusicControls(document),parts=extractAssetMusicParts(document);
 assert.equal(controls[0].yaw,Math.PI/2);
 assert.equal(parts.length,2);
 assert.equal(parts[1].shape,"cylinder");
 const mesh=musicStageGeometry(controls,parts);
 assert.ok(mesh.indices.length>0);
 assert.equal(mesh.positions.length,mesh.colors.length);
 assert.ok(mesh.indices.every(i=>i<mesh.positions.length/3));
});
