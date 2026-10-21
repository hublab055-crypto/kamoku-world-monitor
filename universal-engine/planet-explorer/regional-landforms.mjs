/**
 * Large-scale landforms around the first settlement.
 * Coordinates are geodesic metres from a fixed landing anchor, never camera
 * coordinates. This additive field leaves the town itself and all old saves
 * untouched, while giving the horizon a continuous alpine watershed.
 */
const DEG=Math.PI/180,RAD=180/Math.PI;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a),0,1);return t*t*(3-2*t);};
function local(anchor,lat,lon,radius){
 const la=anchor.lat*DEG,lo=anchor.lon*DEG,a=lat*DEG,b=lon*DEG;
 const up=[Math.cos(la)*Math.cos(lo),Math.sin(la),Math.cos(la)*Math.sin(lo)];
 const p=[Math.cos(a)*Math.cos(b),Math.sin(a),Math.cos(a)*Math.sin(b)];
 const cosine=clamp(up[0]*p[0]+up[1]*p[1]+up[2]*p[2],-1,1);
 const theta=Math.acos(cosine);if(theta<1e-12)return {x:0,z:0};
 const tangent=p.map((v,i)=>v-up[i]*cosine),length=Math.hypot(...tangent);
 const east=[-Math.sin(lo),0,Math.cos(lo)];
 const north=[-Math.sin(la)*Math.cos(lo),Math.cos(la),-Math.sin(la)*Math.sin(lo)];
 return {x:radius*theta*(tangent[0]*east[0]+tangent[2]*east[2])/length,
  z:radius*theta*(tangent[0]*north[0]+tangent[1]*north[1]+tangent[2]*north[2])/length};
}
const LAKE=Object.freeze({x:150,z:-3400,rx:870,rz:900});
export const regionalLake=LAKE;
export function regionalLandformAt(terrain,lat,lon,elevationM){
 const anchor=terrain.landscapeAnchor;
 if(!anchor||!Number.isFinite(anchor.elevationM))return null;
 const {x,z}=local(anchor,lat,lon,terrain.planet.radiusM);
 const distance=Math.hypot(x,z);
 if(distance>28000)return null;
 const fade=1-smooth(21500,28000,distance);
 // Protect the playable village and its handcrafted river valley.
 const alpine=smooth(2450,6600,z)*(1-smooth(16000,24500,z))*
  (1-smooth(12500,22500,Math.abs(x)))*fade;
 const crest=Math.max(0,Math.sin((x+2050)/1650+Math.sin(z/3200)*.7));
 const peak=1650+1500*crest*crest+300*Math.sin(x/2900+z/2400)**2;
 const easternRange=smooth(4500,9500,x)*(1-smooth(14500,22500,x))*
  smooth(-3200,2400,z)*(1-smooth(17000,27000,distance))*fade;
 const eastCrest=.4+.6*Math.sin(x/1250-z/2800)**2;
 const plain=smooth(1600,4600,-z)*(1-smooth(15500,25000,distance))*fade;
 const plainHeight=anchor.elevationM+10*Math.sin(x/4300)+7*Math.cos(z/4600);
 let elevation=elevationM*(1-plain*.92)+plainHeight*plain*.92+
  alpine*peak+easternRange*(950+1050*eastCrest);
 // Incised gorge between the northern ridges: no hard tile boundaries.
 const gorgeX=-3800+730*Math.sin(z/3100);
 const gorge=Math.exp(-Math.pow((x-gorgeX)/410,2))*smooth(2600,5100,z)*
  (1-smooth(14500,21000,z))*fade;
 elevation-=Math.min(360,Math.max(115,elevation*.19))*gorge;
 let landform=alpine>.45||easternRange>.6?"mountain-range":
  gorge>.36?"canyon":plain>.7?"grassland":null;
 // A stable lake basin lies south of the settlement, surrounded by level
 // grassland. Water is not flagged as an ocean: inland lakes have their own
 // elevation, shore, and water-surface mesh.
 const q=Math.hypot((x-LAKE.x)/LAKE.rx,(z-LAKE.z)/LAKE.rz);
 const level=anchor.elevationM-1;
 if(q<1.25){
  const bankMix=smooth(.80,1.25,q);
  const bed=level-6+2*q*q;
  elevation=bed*(1-bankMix)+Math.max(elevation,level+1.8)*bankMix;
  if(q<=.96)return {elevationM:elevation,landform:"lake",river:true,lake:true,waterLevelM:level};
  landform=q<1.16?"lakeshore":landform;
 }
 // The river flows south from the pioneer valley into the lake.
 if(z< -1450&&z> -2780&&Math.abs(x-150-21*Math.sin(z/155)-9*Math.sin(z/61))<85){
  const riverX=145+21*Math.sin(z/155)+9*Math.sin(z/61);
  const width=14+3*Math.sin(z/225),bank=Math.abs(x-riverX);
  const channel=1-smooth(width*.75,75,bank);
  const riverLevel=Math.max(8,anchor.elevationM-12-z*.004);
  elevation=elevation*(1-channel)+(riverLevel-3.2)*channel;
  if(bank<width*.96)return {elevationM:elevation,landform:"river",river:true,waterLevelM:riverLevel};
  if(channel>.35)landform="valley";
 }
 return {elevationM:elevation,landform};
}
/** An inexpensive tiled lake sheet (not a fluid solver) in patch-local metres.
 * Culling to one nearby patch keeps the index count below Uint16 limits.
 */
