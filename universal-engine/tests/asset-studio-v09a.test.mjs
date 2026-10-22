import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {AssetStudioModel,partAnchor,snapCandidates} from "../planet-explorer/asset-studio-model.mjs";
import {OwnerWorld} from "../planet-explorer/owner-world.mjs";
import {AssetCamera,selectionCenter} from "../planet-explorer/asset-camera.mjs";

const template={shape:"cube",width:4,height:3,depth:2,rotation:0,color:[.7,.5,.3],group:"工房"};

test("asset blocks place on XY at a dial-controlled Z plane and snap chosen anchors",()=>{
 const studio=new AssetStudioModel();studio.setPlane(3);
 const first=studio.add(template,0,0),corner=partAnchor(first,"top-right");
 const second=studio.add(template,corner.x+template.width/2+.2,corner.y+template.depth/2+.1,
  {snapMode:"endpoint",sourceAnchor:"top-left",snapDistance:1});
 assert.equal(second.z,3);assert.deepEqual(partAnchor(second,"top-left"),corner);
 assert.ok(snapCandidates(studio.parts,"face").some(p=>p.kind==="right"));
 assert.ok(snapCandidates(studio.parts,"centroid").some(p=>p.kind==="centroid"));
});

test("move edit copy group delete continuous workflow keeps an undo history",()=>{
 const studio=new AssetStudioModel();studio.add(template,0,0);studio.move(2,-1,4);
 assert.deepEqual([studio.parts[0].x,studio.parts[0].y,studio.parts[0].z],[2,-1,4]);
 assert.equal(studio.update({width:6,rotation:Math.PI/4}),true);
 assert.equal(studio.copy(2).length,1);assert.equal(studio.group("塔"),true);assert.equal(studio.selection()[0].group,"塔");
 assert.equal(studio.remove(),true);assert.equal(studio.parts.length,1);assert.equal(studio.undo(),true);assert.equal(studio.parts.length,2);
});

test("asset saves to the existing prefab list and can be placed directly in town",()=>{
 const studio=new AssetStudioModel();studio.add(template,-2,0);studio.add({...template,shape:"cone",height:5},2,0);
 const world=new OwnerWorld(),saved=world.savePrefabParts("Asset工房",studio.prefabParts());
 assert.equal(saved.ok,true);assert.equal(world.prefabs[0].parts.length,2);
 assert.equal(world.placePrefab("Asset工房",{lat:28,lon:42}).ok,true);
});

test("asset camera orbits the selection, returns to model origin, zooms, pans and intersects the floor",()=>{
 const studio=new AssetStudioModel();const part=studio.add(template,6,-3);const camera=new AssetCamera();
 assert.deepEqual(selectionCenter(studio.parts,studio.selected),{x:6,y:-3,z:1.5});
 const center=camera.project({x:6,y:-3,z:1.5},900,620,studio.parts,studio.selected);
 assert.ok(Math.abs(center.x-450)<1e-6&&Math.abs(center.y-310)<1e-6);
 const yaw=camera.yaw,distance=camera.distance;camera.orbit(20,-10);camera.zoom(-80);camera.panPixels(15,8,studio.parts,studio.selected,620);
 assert.notEqual(camera.yaw,yaw);assert.ok(camera.distance<distance);assert.notDeepEqual(camera.pan,{x:0,y:0,z:0});
 camera.resetPan();const floor=camera.rayToPlane(450,310,900,620,4,studio.parts,studio.selected);assert.ok(floor&&Number.isFinite(floor.x));
 studio.select(null);assert.deepEqual(selectionCenter(studio.parts,studio.selected),{x:0,y:0,z:0});
});

test("browser exposes a standalone asset canvas, XYZ dials and requested edit actions",()=>{
 const base=new URL("../planet-explorer/",import.meta.url),html=readFileSync(new URL("index.html",base),"utf8"),
  css=readFileSync(new URL("style.css",base),"utf8"),app=readFileSync(new URL("app.mjs",base),"utf8");
 for(const id of ["owner-asset-open","asset-studio","asset-canvas","asset-camera-tool","asset-camera-preset","asset-camera-focus","asset-z-target","asset-dial-x","asset-dial-y","asset-dial-z",
  "asset-snap-mode","asset-source-anchor","asset-copy","asset-delete","asset-group-apply","asset-continuous"])
  assert.ok(html.includes('id="'+id+'"'),id);
 const ui=readFileSync(new URL("asset-studio-ui.mjs",base),"utf8");
 assert.match(css,/\.asset-camera-row/);assert.match(app,/installAssetStudio/);
 assert.match(ui,/camera\.orbit/);assert.match(ui,/camera\.panPixels/);assert.match(ui,/rayToPlane/);
 assert.match(ui,/floorMode\)studio\.setPlane/);
});
