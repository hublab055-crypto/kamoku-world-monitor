import {geoNormal,geoOffset,geoLocal,DEG,clamp,samplePatch,terrainSurface} from "./geo.mjs";
import {noise3} from "../planet/planet-core.mjs";
import {RIG_SEGMENTS,samplePose,jointTransforms,matrixMultiply,translate,rotX,bowDrawState} from "./rig.mjs";
import {pickSurface} from "./picking.mjs";
import {buildOriginalModel} from "../original-assets/original-models.mjs";
import {jointTransformsV2} from "./rig-v2.mjs";
import {SmoothAnimator} from "./animator.mjs";
import {makeJointCovers} from "./joint-covers.mjs";
import {createAppearance,restoreAppearance,buildAppearanceParts} from "./wardrobe.mjs";
import {ExpressionController,makeFaceParts,expressionPoseValues} from "./expression.mjs";
import {rotZ} from "./rig.mjs";
import {CameraController} from "./camera-controller.mjs";
import {SkinnedFrontierAsset} from "./frontier-skinned-renderer.mjs";
import {CATALOG} from "./lifestyle.mjs";
import {enemyMotion,HUMANOID_MONSTERS} from "./enemy-motion.mjs";
import {furnitureGeometry,campGeometry,flameGeometry,dishGeometry} from "./lifestyle-geometry.mjs";
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
const VERT=["#version 300 es","precision highp float;","layout(location=0) in vec3 aPos;","layout(location=1) in vec3 aNorm;","layout(location=2) in vec3 aColor;","uniform mat4 uMvp;","out vec3 vN; out vec3 vC;","void main(){vN=aNorm;vC=aColor;gl_Position=uMvp*vec4(aPos,1.0);}"].join("\n");
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

