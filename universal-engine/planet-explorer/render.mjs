import {geoNormal,geoOffset,geoLocal,DEG,clamp,wrapLon,samplePatch,terrainSurface} from "./geo.mjs?v=0.8v-alpine-horizon";
import {buildRiverWaterPatch} from "./landscape-relief.mjs";
import {regionalLakeMesh} from "./regional-landforms.mjs";
import {buildDistantLandscape} from "./distant-landscape.mjs";
import {groundCloudGeometry,cloudWind} from "./ground-clouds.mjs?v=0.8d-weather-drift";
import {BUILD_KINDS} from "./construction-system.mjs?v=0.8h-church";
import {placedBuildingGeometry} from "./placed-buildings-geometry.mjs?v=0.8h-church";
import {TREE_FALL_SECONDS,fallingTreeYaw,fallingTreeAngle,scaledMatrix} from "./tree-fall.mjs";
import {noise3} from "../planet/planet-core.mjs";
import {faunaGeometry} from "./fauna-geometry.mjs?v=0.8g-grazing";
import {agricultureGeometry} from "./agriculture-geometry.mjs?v=0.8g-crops";
import {RIG_SEGMENTS,samplePose,jointTransforms,matrixMultiply,translate,rotX,bowDrawState} from "./rig.mjs?v=0.8p-fishing-motion";
import {pickSurface} from "./picking.mjs";
import {pickOrbitalGeo} from "./orbit-landing.mjs";
import {projectOrbitalCities} from "./orbital-city-markers.mjs?v=0.8u-city-globe";
import {ORBIT_GROUND_CUTOFF_M} from "./descent-visuals.mjs";
import {oceanWavePatch,fishAt} from "./marine.mjs?v=0.8k-sailing-ship";
import {sailingShipGeometry} from "./sailing-ship-geometry.mjs?v=0.8k-ship-deck";
import {shipCabinGeometry,CABIN_FURNITURE} from "./ship-cabin-geometry.mjs?v=0.8m-living-cabin-r2";
import {shipLocalToWorld,shipWorldToLocal,isShipWalkable,SHIP_HELM,SHIP_DOOR} from "./shipboard.mjs?v=0.8n-crew-walking";
import {isAquaticAction,swimmingPresentation} from "./swim-motion.mjs?v=0.8q-splash";
import {SEA_SITE_TYPES,seabedPatch} from "./ocean-exploration.mjs?v=0.8o-seabed";
import {orbitalTerrainTier,buildOrbitalTerrainTile} from "./orbit-terrain-lod.mjs?v=0.8v-alpine-horizon";
import {globeIslandGeometry} from "./island-visuals.mjs?v=0.8p-island-globe";
import {buildOriginalModel} from "../original-assets/original-models.mjs";
import {jointTransformsV2} from "./rig-v2.mjs";
import {SmoothAnimator} from "./animator.mjs?v=0.8q-splash";
import {makeJointCovers} from "./joint-covers.mjs";
import {createAppearance,restoreAppearance,buildAppearanceParts} from "./wardrobe.mjs";
import {ExpressionController,makeFaceParts,expressionPoseValues} from "./expression.mjs";
import {rotZ} from "./rig.mjs?v=0.8p-fishing-motion";
import {CameraController} from "./camera-controller.mjs";
import {SkinnedFrontierAsset} from "./frontier-skinned-renderer.mjs?v=0.8q-splash";
import {CATALOG} from "./lifestyle.mjs";
import {enemyMotion,HUMANOID_MONSTERS} from "./enemy-motion.mjs";
import {furnitureGeometry,campGeometry,flameGeometry,dishGeometry} from "./lifestyle-geometry.mjs";
import {planWorldScenery,patchSceneryHeight} from "./world-scenery.mjs?v=0.8w-alpine-horizon";
import {buildSceneryMeshes,buildSceneryInstances,sceneryPrototype} from "./scenery-geometry.mjs?v=0.8e-sized-models";
import {observationTowerGeometry,settlementResidentsGeometry,townInteriorGeometry} from "./settlement-geometry.mjs?v=0.8s-rooms";
import {railwayStationGeometry,steamTrainGeometry,trainInteriorGeometry} from "./railway-geometry.mjs?v=0.8t-timetable";
import {railwayJourneyPose,railwayTrackSamples,railwayStationCoordinates} from "./railway-world.mjs?v=0.8v-track";
import {trackGeometry,wheelSpokesGeometry,connectingRodGeometry,steamPuffGeometry,locomotiveMotion} from "./railway-animated-geometry.mjs?v=0.8v-track";
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=a=>{const l=Math.hypot(...a)||1;return a.map(v=>v/l)};
export function projectScreen(vp,p){
 const x=vp[0]*p[0]+vp[4]*p[1]+vp[8]*p[2]+vp[12];
 const y=vp[1]*p[0]+vp[5]*p[1]+vp[9]*p[2]+vp[13];
 const w=vp[3]*p[0]+vp[7]*p[1]+vp[11]*p[2]+vp[15];
 if(!(w>.00001)||!Number.isFinite(w))return null;
 const u=.5+x/w*.5,v=.5-y/w*.5;
 if(!Number.isFinite(u)||!Number.isFinite(v))return null;
 return {u,v,onScreen:u>=0&&u<=1&&v>=0&&v<=1};
}
export function perspective(fov,aspect,near,far){
 const f=1/Math.tan(fov/2),q=1/(near-far);
 return [f/aspect,0,0,0,0,f,0,0,0,0,(far+near)*q,-1,0,0,2*far*near*q,0];
}
export function lookAt(eye,target,up=[0,1,0]){
 const f=norm(sub(target,eye)),s=norm(cross(f,up)),u=cross(s,f);
 return [s[0],u[0],-f[0],0,s[1],u[1],-f[1],0,s[2],u[2],-f[2],0,-dot(s,eye),-dot(u,eye),dot(f,eye),1];
}
export function multiply4(a,b){
 const out=new Array(16).fill(0);
 for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)out[c*4+r]+=a[k*4+r]*b[c*4+k];
 return out;
}
const VERT=["#version 300 es","precision highp float;","layout(location=0) in vec3 aPos;","layout(location=1) in vec3 aNorm;","layout(location=2) in vec3 aColor;","layout(location=3) in vec4 aInstance;","layout(location=4) in vec2 aFacing;","uniform mat4 uMvp;uniform float uInstanced;","out vec3 vN;out vec3 vC;","void main(){"," vec3 p=aPos,n=aNorm;"," if(uInstanced>0.5){","  float c=aFacing.x,s=aFacing.y;","  p=vec3((aPos.x*c+aPos.z*s)*aInstance.w,aPos.y*aInstance.w,(-aPos.x*s+aPos.z*c)*aInstance.w)+aInstance.xyz;","  n=vec3(aNorm.x*c+aNorm.z*s,aNorm.y,-aNorm.x*s+aNorm.z*c);"," }"," vN=n;vC=aColor;gl_Position=uMvp*vec4(p,1.0);","}"].join("\n");
const FRAG=["#version 300 es","precision highp float;","in vec3 vN; in vec3 vC;","uniform vec3 uLight;uniform float uAlpha;uniform float uAmbient;uniform vec3 uTint;","out vec4 fragColor;","void main(){float b=max(dot(normalize(vN),normalize(uLight)),0.0);fragColor=vec4(vC*uTint*(uAmbient+(1.0-uAmbient)*b),uAlpha);}"].join("\n");
function shader(gl,mode,src){
 const sh=gl.createShader(mode);gl.shaderSource(sh,src);gl.compileShader(sh);
 if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw Error("Shader compile: "+gl.getShaderInfoLog(sh));
 return sh;
}
class Mesh{
 constructor(gl,b){
  this.gl=gl;this.vao=gl.createVertexArray();this.buffers=[];
  gl.bindVertexArray(this.vao);
  for(const [i,values]of [[0,b.positions],[1,b.normals],[2,b.colors]]){
   const buffer=gl.createBuffer();this.buffers.push(buffer);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
   gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(values ?? b.vertices),gl.STATIC_DRAW);
   gl.enableVertexAttribArray(i);gl.vertexAttribPointer(i,3,gl.FLOAT,false,0,0);
  }
  this.indices=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,this.indices);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint16Array(b.indices),gl.STATIC_DRAW);
  this.count=b.indices.length;gl.bindVertexArray(null);
 }
 draw(){const gl=this.gl;gl.bindVertexArray(this.vao);gl.drawElements(gl.TRIANGLES,this.count,gl.UNSIGNED_SHORT,0)}
 destroy(){const gl=this.gl;for(const v of this.buffers)gl.deleteBuffer(v);gl.deleteBuffer(this.indices);gl.deleteVertexArray(this.vao)}
}
class InstancedMesh extends Mesh{
 constructor(gl,geometry,transforms){
  super(gl,geometry);
  if(transforms.length%6)throw new RangeError("Invalid scenery instance transforms");
  this.instanceCount=transforms.length/6;
  // Older GL mocks lack WebGL2 instancing APIs; keep nonvisual unit tests
  // compatible. Production WebGL2 browsers use the fast instanced path.
  this.supported=typeof gl.vertexAttribDivisor==="function"&&
    typeof gl.drawElementsInstanced==="function";
  if(!this.supported)return;
  gl.bindVertexArray(this.vao);
  const buffer=gl.createBuffer();this.buffers.push(buffer);
  gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
  gl.bufferData(gl.ARRAY_BUFFER,transforms,gl.DYNAMIC_DRAW);
  this.instanceBuffer=buffer;
  gl.enableVertexAttribArray(3);gl.vertexAttribPointer(3,4,gl.FLOAT,false,24,0);
  gl.vertexAttribDivisor(3,1);
  gl.enableVertexAttribArray(4);gl.vertexAttribPointer(4,2,gl.FLOAT,false,24,16);
  gl.vertexAttribDivisor(4,1);
  gl.bindVertexArray(null);
 }
 draw(){
  if(!this.instanceCount)return;
  if(!this.supported){super.draw();return;}
  const gl=this.gl;gl.bindVertexArray(this.vao);
  gl.drawElementsInstanced(gl.TRIANGLES,this.count,gl.UNSIGNED_SHORT,0,this.instanceCount);
 }
 updateTransforms(transforms){
  if(transforms.length!==this.instanceCount*6)throw new RangeError("Instance count mismatch");
  if(!this.supported||!this.instanceBuffer||typeof this.gl.bufferSubData!=="function")return;
  this.gl.bindBuffer(this.gl.ARRAY_BUFFER,this.instanceBuffer);
  this.gl.bufferSubData(this.gl.ARRAY_BUFFER,0,transforms);
 }
}

const builder=()=>({positions:[],normals:[],colors:[],indices:[]});
const rotateY=a=>{const c=Math.cos(a),s=Math.sin(a);return [c,0,-s,0,0,1,0,0,s,0,c,0,0,0,0,1]};
function triangle(b,a,c,d,col){
 const n=norm(cross(sub(c,a),sub(d,a))),k=b.positions.length/3;
 b.positions.push(...a,...c,...d);b.normals.push(...n,...n,...n);b.colors.push(...col,...col,...col);b.indices.push(k,k+1,k+2);
}
function quad(b,a,c,d,e,col){triangle(b,a,c,d,col);triangle(b,a,d,e,col)}
function box(b,x,y,z,rx,hh,rz,col){
 const a=[[x-rx,y,z-rz],[x+rx,y,z-rz],[x+rx,y+hh,z-rz],[x-rx,y+hh,z-rz],
 [x-rx,y,z+rz],[x+rx,y,z+rz],[x+rx,y+hh,z+rz],[x-rx,y+hh,z+rz]];
 for(const [i,j,k,l]of [[0,1,2,3],[4,7,6,5],[0,4,5,1],[3,2,6,7],[1,5,6,2],[4,0,3,7]])quad(b,a[i],a[j],a[k],a[l],col);
}
function cone(b,x,y,z,h,r,col,sides=7){
 for(let i=0;i<sides;i++){
  const a=i*2*Math.PI/sides,c=(i+1)*2*Math.PI/sides;
  triangle(b,[x+r*Math.cos(a),y,z+r*Math.sin(a)],[x+r*Math.cos(c),y,z+r*Math.sin(c)],[x,y+h,z],col);
 }
}

// Light, procedural marine assets: no external models required.
export function boatGeometry(kind="raft"){
 const b=builder(),wood=[.49,.29,.13],dark=[.28,.19,.12],sail=[.81,.78,.64];
 if(kind==="canoe"){
  box(b,0,-.27,0,.69,.37,2.35,dark);
  box(b,0,.06,0,.47,.13,1.9,wood);
  box(b,0,.2,-.53,.50,.10,.18,sail);
  box(b,0,.2,.58,.50,.10,.18,sail);
  for(const sign of [-1,1])box(b,sign*.59,.05,0,.08,.24,2.25,wood);
 }else{
  for(let x=-2;x<=2;x++)box(b,x*.37,-.14,0,.175,.25,2.12,wood);
  for(const z of [-1.3,1.3])box(b,0,.13,z,1.05,.12,.17,dark);
  box(b,0,.18,0,.1,.2,.7,dark);
 }
 return b;
}
export function fishGeometry(){
 const b=builder(),body=[.27,.66,.72],back=[.12,.42,.52],fin=[.84,.69,.24];
 triangle(b,[-.30,0,0],[.10,.18,.12],[.46,0,0],body);
 triangle(b,[-.30,0,0],[.46,0,0],[.10,-.18,-.12],back);
 triangle(b,[-.26,0,0],[-.56,.22,0],[-.56,-.22,0],fin);
 triangle(b,[-.03,.05,.03],[.16,.31,.02],[.23,.05,.03],fin);
 return b;
}
export function divingEquipmentGeometry(kind){
 const b=builder(),steel=[.46,.58,.62],cloth=[.21,.32,.42],gold=[.78,.68,.22];
 if(kind==="snorkel"){
  for(const x of [-.2,.2])box(b,x,.08,-.18,.19,.08,.42,[.21,.56,.74]);
  box(b,.30,1.45,-.01,.038,.44,.038,[.75,.81,.89]);
 }else if(kind==="scuba"){
  for(const x of [-.17,.17])box(b,x,.68,-.26,.14,.90,.15,steel);
  box(b,0,.68,-.38,.38,.11,.06,cloth);
  box(b,0,1.6,.11,.26,.12,.12,[.45,.78,.92]);
  for(const x of [-.19,.19])box(b,x,.03,-.18,.20,.08,.44,[.20,.52,.65]);
 }else if(kind==="suit"){
  box(b,0,.72,0,.47,.68,.35,[.30,.38,.42]);
  box(b,0,1.40,0,.35,.43,.36,[.41,.50,.54]);
  box(b,0,1.50,.32,.24,.19,.025,gold);
  for(const x of [-.62,.62])box(b,x,.89,0,.13,.55,.18,steel);
  for(const x of [-.22,.22])box(b,x,.14,0,.17,.55,.25,[.40,.49,.52]);
  box(b,0,.82,-.43,.34,.87,.23,steel);
 }
 return b;
}
export function submergedSiteGeometry(kind){
 const b=builder(),wood=[.38,.22,.10],stone=[.38,.51,.49],gold=[.93,.73,.20];
 if(kind==="wreck"){
  box(b,0,0,0,3,.40,6,wood);
  for(const side of [-1,1])box(b,side*2.5,.2,0,.18,1.1,5.6,wood);
  box(b,0,.2,-2.4,2.5,.45,.21,wood);box(b,0,.2,2.2,2.5,.45,.21,wood);
  box(b,.9,.3,-.8,.13,4.1,.13,wood);
 }else if(kind==="treasure"){
  box(b,0,0,0,.95,.65,.57,wood);box(b,0,.65,0,1.02,.21,.61,gold);
  for(const x of [-.74,.74])box(b,x,.14,0,.09,.43,.63,gold);
 }else if(kind==="ruins"){
  box(b,0,0,0,4,.35,3.2,stone);
  for(const x of [-2.6,2.6])for(const z of [-1.7,1.7]){
   box(b,x,.35,z,.35,3.7,.35,stone);box(b,x,4.05,z,.52,.20,.52,[.57,.61,.55]);
  }
  box(b,0,0,-2.4,3.7,1.1,.22,[.42,.47,.43]);
 }else{
  box(b,0,0,0,3.2,.55,3.2,[.18,.39,.48]);
  for(const x of [-2.1,2.1])for(const z of [-2.1,2.1]){
   box(b,x,.6,z,.42,3,.42,[.18,.48,.54]);
   cone(b,x,3.5,z,1.5,.63,[.39,.85,.90],8);
  }
  cone(b,0,.7,0,4.3,1.25,[.25,.80,.83],8);
 }
 return b;
}
export function deepWaterFishGeometry(){
 const b=builder(),glow=[.37,.94,.75],fin=[.18,.55,.72];
 triangle(b,[-.45,0,0],[.22,.28,0],[.68,0,0],glow);
 triangle(b,[-.45,0,0],[.68,0,0],[.22,-.28,0],fin);
 triangle(b,[-.45,0,0],[-.79,.40,0],[-.79,-.40,0],glow);
 box(b,.40,.10,.09,.06,.06,.06,[.96,.89,.24]);
 return b;
}
// Local equipment geometries are in metres; character forward is +Z.
export const EQUIPMENT_SCALE=Object.freeze({sword:.42,axe:.40,pickaxe:.32,hammer:.38});
function spearGeometry(){
 const b=builder(),wood=[.43,.27,.13],leather=[.22,.17,.12],steel=[.78,.84,.87];
 box(b,0,-.38,0,.027,1.97,.027,wood);
 box(b,0,-.28,0,.039,.38,.036,leather);
 box(b,0,1.55,0,.052,.14,.044,steel);
 cone(b,0,1.67,0,.48,.083,steel,8);
 for(const x of [-.08,.08])cone(b,x,1.61,0,.18,.038,steel,6);
 return b;
}
function greatswordGeometry(){
 const b=builder(),leather=[.28,.17,.11],iron=[.49,.52,.56],steel=[.80,.85,.92],edge=[.91,.93,.96];
 box(b,0,-.52,0,.040,.77,.041,leather);
 box(b,0,-.57,0,.087,.085,.073,iron);
 box(b,0,.21,0,.33,.070,.060,iron);
 for(const x of [-.31,.31])cone(b,x,.22,0,.12,.035,iron,6);
 box(b,0,.30,0,.128,1.10,.030,steel);
 for(const x of [-.125,.125])box(b,x,.33,0,.018,1.03,.032,edge);
 box(b,0,.32,.032,.016,1.10,.008,iron);
 cone(b,0,1.39,0,.34,.128,edge,6);
 return b;
}
function shieldGeometry(){
 const b=builder(),face=[.36,.43,.49],rim=[.79,.68,.43],center=[.64,.67,.72];
 box(b,0,-.10,.06,.23,.55,.035,face);
 box(b,0,-.10,.10,.025,.55,.05,rim);
 for(const x of [-.22,.22])box(b,x,-.10,.09,.025,.55,.045,rim);
 box(b,0,.38,.09,.24,.035,.05,rim);
 box(b,0,-.08,.14,.10,.18,.065,center);
 return b;
}
function bowGeometry(){
 const b=builder(),wood=[.51,.29,.15],wrapping=[.27,.18,.11];
 // Curved upper and lower limbs with a taut string and central wrapped grip.
 for(let i=0;i<16;i++){
  const y=-.64+i*.08,mid=y+.04;
  const z=.17*(1-(mid/.64)**2);
  box(b,0,y,z,.023,.082,.025,wood);
 }
 box(b,0,-.105,.16,.041,.21,.047,wrapping);
 return b;
}
function bowStringGeometry(draw=0){
 const b=builder(),thread=[.88,.82,.70];
 const nock=[0,0,-.018-Math.max(0,Math.min(1,draw))*.30];
 const beam=(a,c)=>{
  const w=.006;
  quad(b,[-w,a[1],a[2]],[w,a[1],a[2]],[w,c[1],c[2]],[-w,c[1],c[2]],thread);
  quad(b,[0,a[1],a[2]-w],[0,a[1],a[2]+w],[0,c[1],c[2]+w],[0,c[1],c[2]-w],thread);
 };
 beam([0,.64,-.018],nock);
 beam(nock,[0,-.64,-.018]);
 return b;
}
function trainingTargetGeometry(){
 const b=builder();
 box(b,0,.05,0,.09,1.55,.10,[.45,.29,.13]);
 box(b,0,1.11,.12,.86,1.05,.08,[.85,.81,.65]);
 box(b,0,1.26,.213,.66,.74,.025,[.63,.20,.18]);
 box(b,0,1.40,.245,.42,.46,.025,[.91,.89,.78]);
 box(b,0,1.51,.278,.20,.24,.025,[.65,.21,.16]);
 return b;
}
function arrowGeometry(type="wood"){
 const b=builder(),wood=type==="iron"?[.46,.50,.58]:[.65,.46,.25],
  steel=type==="fire"?[.95,.44,.1]:[.81,.88,.91],
  fletch=type==="fire"?[.98,.43,.12]:type==="iron"?[.39,.55,.72]:[.84,.25,.16];
 // Shaft and nock run along +Z: the arrowhead is pointed away from the avatar.
 box(b,0,-.008,0,.011,.016,.47,wood);
 for(const sign of [-1,1]){
  triangle(b,[0,-.008,.56],[sign*.050,-.010,.43],[0,.034,.43],steel);
  triangle(b,[0,-.008,.56],[0,-.050,.43],[sign*.050,-.010,.43],steel);
  triangle(b,[sign*.008,0,-.33],[sign*.10,.002,-.47],[sign*.008,.012,-.45],fletch);
 }
 if(type==="fire"){
  cone(b,0,-.005,.51,.23,.065,[1,.43,.10],7);
  cone(b,0,.08,.51,.17,.041,[1,.77,.13],6);
 }
 return b;
}
/** Arrow orientation is defined by the actor facing (+Z), NEVER the wrist.
 * Both nocked and launched arrows share this world-space forward frame.
 */
