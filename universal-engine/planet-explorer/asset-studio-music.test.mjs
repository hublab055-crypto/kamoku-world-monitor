import {test} from "node:test";
import assert from "node:assert/strict";
import {AssetStudioModel,migrateAssetDocument} from "./asset-studio-model.mjs";
import {extractAssetMusicControls} from "./music-crafting.mjs";

test("Asset Studio saves playable keys and retains settings after reload",()=>{
 const model=new AssetStudioModel();
 model.setMeta({name:"自作シンセ",assetType:"instrument"});
 const p=model.add({name:"C4キー",shape:"cube",width:.3,height:.1,depth:.5,
  color:[1,1,1],group:"keys",audioControl:{kind:"key",track:"keys",pitch:60}},.4,.2);
 assert.ok(p);
 const document=model.snapshot();
 assert.equal(document.meta.assetType,"instrument");
 assert.equal(document.nodes[0].audioControl.pitch,60);
 const restored=new AssetStudioModel(document);
 assert.deepEqual(extractAssetMusicControls(restored.snapshot()),[{
  kind:"key",track:"keys",pitch:60,x:.4,y:0,z:.2,width:.3,height:.1,depth:.5
 }]);
 restored.select(p.id);
 assert.equal(restored.update({audioControl:{kind:"button",track:"drums",pitch:38}}),true);
 assert.equal(restored.snapshot().nodes[0].audioControl.pitch,38);
 assert.equal(restored.undo(),true);
 assert.equal(restored.snapshot().nodes[0].audioControl.pitch,60);
});
test("copying a music key retains its sound mapping independently",()=>{
 const model=new AssetStudioModel();model.setMeta({assetType:"instrument"});
 const p=model.add({shape:"cube",width:.3,height:.1,depth:.5,color:[1,1,1],
  audioControl:{kind:"string",track:"guitar",pitch:64}},0,0);
 model.select(p.id);assert.equal(model.copy().length,1);
 assert.equal(model.snapshot().nodes.length,2);
 assert.ok(model.snapshot().nodes.every(n=>n.audioControl.pitch===64));
});
test("non-musical legacy AssetDocuments remain compatible",()=>{
 const old={format:"ue/asset-document",version:2,meta:{name:"小屋",assetType:"building",units:"m"},
  workspace:{planeZ:0},nodes:[{type:"primitive",id:1,name:"箱",parentId:null,
  transform:{position:{x:0,y:0,z:0},rotation:{x:0,y:0,z:0},pivot:{x:0,y:0,z:0}},
  geometry:{shape:"cube",size:{x:1,y:1,z:1}},
  material:{baseColor:[1,1,1]},group:"",sockets:[]}]};
 assert.equal(migrateAssetDocument(old).nodes[0].audioControl,undefined);
 assert.equal(new AssetStudioModel(old).parts[0].audioControl,null);
});
