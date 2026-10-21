/** Fixed stone wharves, lighthouses, and a passenger steamer for Serenote. */
const mesh=()=>({positions:[],normals:[],colors:[],indices:[]});
function triangle(b,a,c,d,color){
 const u=c.map((v,i)=>v-a[i]),v=d.map((v,i)=>v-a[i]);
 const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
 const l=Math.hypot(...n)||1,normal=n.map(x=>x/l),k=b.positions.length/3;
 b.positions.push(...a,...c,...d);b.normals.push(...normal,...normal,...normal);
 b.colors.push(...color,...color,...color);b.indices.push(k,k+1,k+2);
}
const quad=(b,a,c,d,e,color)=>{triangle(b,a,c,d,color);triangle(b,a,d,e,color);};
function block(b,x,y,z,rx,h,rz,color){
 const v=[[x-rx,y,z-rz],[x+rx,y,z-rz],[x+rx,y+h,z-rz],[x-rx,y+h,z-rz],
 [-rx+x,y,z+rz],[rx+x,y,z+rz],[rx+x,y+h,z+rz],[-rx+x,y+h,z+rz]];
 for(const [a,c,d,e] of [[0,1,2,3],[4,7,6,5],[0,4,5,1],[3,2,6,7],[1,5,6,2],[4,0,3,7]])
  quad(b,v[a],v[c],v[d],v[e],color);
}
function cylinder(b,x,y,z,r,h,color,segments=12){
 for(let i=0;i<segments;i++){
  const a=2*Math.PI*i/segments,c=2*Math.PI*(i+1)/segments;
  const at=t=>[x+Math.cos(t)*r,y,z+Math.sin(t)*r];
  const a0=at(a),c0=at(c);
  quad(b,a0,c0,[c0[0],y+h,c0[2]],[a0[0],y+h,a0[2]],color);
  triangle(b,[x,y,z],c0,a0,color);
  triangle(b,[x,y+h,z],[a0[0],y+h,a0[2]],[c0[0],y+h,c0[2]],color);
 }
}
export const WHARVES=Object.freeze([
 Object.freeze({id:"central",name:"セレノート中央埠頭",x:-55,z:235}),
 Object.freeze({id:"cape",name:"灯台岬桟橋",x:620,z:270})
]);
export function serenoteHarborGeometry(){
 const b=mesh(),stone=[.50,.51,.49],wood=[.48,.31,.18],iron=[.21,.25,.26],cream=[.87,.80,.64];
 for(const dock of WHARVES){
  const x=dock.x,z=dock.z;
  // Wharf access runs from dry land across the natural shore to the tidewater.
  block(b,x,1.5,178,5,1,79,wood);
  for(let p=120;p<z+28;p+=18)for(const side of [-4.2,4.2])
   block(b,x+side,-1.3,p,.35,3.4,.35,iron);
  for(let p=184;p<z+30;p+=8)for(const side of [-5,5])
   block(b,x+side,2.55,p,.12,.95,.12,[.68,.70,.68]);
  for(const side of [-4,4])block(b,x+side,2.5,z+15,.52,.7,.60,iron);
  // Landing ticket kiosk next to the road.
  block(b,x-14,4,122,6,3,5,[.62,.45,.30]);
  block(b,x-14,7,122,6.6,.42,5.5,iron);
  block(b,x-14,5.1,127.1,2,1.15,.12,[.35,.68,.73]);
 }
 // Harbour warehouses, cargo crates and a hand-operated dock crane.
 block(b,-120,4,78,17,9,12,[.56,.38,.25]);
 block(b,-120,13,78,18,1.2,13,[.36,.33,.32]);
 for(let i=0;i<5;i++)block(b,-155+i*12,4,128,4.2,3+i%3,3.5,wood);
 block(b,-180,2,195,3,17,3,iron);
 block(b,-170,19,195,22,.85,1,wood);
 block(b,-153,13,195,.14,6,.14,iron);
 block(b,-153,11,195,1.4,2.3,1.4,stone);
 // Tall beacon makes the second wharf easy to recognize from the promenade.
 cylinder(b,650,4,126,6.2,26,[.93,.90,.77],16);
 for(let k=0;k<4;k++)cylinder(b,650,5+k*6.2,126,6.28,1.5,[.72,.23,.20],16);
 cylinder(b,650,30,126,7.5,2.0,iron,16);
 cylinder(b,650,32,126,4.0,3.0,[.93,.79,.42],12);
 cylinder(b,650,35,126,8,.8,iron,16);
 // Harbour stone promenade and bollards run along the landward waterfront.
 block(b,210,1.1,121,490,.45,10,stone);
 for(let x=-210;x<800;x+=32)block(b,x,1.5,126,.8,.9,.8,iron);
 return b;
}
export function passengerSteamerGeometry(){
 const b=mesh(),hull=[.18,.30,.39],trim=[.78,.69,.50],roof=[.25,.27,.29],glass=[.40,.74,.81];
 block(b,0,-.30,0,4.2,1.9,15,hull);
 block(b,0,1.6,0,4.6,.25,15.1,trim);
 for(const side of [-1,1])block(b,side*4.45,1.85,0,.18,1.1,14.2,[.88,.86,.78]);
 block(b,0,1.85,-2.5,3.5,4.7,9.7,[.88,.87,.80]);
 block(b,0,6.55,-2.5,3.9,.6,10.0,roof);
 for(const side of [-1,1])for(let z=-11;z<7;z+=2.9)
  block(b,side*3.55,3.7,z,.10,1.35,1.0,glass);
 for(const z of [8,11])for(const x of [-2.8,0,2.8])
  block(b,x,1.85,z,.65,.75,.8,[.35,.28,.24]);
 cylinder(b,0,7.1,-6,.95,4.1,[.27,.28,.30],12);
 cylinder(b,0,9.6,-6,1.04,1.5,[.71,.22,.16],12);
 block(b,0,6.9,10,.35,5,.35,trim);
 block(b,0,11.8,10,5.6,.16,.24,roof);
 for(let z=-14;z<=14;z+=4)for(const side of [-4.55,4.55])
  block(b,side,1.85,z,.13,1.15,.13,trim);
 return b;
}
export function passengerSteamerInteriorGeometry(){
 const b=mesh(),wood=[.54,.36,.22],wall=[.83,.78,.64],glass=[.39,.71,.81];
 block(b,0,0,0,4.5,.35,11,wood);
 // Open roof and cutaway near wall for a clear walking view.
 for(const side of [-1,1]){
  block(b,side*4.4,0,0,.14,1.25,11,wall);
  block(b,side*4.4,2.65,0,.14,.55,11,wall);
  for(let z=-9.5;z<10;z+=3.1){
   block(b,side*4.4,1.20,z,.12,1.48,.10,wall);
   block(b,side*4.48,1.30,z+1.4,.03,1.18,1.2,glass);
  }
 }
 block(b,0,0,-10.7,4.45,3.2,.15,wall);
 block(b,0,0,10.7,4.45,3.2,.15,wall);
 for(let z=-7;z<9;z+=3.8)for(const side of [-2.6,2.6]){
  block(b,side,0,z,1.0,.70,.85,[.45,.32,.26]);
  block(b,side,.7,z+.60,1.0,.85,.22,[.59,.31,.27]);
 }
 block(b,0,0,-9.7,1.2,1.1,.6,wood);
 return b;
}