export function projectileTransform(actorFacing,progress=0,hand="right"){
 const state=bowDrawState(progress);
 const side=hand==="right"?-1:1;
 const x=side*.37*(1-state.nocked);
 const y=1.42-.21*(1-state.nocked)+.11*state.raised;
 const z=.51+.19*(1-state.nocked)-.31*state.tension+state.flight;
 return matrixMultiply(actorFacing,translate(x,y,z));
}
/** Keep the stave vertical in actor space even when the wrist pitches up
 * during the draw. Wrist position supplies the hand anchor; actor yaw supplies
 * orientation. The arrow continues to use that same actor-facing frame.
 */
export function uprightBowTransform(wristWorld,actorFacing){
 const yaw=Math.atan2(actorFacing[8],actorFacing[10]);
 return matrixMultiply(
  translate(wristWorld[12],wristWorld[13],wristWorld[14]),
  matrixMultiply(rotateY(yaw),heldItemTransform("bow"))
 );
}
function enemyGeometry(kind){
 const b=builder(),eye=[.11,.13,.12],steel=[.64,.68,.72];
 if(["skeleton","orc","lizardman","demon"].includes(kind))return humanoidMonsterGeometry(kind);
 if(kind==="slime"){
  const blue=[.34,.80,.68],dark=[.13,.48,.45];
  cone(b,0,.09,0,.95,.73,blue,12);
  box(b,0,.07,0,.55,.18,.50,dark);
  for(const side of [-1,1])box(b,side*.24,.48,.52,.065,.13,.025,eye);
 }else if(kind==="goblin"){
  const green=[.31,.58,.28],cloth=[.38,.27,.18];
  box(b,0,.48,0,.31,.79,.22,cloth);
  box(b,0,1.19,.025,.32,.39,.29,green);
  for(const side of [-1,1]){
   box(b,side*.35,.30,0,.12,.55,.14,green);
   box(b,side*.47,.87,0,.11,.55,.13,green);
   cone(b,side*.43,1.35,0,.21,.16,green,5);
   box(b,side*.13,1.39,.31,.052,.065,.025,eye);
  }
 }else{
  const coat=[.46,.20,.14],hood=[.24,.23,.24],skin=[.73,.51,.33];
  box(b,0,.54,0,.35,.90,.25,coat);
  box(b,0,1.38,0,.27,.34,.27,skin);
  box(b,0,1.64,-.05,.34,.15,.31,hood);
  for(const side of [-1,1]){
   box(b,side*.23,0,0,.13,.57,.15,hood);
   box(b,side*.46,.69,0,.13,.73,.17,coat);
  }
  box(b,0,1.46,.27,.22,.07,.08,hood);
 }
 return b;
}
/** Unique low-poly silhouettes for four upright fantasy adversaries.
 * Geometry is original and shares the small coloured vertex-buffer format.
 * Every creature has a recognisable head, torso, arms, legs and equipment.
 */
export function humanoidMonsterGeometry(kind){
 const b=builder();
 if(kind==="skeleton"){
  const bone=[.87,.83,.70],shade=[.60,.61,.56],voidColor=[.09,.13,.16],glow=[.36,.95,.94];
  // Separate bones / rib cage for an unmistakably skeletal silhouette.
  box(b,0,.88,0,.16,.48,.12,bone);
  for(let y=.97;y<1.52;y+=.14){
   box(b,0,y,.02,.32,.052,.14,bone);
   box(b,0,y,-.10,.23,.045,.07,shade);
  }
  box(b,0,.70,0,.26,.17,.17,shade);
  for(const side of [-1,1]){
   box(b,side*.22,0,0,.075,.48,.088,bone);
   box(b,side*.22,.52,0,.09,.25,.09,bone);
   box(b,side*.42,1.01,0,.065,.42,.075,bone);
   box(b,side*.42,1.47,0,.073,.34,.083,shade);
   box(b,side*.16,1.82,.28,.075,.075,.025,voidColor);
   box(b,side*.16,1.84,.307,.04,.035,.013,glow);
  }
  box(b,0,1.70,0,.26,.39,.25,bone);
  box(b,0,1.73,.20,.19,.12,.055,shade);
  box(b,0,1.71,.268,.13,.065,.019,voidColor);
  // Rusty one-handed sword + dark round shield.
  box(b,.44,.95,.17,.032,.85,.035,shade);
  box(b,.44,1.77,.17,.11,.17,.055,bone);
  box(b,.44,1.19,.17,.16,.055,.065,voidColor);
  cone(b,-.49,.85,.18,.66,.26,voidColor,9);
  box(b,-.49,1.05,.43,.23,.13,.035,shade);
 }else if(kind==="orc"){
  const skin=[.34,.52,.22],darkSkin=[.21,.35,.19],armor=[.38,.37,.34],
   iron=[.65,.65,.60],tusk=[.93,.88,.67],eye=[.87,.23,.12];
  // Wide heavy-set body, thick arms and broad jaw.
  box(b,0,.73,0,.53,1.00,.39,armor);
  box(b,0,.64,.39,.48,.20,.078,iron);
  box(b,0,1.73,0,.29,.16,.25,darkSkin);
  box(b,0,1.87,.05,.42,.48,.38,skin);
  box(b,0,1.89,.38,.31,.16,.21,darkSkin);
  for(const side of [-1,1]){
   box(b,side*.35,0,0,.22,.72,.22,darkSkin);
   box(b,side*.70,1.05,0,.22,.64,.24,skin);
   box(b,side*.72,1.68,0,.30,.28,.30,iron);
   box(b,side*.73,.88,.04,.23,.18,.22,darkSkin);
   cone(b,side*.24,1.97,.39,.29,.10,tusk,6);
   box(b,side*.17,2.12,.41,.064,.075,.026,eye);
  }
  // Broad iron-headed war club in one hand.
  box(b,.73,.38,.16,.070,1.21,.072,[.40,.26,.16]);
  box(b,.73,1.56,.16,.22,.42,.24,iron);
  for(let i=0;i<3;i++)cone(b,.60+i*.15,1.91,.16,.16,.055,iron,5);
 }else if(kind==="lizardman"){
  const scale=[.19,.55,.47],belly=[.65,.68,.36],dark=[.08,.30,.30],
   claw=[.91,.86,.65],eye=[.89,.71,.16],steel=[.62,.74,.73];
  box(b,0,.78,0,.34,.91,.23,scale);
  box(b,0,.80,.23,.22,.80,.035,belly);
  for(const side of [-1,1]){
   box(b,side*.22,0,0,.145,.74,.18,dark);
   box(b,side*.45,1.08,0,.14,.55,.17,scale);
   box(b,side*.44,1.59,0,.16,.16,.16,dark);
   box(b,side*.13,1.99,.37,.050,.07,.025,eye);
   cone(b,side*.25,2.14,-.04,.19,.13,scale,6);
  }
  box(b,0,1.69,0,.20,.18,.19,dark);
  box(b,0,1.82,.05,.28,.40,.29,scale);
  box(b,0,1.87,.33,.25,.14,.25,scale);
  box(b,0,1.80,.37,.23,.07,.21,belly);
  // The long counterbalancing tail extends behind the legs.
  triangle(b,[-.23,.76,-.19],[.23,.76,-.19],[0,.28,-1.37],scale);
  triangle(b,[0,.98,-.18],[-.23,.76,-.19],[0,.28,-1.37],dark);
  triangle(b,[.23,.76,-.19],[0,.98,-.18],[0,.28,-1.37],scale);
  // Trident carried by the right hand.
  box(b,.47,.27,.15,.036,2.04,.038,[.43,.31,.20]);
  for(const offset of [-.15,0,.15])
   cone(b,.47+offset,2.28,.15,.32,.072,steel,6);
  box(b,.47,2.18,.15,.22,.06,.055,steel);
  for(const sign of [-1,1])cone(b,sign*.19,2.18,.04,.14,.06,claw,5);
 }else if(kind==="demon"){
  const skin=[.39,.19,.29],armor=[.22,.17,.32],trim=[.67,.34,.50],
   horn=[.21,.14,.18],eye=[1,.25,.32],blade=[.78,.47,.64];
  // Armoured humanoid with horns, imposing pauldrons, cape and sword.
  box(b,0,.73,0,.42,1.02,.31,armor);
  box(b,0,1.17,.31,.35,.11,.04,trim);
  box(b,0,.74,.33,.44,.13,.065,trim);
  for(const side of [-1,1]){
   box(b,side*.27,0,0,.18,.73,.20,armor);
   box(b,side*.28,.67,.10,.21,.13,.23,trim);
   box(b,side*.54,1.06,0,.16,.63,.18,skin);
   box(b,side*.55,1.68,0,.32,.27,.28,armor);
   cone(b,side*.65,1.82,-.03,.32,.16,trim,7);
   cone(b,side*.29,2.08,-.07,.58,.125,horn,7);
   box(b,side*.14,2.12,.31,.067,.09,.027,eye);
  }
  box(b,0,1.74,0,.22,.16,.21,trim);
  box(b,0,1.86,.02,.28,.42,.27,skin);
  box(b,0,2.17,.02,.31,.15,.33,armor);
  // Large cape: visible dark wings behind the body.
  triangle(b,[-.44,1.68,-.25],[-.66,.20,-.49],[0,1.01,-.29],armor);
  triangle(b,[.44,1.68,-.25],[0,1.01,-.29],[.66,.20,-.49],armor);
  box(b,.55,.77,.23,.07,1.20,.055,horn);
  box(b,.55,1.95,.23,.17,.22,.075,blade);
  box(b,.55,.94,.23,.24,.07,.10,trim);
 }
 return b;
}
/** Each part is its own vertex mesh with a named local pivot.
 * Root/hip/shoulder/elbow/knee transforms can be animated separately.
 * Colors and face/weapon accents keep the species visually distinguishable.
 */
export function articulatedMonsterGeometry(kind){
 const palette={
  goblin:{skin:[.30,.58,.24],armor:[.46,.32,.16],metal:[.64,.62,.49],eye:[.80,.19,.12],w:.29},
  bandit:{skin:[.75,.57,.41],armor:[.39,.21,.17],metal:[.66,.68,.71],eye:[.12,.17,.17],w:.34},
  skeleton:{skin:[.88,.83,.72],armor:[.36,.36,.38],metal:[.73,.74,.72],eye:[.07,.10,.12],w:.24},
  orc:{skin:[.35,.56,.27],armor:[.38,.37,.31],metal:[.70,.68,.60],eye:[.82,.23,.14],w:.49},
  lizardman:{skin:[.20,.57,.47],armor:[.25,.42,.36],metal:[.67,.78,.75],eye:[.95,.70,.15],w:.34},
  demon:{skin:[.43,.23,.35],armor:[.23,.17,.32],metal:[.77,.42,.56],eye:[.98,.25,.30],w:.40}
 };
 const p=palette[kind];if(!p)throw RangeError("Unknown humanoid monster: "+kind);
 const out=Object.fromEntries(["torso","head","leftUpper","leftLower","rightUpper","rightLower",
  "leftThigh","leftShin","rightThigh","rightShin","weapon","shield"].map(n=>[n,builder()]));
 const isBone=kind==="skeleton";
 const W=p.w;
 // Main body is local to a pelvis joint at 1.18m.
 box(out.torso,0,-.24,0,W,.68,.23,p.armor);
 box(out.torso,0,-.23,.24,W*.77,.09,.035,p.metal);
 if(isBone){
  box(out.torso,0,-.20,.26,.06,.43,.045,p.skin);
  for(let y=-.14;y<.28;y+=.125){
   box(out.torso,0,y,.28,.21,.04,.055,p.skin);
  }
 }else{
  box(out.torso,0,.18,.24,W*.8,.065,.045,p.metal);
  if(kind==="orc")box(out.torso,0,-.12,.28,W*.85,.25,.10,p.skin);
 }
 if(kind==="demon"){
  triangle(out.torso,[-W,.28,-.18],[-W*1.5,-.65,-.32],[0,-.47,-.34],p.armor);
  triangle(out.torso,[W,.28,-.18],[0,-.47,-.34],[W*1.5,-.65,-.32],p.armor);
 }
 if(kind==="lizardman"){
  triangle(out.torso,[-.15,-.37,-.17],[.15,-.37,-.17],[0,-.72,-1.25],p.skin);
  triangle(out.torso,[0,-.18,-.12],[-.15,-.37,-.17],[0,-.72,-1.25],p.armor);
 }
 // Head mesh lives in neck-relative coordinates.
 box(out.head,0,0,.02,W*.74,.37,.25,p.skin);
 box(out.head,-W*.31,.20,.28,.052,.073,.023,p.eye);
 box(out.head,W*.31,.20,.28,.052,.073,.023,p.eye);
 if(isBone){
  box(out.head,0,-.09,.27,W*.56,.095,.052,p.armor);
  box(out.head,0,-.20,.20,W*.48,.06,.08,p.skin);
 }else if(kind==="orc"){
  box(out.head,0,-.10,.29,W*.67,.17,.19,p.skin);
  for(const sign of [-1,1])cone(out.head,sign*W*.44,-.03,.46,.21,.072,[.92,.85,.65],6);
 }else if(kind==="lizardman"){
  box(out.head,0,-.02,.28,W*.65,.125,.25,p.skin);
  for(const sign of [-1,1])cone(out.head,sign*W*.5,.27,-.05,.18,.1,p.skin,6);
 }else if(kind==="demon"){
  for(const sign of [-1,1])cone(out.head,sign*W*.53,.29,-.04,.43,.12,p.metal,7);
 }else if(kind==="bandit"){
  box(out.head,0,.28,-.06,W*.92,.15,.33,p.armor);
 }else{
  for(const sign of [-1,1])cone(out.head,sign*W*.65,.15,-.08,.17,.085,p.skin,6);
 }
 // Joint-local arm segments; negative Y extends toward the next hinge.
 for(const side of ["left","right"]){
  const upper=out[side+"Upper"],lower=out[side+"Lower"];
  box(upper,0,-.36,-.01,W*.40,.38,.17,p.skin);
  box(upper,0,-.08,0,W*.54,.18,.20,p.armor);
  box(lower,0,-.33,0,W*.36,.34,.15,p.skin);
  box(lower,0,-.31,.01,W*.43,.12,.16,p.armor);
  const thigh=out[side+"Thigh"],shin=out[side+"Shin"];
  box(thigh,0,-.41,0,W*.46,.43,.19,p.armor);
  box(shin,0,-.35,0,W*.38,.36,.16,p.skin);
  box(shin,0,-.39,.12,W*.49,.085,.23,p.armor);
  if(isBone){
   box(thigh,0,-.34,.205,W*.16,.32,.045,p.skin);
   box(shin,0,-.28,.17,W*.13,.31,.05,p.skin);
  }
 }
 // Right-hand weapon follows wrist/elbow movement, with a defined blade axis.
 if(kind==="lizardman"){
  box(out.weapon,0,-.13,.03,.033,1.56,.035,[.47,.31,.17]);
  for(const o of [-.12,0,.12])cone(out.weapon,o,1.41,.03,.31,.055,p.metal,6);
  box(out.weapon,0,1.36,.03,.20,.06,.07,p.metal);
 }else if(kind==="orc"){
  box(out.weapon,0,-.12,0,.055,1.09,.06,[.46,.33,.18]);
  box(out.weapon,0,.86,0,.20,.33,.24,p.metal);
  for(const x of [-.13,.13])cone(out.weapon,x,1.14,0,.17,.070,p.metal,5);
 }else{
  box(out.weapon,0,-.20,0,.05,.44,.06,[.39,.27,.19]);
  box(out.weapon,0,.12,0,.22,.075,.09,p.metal);
  box(out.weapon,0,.19,0,.095,.72,.052,p.metal);
  cone(out.weapon,0,.87,0,.19,.095,p.metal,5);
 }
 // Left arm can raise a shield to block the player's swing.
 const shield=p.armor,iron=p.metal;
 box(out.shield,0,-.14,.20,W*.73,.43,.075,shield);
 box(out.shield,0,-.06,.283,W*.58,.09,.018,iron);
 if(kind==="skeleton")cone(out.shield,0,-.26,.24,.52,W*.67,iron,8);
 return out;
}
function enemyHealthMesh(fill){
 const b=builder();box(b,0,0,0,.49,.085,.042,fill?[.27,.91,.43]:[.11,.16,.20]);return b;
}
export function heldItemTransform(kind){
 const grip=translate(0,-.155,.05);
 // Blades point ahead at rest, instead of hanging downward from the wrist.
 // A bow retains its vertical shape while the arrow points ahead.
 return ["bow","shield","fishingRod"].includes(kind)?grip:multiply4(grip,rotX(Math.PI/2));
}
function sphereGeometry(terrain,planet){
 const ground=builder(),clouds=builder(),R=600,resLat=64,resLon=128;
 for(let j=0;j<resLat;j++)for(let i=0;i<resLon;i++){
  const la=-90+j*180/resLat,lb=-90+(j+1)*180/resLat,lo=-180+i*360/resLon,lp=-180+(i+1)*360/resLon;
  const coords=[[la,lo],[la,lp],[lb,lp],[lb,lo]],ss=coords.map(([a,b])=>terrainSurface(terrain,a,b));
  const mean=ss.reduce((a,b)=>a+b.elevationM,0)/4,lat=(la+lb)/2,lon=(lo+lp)/2;
  const temp=28-Math.abs(lat)*.61-Math.max(0,mean)*.006;
  const sea=ss.filter(s=>s.water).length>=2;
  const col=sea?[.07,.26,.51]:temp<-3||mean>3200?[.86,.90,.91]:mean>1900?[.51,.49,.42]:
   temp>29?[.60,.56,.35]:mean>1200?[.34,.49,.24]:[.15,.43,.24];
  const points=coords.map(([a,b],k)=>geoNormal(a,b).map(v=>v*(R+Math.max(0,ss[k].elevationM)*3/planet.radiusM*R)));
  quad(ground,points[0],points[3],points[2],points[1],col);
  const n=geoNormal(lat,lon);
  if(noise3(n[0]*8+3,n[1]*8,n[2]*8-1,planet.seed+91)>.20){
   // Cloud deck near 13 km, rather than the old 85 km shell.
   const pp=coords.map(c=>geoNormal(...c).map(v=>v*(R+1.2)));
   quad(clouds,pp[0],pp[3],pp[2],pp[1],[.91,.95,1]);
  }
 }
 return {ground,clouds,R};
}
// Original world meshes share the same vertex-color format as the WebGL adapter.
// Each tree is a compact triangle hierarchy; no third-party model imports.
const natureModelCache=new Map();
function original(id){
 if(!natureModelCache.has(id))natureModelCache.set(id,buildOriginalModel(id));
 return natureModelCache.get(id);
}
function appendModel(b,model,x,y,z,scale=1,angle=0){
 const c=Math.cos(angle),s=Math.sin(angle);
 for(const part of model.parts){
   const mesh=part.geometry, offset=b.positions.length/3;
   for(let k=0;k<mesh.positions.length;k+=3){
     const px=mesh.positions[k]*scale,pz=mesh.positions[k+2]*scale;
     b.positions.push(x+c*px-s*pz,y+mesh.positions[k+1]*scale,z+s*px+c*pz);
     const nx=mesh.normals[k],ny=mesh.normals[k+1],nz=mesh.normals[k+2];
     b.normals.push(c*nx-s*nz,ny,s*nx+c*nz);
   }
   b.colors.push(...mesh.colors);
   for(const idx of mesh.indices)b.indices.push(idx+offset);
 }
}

