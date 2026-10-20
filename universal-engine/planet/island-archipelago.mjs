/** Sparse deterministic island chains shared by the physical planet and orbital rendering.
 * Islands are uncommon, with open-ocean cells deliberately left empty.
 */
const STEP=4,DEG=Math.PI/180,R=6371000;
const hash=(a,b,seed)=>{let h=(Math.imul(a+193,0x45d9f3b)^Math.imul(b+73,0x27d4eb2d)^Math.imul(seed,0x165667b1))|0;h=Math.imul(h^(h>>>16),0x45d9f3b);return ((h^(h>>>16))>>>0)/4294967296};
const wrap=n=>((n%90)+90)%90;
export function islandCenter(seed,row,col){
 if(row<1||row>43||!Number.isInteger(row)||!Number.isInteger(col))return null;
 const j=wrap(col),chance=hash(row,j,seed);
 if(chance>.087)return null;
 const lat=-90+row*STEP+(.22+.56*hash(row,j,seed+11))*STEP;
 const lon=-180+j*STEP+(.18+.64*hash(row,j,seed+29))*STEP;
 const radiusM=15000+hash(row,j,seed+41)*62000;
 return {id:"island-"+row+"-"+j,lat,lon,radiusM,seed};
}
/** Array for coarse globe representation; computed once per planet seed. */
export function islandCenters(seed){
 const result=[];
 for(let i=1;i<=43;i++)for(let j=0;j<90;j++){
  const center=islandCenter(seed,i,j);
  if(center)result.push(center);
 }
 return result;
}
/** Positive height inside an island footprint, zero outside. */
export function islandHeight(seed,lat,lon){
 const row=Math.floor((lat+90)/STEP),col=Math.floor((lon+180)/STEP);
 let best=0;
 for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++){
  const site=islandCenter(seed,row+dr,col+dc);if(!site)continue;
  const longitude=((lon-site.lon+540)%360)-180;
  const dx=longitude*DEG*R*Math.cos(site.lat*DEG),dz=(lat-site.lat)*DEG*R;
  const angle=Math.atan2(dz,dx);
  const radius=site.radiusM*(.94+.09*Math.sin(angle*5+seed)+.07*Math.cos(angle*7+seed*.11));
  const n=Math.hypot(dx,dz)/radius;
  if(n>=1)continue;
  const elevation=n>.83?Math.max(2,(1-n)*180):18+Math.pow(1-n,1.15)*360;
  best=Math.max(best,elevation);
 }
 return best;
}
