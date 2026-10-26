/** Stone two-storey detention block: central atrium, upper gallery, compact
 * cells, working doors, stair flight, ground-floor refectory and work yard.
 * Geometry is compatible with ExplorerRenderer.Mesh (Uint16 indices).
 */
import {PRISON} from "./custody-facility.mjs?v=atrium-state-v1";
import {custodyAtriumGuardrailGeometry} from "./custody-atrium-guardrail.mjs?v=atrium-rail-v1";

const fresh=()=>({positions:[],normals:[],colors:[],indices:[]});
const stone=[.44,.45,.43],stoneDark=[.33,.36,.37],wall=[.58,.54,.46];
const iron=[.26,.32,.33],wood=[.46,.31,.21],bedding=[.69,.67,.60],lamp=[.99,.77,.36];
function tri(b,a,c,d,color){
  const u=c.map((v,i)=>v-a[i]),v=d.map((v,i)=>v-a[i]);
  const q=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
  const mag=Math.hypot(...q)||1,n=q.map(v=>v/mag),k=b.positions.length/3;
  b.positions.push(...a,...c,...d);b.normals.push(...n,...n,...n);
  b.colors.push(...color,...color,...color);b.indices.push(k,k+1,k+2);
}
const quad=(b,a,c,d,e,color)=>{tri(b,a,c,d,color);tri(b,a,d,e,color);};
function box(b,x,y,z,rx,h,rz,color){
  const v=[[x-rx,y,z-rz],[x+rx,y,z-rz],[x+rx,y+h,z-rz],[x-rx,y+h,z-rz],
    [x-rx,y,z+rz],[x+rx,y,z+rz],[x+rx,y+h,z+rz],[x-rx,y+h,z+rz]];
  for(const [a,c,e,f] of [[0,1,2,3],[4,7,6,5],[0,4,5,1],[3,2,6,7],
    [1,5,6,2],[4,0,3,7]])quad(b,v[a],v[c],v[e],v[f],color);
}
function barFence(b,centerX,minX,maxX,z,y,h){
  const gaps=[[centerX-.62,centerX+.62]];
  // The metal bars at the cell front are not the gate leaf.
  for(let x=minX+.1;x<=maxX-.05;x+=.18){
    if(gaps.some(([a,c])=>x>=a&&x<=c))continue;
    box(b,x,y,z,.025,h,.026,iron);
  }
  box(b,(maxX+minX)/2,y+h-.12,z,(maxX-minX)/2,.12,.05,iron);
  box(b,(maxX+minX)/2,y,z,(maxX-minX)/2,.10,.065,iron);
}
function twoFloorShell(b){
  // Lower stone floor (rendered first): atrium is open above this floor.
  box(b,0,-.25,0,11.9,.25,9.9,stone);
  // Outer walls of a continuous, lit building. No black void behind guards.
  box(b,-11.9,0,0,.22,7.9,10.0,stoneDark);
  box(b,11.9,0,0,.22,7.9,10.0,stoneDark);
  box(b,0,0,-10,.22,7.9,.22,stoneDark);
  box(b,0,0,10,11.9,7.9,.22,wall);
  // Upper ring around the 11m x 9m central opening.
  box(b,-8.75,3.66,0,3.15,.14,9.8,stone);
  box(b,6.35,3.66,0,.90,.14,9.8,stone);
  box(b,11.10,3.66,0,.90,.14,9.8,stone);
  box(b,8.75,3.66,-7.24,2.58,.14,2.56,stone);
  box(b,8.75,3.66,7.72,2.58,.14,2.04,stone);
  box(b,0,3.66,-7.20,5.6,.14,2.60,stone);
  box(b,0,3.66,7.20,5.6,.14,2.60,stone);
  // Interior columns and beams visually bound the courtyard, without an
  // opaque ceiling hiding the atrium and leaving the guard against black.
  for(const x of [-5.7,5.7])for(const z of [-4.7,4.7])
    box(b,x,0,z,.17,7.8,.17,wall);
  for(const x of [-9.3,-5.9,5.9,9.3])
    box(b,x,7.48,0,.09,.35,10,stoneDark);
  for(const z of [-9.3,-5,5,9.3])
    box(b,0,7.48,z,11.8,.35,.11,stoneDark);
  // North cell bank on second floor. Separate narrow cells, front bars and
  // a door gap at the centre of each compartment.
  const cells=[-8,-4,0,4,8];
  for(let i=0;i<=cells.length;i++){
    const x=-10+i*4;
    box(b,x,3.8,-7.83,.08,3.05,1.86,stoneDark);
  }
  for(const x of cells){
    barFence(b,x,x-1.95,x+1.95,-6.15,3.8,3.05);
    box(b,x-.96,3.8,-8.05,.56,.49,.83,wood);
    box(b,x-.96,4.31,-8.05,.52,.13,.76,bedding);
    box(b,x+.95,3.8,-8.7,.35,.73,.35,stone);
    box(b,x+.95,4.48,-8.7,.39,.10,.39,wood);
    box(b,x,6.70,-8.9,.28,.24,.08,lamp);
  }
  // Additional south walkway surveillance windows, lamps and entrance.
  for(let x=-9;x<=9;x+=3){
    box(b,x,5.95,9.55,.45,.65,.07,lamp);
    box(b,x,1.9,9.55,.45,.55,.07,[.77,.84,.77]);
  }
  // Lower refectory, furniture on the ground floor, still visible from above.
  for(const z of [-2.2,0.8,3.1]){
    box(b,-1,0,z,2.30,.72,.65,wood);
    box(b,-1,.72,z,2.38,.09,.70,[.56,.39,.24]);
    for(const side of [-1,1])
      box(b,-1,0,z+side*1.03,2.20,.44,.18,wood);
  }
  box(b,-7,0,5.0,2.7,.98,.58,stoneDark); // serving counter
  box(b,-7,1.04,5.0,2.65,.12,.61,wood);
  for(const x of [-8,-6,-4]){
    box(b,x,1.16,5.0,.30,.06,.30,[.73,.70,.59]); // food plates
  }
  // Ground floor blocks workshop and storage; avoid solid walls that would
  // obscure the meal hall, the guard or the upward sightline.
  box(b,-8,0,-1.0,1.45,.77,.8,wood);
  box(b,-8,.77,-1.0,1.55,.13,.88,[.56,.39,.24]);
  for(let i=0;i<6;i++)
    box(b,-9.1+(i%3)*.75,.91,-1.25+Math.floor(i/3)*.42,.29,.33,.18,bedding);
  // Workshop and open-air yard hints near the south gate.
  for(const x of [-9,-7]){
    box(b,x,0,7.8,.32,.22,.32,stone);
  }
}
function stairs(b){
  // One continuous staircase at the east gallery edge, descending along +z.
  const count=20;
  for(let i=0;i<count;i++){
    const z=PRISON.stairTopZ+(i+.5)*(PRISON.stairBottomZ-PRISON.stairTopZ)/count;
    const high=PRISON.upperY*(1-i/count);
    box(b,PRISON.stairX,0,z,1.48,high,.252,stone);
    box(b,PRISON.stairX,high-.09,z,1.51,.09,.25,bedding);
  }
  for(const x of [7.18,10.30]){
    // Handrail along staircase. On the upper gallery the separate atrium rail
    // continues uninterrupted, providing drop protection at its inner edge.
    for(let i=0;i<=20;i+=2){
      const z=PRISON.stairTopZ+i*(PRISON.stairBottomZ-PRISON.stairTopZ)/20;
      const y=PRISON.upperY*(1-i/20);
      box(b,x,y,z,.06,1.05,.06,iron);
    }
  }
}
export function custodyFacilityGeometry(){
  const b=fresh();twoFloorShell(b);stairs(b);return b;
}
/** Hinged barred door, pivot at local x=0, opening along -z when rotated. */
export function custodyFacilityDoorGeometry(){
  const b=fresh();
  box(b,.56,.06,0,.58,.075,.035,iron);
  box(b,.56,2.18,0,.58,.075,.035,iron);
  box(b,.04,.06,0,.04,2.2,.048,iron);
  box(b,1.08,.06,0,.04,2.2,.048,iron);
  for(let x=.16;x<1.10;x+=.16)box(b,x,.13,0,.023,2.05,.024,iron);
  box(b,1.02,1.0,.12,.12,.12,.07,[.73,.65,.40]);
  return b;
}
export {custodyAtriumGuardrailGeometry};