export class ExplorerRenderer{
 constructor(canvas,planet,terrain){
  const gl=canvas.getContext("webgl2",{antialias:true,alpha:true,powerPreference:"high-performance"});
  if(!gl)throw Error("WebGL2が利用できません。対応ブラウザを利用してください。");
  this.gl=gl;this.canvas=canvas;this.planet=planet;this.terrain=terrain;
  this.cameraController=new CameraController();
  this.actorMarker=null;
  this.screenActors=[];this.screenResources=[];this.resourceNodes=[];this.selectedResource=null;this.mapFocus=null;
  this.screenAnimals=[];this.fauna=null;this.farm=null;this.screenFarms=[];this.farmMeshes=new Map();this.animalGrazeMeshes=new Map();
  this.animalMeshes=Object.fromEntries(["horse","cattle","sheep","goat","chicken","dog","cat"].map(k=>
   [k,new Mesh(gl,faunaGeometry(k))]));this.horseTackMeshes=new Map();
   this.fallingTrees=new Map();this.cloudEast=0;this.cloudNorth=0;this.cloudOriginEast=0;this.cloudOriginNorth=0;this.cloudCoverBand=null;
  this.squad=null;
  this.npcAnimators=new Map();
  const ring=builder();
  for(let i=0;i<24;i++){
   const a=i*Math.PI/12,b=(i+1)*Math.PI/12;
   quad(ring,[Math.cos(a)*1.15,.06,Math.sin(a)*1.15],
     [Math.cos(b)*1.15,.06,Math.sin(b)*1.15],
     [Math.cos(b)*1.40,.06,Math.sin(b)*1.40],
     [Math.cos(a)*1.40,.06,Math.sin(a)*1.40],[.15,.96,1]);
  }
  this.selectionRing=new Mesh(gl,ring);
  const pg=gl.createProgram();gl.attachShader(pg,shader(gl,gl.VERTEX_SHADER,VERT));
  gl.attachShader(pg,shader(gl,gl.FRAGMENT_SHADER,FRAG));gl.linkProgram(pg);
  if(!gl.getProgramParameter(pg,gl.LINK_STATUS))throw Error("Shader link: "+gl.getProgramInfoLog(pg));
  this.program=pg;this.uMvp=gl.getUniformLocation(pg,"uMvp");this.uLight=gl.getUniformLocation(pg,"uLight");
  this.uAlpha=gl.getUniformLocation(pg,"uAlpha");this.uAmbient=gl.getUniformLocation(pg,"uAmbient");this.uTint=gl.getUniformLocation(pg,"uTint");this.uInstanced=gl.getUniformLocation(pg,"uInstanced");
  const earth=sphereGeometry(terrain,planet);this.R=earth.R;
  this.globeIslands=new Mesh(gl,globeIslandGeometry(terrain,this.R));
  this.globe=new Mesh(gl,earth.ground);this.cloud=new Mesh(gl,earth.clouds);
  this.orbitDetail=null;this.orbitDetailCenter=null;this.orbitDetailRadius=0;
  this.patch=null;this.distantLandscape=null;this.distantCenter=null;this.distantKey=null;this.lakeWater=null;this.riverWater=null;this.oceanWave=null;this.lastWaveAt=-1;this.marineClock=0;this.marine=null;this.groundClouds=null;this.trees=[];this.meadow=[];this.settlement=[];this.settlementDecor=[];this.residentMeshes=[];this.settlementId="pioneer";this.townInterior=null;this.townRoomMeshes=new Map();this.townIndoorAvatarMesh=null;this.screenTownResidents=[];this.screenTownBuildings=[];this.townSites=[];this.sceneryStats=null;this.patchKey=null;
   this.railway=null;this.trainInterior=null;this.trainClock=0;
   this.railwayStationMesh=new Mesh(gl,railwayStationGeometry());
   this.railWheelSpokes=new Mesh(gl,wheelSpokesGeometry());
   this.railConnectingRod=new Mesh(gl,connectingRodGeometry());
   this.railSmokePuff=new Mesh(gl,steamPuffGeometry());
   this.railJourneyPatch=null;this.railJourneyTrack=null;this.railJourneyTrees=[];
   this.railJourneyGrass=[];this.railJourneyOrigin=null;this.railJourneyGeo=null;
   this.railJourneyData=null;this.railJourney=null;this.railCameraFixed=null;
   this.railJourneyHorizon=null;this.railJourneyHorizonGeo=null;
   this.trainWindowHorizon=null;this.trainWindowHorizonGeo=null;this.railwayLocations=null;this.stationTrackMesh=null;this.stationTrackId=null;
   this.trainWindowPatch=null;this.trainWindowGeo=null;this.trainPersonMesh=null;this.trainPersonKey=null;
   this.railwayTrainMesh=new Mesh(gl,steamTrainGeometry());this.trainRoomMeshes=new Map();
   this.resourceHarvest=null;
  // Original segmented humanoid; each mesh is parented to a semantic joint.
  this.avatarStyle="pioneer";
  this.rigParts=[];
  this.animator=new SmoothAnimator();
  this.expression=new ExpressionController();
  this.appearance=createAppearance("pioneer","pioneer");
  this.setAppearance(this.appearance);
  this.tools={};
  for(const [tool,scale] of Object.entries(EQUIPMENT_SCALE)){
    const src=original(tool).parts[0].geometry;
    // Reduce oversized display meshes; retain the original tool geometry for exports.
    const b={positions:[],normals:[...src.normals],colors:[...src.colors],indices:[...src.indices]};
    for(let k=0;k<src.positions.length;k+=3){
      b.positions.push(src.positions[k]*scale,src.positions[k+1]*scale,src.positions[k+2]*scale);
    }
    this.tools[tool]=new Mesh(gl,b);
  }
  this.tools.spear=new Mesh(gl,spearGeometry());
   this.tools.greatsword=new Mesh(gl,greatswordGeometry());
   this.tools.bow=new Mesh(gl,bowGeometry());
  this.tools.shield=new Mesh(gl,shieldGeometry());
  this.bowStrings=Array.from({length:9},(_,i)=>new Mesh(gl,bowStringGeometry(i/8)));
  this.tools.arrow=new Mesh(gl,arrowGeometry());
   this.typedArrows={wood:this.tools.arrow,iron:new Mesh(gl,arrowGeometry("iron")),
    fire:new Mesh(gl,arrowGeometry("fire"))};
  this.practiceTargetMesh=new Mesh(gl,trainingTargetGeometry());
  this.arrowWorld=null;this.screenArrows=[];this.screenTargets=[];
  this.battle=null;
  // Humanoids now use 12 articulated meshes each; only slime needs a static mesh.
  this.enemyMeshes={slime:new Mesh(gl,enemyGeometry("slime"))};
  this.animatedEnemies=Object.fromEntries(HUMANOID_MONSTERS.map(kind=>
   [kind,Object.fromEntries(Object.entries(articulatedMonsterGeometry(kind))
    .map(([name,g])=>[name,new Mesh(gl,g)]))]));
  this.enemyHealthTrack=new Mesh(gl,enemyHealthMesh(false));
  this.enemyHealthFill=new Mesh(gl,enemyHealthMesh(true));
  this.buildingMeshes=this.makeBuildingMeshes(gl);
  this.roomMeshes=this.makeRoomMeshes(gl);this.doorAngles=new Map();this.screenDoors=[];this.screenShelves=[];this.interiorBuildingId=null;
  this.lifeMeshes={};
  for(const kind of Object.keys(CATALOG).filter(k=>CATALOG[k].inside))this.lifeMeshes[kind]=new Mesh(gl,furnitureGeometry(kind));
  this.campMeshes={tent:new Mesh(gl,campGeometry("tent")),tentCutaway:new Mesh(gl,campGeometry("tent",true)),
   bedroll:new Mesh(gl,campGeometry("bedroll")),fire:new Mesh(gl,flameGeometry())};
  this.dishMeshes={};
  for(const kind of ["plate","bowl","cup","pot"])this.dishMeshes[kind]=new Mesh(gl,dishGeometry(kind));
  this.sceneLife=null;this.screenFurniture=[];this.screenCamps=[];
  this.boatMeshes={raft:new Mesh(gl,boatGeometry("raft")),canoe:new Mesh(gl,boatGeometry("canoe"))};
   this.sailingShipMeshes=[0,.5,1].map(trim=>new Mesh(gl,sailingShipGeometry(trim)));
   this.shipCabinShell=new Mesh(gl,shipCabinGeometry());
   const shipDoor=builder();
   box(shipDoor,0,0,0,.53,1.69,.07,[.40,.24,.12]);
   box(shipDoor,.37,.81,.085,.052,.14,.035,[.91,.72,.38]);
   this.shipDoorMesh=new Mesh(gl,shipDoor);
   this.screenShipCrew=[];this.screenShipDoor=null;this.screenShipHelm=null;
   this.screenMarineFurniture=[];
   const rod=builder();
   box(rod,0,.05,0,.019,2.8,.019,[.53,.35,.16]);
   box(rod,0,2.63,0,.009,.38,.009,[.82,.80,.71]);
   this.fishingRod=new Mesh(gl,rod);
   this.tools.fishingRod=new Mesh(gl,rod);
   const float=builder();
   cone(float,0,0,0,.23,.13,[.90,.22,.15],8);
   box(float,0,-.13,0,.08,.13,.08,[.96,.94,.74]);
   this.fishingFloat=new Mesh(gl,float);
  this.fishMesh=new Mesh(gl,fishGeometry());
  this.seabedMesh=null;this.seabedAnchor=null;this.screenUnderseaSites=[];
  this.divingEquipmentModels=Object.fromEntries(["snorkel","scuba","suit"]
   .map(kind=>[kind,new Mesh(gl,divingEquipmentGeometry(kind))]));
  this.deepFishMesh=new Mesh(gl,deepWaterFishGeometry());
  this.underseaModels=Object.fromEntries(Object.keys(SEA_SITE_TYPES)
   .map(kind=>[kind,new Mesh(gl,submergedSiteGeometry(kind))]));
  this.placedMeshes=Object.fromEntries(BUILD_KINDS.map(kind=>[kind,new Mesh(gl,placedBuildingGeometry(kind))]));
  this.constructionSystem=null;
  this.sceneActions=null;this.sceneFrontier=null;this.glbMeshes={};this.animatedGlb={};this.glbStatuses={};this.socialAnimations=new Map();this.handEquipment={};this.actionHand={};this.glbFor={player:'male',scout:'female',artisan:'male'};this.rtsHeadingUp=false;this.rtsHeadingYaw=0;
   this.fwResourceMeshes={};
   const colors={wood:[.40,.24,.15],stone:[.54,.59,.62],fiber:[.27,.64,.35],food:[.80,.31,.23],water:[.22,.59,.84]};
   for(const [kind,color] of Object.entries(colors)){
    const geo=builder();box(geo,0,0,0,.48,.85,.48,color);
    if(kind==='wood'||kind==='fiber')cone(geo,0,.86,0,.6,.55,color);
    this.fwResourceMeshes[kind]=new Mesh(gl,geo);
   }
  this.pickVP=null;this.groundPatchData=null;
  this.orbitVP=null;this.orbitOffsetDeg=0;this.selectedLanding=null;this.screenLanding=null;
  this.orbitPan=null;this.lastOrbitCenter=null;this.orbitFocus=null;
  gl.enable(gl.DEPTH_TEST);
 }
 setAvatarStyle(id){
   if(!["pioneer","scout","artisan"].includes(id))throw new RangeError("Unknown avatar style");
   this.setAppearance(createAppearance(id,id));
   return id;
 }
 setAppearance(input){
   const appearance=restoreAppearance(input);
   const parts=[...buildAppearanceParts(appearance),...makeFaceParts()];
   const meshes=[];
   try{for(const part of parts)meshes.push({mesh:new Mesh(this.gl,part.geometry),part});}
   catch(e){for(const entry of meshes)entry.mesh.destroy();throw e;}
   for(const entry of this.rigParts||[])entry.mesh.destroy();
   this.rigParts=meshes;
   this.appearance=appearance;
   this.avatarStyle=appearance.baseModelId;
   return {...appearance};
 }
 makeBuildingMeshes(gl){
   const parts=original("hut").parts;
   return {
     base:new Mesh(gl,parts[0].geometry),
     walls:new Mesh(gl,parts[1].geometry),
     roof:new Mesh(gl,parts[2].geometry),
     details:new Mesh(gl,parts[3].geometry)
   };
 }
 makeRoomMeshes(gl){
   const door=builder(),floor=builder(),furniture=builder(),bookshelf=builder();
   box(door,.64,.29,0,.64,2.03,.065,[.37,.23,.16]);
   box(door,1.04,1.36,.095,.065,.105,.045,[.86,.68,.35]);
   box(floor,0,.27,0,2.58,.12,2.22,[.50,.34,.22]);
   box(floor,0,.395,0,1.55,.015,1.25,[.36,.48,.42]);
   const items=[
    [-1.72,.42,-.88,.58,.29,1.05,[.40,.25,.17]],
    [-1.72,.72,-1.1,.54,.16,.58,[.81,.78,.62]],
    [-1.72,.61,-.48,.54,.08,.48,[.65,.24,.18]],
    [1.67,.40,-1.2,.60,.70,.43,[.37,.23,.12]],
    [1.67,1.07,-1.2,.62,.08,.46,[.68,.51,.28]],
    [1.67,1.18,-.89,.13,.055,.05,[.90,.72,.37]],
    [.62,.54,0,.78,.76,.53,[.40,.27,.16]],
    [.62,1.28,0,.90,.10,.62,[.69,.48,.28]],
    [.62,.43,-1.05,.38,.48,.38,[.36,.25,.16]],
    [.62,.84,-1.28,.38,.47,.10,[.43,.29,.17]],
    [.62,.43,1.03,.38,.48,.38,[.36,.25,.16]],
    [.62,.84,1.26,.38,.47,.10,[.43,.29,.17]],
    [-.7,.41,-1.78,.32,.75,.25,[.42,.29,.15]],
    [-.7,1.17,-1.78,.12,.35,.12,[.96,.82,.42]]];
   for(const item of items)box(furniture,...item);
   // Shelf built from separate planks and rows of upright colored books.
   const wood=[.43,.29,.18],edge=[.27,.18,.12];
   box(bookshelf,.28,.40,-1.98,.94,2.12,.33,wood);
   box(bookshelf,.28,.46,-1.60,.86,.13,.06,edge);
   for(const y of [.61,1.26,1.91]){
    box(bookshelf,.28,y,-1.62,.88,.10,.30,[.61,.39,.22]);
    for(let i=0;i<7;i++){
     const colors=[[.23,.45,.51],[.62,.30,.22],[.66,.56,.28],[.25,.44,.32],[.58,.34,.48]];
     const color=colors[(i+Math.round(y*5))%colors.length];
     box(bookshelf,-.39+i*.22,y+.11,-1.62,.085,.45+(i%3)*.035,.15,color);
     box(bookshelf,-.39+i*.22,y+.25,-1.46,.05,.012,.018,[.9,.78,.54]);
    }
   }
   return {door:new Mesh(gl,door),floor:new Mesh(gl,floor),furniture:new Mesh(gl,furniture),
    bookshelf:new Mesh(gl,bookshelf)};
  }
  pickTownTarget(clientX,clientY){
   const rect=this.canvas.getBoundingClientRect();
   if(!rect.width||!rect.height||this.townInterior||this.trainInterior)return null;
   let nearest=null,best=36;
   for(const target of [...this.screenTownResidents,...this.screenTownBuildings]){
    if(!target.onScreen)continue;
    const distance=Math.hypot(target.u*rect.width-(clientX-rect.left),
     target.v*rect.height-(clientY-rect.top));
    if(distance<best){nearest=target;best=distance;}
   }
   return nearest;
  }
  orbitCityMarkers(locations=[]){
   return this.orbitVP&&this.orbitCamera?
    projectOrbitalCities(locations,{viewProjection:this.orbitVP,
     camera:this.orbitCamera,radius:this.R,spinOffsetDeg:this.orbitOffsetDeg||0}):[];
  }
  pickArrow(clientX,clientY){
   const r=this.canvas.getBoundingClientRect();if(!r.width||!r.height)return null;
   let nearest=null,dist=35;
   for(const arrow of this.screenArrows||[]){
    if(!arrow.onScreen)continue;
    const d=Math.hypot(arrow.u*r.width-(clientX-r.left),arrow.v*r.height-(clientY-r.top));
    if(d<dist){nearest=arrow;dist=d;}
   }
   return nearest;
  }
  pickTarget(clientX,clientY){
   const r=this.canvas.getBoundingClientRect();if(!r.width||!r.height)return null;
   let nearest=null,dist=52;
   for(const target of this.screenTargets||[]){
    if(!target.onScreen)continue;
    const d=Math.hypot(target.u*r.width-(clientX-r.left),target.v*r.height-(clientY-r.top));
    if(d<dist){nearest=target;dist=d;}
   }
   return nearest;
  }
  pickAnimal(clientX,clientY){
   const rect=this.canvas.getBoundingClientRect();if(!rect.width||!rect.height)return null;
   const u=(clientX-rect.left)/rect.width,v=(clientY-rect.top)/rect.height;
   let nearest=null,range=56;
   for(const a of this.screenAnimals||[]){
    if(!a.onScreen)continue;
    const d=Math.hypot((a.u-u)*rect.width,(a.v-v)*rect.height);
    if(d<range){range=d;nearest=a;}
   }
   return nearest;
  }
  drawAgriculture(vp,light,actor,radius){
   this.screenFarms=[];
   if(!this.farm)return;
   for(const p of this.farm.plots){
    const x=p.x-this.cx,z=p.z-this.cz;
    if(Math.abs(x)>radius||Math.abs(z)>radius)continue;
    const coord=geoOffset(actor.origin.lat,actor.origin.lon,p.x,p.z,this.planet.radiusM);
    const ground=terrainSurface(this.terrain,coord.lat,coord.lon);
    if(ground.water||ground.river)continue;
    const stage=Math.round(this.farm.growth(p,this.planet.timeDays)*10);
    const kind=p.crop||"field",key=kind+":"+stage;
    if(!this.farmMeshes.has(key))this.farmMeshes.set(key,
     new Mesh(this.gl,agricultureGeometry(kind,stage/10)));
    const y=Math.max(0,ground.elevationM);
    this.drawMesh(this.farmMeshes.get(key),multiply4(vp,translate(x,y+.04,z)),light,1,.86);
    const screen=projectScreen(vp,[x,y+(kind==="apple"?1.4:.38),z]);
    if(screen?.onScreen)this.screenFarms.push({...screen,id:p.id});
   }
  }
  pickFarm(clientX,clientY){
   const rect=this.canvas.getBoundingClientRect();if(!rect.width||!rect.height)return null;
   let best=null,range=44;
   for(const p of this.screenFarms){
    const d=Math.hypot(p.u*rect.width-(clientX-rect.left),p.v*rect.height-(clientY-rect.top));
    if(d<range){best=p;range=d;}
   }
   return best;
  }
  drawFauna(vp,light,actor,radius){
   this.screenAnimals=[];
   if(!this.fauna)return;
   for(const a of this.fauna.animals){
    const x=a.x-this.cx,z=a.z-this.cz;
    if(Math.abs(x)>radius||Math.abs(z)>radius)continue;
    const geo=geoOffset(actor.origin.lat,actor.origin.lon,a.x,a.z,this.planet.radiusM);
    const surf=terrainSurface(this.terrain,geo.lat,geo.lon);
    if(surf.water||surf.river)continue;
    const y=Math.max(0,surf.elevationM),height=a.kind==="horse"||a.kind==="cattle"?2.0:a.kind==="chicken"?.8:1.4;
    const projected=projectScreen(vp,[x,y+height,z]);
    if(projected?.onScreen)this.screenAnimals.push({...projected,id:a.id,kind:a.kind});
    const mounted=this.fauna.mountId===a.id;
    const active=mounted?Boolean(actor.moving):Boolean(a.following);
    const gait=mounted?this.fauna.gait:"walk";
    const frequency=gait==="gallop"?12:gait==="trot"?8:4;
    const phase=this.fauna.elapsed*frequency;
    const bounce=active?(gait==="gallop"?.085:.035)*Math.abs(Math.sin(phase)):0;
    const pitch=active?(gait==="gallop"?.065:.022)*Math.sin(phase):0;
    const model=multiply4(translate(x,y+bounce,z),multiply4(rotateY(a.yaw),rotX(pitch)));
    let mesh=this.animalMeshes[a.kind];
    if(a.kind==="horse"){
     const frame=active?Math.floor((phase%(Math.PI*2)+Math.PI*2)%(Math.PI*2)/(Math.PI*2)*12):0;
     const key=a.id+":"+Object.values(a.gear).map(Boolean).join("/")+":"+gait+":"+frame+":"+Number(active)+":"+Number(a.grazing);
     if(!this.horseTackMeshes.has(key)){
      const gaitPhase=frame/12*Math.PI*2;
      this.horseTackMeshes.set(key,new Mesh(this.gl,faunaGeometry("horse",a.gear,{gait,phase:gaitPhase,moving:active,grazing:a.grazing})));
     }
     mesh=this.horseTackMeshes.get(key);
    }
    this.drawMesh(mesh,multiply4(vp,model),light,1,.77);
    if(this.fauna.selectedId===a.id)this.drawMesh(this.selectionRing,
     multiply4(vp,translate(x,y+.05,z)),light,1,.90,[.78,.92,.42]);
   }
  }
  pickResource(clientX,clientY){
   const r=this.canvas.getBoundingClientRect();if(!r.width||!r.height)return null;
   const u=(clientX-r.left)/r.width,v=(clientY-r.top)/r.height;
   let best=null,distance=44;
   for(const resource of this.screenResources||[]){
    if(!resource.onScreen)continue;
    const d=Math.hypot((resource.u-u)*r.width,(resource.v-v)*r.height);
    if(d<distance){best=resource;distance=d;}
   }
   return best;
  }
  pickLife(clientX,clientY){
   const r=this.canvas.getBoundingClientRect();if(!r.width||!r.height)return null;
   const u=(clientX-r.left)/r.width,v=(clientY-r.top)/r.height;
   let found=null,nearest=48;
   for(const item of [...this.screenFurniture,...this.screenCamps]){
    if(!item.onScreen)continue;
    const d=Math.hypot((item.u-u)*r.width,(item.v-v)*r.height);
    if(d<nearest){nearest=d;found=item;}
   }
   return found;
  }
  pickBookshelf(clientX,clientY){
   const r=this.canvas.getBoundingClientRect();if(!r.width||!r.height)return null;
   const u=(clientX-r.left)/r.width,v=(clientY-r.top)/r.height;
   let hit=null,distance=58;
   for(const shelf of this.screenShelves){
    if(!shelf.onScreen)continue;
    const d=Math.hypot((shelf.u-u)*r.width,(shelf.v-v)*r.height);
    if(d<distance){distance=d;hit=shelf;}
   }
   return hit;
  }
  pickDoor(clientX,clientY){
   const r=this.canvas.getBoundingClientRect();if(!r.width||!r.height)return null;
   const u=(clientX-r.left)/r.width,v=(clientY-r.top)/r.height;
   let best=null,distance=42;
   for(const d of this.screenDoors){
    if(!d.onScreen)continue;
    const gap=Math.hypot((d.u-u)*r.width,(d.v-v)*r.height);
    if(gap<distance){distance=gap;best=d;}
   }
   return best;
  }
  /** Pick any visible point on the orbital globe. Doesn't affect the actor. */
  /** Planet drag rotates the *view* across all latitudes and longitudes. */
  setOrbitLandingFocus(lat,lon){
   if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90)return;
   const here=this.lastOrbitCenter||{lat,lon};
   this.orbitPan={lat:here.lat,lon:here.lon};
   this.orbitFocus={lat,lon:wrapLon(lon)};
  }
  panOrbit(dx,dy){
   if(![dx,dy].every(Number.isFinite))return;
   this.orbitFocus=null;
   if(!this.orbitPan)this.orbitPan={...(this.lastOrbitCenter||{lat:0,lon:0})};
   this.orbitPan.lat=clamp(this.orbitPan.lat+dy*.23,-89.5,89.5);
   this.orbitPan.lon=wrapLon(this.orbitPan.lon-dx*.25);
  }
  pickOrbit(clientX,clientY){
   if(!this.orbitVP)return null;
   const r=this.canvas.getBoundingClientRect();
   if(!r.width||!r.height)return null;
   const nx=((clientX-r.left)/r.width)*2-1;
   const ny=1-((clientY-r.top)/r.height)*2;
   return pickOrbitalGeo(this.orbitVP,nx,ny,this.R,this.orbitOffsetDeg);
  }
  pickGround(clientX,clientY){
   if(!this.pickVP||!this.groundPatchData)return null;
   const r=this.canvas.getBoundingClientRect();
   if(!r.width||!r.height)return null;
   const nx=((clientX-r.left)/r.width)*2-1,ny=1-((clientY-r.top)/r.height)*2;
   const hit=pickSurface(this.groundPatchData.vertices,this.groundPatchData.indices,this.pickVP,nx,ny);
   return hit?{x:hit[0]+this.cx,z:hit[2]+this.cz,elevationM:hit[1]}:null;
 }
 drawArticulated(vp,avatarTransform,s,light,dt=1/60,animator=this.animator,expression=this.expression,motion=this.sceneActions?.getAnimation()||{action:"idle",progress:0},tint=[1,1,1],actorId="player"){
   const face=expression.update(dt);
   const pose=animator.update(dt,{
      moving:s.moving,phase:s.totalDistanceM*2.7,
      speedMps:s.moving?(s.movementSpeed?.()||s.walkSpeed):0,
      jumpHeight:s.jumpY||0,action:motion.action,progress:motion.progress,variant:motion.variant||"overhead",
      emotion:expression.preset,faceDirection:face.gazeX*.27,hand:motion?.hand||this.actionHand?.[actorId]||"right",
      equipped:this.handEquipment?.[actorId]||{}
   });
   Object.assign(pose,expressionPoseValues(face));
   const wet=isAquaticAction(motion?.action);
   const splash=motion.action==="splash"&&this.marine?.entrySeconds>0;
   const pitch=splash ? .50+(1-this.marine.entrySeconds/this.marine.entryDuration)*.8 :
    wet?swimmingPresentation(s.travelMode,s.moving,0,this.marine?.depthM||0,this.marineClock,this.marine?.swimStyle,this.marine?.seabedWalking).pitch:0;
   const rigRoot=wet?matrixMultiply(avatarTransform,matrixMultiply(rotateY(s.yaw||0),rotX(pitch))):avatarTransform;
   const joints=jointTransformsV2(pose,wet?0:s.yaw);
   for(const {mesh,part} of this.rigParts){
     let m=matrixMultiply(rigRoot,joints[part.pivot]);
     if(part.faceKind==="lid"){
       const openScale=Math.max(.015,Math.min(1,face.blink));
       m=matrixMultiply(m,[1,0,0,0,0,openScale,0,0,0,0,1,0,0,0,0,1]);
     }else if(part.faceKind==="leftBrow"||part.faceKind==="rightBrow"){
       const angle=face.brow*(part.faceKind==="leftBrow"?1:-1);
       m=matrixMultiply(m,rotZ(angle));
     }else if(part.faceKind==="mouth"){
       const x=Math.max(.5,Math.min(1.4,face.mouthWidth));
       m=matrixMultiply(m,[x,0,0,0,0,1,0,0,0,0,1,0,0,face.mouthHeight,0,1]);
     }
     this.drawMesh(mesh,multiply4(vp,m),light,1,.72,tint);
   }
   if(wet)return; // Hands are paddling, not swinging handheld weapons underwater.
   const equipment=this.handEquipment?.[actorId]||{};
   const activeHand=motion?.hand||this.actionHand?.[actorId]||"right";
    const paired=["spear","greatsword"].includes(equipment.right)&&equipment.left===equipment.right;
   for(const hand of ["right","left"]){
    // The other hand must be free to place the arrow and draw the bowstring.
    if(paired&&hand==="left")continue;
     if(motion?.action==="bow"&&hand!==activeHand)continue;
    const kind=hand===activeHand&&pose.tool?pose.tool:equipment[hand];
    if(!this.tools[kind])continue;
    const wrist=joints[hand+"Wrist"];if(!wrist)continue;
    const attached=matrixMultiply(avatarTransform,wrist);
    // Hand position follows the animation, but the bow stays upright.
    const held=kind==="bow"?
      uprightBowTransform(attached,matrixMultiply(avatarTransform,rotateY(s.yaw||0))):
      matrixMultiply(attached,heldItemTransform(kind));
    if(kind==="bow")this.drawBow(vp,held,light,hand===activeHand?motion:null,tint);
    else this.drawMesh(this.tools[kind],multiply4(vp,held),light,1,.68,tint);
    if(kind==="bow"&&hand===activeHand&&motion?.action==="bow")
      this.drawFlyingArrow(vp,matrixMultiply(avatarTransform,rotateY(s.yaw||0)),light,motion.progress,tint,hand);
   }
 }
 drawBow(vp,held,light,motion=null,tint=[1,1,1]){
   const tension=motion?.action==="bow"?bowDrawState(motion.progress).tension:0;
   this.drawMesh(this.tools.bow,multiply4(vp,held),light,1,.68,tint);
   this.drawMesh(this.bowStrings[Math.round(tension*8)],multiply4(vp,held),light,1,.80,tint);
 }
 drawFlyingArrow(vp,actorFacing,light,progress=0,tint=[1,1,1],hand="right"){
   // Wrist rotations may point vertically when aiming; launch along the actor's +Z.
   // The real flight mesh takes over at release; avoid showing two arrows.
  if(progress>=.81||!bowDrawState(progress).visible)return;
   this.drawMesh(this.tools.arrow,multiply4(vp,projectileTransform(actorFacing,progress,hand)),light,1,.88,tint);
 }
 drawArticulatedEnemy(vp,light,base,enemy){
  const meshes=this.animatedEnemies[enemy.type];
  if(!meshes)return;
  const pose=enemyMotion(enemy),scale=Math.max(.75,(enemy.height||2.10)/2.15);
  const tint=pose.state==="hit"?[1,.48,.48]:pose.state==="death"?[.56,.53,.50]:[1,1,1];
  const scaled=[scale,0,0,0,0,scale,0,0,0,0,scale,0,0,0,0,1];
  // Fall forward around the feet, then leave a prone body on the ground.
  const root=multiply4(multiply4(multiply4(base,rotateY(enemy.yaw)),rotX(pose.rootFall)),scaled);
  const hip=multiply4(root,translate(0,.84+pose.rootBob,0));
  const torso=multiply4(hip,multiply4(translate(0,.36,0),
   multiply4(rotX(pose.bodyX),multiply4(rotateY(pose.bodyY),rotZ(pose.bodyZ)))));
  const draw=(name,transform)=>{
   const mesh=meshes[name];if(mesh)this.drawMesh(mesh,multiply4(vp,transform),light,pose.opacity,.77,tint);
  };
  draw("torso",torso);
  const head=multiply4(torso,multiply4(translate(0,.48,0),rotX(pose.headX)));
  draw("head",head);
  const width=enemy.type==="orc"?.56:enemy.type==="skeleton"?.32:.43;
  for(const side of ["left","right"]){
   const sign=side==="left"?-1:1;
   const shoulder=multiply4(torso,multiply4(translate(sign*width,.25,0),
    multiply4(rotZ(pose[side+"ArmZ"]),rotX(pose[side+"ArmX"]))));
   draw(side+"Upper",shoulder);
   const elbow=multiply4(shoulder,multiply4(translate(0,-.34,0),rotX(pose[side+"ElbowX"])));
   draw(side+"Lower",elbow);
   const wrist=multiply4(elbow,translate(0,-.30,0));
   draw(side==="right"?"weapon":"shield",wrist);
   const thigh=multiply4(hip,multiply4(translate(sign*.22,-.04,0),rotX(pose[side+"LegX"])));
   draw(side+"Thigh",thigh);
   const shin=multiply4(thigh,multiply4(translate(0,-.40,0),rotX(pose[side+"KneeX"])));
   draw(side+"Shin",shin);
  }
 }
 drawPhysicalArrows(vp,light){
  this.screenArrows=[];this.screenTargets=[];
  if(!this.arrowWorld)return;
  for(const target of this.arrowWorld.targets){
   const model=multiply4(translate(target.x-this.cx,target.y,target.z-this.cz),rotateY(target.yaw));
   this.drawMesh(this.practiceTargetMesh,multiply4(vp,model),light,1,.86);
   const p=projectScreen(vp,[target.x-this.cx,target.y+1.6,target.z-this.cz]);
   if(p)this.screenTargets.push({...p,...target});
  }
  for(const shot of [...this.arrowWorld.flying,...this.arrowWorld.embedded]){
   const moving=Object.hasOwn(shot,"vx"),dir=moving?{x:shot.vx,y:shot.vy,z:shot.vz}:
    {x:shot.dx,y:shot.dy,z:shot.dz};
   const len=Math.hypot(dir.x,dir.y,dir.z)||1;
   const yaw=Math.atan2(dir.x,dir.z),pitch=Math.atan2(dir.y,Math.hypot(dir.x,dir.z));
   const x=shot.x-this.cx-dir.x/len*.54;
   const y=shot.y-dir.y/len*.54;
   const z=shot.z-this.cz-dir.z/len*.54;
   const model=multiply4(translate(x,y,z),multiply4(rotateY(yaw),rotX(-pitch)));
   this.drawMesh(this.typedArrows[shot.arrowType]||this.tools.arrow,multiply4(vp,model),light,1,.96);
   if(!moving){
    const p=projectScreen(vp,[shot.x-this.cx,shot.y,shot.z-this.cz]);
    if(p)this.screenArrows.push({...p,...shot});
   }
  }
 }
 drawTestEnemies(vp,light,s,radius){
  this.screenEnemies=[];
  if(!this.battle)return;
  for(const enemy of this.battle.enemies){
   if(enemy.hp<=0&&(enemy.deathTime||0)>5)continue;
   if(Math.abs(enemy.x-s.x)>radius||Math.abs(enemy.z-s.z)>radius)continue;
   const geo=geoOffset(s.origin.lat,s.origin.lon,enemy.x,enemy.z,this.planet.radiusM);
   const height=Math.max(0,terrainSurface(this.terrain,geo.lat,geo.lon).elevationM);
   const bob=enemy.type==="slime"&&enemy.hp>0?Math.abs(Math.sin(enemy.walkPhase||0))*.025:0;
   const base=translate(enemy.x-this.cx,height+bob,enemy.z-this.cz);
   if(enemy.hp>0){
    const screen=projectScreen(vp,[enemy.x-this.cx,height+(enemy.height||1.8)*.67,enemy.z-this.cz]);
    if(screen)this.screenEnemies.push({...screen,id:enemy.id,name:enemy.name,hp:enemy.hp});
    if(enemy.id===this.combatTargetId){
     this.drawMesh(this.selectionRing,multiply4(vp,translate(enemy.x-this.cx,height+.04,enemy.z-this.cz)),light,1,.96,[1,.68,.25]);
    }
   }
   if(this.animatedEnemies[enemy.type])
    this.drawArticulatedEnemy(vp,light,base,enemy);
   else if(enemy.hp>0)
    this.drawMesh(this.enemyMeshes[enemy.type],multiply4(vp,multiply4(base,rotateY(enemy.yaw))),light,1,.75,
     enemy.anim==="hit"?[1,.52,.52]:[1,1,1]);
   if(enemy.hp<=0)continue;
   const ratio=enemy.hp/enemy.maxHp,head=enemy.height||2.1;
   const hpAt=multiply4(base,translate(0,head,0));
   this.drawMesh(this.enemyHealthTrack,multiply4(vp,hpAt),light,1,1);
   const scale=[ratio,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
   const fill=multiply4(hpAt,multiply4(translate(-.49*(1-ratio),0,.013),scale));
   this.drawMesh(this.enemyHealthFill,multiply4(vp,fill),light,1,1);
  }
 }
 drawBuildings(vp,light,s,radius,dt=1/60){
   if(!this.sceneActions)return;
   this.screenDoors=[];this.screenShelves=[];
   for(const hut of this.sceneActions.structures){
     const offset=geoLocal(s.origin.lat,s.origin.lon,hut.lat,hut.lon,this.planet.radiusM);
     const bx=offset.eastM,bz=offset.northM;
     if(Math.abs(bx-s.x)>radius||Math.abs(bz-s.z)>radius)continue;
     const model=translate(bx-this.cx,hut.height,bz-this.cz);
     const mvp=multiply4(vp,model);
     this.drawMesh(this.buildingMeshes.base,mvp,light,1,.64);
     if(hut.progress>=.3)this.drawMesh(this.buildingMeshes.walls,mvp,light,1,.64);
     if(hut.progress>=.75&&hut.id!==this.interiorBuildingId)this.drawMesh(this.buildingMeshes.roof,mvp,light,1,.64);
     if(hut.progress>=.92)this.drawMesh(this.buildingMeshes.details,mvp,light,1,.64);
     if(hut.progress>=1){
      this.drawMesh(this.roomMeshes.floor,mvp,light,1,.72);
      if(!this.sceneLife&&(hut.doorOpen||hut.id===this.interiorBuildingId)){
        this.drawMesh(this.roomMeshes.furniture,mvp,light,1,.73);
        this.drawMesh(this.roomMeshes.bookshelf,mvp,light,1,.78);
        if(hut.id===this.interiorBuildingId){
         const target=projectScreen(vp,[bx-this.cx+.28,hut.height+1.6,bz-this.cz-1.61]);
         if(target)this.screenShelves.push({...target,id:hut.id});
        }
       }
      const target=hut.doorOpen?1.4:0,prev=this.doorAngles.get(hut.id)??0;
      const angle=prev+(target-prev)*Math.min(1,Math.max(0,dt)*5.5);
      this.doorAngles.set(hut.id,angle);
      const hinge=translate(bx-this.cx-.69,hut.height,bz-this.cz+2.59);
      this.drawMesh(this.roomMeshes.door,multiply4(vp,multiply4(hinge,rotateY(-angle))),light,1,.68);
      const point=projectScreen(vp,[bx-this.cx,hut.height+1.48,bz-this.cz+2.68]);
      if(point)this.screenDoors.push({...point,id:hut.id});
     }
   }
 }
 clearFrontierGlb(sex){
  this.animatedGlb[sex]?.destroy();
  for(const mesh of this.glbMeshes[sex]||[])mesh.destroy();
  delete this.animatedGlb[sex];delete this.glbMeshes[sex];delete this.glbStatuses[sex];
 }
 setFrontierGlb(sex,data,source=null){
  if(!["male","female"].includes(sex)||!data?.chunks?.length)throw Error("Invalid GLB avatar");
  let animated=null,reason="";
  if(source){
   try{animated=new SkinnedFrontierAsset(this.gl,source);}
   catch(error){reason=String(error.message||error);console.warn("Animated GLB fallback:",error);}
  }
  const list=[];
  if(!animated){
   try{for(const chunk of data.chunks)list.push(new Mesh(this.gl,chunk));}
   catch(error){for(const mesh of list)mesh.destroy();throw error;}
  }
  this.animatedGlb[sex]?.destroy();
  for(const mesh of this.glbMeshes[sex]||[])mesh.destroy();
  this.animatedGlb[sex]=animated;
  this.glbMeshes[sex]=list;
  this.glbStatuses[sex]=animated?{animated:true,triangles:animated.triangles,clips:animated.rig.clips.map(c=>c.name)}:
   {animated:false,triangles:data.triangles,reason};
  return animated?.meshes.length||list.length;
 }
 triggerSocial(from,to,kind="talk"){
  const action=kind==="gift"?"gift":"talk";
  for(const id of [from,to])if(["player","scout","artisan"].includes(id))this.socialAnimations.set(id,{kind:action,remaining:2.1});
 }
 drawSkinnedHandEquipment(rig,id,vp,characterTransform,light,motion={}){
   const pose=rig.instances.get(id)?.previous;
   if(!pose||!rig.rig?.nodes?.length)return;
   const info=rig.rig,gear=this.handEquipment?.[id]||{};
   const x=info.scale,c=info.center;
   const normalize=[
    x,0,0,0,0,x,0,0,0,0,x,0,
    -c[0]*x,-c[1]*x,-c[2]*x,1
   ];
   const activeHand=motion?.hand||this.actionHand?.[id]||"right";
    const paired=["spear","greatsword"].includes(gear.right)&&gear.left===gear.right;
   for(const hand of ["right","left"]){
    if(paired&&hand==="left")continue;
     if(motion?.action==="bow"&&hand!==activeHand)continue;
    const item=gear[hand],mesh=this.tools[item];
    if(!mesh)continue;
    const right=hand==="right";
    const joint=info.nodes.findIndex(n=>{
     const name=(n.name||"").toLowerCase().replace(/[^a-z0-9]/g,"");
     return right?/(righthand|rightwrist|handright|bip.*rhand|handr$)/.test(name):
       /(lefthand|leftwrist|handleft|bip.*lhand|handl$)/.test(name);
    });
    if(joint<0||!pose.world[joint])continue;
    const attach=multiply4(characterTransform,multiply4(normalize,pose.world[joint]));
    const held=item==="bow"?uprightBowTransform(attach,characterTransform):
      multiply4(attach,heldItemTransform(item));
    if(item==="bow")this.drawBow(vp,held,light,hand===activeHand?motion:null);
    else this.drawMesh(mesh,multiply4(vp,held),light,1,.68);
    if(item==="bow"&&hand===activeHand&&motion?.action==="bow")
      this.drawFlyingArrow(vp,characterTransform,light,motion.progress,[1,1,1],hand);
   }
 }
 drawFrontierAvatar(sex,vp,transform,unit,light,dt=1/60,motion={action:"idle"},id="player"){
  const animation=this.socialAnimations.get(id);
  if(animation){
   animation.remaining-=Math.max(0,dt);
   if(animation.remaining<=0)this.socialAnimations.delete(id);
  }
  const aquatic=isAquaticAction(motion?.action);
  const rig=this.animatedGlb[sex];
  // Imported rigs without semantic limb joints cannot execute swim strokes.
  // Show the procedural swimmer instead of an upright, motionless GLB.
  if(aquatic&&(!rig||!["leftshoulder","rightshoulder","lefthip","righthip"]
    .every(name=>rig.rig?.nodes?.some(node=>node.name?.toLowerCase()===name))))return false;
  if(rig){
   const splash=motion.action==="splash"&&this.marine?.entrySeconds>0;
   const pitch=splash ? .50+(1-this.marine.entrySeconds/this.marine.entryDuration)*.8 :
    aquatic?swimmingPresentation(unit.travelMode,unit.moving,0,this.marine?.depthM||0,this.marineClock,this.marine?.swimStyle,this.marine?.seabedWalking).pitch:0;
   const characterTransform=multiply4(transform,multiply4(rotateY(unit.yaw||0),rotX(pitch)));
   let drawn=true;
   try{rig.draw(vp,characterTransform,light,id,dt,{
    moving:Boolean(unit.moving),motion:motion?.action||"idle",
    motionProgress:Number.isFinite(motion?.progress)?motion.progress:null,
    variant:motion?.variant||"overhead",
    hand:motion?.hand||this.actionHand?.[id]||"right",
    talking:animation?.kind==="talk"&&animation.remaining>0,
    giving:animation?.kind==="gift"&&animation.remaining>0
   });}
   catch(error){
    console.warn("GLB runtime animation failed; restoring procedural avatar:",error);
    rig.destroy();this.animatedGlb[sex]=null;
    this.glbStatuses[sex]={animated:false,reason:String(error.message||error)};
    drawn=false;
   }finally{this.gl.useProgram(this.program);}
   if(drawn&&!aquatic)this.drawSkinnedHandEquipment(rig,id,vp,characterTransform,light,motion);
   return drawn;
  }
  const meshes=this.glbMeshes[sex];if(!meshes?.length||aquatic)return false;
  const mvp=multiply4(vp,multiply4(transform,rotateY(unit.yaw||0)));
  for(const mesh of meshes)this.drawMesh(mesh,mvp,light,1,.83);
  return true;
 }
 drawPlacedStructures(vp,light,s,radius){
   if(!this.constructionSystem)return;
   for(const site of this.constructionSystem.structures){
    if(Math.abs(site.x-s.x)>radius||Math.abs(site.z-s.z)>radius)continue;
    const mesh=this.placedMeshes[site.kind];if(!mesh)continue;
    const model=multiply4(translate(site.x-this.cx,site.height,site.z-this.cz),
      rotateY(site.rotation||0));
    this.drawMesh(mesh,multiply4(vp,model),light,1,.72);
   }
 }
 drawFrontier(vp,light,s,radius){
   if(!this.sceneFrontier)return;
   for(const n of this.sceneFrontier.nodes){
    if(n.quantity<=0||Math.abs(n.x-s.x)>radius||Math.abs(n.z-s.z)>radius)continue;
    const geo=geoOffset(s.origin.lat,s.origin.lon,n.x,n.z,this.planet.radiusM);
    const elevation=terrainSurface(this.terrain,geo.lat,geo.lon).elevationM;
    const mesh=this.fwResourceMeshes[n.kind];if(!mesh)continue;
    this.drawMesh(mesh,multiply4(vp,translate(n.x-this.cx,Math.max(0,elevation),n.z-this.cz)),light,1,.75);
   }
  }
  drawLifestyle(vp,light,s,radius){
   this.screenFurniture=[];this.screenCamps=[];
   if(!this.sceneLife||!this.sceneActions)return;
   for(const hut of this.sceneActions.structures){
    if(hut.progress<1)continue;
    const at=geoLocal(s.origin.lat,s.origin.lon,hut.lat,hut.lon,this.planet.radiusM);
    if(Math.abs(at.eastM-s.x)>radius||Math.abs(at.northM-s.z)>radius)continue;
    for(const f of this.sceneLife.atHut(hut)){
     const mesh=this.lifeMeshes[f.kind];if(!mesh)continue;
     const x=at.eastM+f.x-this.cx,z=at.northM+f.z-this.cz;
     const model=multiply4(translate(x,hut.height,z),rotateY((f.rotation||0)*DEG));
     this.drawMesh(mesh,multiply4(vp,model),light,1,f.kind==="lamp"?(f.lit?.98:.40):.76);
     if(f.kind==="table"){
      if(this.sceneLife.count("served")>0)this.drawMesh(this.dishMeshes.plate,multiply4(vp,model),light,1,.89);
      if(this.sceneLife.count("servedBowl")>0)this.drawMesh(this.dishMeshes.bowl,multiply4(vp,model),light,1,.89);
      if(this.sceneLife.count("cup")>0)this.drawMesh(this.dishMeshes.cup,multiply4(vp,model),light,1,.89);
     }else if(f.kind==="kitchen"&&this.sceneLife.count("pot")>0)
      this.drawMesh(this.dishMeshes.pot,multiply4(vp,model),light,1,.84);
     if(f.lit&&f.kind==="fireplace")this.drawMesh(this.campMeshes.fire,multiply4(vp,model),[.7,.6,.2],1,.92);
     if(hut.id===this.interiorBuildingId){
      const point=projectScreen(vp,[x,hut.height+(f.kind==="bookshelf"?1.55:1.05),z]);
      if(point)this.screenFurniture.push({...point,id:f.id,kind:f.kind,type:"furniture"});
     }
    }
   }
   for(const camp of this.sceneLife.deployments){
    const at=geoLocal(s.origin.lat,s.origin.lon,camp.lat,camp.lon,this.planet.radiusM);
    if(Math.abs(at.eastM-s.x)>radius||Math.abs(at.northM-s.z)>radius)continue;
    const x=at.eastM-this.cx,z=at.northM-this.cz;
    const cut=camp.kind==="tent"&&this.sceneLife.insideTentId===camp.id;
    const mesh=this.campMeshes[cut?"tentCutaway":camp.kind];
    if(!mesh)continue;
    const model=multiply4(translate(x,camp.height,z),rotateY(camp.rotation||0));
    this.drawMesh(mesh,multiply4(vp,model),light,1,.72);
    const point=projectScreen(vp,[x,camp.height+(camp.kind==="tent"?1.20:.35),z]);
    if(point)this.screenCamps.push({...point,id:camp.id,kind:camp.kind,type:"camp"});
   }
  }
  drawMesh(mesh,mvp,light,alpha=1,ambient=.25,tint=[1,1,1]){
  const gl=this.gl;gl.uniformMatrix4fv(this.uMvp,false,new Float32Array(mvp));
  gl.uniform3fv(this.uLight,new Float32Array(light));gl.uniform3fv(this.uTint,new Float32Array(tint));
  gl.uniform1f(this.uAlpha,alpha);gl.uniform1f(this.uAmbient,ambient);gl.uniform1f(this.uInstanced,0);mesh.draw();
 }

 beginTreeFall(node){
   if(!node||node.kind==="stone"||node.type==="fallen-log"||
      node.type==="rubble"||this.fallingTrees.has(node.id))return false;
   if(this.fallingTrees.size>=8)return false;
   const mesh=new Mesh(this.gl,sceneryPrototype(node.type));
   this.fallingTrees.set(node.id,{node:{...node},mesh,age:0,yaw:fallingTreeYaw(node.id)});
   this.patchKey=null;return true;
  }
 drawFallingTrees(vp,light,dt){
   let rebuild=false;
   for(const [id,fall] of this.fallingTrees){
    fall.age+=Math.max(0,Math.min(.1,dt));
    if(fall.age>=TREE_FALL_SECONDS){
     fall.mesh.destroy();this.fallingTrees.delete(id);rebuild=true;continue;
    }
    const node=fall.node;
    const model=multiply4(translate(node.x-this.cx,node.elevationM,node.z-this.cz),
      multiply4(rotateY(fall.yaw),
       multiply4(rotZ(-fallingTreeAngle(fall.age)),scaledMatrix(node.scale||1))));
    this.drawMesh(fall.mesh,multiply4(vp,model),light,1,.62);
   }
   if(rebuild)this.patchKey=null;
  }
 renderWeatherClouds(s,geo,radius,vp,light,dt){
   if(!this.sceneWeather)return;
   const climate=this.sceneWeather.sample(s.lat,s.lon,
    Math.max(0,terrainSurface(this.terrain,s.lat,s.lon).elevationM));
   const wind=cloudWind(climate,s.lat,this.planet.timeDays);
   const ds=Math.max(0,Math.min(dt,.1));
   this.cloudEast+=wind.eastMps*ds;this.cloudNorth+=wind.northMps*ds;
   const band=Math.floor(wind.coverage*6);
   const moved=Math.hypot(this.cloudEast-this.cloudOriginEast,
     this.cloudNorth-this.cloudOriginNorth)>185;
   if((!this.groundClouds||band!==this.cloudCoverBand||moved)&&radius<=9000){
    const clouds=groundCloudGeometry({seed:this.planet.seed,cx:this.cx,cz:this.cz,radius,
      baseElevation:terrainSurface(this.terrain,geo.lat,geo.lon).elevationM,
      driftEast:this.cloudEast,driftNorth:this.cloudNorth,
      cloudCover:climate.cloudCover,precipitation:climate.precipitation});
    this.groundClouds?.destroy();
    this.groundClouds=clouds.indices.length?new Mesh(this.gl,clouds):null;
    this.cloudOriginEast=this.cloudEast;this.cloudOriginNorth=this.cloudNorth;
    this.cloudCoverBand=band;
   }
   if(!this.groundClouds)return;
   const offset=translate(this.cloudEast-this.cloudOriginEast,0,
     this.cloudNorth-this.cloudOriginNorth);
   const gl=this.gl;
   gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);
   this.drawMesh(this.groundClouds,multiply4(vp,offset),light,wind.opacity,.87);
   gl.depthMask(true);gl.disable(gl.BLEND);
  }
 drawInstancedMesh(mesh,vp,light,alpha=1,ambient=.25){
   const gl=this.gl;gl.uniformMatrix4fv(this.uMvp,false,new Float32Array(vp));
   gl.uniform3fv(this.uLight,new Float32Array(light));
   gl.uniform3fv(this.uTint,new Float32Array([1,1,1]));
   gl.uniform1f(this.uAlpha,alpha);gl.uniform1f(this.uAmbient,ambient);
   gl.uniform1f(this.uInstanced,1);mesh.draw();
 }
 frame(state,dt=1/60){
  const gl=this.gl,dpr=Math.min(2,globalThis.devicePixelRatio||1);
  const w=Math.max(1,Math.floor(this.canvas.clientWidth*dpr)),h=Math.max(1,Math.floor(this.canvas.clientHeight*dpr));
  if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;}
  // Ground view exposes the atmospheric CSS gradient through transparent sky pixels.
  // Orbital view remains opaque dark space; terrain meshes always draw opaque.
  const inOrbit=state.altitudeM>ORBIT_GROUND_CUTOFF_M;
  gl.viewport(0,0,w,h);gl.clearColor(.011,.032,.071,inOrbit?1:0);
  gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(this.program);
  const asp=w/h;
  this.actorMarker=null;
  if(!inOrbit){
   this.orbitVP=null;this.orbitCamera=null;this.screenLanding=null;
   this.orbitFocus=null;this.orbitPan=null;this.lastOrbitCenter=null;
   if(this.orbitDetail){this.orbitDetail.destroy();this.orbitDetail=null;}
   this.orbitDetailCenter=null;this.orbitDetailRadius=0;
  }
  this.screenActors=[];this.screenEnemies=[];this.screenResources=[];this.screenAnimals=[];this.screenArrows=[];this.screenTargets=[];this.screenDoors=[];this.screenShelves=[];this.screenFurniture=[];this.screenCamps=[];this.screenTownResidents=[];this.screenTownBuildings=[];
  if(this.trainInterior?.camera==="interior"||this.trainInterior&&!this.trainInterior.camera)return this.renderTrainInterior(asp,dt);
  if(this.trainInterior&&this.railJourney)return this.renderRailJourney(asp,dt);
  if(this.townInterior)return this.renderTownInterior(asp);
  return inOrbit?this.orbit(state,asp,dt):this.ground(state,asp,dt);
 }
 /** A train follows its actual geodesic rail path, never a free-flight camera proxy. */
 renderRailJourney(asp,dt=1/60){
  const pose=this.railJourney?.pose,locations=this.railJourney?.locations||[];
  if(!pose)return this.renderTrainInterior(asp,dt);
  const R=this.planet.radiusM,gl=this.gl;
  this.trainClock+=Math.max(0,Math.min(.1,dt));
  const start=this.railJourneyOrigin;
  const moved=start?geoLocal(start.lat,start.lon,pose.lat,pose.lon,R):null;
  if(!start||!moved||Math.hypot(moved.eastM,moved.northM)>270){
   const station=pose.state.mode==="stopped"?pose.state.station:
    pose.progress>.996?pose.state.nextStation:pose.progress<.004?pose.state.fromStation:null;
   const home=station?locations.find(p=>p.id===station.id):null;
   const anchor=home&&Math.hypot(...Object.values(geoLocal(home.lat,home.lon,pose.lat,pose.lon,R)).slice(0,2))<600?
    {lat:home.lat,lon:home.lon}: {lat:pose.lat,lon:pose.lon};
   this.railJourneyOrigin=anchor;
   this.railJourneyGeo={lat:pose.lat,lon:pose.lon};
   this.railJourneyPatch?.destroy();this.railJourneyTrack?.destroy();
   for(const mesh of [...this.railJourneyTrees,...this.railJourneyGrass])mesh.destroy();
   this.railJourneyTrees=[];this.railJourneyGrass=[];
   this.railJourneyData=samplePatch(this.terrain,anchor.lat,anchor.lon,880,58);
   this.railJourneyPatch=new Mesh(gl,this.railJourneyData);
   const center=geoLocal(anchor.lat,anchor.lon,pose.lat,pose.lon,R);
   const railRows=railwayTrackSamples(this.terrain,locations,pose,{spanM:1550,steps:60}).map(p=>
    ({...p,x:p.x+center.eastM,z:p.z+center.northM}));
   const geom=trackGeometry(railRows);
   this.railJourneyTrack=geom.indices.length?new Mesh(gl,geom):null;
   // LOD: native grass/trees from the same planetary seed as free exploration.
   const groundAt=(x,z)=>patchSceneryHeight(this.railJourneyData,x,z);
   const plan=planWorldScenery({seed:this.planet.seed,cx:0,cz:0,radius:880,
    groundAt,settlementId:"wilderness",
    biomeAt:(x,z)=>{
     const p=geoOffset(anchor.lat,anchor.lon,x,z,R);
     return terrainSurface(this.terrain,p.lat,p.lon);
    }});
   const scenery=buildSceneryInstances({...plan,trees:plan.trees.slice(0,850),
    grass:plan.grass.slice(0,2000)});
   this.railJourneyTrees=scenery.woods.map(g=>new InstancedMesh(gl,sceneryPrototype(g.kind),g.transforms));
   this.railJourneyGrass=scenery.meadow.map(g=>new InstancedMesh(gl,sceneryPrototype(g.kind),g.transforms));
  }
  const pos=geoLocal(this.railJourneyOrigin.lat,this.railJourneyOrigin.lon,pose.lat,pose.lon,R);
  const tx=pos.eastM,tz=pos.northM,ty=pose.elevationM,heading=pose.yaw;
  const mode=this.trainInterior.camera||"follow";
  let eye,target=[tx,ty+2.7,tz+3];
  if(mode==="rts")eye=[tx+90,ty+205,tz-80];
  else if(mode==="fixed"){
   const fixed=this.railCameraFixed;
   const far=fixed?geoLocal(fixed.at.lat,fixed.at.lon,pose.lat,pose.lon,R):null;
   if(!fixed||fixed.fromId!==pose.fromId||fixed.toId!==pose.toId||
     Math.hypot(far.eastM,far.northM)>470){
    const at=geoOffset(pose.lat,pose.lon,
     Math.cos(heading)*62+Math.sin(heading)*100,
     -Math.sin(heading)*62+Math.cos(heading)*100,R);
    this.railCameraFixed={at,fromId:pose.fromId,toId:pose.toId,
     elevationM:pose.elevationM};
   }
   const near=geoLocal(this.railJourneyOrigin.lat,this.railJourneyOrigin.lon,
    this.railCameraFixed.at.lat,this.railCameraFixed.at.lon,R);
   eye=[near.eastM,this.railCameraFixed.elevationM+32,near.northM];
  }else eye=[tx-Math.sin(heading)*58+Math.cos(heading)*26,ty+23,
    tz-Math.cos(heading)*58-Math.sin(heading)*26];
  const vp=multiply4(perspective((mode==="rts"?60:57)*DEG,asp,.65,55000),
   lookAt(eye,target,mode==="rts"?[0,1,0]:undefined));
  this.pickVP=null;this.actorMarker=null;
  const light=[.40,Math.max(.4,this.planet.illumination(pose.lat,pose.lon)),.24];
  const far=this.railJourneyHorizonGeo?geoLocal(this.railJourneyHorizonGeo.lat,
   this.railJourneyHorizonGeo.lon,pose.lat,pose.lon,R):null;
  if(!this.railJourneyHorizon||!far||Math.hypot(far.eastM,far.northM)>6200){
   this.railJourneyHorizon?.destroy();
   this.railJourneyHorizon=new Mesh(gl,buildDistantLandscape(this.terrain,pose.lat,pose.lon));
   this.railJourneyHorizonGeo={lat:pose.lat,lon:pose.lon};
  }
  const offset=geoLocal(this.railJourneyOrigin.lat,this.railJourneyOrigin.lon,
   this.railJourneyHorizonGeo.lat,this.railJourneyHorizonGeo.lon,R);
  this.drawMesh(this.railJourneyHorizon,multiply4(vp,translate(offset.eastM,0,offset.northM)),light,1,.52);
  this.drawMesh(this.railJourneyPatch,vp,light,1,.57);
  if(this.railJourneyTrack)this.drawMesh(this.railJourneyTrack,vp,light,1,.86);
  for(const mesh of this.railJourneyGrass)this.drawInstancedMesh(mesh,vp,light,1,.65);
  for(const mesh of this.railJourneyTrees)this.drawInstancedMesh(mesh,vp,light,1,.62);
  // On the last kilometre, station buildings are drawn on the same terrain tile.
  for(const station of this.railway?.live(this.planet.timeDays)?.map(s=>
    s.mode==="stopped"?s.station:s.nextStation)||[]){
   if(!station)continue;
   const at=railwayStationCoordinates(this.terrain,locations,station.id);
   if(!at)continue;
   const local=geoLocal(this.railJourneyOrigin.lat,this.railJourneyOrigin.lon,at.lat,at.lon,R);
   if(Math.hypot(local.eastM-tx,local.northM-tz)>800)continue;
   const g=terrainSurface(this.terrain,at.lat,at.lon);
   const world=multiply4(translate(local.eastM,Math.max(0,g.elevationM),local.northM),rotateY(heading));
   this.drawMesh(this.railwayStationMesh,multiply4(vp,world),light,1,.77);
  }
  this.drawRailwayVehicle(vp,light,tx,ty,tz,heading,pose);
  return "train-exterior";
 }
 drawRailwayVehicle(vp,light,x,y,z,yaw,pose){
  const world=multiply4(translate(x,y,z),rotateY(yaw));
  const frame=multiply4(vp,world);
  this.drawMesh(this.railwayTrainMesh,frame,light,1,.80);
  const ease=.5-.5*Math.cos(Math.PI*(pose.progress||0));
  const motion=locomotiveMotion((pose.totalM||0)*ease,this.trainClock,pose.speedMps||0);
  for(const side of [-1.83,1.83]){
   for(const z0 of [14.2,17.1,20.1]){
    const gear=multiply4(translate(side,1.02,z0),rotX(motion.phase));
    this.drawMesh(this.railWheelSpokes,multiply4(frame,gear),light,1,.93);
   }
  }
  for(const rod of motion.rod){
   const long=[1,0,0,0,0,1,0,0,0,0,rod.length,0,0,0,0,1];
   const model=multiply4(translate(rod.x,rod.y,rod.z),multiply4(rotX(rod.angle),long));
   this.drawMesh(this.railConnectingRod,multiply4(frame,model),light,1,.87);
  }
  const smokeLife=pose.state?.mode==="stopped"?.38:1;
  for(const puff of motion.smoke){
   const sc=puff.scale*smokeLife;
   const scale=[sc,0,0,0,0,sc,0,0,0,0,sc,0,0,0,0,1];
   const model=multiply4(translate(puff.x,puff.y,puff.z),scale);
   this.drawMesh(this.railSmokePuff,multiply4(frame,model),light,.58,.92);
  }
 }
 renderTrainInterior(asp,dt=1/60){
  const gl=this.gl,kind=this.trainInterior.carriage||"passenger";
  const roomKey=kind+":"+(this.trainInterior.hideWalls?"open":"closed");
  if(!this.trainRoomMeshes.has(roomKey))
   this.trainRoomMeshes.set(roomKey,new Mesh(gl,
    trainInteriorGeometry(kind,{hideWalls:this.trainInterior.hideWalls})));
  this.trainClock+=Math.min(.1,Math.max(0,dt));
  const moving=this.trainInterior.mode==="travel",sway=moving?Math.sin(this.trainClock*3.4)*.11:0;
  gl.clearColor(.055,.075,.073,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
  const vp=multiply4(perspective(55*DEG,asp,.25,55000),
   lookAt([9+sway,7.1,11],[0,1.25,-.1]));
  this.pickVP=null;
  // The window background is a real, updated local planetary terrain mesh,
  // not a static illustration. It moves as the train progresses along the track.
  const pose=this.railJourney?.pose;
  if(pose){
   const moved=this.trainWindowGeo?geoLocal(this.trainWindowGeo.lat,this.trainWindowGeo.lon,
    pose.lat,pose.lon,this.planet.radiusM):null;
   if(!this.trainWindowPatch||!moved||Math.hypot(moved.eastM,moved.northM)>90){
    this.trainWindowPatch?.destroy();
    this.trainWindowPatch=new Mesh(gl,samplePatch(this.terrain,pose.lat,pose.lon,300,42));
    this.trainWindowGeo={lat:pose.lat,lon:pose.lon,elevationM:pose.elevationM};
   }
   const offset=geoLocal(this.trainWindowGeo.lat,this.trainWindowGeo.lon,pose.lat,pose.lon,this.planet.radiusM);
   const transform=translate(-offset.eastM,-this.trainWindowGeo.elevationM-.85,-offset.northM);
   const toFar=this.trainWindowHorizonGeo?geoLocal(this.trainWindowHorizonGeo.lat,
    this.trainWindowHorizonGeo.lon,pose.lat,pose.lon,this.planet.radiusM):null;
   if(!this.trainWindowHorizon||!toFar||Math.hypot(toFar.eastM,toFar.northM)>5800){
    this.trainWindowHorizon?.destroy();
    this.trainWindowHorizon=new Mesh(gl,buildDistantLandscape(this.terrain,pose.lat,pose.lon));
    this.trainWindowHorizonGeo={lat:pose.lat,lon:pose.lon,elevationM:pose.elevationM};
   }
   const backdrop=geoLocal(pose.lat,pose.lon,this.trainWindowHorizonGeo.lat,
    this.trainWindowHorizonGeo.lon,this.planet.radiusM);
   this.drawMesh(this.trainWindowHorizon,multiply4(vp,translate(backdrop.eastM,
    -this.trainWindowHorizonGeo.elevationM-.85,backdrop.northM)),[.55,.9,.4],1,.57);
   this.drawMesh(this.trainWindowPatch,multiply4(vp,transform),[.55,.9,.4],1,.65);
  }
  this.drawMesh(this.trainRoomMeshes.get(roomKey),vp,[.55,.88,.42],1,.84);
  const people=this.railway?.people(this.squad?.agents?.slice(1).map(a=>a.name)||[])||[];
  const peopleKey=kind+":"+people.map(p=>p.id+":"+p.name).join("|");
  if(peopleKey!==this.trainPersonKey){
   this.trainPersonMesh?.destroy();
   this.trainPersonMesh=people.length?new Mesh(gl,settlementResidentsGeometry(
    people.map((p,i)=>({id:p.id,x:p.x,z:p.z,clothing:i%6})),()=>0)):null;
   this.trainPersonKey=peopleKey;
  }
  if(this.trainPersonMesh)this.drawMesh(this.trainPersonMesh,vp,[.58,.86,.42],1,.83);
  if(!this.townIndoorAvatarMesh){
   const g=settlementResidentsGeometry([{id:"player",x:0,z:0,clothing:0}],()=>0);
   this.townIndoorAvatarMesh=new Mesh(gl,g);
  }

  const person=this.trainInterior.pose||{x:0,z:1.4,yaw:0};
  const model=multiply4(translate(person.x,moving?.025*Math.sin(this.trainClock*6):0,person.z),rotateY(person.yaw||0));
  this.drawMesh(this.townIndoorAvatarMesh,multiply4(vp,model),[.6,.9,.35],1,.88);
  return "train-interior";
 }
 renderTownInterior(asp){
  const gl=this.gl,kind=this.townInterior.type||"cabin";
  if(!this.townRoomMeshes.has(kind))
   this.townRoomMeshes.set(kind,new Mesh(gl,townInteriorGeometry(kind)));
  gl.clearColor(.08,.13,.15,1);
  gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
  const vp=multiply4(perspective(55*DEG,asp,.1,90),
   lookAt([8,6.6,10],[0,1.0,-.2]));
  this.pickVP=null;
  this.drawMesh(this.townRoomMeshes.get(kind),vp,[.5,.9,.45],1,.86);
  if(!this.townIndoorAvatarMesh){
   const g=settlementResidentsGeometry([{id:"player",x:0,z:0,clothing:0}],()=>0);
   this.townIndoorAvatarMesh=new Mesh(gl,g);
  }
  const person=this.townInterior.pose||{x:0,z:2.4,yaw:0};
  const model=multiply4(translate(person.x,0,person.z),rotateY(person.yaw||0));
  this.drawMesh(this.townIndoorAvatarMesh,multiply4(vp,model),[.6,.9,.35],1,.88);
  return "town-interior";
 }
 orbit(s,asp,dt=1/60){
  this.pickVP=null;
  if(this.orbitFocus&&this.orbitPan){
   const a=1-Math.exp(-Math.min(Math.max(dt,0),.1)*5.5);
   const deltaLon=wrapLon(this.orbitFocus.lon-this.orbitPan.lon);
   this.orbitPan.lat+=(this.orbitFocus.lat-this.orbitPan.lat)*a;
   this.orbitPan.lon=wrapLon(this.orbitPan.lon+deltaLon*a);
   if(Math.abs(this.orbitFocus.lat-this.orbitPan.lat)<.01&&
      Math.abs(wrapLon(this.orbitFocus.lon-this.orbitPan.lon))<.01){
    this.orbitPan={...this.orbitFocus};
    this.orbitFocus=null;
   }
  }
  const gl=this.gl,R=this.R,distance=R*(1+s.altitudeM/this.planet.radiusM);
  const c=this.cameraController.config;
  const offset=this.planet.rotationAngle*180/Math.PI*(s.altitudeM>400000?1:0);
  // Orbiting the view never changes the avatar's real lat/lon.
  const freeGeo=c.mode==="free"?
    geoOffset(s.origin.lat,s.origin.lon,c.freeX,c.freeZ,this.planet.radiusM):null;
  const centerLat=freeGeo?.lat??s.lat,centerLon=freeGeo?.lon??s.lon;
  const pitch=c.mode==="free"?c.freePitch:c.pitchRad;
  const yaw=c.mode==="free"?c.freeYaw:c.yawOffset;
  const orbitalLat=this.orbitPan?.lat??clamp(centerLat+(c.mode==="legacy"?0:pitch*30),-89.5,89.5);
  const orbitalLon=this.orbitPan?this.orbitPan.lon+offset:
   centerLon+offset+(c.mode==="legacy"?0:yaw*35);
  this.lastOrbitCenter={lat:orbitalLat,lon:wrapLon(orbitalLon-offset)};
  const n=geoNormal(orbitalLat,orbitalLon),camera=n.map(v=>v*distance);
  const view=lookAt(camera,[0,0,0],Math.abs(n[1])>.95?[0,0,1]:[0,1,0]);
  const vp=multiply4(perspective((c.mode==="legacy"?53:c.fieldOfViewDeg)*DEG,asp,
    Math.max(.01,(distance-R-110)*.3),distance+R*5),view);
  this.orbitVP=vp;this.orbitCamera=camera;this.orbitOffsetDeg=offset;
  const landingPoint=this.selectedLanding?
   geoNormal(this.selectedLanding.lat,this.selectedLanding.lon+offset).map(v=>v*(R+.7)):null;
  // A marker on the far side of the planet must not shine through the globe.
  this.screenLanding=landingPoint&&dot(camera,landingPoint)>R*R?
   projectScreen(vp,landingPoint):null;
  const spin=-this.planet.rotationAngle,tilt=-this.planet.axialTiltDeg*DEG,sun=this.planet.solarDirection;
  const cs=Math.cos(spin),ss=Math.sin(spin),x=cs*sun.x+ss*sun.z,z=-ss*sun.x+cs*sun.z;
  const ct=Math.cos(tilt),st=Math.sin(tilt),light=[x,ct*sun.y-st*z,st*sun.y+ct*z];
  this.drawMesh(this.globe,vp,light,1,.14);
  this.drawMesh(this.globeIslands,vp,light,1,.56);
  // The global globe is coarse (degrees per triangle). Refine only the
  // visible landing neighbourhood as we move toward the cloud deck.
  const tier=orbitalTerrainTier(s.altitudeM);
  if(!tier){
   if(this.orbitDetail){this.orbitDetail.destroy();this.orbitDetail=null;}
   this.orbitDetailCenter=null;this.orbitDetailRadius=0;
  }else{
   const geo={lat:orbitalLat,lon:wrapLon(orbitalLon-offset)};
   const previous=this.orbitDetailCenter;
   const moved=previous?geoLocal(previous.lat,previous.lon,geo.lat,geo.lon,this.planet.radiusM):null;
   const farFromCenter=!moved||Math.hypot(moved.eastM,moved.northM)>tier.radiusM*.14;
   if(!this.orbitDetail||this.orbitDetailRadius!==tier.radiusM||farFromCenter){
    // Do not discard a valid mesh if a new tile cannot be allocated.
    const mesh=new Mesh(gl,buildOrbitalTerrainTile(this.terrain,{
     lat:geo.lat,lon:geo.lon,renderRadius:R,radiusM:tier.radiusM,resolution:tier.resolution
    }));
    this.orbitDetail?.destroy();this.orbitDetail=mesh;
    this.orbitDetailCenter=geo;this.orbitDetailRadius=tier.radiusM;
   }
   this.drawMesh(this.orbitDetail,vp,light,1,.22);
  }
  gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);
  this.drawMesh(this.cloud,vp,light,.33,.32);gl.depthMask(true);gl.disable(gl.BLEND);
  if(c.indicator){
   const actor=geoNormal(s.lat,s.lon+offset).map(v=>v*(R+.15));
   const screen=projectScreen(vp,actor);
   this.actorMarker=screen?{...screen,altitudeM:s.altitudeM,label:"アバターの地表位置"}:null;
  }
  return "orbit";
 }
 drawMarineSurface(vp,light,s,dt){
  const wet=s.travelMode==="swim"||s.travelMode==="dive"||s.travelMode==="boat";
  this.marineClock+=Math.min(.1,Math.max(0,dt));
  const now=this.marineClock;
  // Rebuild a small wave mesh only 3 times/s; do not regenerate whole continents.
  const nearWater=wet||[[0,0],[45,0],[-45,0],[0,45],[0,-45]].some(([x,z])=>{
    const point=geoOffset(s.origin.lat,s.origin.lon,s.x+x,s.z+z,this.planet.radiusM);
    return terrainSurface(this.terrain,point.lat,point.lon).water;
  });
  if(nearWater&&
      (this.lastWaveAt<0||now-this.lastWaveAt>.34)){
   const patch=oceanWavePatch(this.terrain,s.origin,s.x,s.z,now,
    {radius:105,cells:24});
   this.oceanWave?.destroy();
   this.oceanWave=patch.indices.length?new Mesh(this.gl,patch):null;
   this.lastWaveAt=now;
  }
  if(!this.oceanWave)return;
  const gl=this.gl;
  gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);
  this.drawMesh(this.oceanWave,multiply4(vp,translate(-this.cx,0,-this.cz)),light,.52,.87);
  gl.depthMask(true);gl.disable(gl.BLEND);
 }
 drawShipCabin(vp,light,s,waterY){
  this.screenMarineFurniture=[];
  if(!this.marine?.cabinId||!this.marine.boarded||this.marine.boarded.id!==this.marine.cabinId)return;
  const cx=s.x-this.cx,cz=s.z-this.cz,yaw=this.marine.boarded.yaw;
  const base=multiply4(translate(cx,waterY+.23,cz),rotateY(yaw));
  this.drawMesh(this.shipCabinShell,multiply4(vp,base),light,1,.82);
  for(const f of CABIN_FURNITURE){
   const mesh=this.lifeMeshes[f.kind];
   if(!mesh)continue;
   const furniture=multiply4(base,multiply4(translate(f.x,.22,f.z),rotateY(f.yaw)));
   this.drawMesh(mesh,multiply4(vp,furniture),light,1,f.kind==="lamp"?.93:.86);
   const x=cx+Math.cos(yaw)*f.x+Math.sin(yaw)*f.z,
    z=cz-Math.sin(yaw)*f.x+Math.cos(yaw)*f.z;
   const screen=projectScreen(vp,[x,waterY+(f.kind==="bookshelf"?1.7:1.20),z]);
   if(f.kind!=="lamp"&&screen?.onScreen)this.screenMarineFurniture.push({...screen,kind:f.kind});
  }
 }
 pickMarineFurniture(clientX,clientY){
  const rect=this.canvas.getBoundingClientRect();
  if(!rect.width||!rect.height)return null;
  let nearest=null,best=52;
  for(const f of this.screenMarineFurniture){
   const d=Math.hypot(f.u*rect.width-(clientX-rect.left),
    f.v*rect.height-(clientY-rect.top));
   if(d<best){best=d;nearest=f;}
  }
  return nearest;
 }
 drawFishingActivity(vp,light,s,waterY){
  if(!this.marine?.fishing?.casting||this.marine.cabinId||s.altitudeM>12)return;
  const p=this.marine.shipboard?.shipId===this.marine.boardedId?this.marine.shipboard.player:null;
  const position=p?shipLocalToWorld(s.x,s.z,s.yaw,p.x,p.z):{x:s.x,z:s.z};
  const heading=s.yaw+(p?.yaw||0);
  const rodX=position.x-this.cx+Math.cos(heading)*.50,rodZ=position.z-this.cz+Math.sin(heading)*.50;
  const cast=this.marine.fishing.castMotion||0,reel=this.marine.fishing.reelTurns||0;
  const pitch=-.35-.55*Math.sin(Math.PI*cast)+.20*Math.sin(reel*Math.PI*2);
  const rodBase=multiply4(translate(rodX,waterY+(this.marine.boarded?1.65:.25),rodZ),rotX(pitch));
  if(!Object.values(this.handEquipment?.player||{}).includes("fishingRod"))
   this.drawMesh(this.fishingRod,multiply4(vp,rodBase),light,1,.82);
  const distance=this.marine.fishing.lineOutM||5.2,fx=position.x-this.cx+Math.sin(heading)*distance,
   fz=position.z-this.cz+Math.cos(heading)*distance;
  const bounce=.07*Math.sin(this.marineClock*2.3);
  this.drawMesh(this.fishingFloat,multiply4(vp,translate(fx,waterY+.10+bounce,fz)),light,1,.88);
  // Fish approaches the float before the hit, then stays near the lure.
  const seek=this.marine.fishing.approach||0;
  const fishX=fx+Math.cos(heading)*Math.max(.6,9*(1-seek)),fishZ=fz+Math.sin(heading)*Math.max(.6,9*(1-seek));
  const fishY=waterY-1.1-.2*Math.sin(this.marineClock*2);
  const fishTransform=multiply4(translate(fishX,fishY,fishZ),rotateY(heading+this.marineClock*.12));
  this.drawMesh(this.fishMesh,multiply4(vp,fishTransform),light,1,.87);
 }
 drawShipboardObjects(vp,light,s,waterY){
  this.screenShipCrew=[];this.screenShipDoor=null;this.screenShipHelm=null;
  const board=this.marine?.shipboard,boat=this.marine?.boarded;
  if(boat?.kind!=="sailing_ship"||board?.shipId!==boat.id){this.shipFloorCenter=null;return;}
  this.shipFloorCenter={x:s.x,z:s.z,yaw:boat.yaw};
  const zone=board.player.zone;
  const d=SHIP_DOOR[zone],pos=shipLocalToWorld(s.x,s.z,boat.yaw,d.x,d.z);
  const y=waterY+(zone==="cabin"?.47:1.45);
  const hinge=multiply4(translate(pos.x-this.cx,y,pos.z-this.cz),rotateY(boat.yaw));
  const model=multiply4(hinge,multiply4(translate(-.53,0,0),
   multiply4(rotateY(-board.doorProgress*1.3),translate(.53,0,0))));
  this.drawMesh(this.shipDoorMesh,multiply4(vp,model),light,1,.88);
  const point=projectScreen(vp,[pos.x-this.cx,y+1.05,pos.z-this.cz]);
  if(point?.onScreen)this.screenShipDoor={...point,type:"door"};
  if(zone==="deck"){
   const wheel=shipLocalToWorld(s.x,s.z,boat.yaw,SHIP_HELM.x,SHIP_HELM.z);
   const screen=projectScreen(vp,[wheel.x-this.cx,waterY+2.47,wheel.z-this.cz]);
   if(screen?.onScreen)this.screenShipHelm={...screen,type:"helm"};
  }
 }
 pickShipboard(clientX,clientY){
  const r=this.canvas.getBoundingClientRect();if(!r.width||!r.height)return null;
  let best=null,range=44;
  for(const p of [...this.screenShipCrew,this.screenShipDoor,this.screenShipHelm]){
   if(!p)continue;
   const d=Math.hypot(p.u*r.width-(clientX-r.left),p.v*r.height-(clientY-r.top));
   if(d<range){best=p;range=d;}
  }
  return best;
 }
 pickShipboardFloor(clientX,clientY){
  if(!this.pickVP||this.marine?.boarded?.kind!=="sailing_ship")return null;
  const r=this.canvas.getBoundingClientRect();if(!r.width||!r.height)return null;
  const boat=this.marine.boarded,board=this.marine.shipboard;
  if(board?.shipId!==boat.id)return null;
  const cabin=board.player.zone==="cabin";
  const xMax=cabin?1.64:2.28,zMax=cabin?2.08:7.45,y=cabin?.46:1.65;
  const here=this.shipFloorCenter;
  if(!here)return null;
  const corners=[[-xMax,-zMax],[xMax,-zMax],[xMax,zMax],[-xMax,zMax]];
  const vertices=corners.flatMap(([x,z])=>{
   const v=shipLocalToWorld(here.x,here.z,boat.yaw,x,z);
   return [v.x-this.cx,y,v.z-this.cz];
  });
  const nx=((clientX-r.left)/r.width)*2-1,ny=1-((clientY-r.top)/r.height)*2;
  const hit=pickSurface(vertices,[0,1,2,0,2,3],this.pickVP,nx,ny);
  if(!hit)return null;
  const p=shipWorldToLocal(here.x-this.cx,here.z-this.cz,boat.yaw,hit[0],hit[2]);
  return isShipWalkable(p.x,p.z,cabin?"cabin":"deck")?p:null;
 }
 drawSeabed(vp,light,s){
  this.screenUnderseaSites=[];
  if(s.travelMode!=="dive"||!this.marine)return;
  const key=this.seabedAnchor;
  if(!key||Math.hypot(s.x-key.x,s.z-key.z)>35||
    key.lat!==s.origin.lat||key.lon!==s.origin.lon){
   const patch=seabedPatch(this.terrain,s.origin,s.x,s.z,{radius:112,cells:16});
   this.seabedMesh?.destroy();
   this.seabedMesh=patch.indices.length?new Mesh(this.gl,patch):null;
   this.seabedAnchor={x:s.x,z:s.z,lat:s.origin.lat,lon:s.origin.lon};
  }
  if(this.seabedMesh)this.drawMesh(this.seabedMesh,
   multiply4(vp,translate(-this.cx,0,-this.cz)),light,1,.65);
  for(const site of this.marine.sitesNear(s,this.terrain,140)){
   if(this.marine.salvagedSites.has(site.id))continue;
   const mesh=this.underseaModels[site.kind];if(!mesh)continue;
   const x=s.x+site.eastM-this.cx,z=s.z+site.northM-this.cz;
   this.drawMesh(mesh,multiply4(vp,translate(x,-site.depthM+.25,z)),light,1,.72);
   const screen=projectScreen(vp,[x,-site.depthM+2,z]);
   if(screen?.onScreen)this.screenUnderseaSites.push({...screen,id:site.id,kind:site.kind,name:site.name});
  }
 }
 drawMarineWildlife(vp,light,s,radius){
  if(!this.marine)return;
  for(const boat of this.marine.nearby(s,Math.min(radius,1300))){
   const trim=boat.sailTrim||0;
   const mesh=boat.kind==="sailing_ship"?this.sailingShipMeshes[trim<.05?0:trim<.72?1:2]:this.boatMeshes[boat.kind];if(!mesh)continue;
   if(boat.id===this.marine.cabinId)continue;
   const location=terrainSurface(this.terrain,boat.lat,boat.lon);
   const waterY=Number.isFinite(location.waterLevelM)?location.waterLevelM:0;
   const transform=multiply4(translate(boat.x-this.cx,waterY+.06,boat.z-this.cz),rotateY(boat.yaw));
   this.drawMesh(mesh,multiply4(vp,transform),light,1,.73);
  }
  if(!["swim","dive","boat"].includes(s.travelMode))return;
  const deep=s.travelMode==="dive"&&(this.marine?.depthM||0)>7;
  const fish=fishAt(this.planet.seed,s.x,s.z,this.marineClock,deep?17:11);
  for(const f of fish){
   const geo=geoOffset(s.origin.lat,s.origin.lon,f.x,f.z,this.planet.radiusM);
   if(!terrainSurface(this.terrain,geo.lat,geo.lon).water)continue;
   const fishY=s.travelMode==="dive"?-(this.marine?.depthM||0)+Math.sin(this.marineClock*.7+f.kind)*2+.3:.14;
   const transform=multiply4(translate(f.x-this.cx,fishY,f.z-this.cz),rotateY(f.yaw));
   this.drawMesh(deep?this.deepFishMesh:this.fishMesh,multiply4(vp,transform),light,1,.86);
  }
 }
 ground(s,asp,dt=1/60){
  const gl=this.gl,alt=s.altitudeM,cameraMode=this.cameraController.mode;
  const cfg=this.cameraController.config;
  const cameraAltitude=cameraMode==="tactical"?cfg.tacticalHeightM:
    cameraMode==="free"?Math.max(2.5,cfg.freeHeightM):cameraMode==="legacy"?alt:
    Math.max(2.5,cfg.distanceM);
  const requestedRadius=Math.max(alt,cameraAltitude)*4+350;
  const radius=clamp(450*Math.pow(2,Math.ceil(Math.log2(requestedRadius/450))),450,55000);
  const snap=radius<2200?110:radius<6500?600:3000;
  const focusX=cameraMode==="free"?cfg.freeX:s.x,focusZ=cameraMode==="free"?cfg.freeZ:s.z;
  const cx=Math.round(focusX/snap)*snap,cz=Math.round(focusZ/snap)*snap;
  const resolution=radius<=500?112:radius<=1000?96:radius<=2100?72:radius>8000?64:56,key=[cx,cz,Math.round(radius/90),resolution,this.settlementId].join("/");
  if(key!==this.patchKey){
   const geo=geoOffset(s.origin.lat,s.origin.lon,cx,cz,this.planet.radiusM);
   this.patch?.destroy();this.riverWater?.destroy();this.lakeWater?.destroy();this.oceanWave?.destroy();this.oceanWave=null;this.lastWaveAt=-1;this.groundClouds?.destroy();for(const mesh of [...this.trees,...this.meadow,...this.settlement,...this.settlementDecor,...this.residentMeshes])mesh.destroy();
   this.groundPatchData=samplePatch(this.terrain,geo.lat,geo.lon,radius,resolution);
   this.patch=new Mesh(gl,this.groundPatchData);
   const channel=buildRiverWaterPatch(this.terrain,geo,radius);
   this.riverWater=channel.indices.length?new Mesh(gl,channel):null;
   const lake=regionalLakeMesh(this.terrain,geo,radius);
   this.lakeWater=lake.indices.length?new Mesh(gl,lake):null;
    const climate=this.sceneWeather?.sample(s.lat,s.lon,Math.max(0,terrainSurface(this.terrain,s.lat,s.lon).elevationM));
    const clouds=groundCloudGeometry({seed:this.planet.seed,cx,cz,radius,
     baseElevation:terrainSurface(this.terrain,geo.lat,geo.lon).elevationM,
     cloudCover:climate?.cloudCover??.55,precipitation:climate?.precipitation??"none",
     driftEast:this.cloudEast,driftNorth:this.cloudNorth});
    this.cloudOriginEast=this.cloudEast;this.cloudOriginNorth=this.cloudNorth;
    this.cloudCoverBand=Math.floor((climate?.cloudCover??.55)*6);
    this.groundClouds=clouds.indices.length?new Mesh(gl,clouds):null;
   const heightAt=(x,z)=>patchSceneryHeight(this.groundPatchData,x,z);
   const plan=planWorldScenery({
    seed:this.planet.seed,cx,cz,radius,groundAt:heightAt,settlementId:this.settlementId,
    biomeAt:(wx,wz)=>{
     const pos=geoOffset(s.origin.lat,s.origin.lon,wx,wz,this.planet.radiusM);
     return terrainSurface(this.terrain,pos.lat,pos.lon);
    }
   });
   const visible=(this.resourceHarvest?this.resourceHarvest.visible(plan.trees):plan.trees).filter(n=>!this.fallingTrees.has(n.id));
   const instanced=buildSceneryInstances({...plan,trees:visible});
   // Vegetation repeats tiny GPU prototypes; background settlement remains baked.
   const scenery=buildSceneryMeshes({trees:[],grass:[],buildings:plan.buildings});
   this.resourceNodes=visible;
   this.townSites=plan.buildings;
   this.sceneryStats={trees:visible.filter(n=>n.kind==="wood").length,
    rocks:visible.filter(n=>n.kind==="stone").length,
    grass:plan.grass.length,buildings:plan.buildings.length};
   this.trees=instanced.woods.map(g=>new InstancedMesh(gl,sceneryPrototype(g.kind),g.transforms));
   this.meadow=instanced.meadow.map(g=>new InstancedMesh(gl,sceneryPrototype(g.kind),g.transforms));
   this.settlement=scenery.settlement.map(g=>new Mesh(gl,g));
   this.settlementDecor=[];
   this.residentMeshes=[];
   // One moving crowd draw call per clothing variant rather than per person.
   for(let clothing=0;clothing<6;clothing++){
    const residents=plan.people.filter(p=>p.clothing===clothing);
    if(!residents.length)continue;
    const prototype=settlementResidentsGeometry([{id:"prototype",x:0,z:0,clothing}],()=>0);
    const transforms=new Float32Array(residents.length*6);
    for(let i=0;i<residents.length;i++){
     const p=residents[i],k=i*6;
     transforms.set([p.localX,p.elevationM,p.localZ,1,
      Math.cos(p.facing),Math.sin(p.facing)],k);
    }
    const mesh=new InstancedMesh(gl,prototype,transforms);
    mesh.residents=residents;mesh.dynamicTransforms=transforms;
    this.residentMeshes.push(mesh);
   }
   if(plan.landmark)this.settlementDecor.push(new Mesh(gl,observationTowerGeometry({
    x:plan.landmark.localX,z:plan.landmark.localZ,y:plan.landmark.elevationM
   })));
   this.patchKey=key;this.cx=cx;this.cz=cz;
   this.cameraController.smoothEye=null;this.cameraController.smoothTarget=null;
  }
  // Cache the low-poly 47 km panorama independently of the 110 m ground
  // patch snaps, minimizing rebuild cost on mobile WebGL2.
  const panoramaAllowed=radius<=6500;
  const farCx=Math.round(focusX/900)*900,farCz=Math.round(focusZ/900)*900;
  const farKey=[farCx,farCz,this.planet.seed].join("/");
  if(panoramaAllowed&&farKey!==this.distantKey){
   this.distantLandscape?.destroy();
   const farGeo=geoOffset(s.origin.lat,s.origin.lon,farCx,farCz,this.planet.radiusM);
   this.distantLandscape=new Mesh(gl,buildDistantLandscape(this.terrain,farGeo.lat,farGeo.lon));
   this.distantCenter={cx:farCx,cz:farCz};
   this.distantKey=farKey;
  }else if(!panoramaAllowed&&this.distantLandscape){
   this.distantLandscape.destroy();this.distantLandscape=null;this.distantCenter=null;this.distantKey=null;
  }
  const shipboard=this.marine?.shipboard;
  const onboard=Boolean(this.marine?.boarded?.kind==="sailing_ship"&&
   shipboard?.shipId===this.marine.boardedId);
  const person=onboard?shipboard.player:null;
  const worldPerson=person?shipLocalToWorld(s.x,s.z,s.yaw,person.x,person.z):{x:s.x,z:s.z};
  const viewS=person?{...s,x:worldPerson.x,z:worldPerson.z,
   yaw:s.yaw+person.yaw,moving:person.moving,
   totalDistanceM:shipboard.elapsed*2.6,movementSpeed:()=>2.65}:s;
  const px=viewS.x-this.cx,pz=viewS.z-this.cz;
  const currentSurface=terrainSurface(this.terrain,s.lat,s.lon);
  const ground=currentSurface.elevationM;
  const waterY=Number.isFinite(currentSurface.waterLevelM)?currentSurface.waterLevelM:0;
  let marinePose=["swim","dive"].includes(s.travelMode)?
    swimmingPresentation(s.travelMode,s.moving,waterY,this.marine?.depthM||0,this.marineClock,this.marine?.swimStyle,this.marine?.seabedWalking):null;
  if(s.travelMode==="swim"&&this.marine?.entrySeconds>0){
   const p=1-this.marine.entrySeconds/this.marine.entryDuration;
   marinePose={action:"splash",pitch:.50+.8*p,baseY:waterY-1.12+1.8*Math.sin(Math.PI*p)};
  }
  const feet=marinePose?.baseY??(s.travelMode==="boat"?waterY+(this.marine?.cabinId ? .46 : this.marine?.boarded?.kind==="sailing_ship"?1.65:.38):Math.max(ground,0));
  const focusGeo=cameraMode==="free"?
    geoOffset(s.origin.lat,s.origin.lon,focusX,focusZ,this.planet.radiusM):{lat:s.lat,lon:s.lon};
  const focusGround=Math.max(0,terrainSurface(this.terrain,focusGeo.lat,focusGeo.lon).elevationM);
  const room=this.sceneActions?.structures.find(b=>b.id===this.interiorBuildingId&&b.progress>=1);
  const cabinActive=Boolean(this.marine?.cabinId&&this.marine.boarded?.id===this.marine.cabinId);
  const camYaw=viewS.yaw||0;
  const camera=room?{
   eye:[room.x-this.cx+1.5,room.height+8.1,room.z-this.cz+4.4],
   target:[s.x-this.cx,room.height+1,s.z-this.cz-.55],
   fovDeg:64,heightM:8,marker:false
  }:cabinActive?{
   eye:[px+Math.cos(camYaw)*4.4+Math.sin(camYaw)*5.8,waterY+6.9,
    pz-Math.sin(camYaw)*4.4+Math.cos(camYaw)*5.8],
   target:[px,waterY+1.55,pz],fovDeg:58,heightM:6,marker:false
  }:this.cameraController.groundView(viewS,{
    cx:this.cx,cz:this.cz,groundM:marinePose?.action==="swim"||marinePose?.action==="tread"?waterY-1:feet,focusGroundM:focusGround,dt
  });
  if(s.travelMode==="dive"&&!room&&!cabinActive&&cameraMode!=="free"&&cameraMode!=="tactical"){
   camera.eye[1]=Math.min(waterY-.35,feet+2.35);camera.target[1]=feet+.65;
  }
  const vp=multiply4(perspective(camera.fovDeg*DEG,asp,.12,Math.max(radius*8,65000)),
    lookAt(camera.eye,camera.target,this.rtsHeadingUp&&cameraMode==='tactical'?[Math.sin(this.rtsHeadingYaw),0,Math.cos(this.rtsHeadingYaw)]:undefined));
  this.pickVP=vp;
  const light=[.4,Math.max(.3,this.planet.illumination(s.lat,s.lon)),.2];
  // Draw kilometer-scale mountains before the collision mesh, without writing
  // depth. The full-detail foreground always wins even where LODs overlap.
  if(this.distantLandscape&&s.travelMode!=="dive"){
   gl.depthMask(false);
   this.drawMesh(this.distantLandscape,multiply4(vp,translate(
     this.distantCenter.cx-this.cx,0,this.distantCenter.cz-this.cz)),light,1,.83);
   gl.depthMask(true);
  }
  if(s.travelMode==="dive"){
   gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);
   this.drawMesh(this.patch,vp,light,.5,.66);
   gl.depthMask(true);gl.disable(gl.BLEND);
  }else this.drawMesh(this.patch,vp,light,1,.58);
  if(this.riverWater)this.drawMesh(this.riverWater,vp,light,1,.86);
  if(this.lakeWater)this.drawMesh(this.lakeWater,vp,light,1,.88);
  this.drawMarineSurface(vp,light,s,dt);
  if(s.travelMode==="swim"&&this.marine?.entrySeconds>0){
   const p=1-this.marine.entrySeconds/this.marine.entryDuration,spread=.55+2.1*p;
   const size=[spread,0,0,0,0,1,0,0,0,0,spread,0,0,0,0,1];
   const ripple=multiply4(translate(s.x-this.cx,waterY+.07,s.z-this.cz),size);
   this.drawMesh(this.selectionRing,multiply4(vp,ripple),light,1,.94,[.60,.91,1]);
  }
  this.drawSeabed(vp,light,s);
  for(const mesh of this.meadow)this.drawInstancedMesh(mesh,vp,light,1,.72);
   for(const mesh of this.trees)this.drawInstancedMesh(mesh,vp,light,1,.58);
   this.drawFallingTrees(vp,light,dt);
   for(const mesh of this.settlement)this.drawMesh(mesh,vp,light,1,.64);
   for(const mesh of this.settlementDecor)this.drawMesh(mesh,vp,light,1,.72);
   const railStation=this.railway?.station(this.settlementId);
   if(railStation){
    // The rails extend beyond the platform along the actual local ground.
    if(this.stationTrackId!==this.settlementId){
     this.stationTrackMesh?.destroy();
     const sleepers=[];
     for(let i=0;i<=110;i++){
      const z=railStation.site.z-380+i*7.0,x=railStation.site.x;
      const point=geoOffset(s.origin.lat,s.origin.lon,x,z,this.planet.radiusM);
      const y=Math.max(0,terrainSurface(this.terrain,point.lat,point.lon).elevationM);
      sleepers.push({x,z,y});
     }
     const track=trackGeometry(sleepers);
     this.stationTrackMesh=track.indices.length?new Mesh(gl,track):null;
     this.stationTrackId=this.settlementId;
    }
    if(this.stationTrackMesh)this.drawMesh(this.stationTrackMesh,
     multiply4(vp,translate(-this.cx,0,-this.cz)),light,1,.82);
    const x=railStation.site.x-this.cx,z=railStation.site.z-this.cz;
    const y=patchSceneryHeight(this.groundPatchData,x,z);
    const stationModel=multiply4(translate(x,y,z),rotateY(railStation.site.yaw||0));
    this.drawMesh(this.railwayStationMesh,multiply4(vp,stationModel),light,1,.72);
    const locations=this.railwayLocations||[];
    this.trainClock+=Math.max(0,Math.min(dt,.1));
    for(const state of this.railway.live(this.planet.timeDays)){
     const pose=railwayJourneyPose(this.terrain,locations,state,this.planet.timeDays);
     if(!pose)continue;
     const place=geoLocal(s.origin.lat,s.origin.lon,pose.lat,pose.lon,this.planet.radiusM);
     if(Math.hypot(place.eastM-s.x,place.northM-s.z)>radius*.95)continue;
     this.drawRailwayVehicle(vp,light,place.eastM-this.cx,pose.elevationM,
      place.northM-this.cz,pose.yaw,pose);
    }
   }
   if(this.settlementId!=="pioneer"&&this.settlementId!=="wilderness"){
    const range=cameraMode==="tactical"?120:42;
    for(const site of this.townSites){
     if(Math.hypot(site.x-s.x,site.z-s.z)>range)continue;
     const spot=projectScreen(vp,[site.localX,site.elevationM+2.4,site.localZ]);
     if(spot?.onScreen)this.screenTownBuildings.push({...spot,x:site.x,z:site.z,
       source:"village",id:site.id});
    }
   }
   // Residents stroll gently along lanes; movement is local and deterministic.
   for(const mesh of this.residentMeshes){
    for(let i=0;i<mesh.residents.length;i++){
     const resident=mesh.residents[i],a=this.marineClock*.55+i*1.4+resident.clothing;
     const dx=Math.sin(a)*.65,dz=Math.cos(a)*.55,k=i*6;
     mesh.dynamicTransforms[k]=resident.localX+dx;
     mesh.dynamicTransforms[k+1]=resident.elevationM+Math.max(0,Math.sin(a*4))*.035;
     mesh.dynamicTransforms[k+2]=resident.localZ+dz;
     mesh.dynamicTransforms[k+3]=1;
     mesh.dynamicTransforms[k+4]=Math.cos(a+Math.PI*.5);
     mesh.dynamicTransforms[k+5]=Math.sin(a+Math.PI*.5);
    }
    mesh.updateTransforms(mesh.dynamicTransforms);
    this.drawInstancedMesh(mesh,vp,light,1,.72);
    for(const person of mesh.residents){
     if(Math.hypot(person.x-s.x,person.z-s.z)>25)continue;
     const p=projectScreen(vp,[person.localX,person.elevationM+2.0,person.localZ]);
     if(p?.onScreen)this.screenTownResidents.push({...p,id:person.id,
      source:"resident",x:person.x,z:person.z});
    }
   }
   this.drawPlacedStructures(vp,light,s,radius);
  // Resource hit-testing is local to the camera, not all 16k wood/stone nodes.
  this.screenResources=[];
  const farPick=cameraMode==="tactical"&&camera.heightM>70;
  const pickRadius=farPick?Math.min(480,camera.heightM*2.4):140;
  const thinning=farPick?Math.max(1,Math.floor(this.resourceNodes.length/1400)):1;
  for(let i=0;i<this.resourceNodes.length;i++){
   if(i%thinning!==0)continue;
   const node=this.resourceNodes[i],dx=node.x-s.x,dz=node.z-s.z;
   if(dx*dx+dz*dz>pickRadius*pickRadius)continue;
   const screen=projectScreen(vp,[node.x-this.cx,node.elevationM+(node.kind==="wood"?2.0:.85),node.z-this.cz]);
   if(screen?.onScreen)this.screenResources.push({...node,...screen});
   if(this.screenResources.length>=1800)break;
  }
  if(this.selectedResource){
   const node=this.resourceNodes?.find(n=>n.id===this.selectedResource.id);
   if(node)this.drawMesh(this.selectionRing,
    multiply4(vp,translate(node.x-this.cx,node.elevationM+.06,node.z-this.cz)),light,1,.95,[.45,1,.55]);
  }
  if(this.mapFocus&&Number.isFinite(this.mapFocus.x)&&Number.isFinite(this.mapFocus.z)){
   const focus=this.mapFocus,x=focus.x-this.cx,z=focus.z-this.cz;
   if(Math.abs(x)<=radius&&Math.abs(z)<=radius){
    const geo=geoOffset(s.origin.lat,s.origin.lon,focus.x,focus.z,this.planet.radiusM);
    const ground=terrainSurface(this.terrain,geo.lat,geo.lon);
    this.drawMesh(this.selectionRing,
     multiply4(vp,translate(x,ground.water||ground.river?.1:ground.elevationM+.07,z)),light,1,.97,[.28,.98,1]);
   }
  }
  this.drawBuildings(vp,light,s,radius,dt);
  this.drawAgriculture(vp,light,s,radius);
  this.drawFauna(vp,light,s,radius);
  this.drawMarineWildlife(vp,light,s,radius);
  this.drawShipCabin(vp,light,s,waterY);
  this.drawShipboardObjects(vp,light,s,waterY);
  this.drawFishingActivity(vp,light,s,waterY);
  this.drawFrontier(vp,light,s,radius);
  this.drawTestEnemies(vp,light,s,radius);
  this.drawPhysicalArrows(vp,light);
  this.drawLifestyle(vp,light,s,radius);
  // The grounded avatar remains at real scale even when the observer ascends.
  const transform=translate(px,feet+(s.jumpY||0)+(this.fauna?.mount?1.15:0),pz);
  const lifeAction=this.sceneLife?.activity;
  const baseMotion=marinePose?
   {action:marinePose.action,progress:0}:
   this.marine?.fishing?.casting?
   {action:"fish",progress:(this.marine.fishing.castMotion<1?this.marine.fishing.castMotion:
    1+this.marine.fishing.reelTurns*2*Math.PI)}:
   lifeAction&&lifeAction!=="idle"?
   {action:lifeAction,progress:0}:this.sceneActions?.getAnimation()||{action:"idle",progress:0};
  const hitActive=(this.playerHitSeconds||0)>0;
  const hitMotion=!marinePose&&hitActive&&!["sword","spear","greatsword","axe","bow","guard"].includes(baseMotion.action);
  const playerMotion=hitMotion?
   {action:"hit",progress:Math.max(0,Math.min(1,1-(this.playerHitSeconds||0)/.48))}:
   baseMotion;
  const playerTint=hitActive?[1,.56,.56]:[1,1,1];
  if(!this.drawFrontierAvatar(this.glbFor.player,vp,transform,viewS,light,dt,playerMotion,'player'))
   this.drawArticulated(vp,transform,viewS,light,dt,this.animator,this.expression,playerMotion,playerTint,"player");
  const gearModel=this.divingEquipmentModels[this.marine?.diveGear];
  if(gearModel&&s.travelMode!=="boat"){
   const gearTransform=multiply4(transform,multiply4(rotateY(viewS.yaw||0),rotX(marinePose?.pitch||0)));
   this.drawMesh(gearModel,multiply4(vp,gearTransform),light,1,.84);
  }
  // Each companion has a separate controller and animator. Screen-space
  // projections are used for tap selection in the overhead RTS view.
  const actors=this.squad?.agents||[];
  this.screenActors=[];
  for(const agent of actors){
   const base=agent.control,crewPose=onboard?shipboard.member(agent.id):null;
   if(onboard&&agent.id!=="player"&&(!crewPose||crewPose.zone!==person.zone))continue;
   const world=crewPose?shipLocalToWorld(s.x,s.z,s.yaw,crewPose.x,crewPose.z):null;
   const unit=crewPose?{...base,x:world.x,z:world.z,yaw:s.yaw+crewPose.yaw,
    moving:crewPose.moving,totalDistanceM:shipboard.elapsed*1.2,movementSpeed:()=>1.15}:base;
   const elevation=crewPose?waterY+(crewPose.zone==="cabin"?.46:1.65):
    Math.max(0,terrainSurface(this.terrain,unit.lat,unit.lon).elevationM);
   const x=unit.x-this.cx,z=unit.z-this.cz;
   if(Math.abs(x)>radius||Math.abs(z)>radius)continue;
   const projected=projectScreen(vp,[x,elevation+(unit.jumpY||0)+1.6,z]);
   if(projected?.onScreen){
    this.screenActors.push({...projected,id:agent.id,name:agent.name});
    if(crewPose&&agent.id!=="player")
     this.screenShipCrew.push({...projected,id:agent.id,name:agent.name,type:"crew"});
   }
   if(this.squad.selected.has(agent.id))
    this.drawMesh(this.selectionRing,multiply4(vp,translate(x,elevation+(unit.jumpY||0),z)),light,1,.85);
   if(agent.id==="player")continue;
   if(!this.npcAnimators.has(agent.id))
    this.npcAnimators.set(agent.id,{animator:new SmoothAnimator(),expression:new ExpressionController()});
   const ctx=this.npcAnimators.get(agent.id);
   const model=translate(x,elevation+(unit.jumpY||0),z);
   const motion=crewPose?{action:crewPose.task==="rest"?"sit":"idle",progress:0}:
    this.squad.getMotion(agent);
   const highDetail=actors.length<=16||actors.indexOf(agent)<10||
    (this.squad.selected.size<=6&&this.squad.selected.has(agent.id));
   if(!highDetail||!this.drawFrontierAvatar(this.glbFor[agent.id],vp,model,unit,light,dt,motion,agent.id))
    this.drawArticulated(vp,model,unit,light,dt,ctx.animator,ctx.expression,
     motion,agent.id==="scout"?[.65,.86,1]:[1,.78,.65],agent.id);
  }
  if(camera.marker){
   const screen=projectScreen(vp,camera.actorPos);
   this.actorMarker=screen?{...screen,altitudeM:camera.heightM,label:"アバターの位置"}:null;
  }
  // Wind-driven sky volumes, behind intervening mountain peaks.
  this.renderWeatherClouds(s,geoOffset(s.origin.lat,s.origin.lon,this.cx,this.cz,this.planet.radiusM),radius,vp,light,dt);
  return "ground";
 }
 destroy(){
   for(const m of [this.globe,this.globeIslands,this.cloud,this.orbitDetail,this.patch,this.distantLandscape,this.lakeWater,this.riverWater,this.oceanWave,this.groundClouds,...this.trees,...this.meadow,...this.settlement,...this.settlementDecor,...this.residentMeshes,...this.townRoomMeshes.values(),...this.trainRoomMeshes.values(),this.townIndoorAvatarMesh,this.railwayStationMesh,this.railwayTrainMesh,this.railWheelSpokes,this.railConnectingRod,this.railSmokePuff,this.stationTrackMesh,this.railJourneyPatch,this.railJourneyHorizon,this.railJourneyTrack,this.trainWindowPatch,this.trainWindowHorizon,this.trainPersonMesh,...this.railJourneyTrees,...this.railJourneyGrass,this.selectionRing,this.practiceTargetMesh,...this.rigParts.map(x=>x.mesh),...Object.values(this.tools),this.typedArrows.iron,this.typedArrows.fire,...this.bowStrings,...Object.values(this.enemyMeshes),...Object.values(this.animatedEnemies).flatMap(parts=>Object.values(parts)),this.enemyHealthTrack,this.enemyHealthFill,...Object.values(this.buildingMeshes),...Object.values(this.placedMeshes),...Object.values(this.roomMeshes),...Object.values(this.lifeMeshes),...Object.values(this.campMeshes),...Object.values(this.dishMeshes),...Object.values(this.fwResourceMeshes),...Object.values(this.animalMeshes),...Object.values(this.boatMeshes),...this.sailingShipMeshes,this.fishMesh,this.shipCabinShell,this.shipDoorMesh,this.fishingRod,this.fishingFloat,this.seabedMesh,this.deepFishMesh,...Object.values(this.divingEquipmentModels),...Object.values(this.underseaModels),...this.horseTackMeshes.values(),...this.animalGrazeMeshes.values(),...this.farmMeshes.values(),...Object.values(this.glbMeshes).flat()])m?.destroy();
    for(const asset of Object.values(this.animatedGlb))asset?.destroy();
   for(const fall of this.fallingTrees.values())fall.mesh.destroy();this.fallingTrees.clear();
   this.gl.deleteProgram(this.program);
 }
}
