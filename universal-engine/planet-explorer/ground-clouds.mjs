/** Volumetric-looking low-poly cloud banks for ground camera.
 * Stable seed + world-grid cells, one indexed mesh and one blended WebGL draw.
 */
const fract=x=>x-Math.floor(x);
/** Local prevailing wind: tied to latitude, season and current cloud/precipitation.
 * This is simulated weather, not a real-time meteorological forecast.
 */
export function cloudWind(climate={},latitude=0,timeDays=0){
 const cover=Math.max(0,Math.min(1,Number(climate.cloudCover)||0));
 const wet=climate.precipitation&&climate.precipitation!=="none";
 const speed=2.2+cover*5.8+(wet?3.5:0);
 const heading=(Math.sin(latitude*.024+timeDays*.025)*.68)+
     (latitude>=0?.42:-.42);
 return {eastMps:Math.cos(heading)*speed,northMps:Math.sin(heading)*speed,
  opacity:Math.max(.04,Math.min(.76,.12+cover*.60+(wet?.08:0))),
  coverage:cover};
}
const hash=(x,z,seed)=>fract(Math.sin(x*127.1+z*311.7+seed*19.4)*43758.5453);
export function groundCloudGeometry({seed=77,cx=0,cz=0,radius=450,baseElevation=300,driftEast=0,driftNorth=0,cloudCover=.55,precipitation="none"}={}){
 const out={positions:[],normals:[],colors:[],indices:[]};
 if(radius>9000)return out;
 const unit=275,reach=Math.max(600,Math.min(radius*1.6,2100));
 const ix0=Math.floor((cx-reach)/unit),ix1=Math.ceil((cx+reach)/unit);
 const iz0=Math.floor((cz-reach)/unit),iz1=Math.ceil((cz+reach)/unit);
 function addPuff(x,y,z,rx,ry,rz,col){
  const ns=8,nt=4,first=out.positions.length/3;
  for(let j=0;j<=nt;j++){
   const phi=j*Math.PI/nt;
   for(let i=0;i<=ns;i++){
    const theta=2*Math.PI*i/ns;
    const sx=Math.sin(phi)*Math.cos(theta),sy=Math.cos(phi),sz=Math.sin(phi)*Math.sin(theta);
    out.positions.push(x+sx*rx,y+sy*ry,z+sz*rz);
    out.normals.push(sx,sy,sz);out.colors.push(...col);
   }
  }
  for(let j=0;j<nt;j++)for(let i=0;i<ns;i++){
   const a=first+j*(ns+1)+i,b=a+ns+1;
   out.indices.push(a,b,a+1,a+1,b,b+1);
  }
 }
 for(let iz=iz0;iz<=iz1;iz++)for(let ix=ix0;ix<=ix1;ix++){
  const roll=hash(ix,iz,seed);if(roll>Math.max(.06,Math.min(.85,cloudCover*.80+.15)))continue;
  const wx=(ix+.18+hash(ix+3,iz,seed)*.65)*unit;
  const wz=(iz+.17+hash(ix,iz+7,seed)*.65)*unit;
  const baseX=wx-cx,baseZ=wz-cz;
  if(Math.hypot(baseX,baseZ)>reach)continue;
  const x=baseX+driftEast,z=baseZ+driftNorth;
  const y=baseElevation+280+240*hash(ix-10,iz+9,seed);
  const shade=precipitation!=="none"?.70:1;
  const cloudColor=[(.91+roll*.05)*shade,(.93+roll*.04)*shade,.96*shade];
  for(let k=0;k<3;k++){
   const ang=k*Math.PI*2/3;
   addPuff(x+Math.cos(ang)*38,y+Math.sin(k*3)*9,z+Math.sin(ang)*20,
    55+hash(ix+k,iz,seed)*35,22+hash(ix,iz+k,seed)*14,
    32+hash(ix-k,iz+k,seed)*25,cloudColor);
  }
 }
 return out;
}
