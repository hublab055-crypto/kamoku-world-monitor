import test from "node:test";
import assert from "node:assert/strict";
import {Shape} from "../original-assets/original-models.mjs";
import {
 OUTFITS,createAppearance,validateAppearance,restoreAppearance,
 withOutfit,withAppearanceSlot,buildAppearanceParts,appearanceDescription
} from "../planet-explorer/wardrobe.mjs";
import {
 EXPRESSIONS,ExpressionController,makeFaceParts,expressionPoseValues
} from "../planet-explorer/expression.mjs";
import {ExplorerRenderer} from "../planet-explorer/render.mjs";
import {Planet} from "../planet/planet-core.mjs";
import {Terrain} from "../planet/terrain-engine.mjs";
import {readFileSync} from "node:fs";

const findPart=(p,name)=>p.find(x=>x.name.includes(name));
test("10 original outfits, independent from 3 body bases",()=>{
 assert.equal(OUTFITS.length,10);
 assert.equal(new Set(OUTFITS.map(x=>x.id)).size,10);
 for(const o of OUTFITS)for(const base of ["pioneer","scout","artisan"]){
  const app=createAppearance(o.id,base);
  assert.equal(validateAppearance(app),true);
  const parts=buildAppearanceParts(app);
  assert.ok(parts.length>45,base+" "+o.id);
  for(const part of parts){
   assert.equal(part.geometry.positions.length,part.geometry.colors.length);
   assert.equal(part.geometry.positions.length,part.geometry.normals.length);
   assert.ok(part.geometry.positions.every(Number.isFinite));
   assert.ok(part.geometry.indices.every(x=>x>=0&&x<part.geometry.positions.length/3));
  }
 }
});
test("wardrobe replaces color values while retaining the source model, joints and weapon anchors",()=>{
 const old=buildAppearanceParts(createAppearance("pioneer","pioneer"));
 const changed=buildAppearanceParts(withOutfit(createAppearance("pioneer","pioneer"),"merchant"));
 assert.deepEqual(old[0].geometry.positions,changed[0].geometry.positions);
 assert.notDeepEqual(old[0].geometry.colors,changed[0].geometry.colors);
 assert.ok(changed.some(p=>p.pivot==="rightWrist"));
 assert.ok(changed.some(p=>p.pivot==="rightToe"));
});
test("hair, boots, cape, hats and bags are separately changeable",()=>{
 let app=createAppearance("pioneer");
 app=withAppearanceSlot(app,"hairStyle","long");
 app=withAppearanceSlot(app,"headwear","helmet");
 app=withAppearanceSlot(app,"cape","long");
 app=withAppearanceSlot(app,"bag","toolbag");
 app=withAppearanceSlot(app,"outer","#ff2244");
 app=withAppearanceSlot(app,"feet","#224466");
 const parts=buildAppearanceParts(app);
 assert.ok(findPart(parts,"clothing:long-hair"));
 assert.ok(findPart(parts,"clothing:helmet"));
 assert.ok(findPart(parts,"clothing:long-cape"));
 assert.ok(findPart(parts,"clothing:bag"));
 assert.deepEqual(restoreAppearance(app),app);
});
test("individual actor configurations stay independent, save preserves slots",()=>{
 const a=createAppearance("pioneer"),b=createAppearance("farmer","scout");
 const x=withAppearanceSlot(a,"cape","long");
 assert.equal(b.cape,"none");
 assert.equal(a.cape,"short");
 assert.equal(x.cape,"long");
 assert.deepEqual(restoreAppearance(JSON.parse(JSON.stringify(x))),x);
});
test("wardrobe rejects unregistered body, outfit, color and slots",()=>{
 assert.throws(()=>createAppearance("spacesuit"),/Unknown/);
 assert.throws(()=>withAppearanceSlot(createAppearance(),"outer","red"),/Invalid color/);
 assert.throws(()=>withAppearanceSlot(createAppearance(),"headwear","crown"),/Invalid wardrobe/);
 assert.throws(()=>withAppearanceSlot(createAppearance(),"unknown","foo"),/Invalid wardrobe/);
 assert.throws(()=>restoreAppearance({...createAppearance(),baseModelId:"../../secret"}),/Invalid/);
});
test("expressions include seven modes and finite smoothed face transforms",()=>{
 assert.equal(EXPRESSIONS.length,7);
 for(const [id] of EXPRESSIONS){
  const e=new ExpressionController();
  e.setPreset(id);
  let p;
  for(let i=0;i<120;i++)p=e.update(1/60);
  const t=expressionPoseValues(p);
  assert.ok(Object.values(t).every(Number.isFinite));
  assert.ok(p.blink>=0&&p.blink<=1);
  assert.ok(p.mouthWidth>=.5&&p.mouthWidth<=1.5);
 }
});
test("blink and gaze animate but do not move character world position",()=>{
 const e=new ExpressionController();
 e.setGaze(.8,-.6);
 e.setPreset("joy");
 let maxBlink=0;
 for(let i=0;i<350;i++){const p=e.update(.016);maxBlink=Math.max(maxBlink,p.blink)}
 assert.ok(maxBlink>.6,"No blink was triggered");
 assert.ok(e.current.gazeX>.75);
 const t=expressionPoseValues(e.current);
 assert.ok(t.leftEyeY>.20);
 assert.ok(t.leftEyeX<-.10);
 assert.ok(t.faceHeadY>.01);
});
test("disabling blink keeps eyes open and loading restores expression intent",()=>{
 const e=new ExpressionController({preset:"sadness",autoBlink:false,gazeX:-.4,gazeY:.3});
 for(let i=0;i<350;i++)e.update(.016);
 assert.ok(e.blink<.01);
 const restored=ExpressionController.fromSnapshot(e.snapshot());
 assert.deepEqual(restored.snapshot(),e.snapshot());
 assert.throws(()=>ExpressionController.fromSnapshot({version:1,preset:"joy",autoBlink:"yes",gazeX:0,gazeY:0}),/Invalid/);
 assert.throws(()=>e.setGaze(Infinity),/Invalid/);
});
test("actual facial meshes have correct 60-pivot IDs",()=>{
 const expected=new Set(["head","jaw","leftEye","rightEye"]);
 const face=makeFaceParts();
 assert.equal(face.length,9);
 assert.ok(face.every(p=>expected.has(p.pivot)));
 assert.equal(face.filter(p=>p.faceKind==="lid").length,2);
 assert.equal(face.filter(p=>p.faceKind==="mouth").length,1);
 assert.ok(face.every(p=>p.geometry.colors.length===p.geometry.positions.length));
});
test("renderer can dress and emote without changing world geometry or old action interface",()=>{
 let draws=0;
 const gl={
  VERTEX_SHADER:35633,FRAGMENT_SHADER:35632,COMPILE_STATUS:35713,LINK_STATUS:35714,
  ARRAY_BUFFER:34962,ELEMENT_ARRAY_BUFFER:34963,STATIC_DRAW:35044,FLOAT:5126,
  TRIANGLES:4,UNSIGNED_SHORT:5123,DEPTH_TEST:2929,
  COLOR_BUFFER_BIT:16384,DEPTH_BUFFER_BIT:256,BLEND:3042,SRC_ALPHA:770,ONE_MINUS_SRC_ALPHA:771,
  createShader:()=>({}),shaderSource(){},compileShader(){},getShaderParameter:()=>true,
  createProgram:()=>({}),attachShader(){},linkProgram(){},getProgramParameter:()=>true,
  getUniformLocation:()=>({}),createVertexArray:()=>({}),bindVertexArray(){},
  createBuffer:()=>({}),bindBuffer(){},bufferData(){},enableVertexAttribArray(){},
  vertexAttribPointer(){},enable(){},disable(){},uniformMatrix4fv(){},uniform3fv(){},
  uniform1f(){},useProgram(){},viewport(){},clearColor(){},clear(){},
  blendFunc(){},depthMask(){},drawElements(){draws++},deleteBuffer(){},
  deleteVertexArray(){},deleteProgram(){}
 };
 const canvas={clientWidth:960,clientHeight:560,width:960,height:560,getContext:()=>gl,
  getBoundingClientRect:()=>({left:0,top:0,width:960,height:560})};
 const planet=new Planet({seed:77}),terrain=new Terrain(planet);
 const renderer=new ExplorerRenderer(canvas,planet,terrain);
 const g=renderer.globe;
 const app=withAppearanceSlot(createAppearance("priest","scout"),"cape","long");
 renderer.setAppearance(app);
 assert.equal(renderer.avatarStyle,"scout");
 assert.equal(renderer.appearance.presetId,"priest");
 assert.ok(renderer.rigParts.some(x=>x.part.faceKind==="lid"));
 renderer.expression.setPreset("joy");
 const state={origin:{lat:28,lon:42},lat:28,lon:42,x:0,z:0,yaw:0,altitudeM:2.5,
  jumpY:0,moving:false,walkSpeed:5,totalDistanceM:0};
 // Draw near-ground via built-in renderer; real terrain/GL mocked.
 renderer.frame(state,.016);
 assert.ok(draws>renderer.rigParts.length);
 assert.equal(renderer.globe,g);
 renderer.destroy();
});
test("new UI contains expression, wardrobe and version-navigation controls",()=>{
 const html=readFileSync(new URL("../planet-explorer/index.html",import.meta.url),"utf8");
 const app=readFileSync(new URL("../planet-explorer/app.mjs",import.meta.url),"utf8");
 for(const id of ["outfit-select","hair-style","headwear","cape","bag","outer-color","legs-color",
  "feet-color","hair-color","expression-preset","gaze-x","auto-blink","reset-appearance","import-v07a-save"]){
  assert.match(html,new RegExp('id="'+id+'"'));
 }
 assert.match(app,/SAVE_KEY="universal-engine:explorer:v0\.7b"/);
 assert.match(app,/PREVIOUS_SAVE_KEY="universal-engine:explorer:v0\.7a"/);
 assert.match(app,/LEGACY_SAVE_KEY="universal-engine:explorer:v1"/);
 assert.match(html,/versions\/v0\.7a\/planet-explorer/);
 assert.match(html,/versions\/v0\.6\/planet-explorer/);
});