// Local equipment geometries are in metres; character forward is +Z.
export const EQUIPMENT_SCALE=Object.freeze({sword:.42,axe:.40,pickaxe:.32,hammer:.38});
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
function arrowGeometry(){
 const b=builder(),wood=[.65,.46,.25],steel=[.81,.88,.91],fletch=[.84,.25,.16];
 // Shaft and nock run along +Z: the arrowhead is pointed away from the avatar.
 box(b,0,-.008,0,.011,.016,.47,wood);
 for(const sign of [-1,1]){
  triangle(b,[0,-.008,.56],[sign*.050,-.010,.43],[0,.034,.43],steel);
  triangle(b,[0,-.008,.56],[0,-.050,.43],[sign*.050,-.010,.43],steel);
  triangle(b,[sign*.008,0,-.33],[sign*.10,.002,-.47],[sign*.008,.012,-.45],fletch);
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
 return kind==="bow"?grip:multiply4(grip,rotX(Math.PI/2));
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
   const pp=coords.map(c=>geoNormal(...c).map(v=>v*(R+8)));
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
function vegetation(terrain,planet,origin,cx,cz,radius){
 const b=builder();
 if(radius>4100)return b;
 const cell=98,rng=Math.min(radius*.87,850);
 let count=0;
 for(let iz=Math.floor((cz-rng)/cell);iz<=Math.ceil((cz+rng)/cell);iz++){
  for(let ix=Math.floor((cx-rng)/cell);ix<=Math.ceil((cx+rng)/cell);ix++){
   if(count>=80)break;
   const val=noise3(ix*.84,iz*.92,5,planet.seed+503);
   if(val<-.22)continue;
   const ax=ix*cell+val*9,az=iz*cell+val*11,x=ax-cx,z=az-cz;
   if(Math.abs(x)>radius*.98||Math.abs(z)>radius*.98)continue;
   const geo=geoOffset(origin.lat,origin.lon,ax,az,planet.radiusM);
   const s=terrainSurface(terrain,geo.lat,geo.lon);
   if(s.water||s.river||s.elevationM<60||s.elevationM>2200)continue;
   const id=val>.28?"broadleaf":val>.04?"pine":val>-.07?"flowering":"boulder";
   const scale=id==="boulder"?.8:1.05+Math.abs(val)*.42;
   appendModel(b,original(id),x,s.elevationM,z,scale,val*5);
   count++;
  }
  if(count>=80)break;
 }
 return b;
}
export class ExplorerRenderer{
 constructor(canvas,planet,terrain){
  const gl=canvas.getContext("webgl2",{antialias:true,alpha:true,powerPreference:"high-performance"});
  if(!gl)throw Error("WebGL2が利用できません。対応ブラウザを利用してください。");
  this.gl=gl;this.canvas=canvas;this.planet=planet;this.terrain=terrain;
  this.cameraController=new CameraController();
  this.actorMarker=null;
  this.screenActors=[];
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
  this.uAlpha=gl.getUniformLocation(pg,"uAlpha");this.uAmbient=gl.getUniformLocation(pg,"uAmbient");this.uTint=gl.getUniformLocation(pg,"uTint");
  const earth=sphereGeometry(terrain,planet);this.R=earth.R;
  this.globe=new Mesh(gl,earth.ground);this.cloud=new Mesh(gl,earth.clouds);
  this.patch=null;this.trees=null;this.patchKey=null;
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
  this.tools.bow=new Mesh(gl,bowGeometry());
  this.bowStrings=Array.from({length:9},(_,i)=>new Mesh(gl,bowStringGeometry(i/8)));
  this.tools.arrow=new Mesh(gl,arrowGeometry());
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
  this.sceneActions=null;this.sceneFrontier=null;this.glbMeshes={};this.animatedGlb={};this.glbStatuses={};this.socialAnimations=new Map();this.handEquipment={};this.actionHand={};this.glbFor={player:'male',scout:'female',artisan:'male'};this.rtsHeadingUp=false;this.rtsHeadingYaw=0;
   this.fwResourceMeshes={};
   const colors={wood:[.40,.24,.15],stone:[.54,.59,.62],fiber:[.27,.64,.35],food:[.80,.31,.23],water:[.22,.59,.84]};
   for(const [kind,color] of Object.entries(colors)){
    const geo=builder();box(geo,0,0,0,.48,.85,.48,color);
    if(kind==='wood'||kind==='fiber')cone(geo,0,.86,0,.6,.55,color);
    this.fwResourceMeshes[kind]=new Mesh(gl,geo);
   }
  this.pickVP=null;this.groundPatchData=null;
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
      speedMps:s.moving?s.walkSpeed:0,
      jumpHeight:s.jumpY||0,action:motion.action,progress:motion.progress,variant:motion.variant||"overhead",
      emotion:expression.preset,faceDirection:face.gazeX*.27,hand:motion?.hand||this.actionHand?.[actorId]||"right",
      equipped:this.handEquipment?.[actorId]||{}
   });
   Object.assign(pose,expressionPoseValues(face));
   const joints=jointTransformsV2(pose,s.yaw);
   for(const {mesh,part} of this.rigParts){
     let m=matrixMultiply(avatarTransform,joints[part.pivot]);
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
   const equipment=this.handEquipment?.[actorId]||{};
   const activeHand=motion?.hand||this.actionHand?.[actorId]||"right";
   for(const hand of ["right","left"]){
    // The other hand must be free to place the arrow and draw the bowstring.
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
   if(!bowDrawState(progress).visible)return;
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
 drawTestEnemies(vp,light,s,radius){
  this.screenEnemies=[];
  if(!this.battle)return;
  for(const enemy of this.battle.enemies){
   if(enemy.hp<=0&&(enemy.deathTime||0)>5)return;
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
   for(const hand of ["right","left"]){
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
  const rig=this.animatedGlb[sex];
  if(rig){
   const characterTransform=multiply4(transform,rotateY(unit.yaw||0));
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
   if(drawn)this.drawSkinnedHandEquipment(rig,id,vp,characterTransform,light,motion);
   return drawn;
  }
  const meshes=this.glbMeshes[sex];if(!meshes?.length)return false;
  const mvp=multiply4(vp,multiply4(transform,rotateY(unit.yaw||0)));
  for(const mesh of meshes)this.drawMesh(mesh,mvp,light,1,.83);
  return true;
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
  gl.uniform1f(this.uAlpha,alpha);gl.uniform1f(this.uAmbient,ambient);mesh.draw();
 }
 frame(state,dt=1/60){
  const gl=this.gl,dpr=Math.min(2,globalThis.devicePixelRatio||1);
  const w=Math.max(1,Math.floor(this.canvas.clientWidth*dpr)),h=Math.max(1,Math.floor(this.canvas.clientHeight*dpr));
  if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;}
  // Ground view exposes the atmospheric CSS gradient through transparent sky pixels.
  // Orbital view remains opaque dark space; terrain meshes always draw opaque.
  const inOrbit=state.altitudeM>23000;
  gl.viewport(0,0,w,h);gl.clearColor(.011,.032,.071,inOrbit?1:0);
  gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(this.program);
  const asp=w/h;
  this.actorMarker=null;
  this.screenActors=[];this.screenEnemies=[];this.screenDoors=[];this.screenShelves=[];this.screenFurniture=[];this.screenCamps=[];
  return inOrbit?this.orbit(state,asp):this.ground(state,asp,dt);
 }
 orbit(s,asp){
  this.pickVP=null;
  const gl=this.gl,R=this.R,distance=R*(1+s.altitudeM/this.planet.radiusM);
  const c=this.cameraController.config;
  const offset=this.planet.rotationAngle*180/Math.PI*(s.altitudeM>400000?1:0);
  // Orbiting the view never changes the avatar's real lat/lon.
  const freeGeo=c.mode==="free"?
    geoOffset(s.origin.lat,s.origin.lon,c.freeX,c.freeZ,this.planet.radiusM):null;
  const centerLat=freeGeo?.lat??s.lat,centerLon=freeGeo?.lon??s.lon;
  const pitch=c.mode==="free"?c.freePitch:c.pitchRad;
  const yaw=c.mode==="free"?c.freeYaw:c.yawOffset;
  const orbitalLat=clamp(centerLat+(c.mode==="legacy"?0:pitch*30),-89.5,89.5);
  const orbitalLon=centerLon+offset+(c.mode==="legacy"?0:yaw*35);
  const n=geoNormal(orbitalLat,orbitalLon),camera=n.map(v=>v*distance);
  const view=lookAt(camera,[0,0,0],Math.abs(n[1])>.95?[0,0,1]:[0,1,0]);
  const vp=multiply4(perspective((c.mode==="legacy"?53:c.fieldOfViewDeg)*DEG,asp,
    Math.max(.01,(distance-R-110)*.3),distance+R*5),view);
  const spin=-this.planet.rotationAngle,tilt=-this.planet.axialTiltDeg*DEG,sun=this.planet.solarDirection;
  const cs=Math.cos(spin),ss=Math.sin(spin),x=cs*sun.x+ss*sun.z,z=-ss*sun.x+cs*sun.z;
  const ct=Math.cos(tilt),st=Math.sin(tilt),light=[x,ct*sun.y-st*z,st*sun.y+ct*z];
  this.drawMesh(this.globe,vp,light,1,.14);
  gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);
  this.drawMesh(this.cloud,vp,light,.33,.32);gl.depthMask(true);gl.disable(gl.BLEND);
  if(c.indicator){
   const actor=geoNormal(s.lat,s.lon+offset).map(v=>v*(R+.15));
   const screen=projectScreen(vp,actor);
   this.actorMarker=screen?{...screen,altitudeM:s.altitudeM,label:"アバターの地表位置"}:null;
  }
  return "orbit";
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
  const resolution=radius>8000?64:56,key=[cx,cz,Math.round(radius/90),resolution].join("/");
  if(key!==this.patchKey){
   const geo=geoOffset(s.origin.lat,s.origin.lon,cx,cz,this.planet.radiusM);
   this.patch?.destroy();this.trees?.destroy();
   this.groundPatchData=samplePatch(this.terrain,geo.lat,geo.lon,radius,resolution);
   this.patch=new Mesh(gl,this.groundPatchData);
   const shrubs=vegetation(this.terrain,this.planet,s.origin,cx,cz,radius);
   this.trees=shrubs.positions.length?new Mesh(gl,shrubs):null;
   this.patchKey=key;this.cx=cx;this.cz=cz;
   this.cameraController.smoothEye=null;this.cameraController.smoothTarget=null;
  }
  const px=s.x-this.cx,pz=s.z-this.cz;
  const ground=terrainSurface(this.terrain,s.lat,s.lon).elevationM;
  const feet=Math.max(ground,0);
  const focusGeo=cameraMode==="free"?
    geoOffset(s.origin.lat,s.origin.lon,focusX,focusZ,this.planet.radiusM):{lat:s.lat,lon:s.lon};
  const focusGround=Math.max(0,terrainSurface(this.terrain,focusGeo.lat,focusGeo.lon).elevationM);
  const room=this.sceneActions?.structures.find(b=>b.id===this.interiorBuildingId&&b.progress>=1);
  const camera=room?{
   eye:[room.x-this.cx+1.5,room.height+8.1,room.z-this.cz+4.4],
   target:[s.x-this.cx,room.height+1,s.z-this.cz-.55],
   fovDeg:64,heightM:8,marker:false
  }:this.cameraController.groundView(s,{
    cx:this.cx,cz:this.cz,groundM:feet,focusGroundM:focusGround,dt
  });
  const vp=multiply4(perspective(camera.fovDeg*DEG,asp,.08,Math.max(radius*8,5000)),
    lookAt(camera.eye,camera.target,this.rtsHeadingUp&&cameraMode==='tactical'?[Math.sin(this.rtsHeadingYaw),0,Math.cos(this.rtsHeadingYaw)]:undefined));
  this.pickVP=vp;
  const light=[.4,Math.max(.3,this.planet.illumination(s.lat,s.lon)),.2];
  this.drawMesh(this.patch,vp,light,1,.58);
  if(this.trees)this.drawMesh(this.trees,vp,light,1,.58);
  this.drawBuildings(vp,light,s,radius,dt);
  this.drawFrontier(vp,light,s,radius);
  this.drawTestEnemies(vp,light,s,radius);
  this.drawLifestyle(vp,light,s,radius);
  // The grounded avatar remains at real scale even when the observer ascends.
  const transform=translate(px,feet+(s.jumpY||0),pz);
  const lifeAction=this.sceneLife?.activity;
  const playerMotion=lifeAction&&lifeAction!=="idle"?
   {action:lifeAction,progress:0}:this.sceneActions?.getAnimation()||{action:"idle",progress:0};
  if(!this.drawFrontierAvatar(this.glbFor.player,vp,transform,s,light,dt,playerMotion,'player'))
   this.drawArticulated(vp,transform,s,light,dt,this.animator,this.expression,playerMotion,[1,1,1],"player");
  // Each companion has a separate controller and animator. Screen-space
  // projections are used for tap selection in the overhead RTS view.
  const actors=this.squad?.agents||[];
  this.screenActors=[];
  for(const agent of actors){
   const unit=agent.control;
   const elevation=Math.max(0,terrainSurface(this.terrain,unit.lat,unit.lon).elevationM);
   const x=unit.x-this.cx,z=unit.z-this.cz;
   const projected=projectScreen(vp,[x,elevation+(unit.jumpY||0)+1.8,z]);
   if(projected)this.screenActors.push({...projected,id:agent.id,name:agent.name});
   if(this.squad.selected.has(agent.id)){
    this.drawMesh(this.selectionRing,multiply4(vp,translate(x,elevation+(unit.jumpY||0),z)),light,1,.85);
   }
   if(agent.id==="player"||Math.abs(x)>radius||Math.abs(z)>radius)continue;
   if(!this.npcAnimators.has(agent.id))
    this.npcAnimators.set(agent.id,{animator:new SmoothAnimator(),expression:new ExpressionController()});
   const ctx=this.npcAnimators.get(agent.id);
   const model=translate(x,elevation+(unit.jumpY||0),z);
   if(!this.drawFrontierAvatar(this.glbFor[agent.id],vp,model,unit,light,dt,this.squad.getMotion(agent),agent.id))
    this.drawArticulated(vp,model,unit,light,dt,ctx.animator,ctx.expression,
     this.squad.getMotion(agent),agent.id==="scout"?[.65,.86,1]:[1,.78,.65],agent.id);
  }
  if(camera.marker){
   const screen=projectScreen(vp,camera.actorPos);
   this.actorMarker=screen?{...screen,altitudeM:camera.heightM,label:"アバターの位置"}:null;
  }
  return "ground";
 }
 destroy(){
   for(const m of [this.globe,this.cloud,this.patch,this.trees,this.selectionRing,...this.rigParts.map(x=>x.mesh),...Object.values(this.tools),...this.bowStrings,...Object.values(this.enemyMeshes),...Object.values(this.animatedEnemies).flatMap(parts=>Object.values(parts)),this.enemyHealthTrack,this.enemyHealthFill,...Object.values(this.buildingMeshes),...Object.values(this.roomMeshes),...Object.values(this.lifeMeshes),...Object.values(this.campMeshes),...Object.values(this.dishMeshes),...Object.values(this.fwResourceMeshes),...Object.values(this.glbMeshes).flat()])m?.destroy();
    for(const asset of Object.values(this.animatedGlb))asset?.destroy();
   this.gl.deleteProgram(this.program);
 }
}
