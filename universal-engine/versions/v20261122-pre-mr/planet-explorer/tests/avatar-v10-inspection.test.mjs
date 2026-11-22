import test from "node:test";
import assert from "node:assert/strict";
import {readFile,readFileSync} from "node:fs";
import {gunzipSync} from "node:zlib";
import {parseFrontierRig} from "../frontier-animated.mjs";
import {createAvatarV10ProceduralBody} from "../avatar-v10-procedural-body.mjs";
import {createAvatarV10InspectionMeshes} from "../avatar-v10-inspection-mesh.mjs";
import {normalizeAvatarAnatomy} from "../avatar-anatomy-schema.mjs";

test("anatomy view preserves normal, clamps transparency, and rejects unknown layer",()=>{
 assert.deepEqual([normalizeAvatarAnatomy().layer,normalizeAvatarAnatomy().opacity],["skin",30]);
 assert.equal(normalizeAvatarAnatomy({layer:"xray",opacity:0}).opacity,10);
 assert.equal(normalizeAvatarAnatomy({layer:"bones",opacity:200}).opacity,90);
 assert.equal(normalizeAvatarAnatomy({layer:"ghost"}).layer,"skin");
});
for(const model of ["ren","lyra"]){
 test(model+" V10 uses actual skeleton for chest, navel, neck and transparent anatomy",()=>{
  const raw=gunzipSync(readFileSync(new URL("../../original-assets/avatar-v10/"+model+".glb.gz",import.meta.url)));
  const rig=parseFrontierRig(raw);rig.studyModelBust=model==="lyra";
  const body=createAvatarV10ProceduralBody(rig,{resolution:.066});
  assert(body,"body creation");
  const anchors=rig.studyLandmarks;
  assert(anchors.chestY>anchors.navelY+.12,"chest must remain above abdomen");
  assert(anchors.navelY>anchors.hipY,"navel must be higher than the leg root");
  assert(anchors.neckY>anchors.chestY,"neck must extend beyond chest");
  const inspection=createAvatarV10InspectionMeshes(rig);
  assert.deepEqual(inspection.map(x=>x.inspectLayer).sort(),
   ["bones","muscles","organs","organs-obstetric","organs-testicular","organs-uterine"].sort());
  for(const piece of inspection){
   assert(piece.indices.length>0,piece.inspectLayer);
   assert(piece.arrays.positions.every(Number.isFinite),piece.inspectLayer);
   assert.equal(piece.arrays.positions.length/3*4,piece.arrays.weights.length);
   for(const id of piece.arrays.joints)
    assert(id>=0&&id<rig.skins[piece.skin].joints.length);
  }
  assert(inspection.every(p=>p.wardrobe.length===1&&p.wardrobe[0]==="base"));
 });
}
test("renderer composites interior first, then a transparent skin shell",()=>{
 const root=new URL("../",import.meta.url);
 const shader=readFileSync(new URL("frontier-skinned-renderer.mjs",root),"utf8");
 const ui=readFileSync(new URL("avatar-v10-ui.mjs",root),"utf8");
 assert.match(shader,/uniform float uOpacity/);
 assert.match(shader,/gl\.depthMask\(false\)/);
 assert.match(shader,/\["inside","outside"\]/);
 assert.match(shader,/uStudyLandmarks/);
 assert.match(ui,/皮膚の透明度/);
 assert.match(ui,/opacityRange/);
});