export function regionalLakeMesh(terrain,patchCenter,radiusM){
 const empty=()=>({positions:[],normals:[],colors:[],indices:[]});
 const out=empty(),anchor=terrain.landscapeAnchor;
 if(!anchor||radiusM>2200)return out;
 const origin=local(anchor,patchCenter.lat,patchCenter.lon,terrain.planet.radiusM);
 if(Math.abs(origin.x-LAKE.x)>radiusM+LAKE.rx||
  Math.abs(origin.z-LAKE.z)>radiusM+LAKE.rz)return out;
 const step=radiusM<=500?17:radiusM<=1000?30:62;
 const nx=Math.ceil(2*radiusM/step),nz=Math.ceil(2*radiusM/step);
 const dx=2*radiusM/nx,dz=2*radiusM/nz,y=anchor.elevationM-.82;
 for(let iz=0;iz<nz;iz++)for(let ix=0;ix<nx;ix++){
  const x=-radiusM+ix*dx,z=-radiusM+iz*dz;
  const midX=origin.x+x+dx*.5,midZ=origin.z+z+dz*.5;
  if(Math.hypot((midX-LAKE.x)/LAKE.rx,(midZ-LAKE.z)/LAKE.rz)>.955)continue;
  const k=out.positions.length/3;
  out.positions.push(x,y,z,x+dx,y,z,x,y,z+dz,x+dx,y,z+dz);
  for(let j=0;j<4;j++)out.normals.push(0,1,0);
  for(let j=0;j<4;j++)out.colors.push(.13,.40,.58);
  out.indices.push(k,k+2,k+1,k+1,k+2,k+3);
 }
 return out;
}

/** Mountain-village amphitheatre. The actual village landing is found first
 * by settlementDestinations; slopes begin well outside its building clearing.
 * A lower north-south pass remains for walking and future roads.
 */
export function mountainVillageReliefAt(terrain,lat,lon,elevationM){
 const anchor=terrain.alpineVillageAnchor;
 if(!anchor)return null;
 const {x,z}=local(anchor,lat,lon,terrain.planet.radiusM),d=Math.hypot(x,z);
 if(d>24000)return null;
 const angle=Math.atan2(z,x);
 const ring=smooth(620,3800,d)*(1-smooth(13000,24000,d));
 const corridor=1-.75*Math.exp(-Math.pow(x/1150,2));
 const peaks=.35+.65*Math.sin(3.3*angle+d/2300)**2;
 const rise=ring*corridor*(1700+1750*peaks);
 const elevation=Math.max(.1,elevationM+rise);
 return {elevationM:elevation,landform:rise>850?"mountain-range":
  rise>180?"hills":null};
}
