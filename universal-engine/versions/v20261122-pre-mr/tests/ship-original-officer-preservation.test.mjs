import test from "node:test";
import assert from "node:assert/strict";
import {normalizeAvatarV10,normalizeAvatarRoster} from "../planet-explorer/avatar-v10.mjs";
import {SkinnedFrontierAsset} from "../planet-explorer/frontier-skinned-renderer.mjs";
import {createShipCrewStandIn} from "../planet-explorer/ship-interior-3d.mjs";

test("original Lyra first officer is the default while crew/player keep V10 slots",()=>{
 const roster=normalizeAvatarRoster();
 assert.equal(roster.navigator.model,"lyra");
 assert.equal(roster.navigator.preserveOriginal,true);
 for(const id of ["player","engineer","companion"])assert.equal(roster[id].preserveOriginal,false);
 assert.equal(roster.player.model,"ren");
});

test("first officer selection persists, does not override explicit edited mode",()=>{
 const modified=normalizeAvatarV10("navigator",{model:"lyra",preserveOriginal:false,
  appearance:{eyeSize:113,faceWidth:109},outfit:"space"});
 assert.equal(modified.preserveOriginal,false);
 assert.equal(modified.appearance.eyeSize,113);
 assert.equal(modified.outfit,"space");
 const restored=normalizeAvatarV10("navigator",{...modified,preserveOriginal:true});
 assert.equal(restored.preserveOriginal,true);
 assert.equal(restored.appearance.eyeSize,113,"original display must not destroy saved edits");
 assert.equal(normalizeAvatarV10("navigator",{model:"mina",preserveOriginal:true}).preserveOriginal,false);
 assert.equal(normalizeAvatarV10("navigator",{model:"lyra"}).preserveOriginal,true);
});

test("switching back to original restores all eight deformed GPU mesh buffers",()=>{
 const attrs=["positions","normals","colors","uv","joints","weights","morph0","morph1"];
 const arrays=Object.fromEntries(attrs.map((name,i)=>[name,new Float32Array([i,.1,.2])]));
 const calls=[];const gl={ARRAY_BUFFER:34962,bindBuffer:(...xs)=>calls.push(["bind",...xs]),
  bufferSubData:(...xs)=>calls.push(["upload",...xs])};
 const mesh={source:{arrays},buffers:attrs.map((_,i)=>i+1),appliedFace:{eyeSize:119}};
 const receiver={gl,rig:{isV10:true}};
 SkinnedFrontierAsset.prototype.applyFace.call(receiver,mesh,{preserveOriginal:true});
 assert.equal(mesh.appliedFace,null);
 const uploads=calls.filter(c=>c[0]==="upload");
 assert.equal(uploads.length,8);
 attrs.forEach((name,i)=>assert.equal(uploads[i][3],arrays[name]));
 SkinnedFrontierAsset.prototype.applyFace.call(receiver,mesh,{preserveOriginal:true});
 assert.equal(calls.filter(c=>c[0]==="upload").length,8,"no extra GPU uploads in preserved mode");
});

test("fallback hull crew mesh remains available if V10 shader or GLB loading fails",()=>{
 const crew=createShipCrewStandIn({id:"navigator"});
 assert.ok(crew instanceof Float32Array&&crew.length>0);
 assert.equal(crew.length%9,0);
});
