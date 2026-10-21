/** Low-poly station, steam consist and carriage interiors. */
const fresh=()=>({positions:[],normals:[],colors:[],indices:[]});
function triangle(b,a,c,d,color){
 const u=c.map((n,i)=>n-a[i]),v=d.map((n,i)=>n-a[i]);
 const q=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
 const mag=Math.hypot(...q)||1,n=q.map(value=>value/mag),k=b.positions.length/3;
 b.positions.push(...a,...c,...d);b.normals.push(...n,...n,...n);
 b.colors.push(...color,...color,...color);b.indices.push(k,k+1,k+2);
}
function quad(b,a,c,d,e,color){triangle(b,a,c,d,color);triangle(b,a,d,e,color);}
function block(b,x,y,z,w,h,d,color){
 const v=[[x-w,y,z-d],[x+w,y,z-d],[x+w,y+h,z-d],[x-w,y+h,z-d],
  [x-w,y,z+d],[x+w,y,z+d],[x+w,y+h,z+d],[x-w,y+h,z+d]];
 for(const [a,c,e,f] of [[0,1,2,3],[4,7,6,5],[0,4,5,1],[3,2,6,7],[1,5,6,2],[4,0,3,7]])
  quad(b,v[a],v[c],v[e],v[f],color);
}
function roof(b,x,y,z,w,d,rise,color){
 const a=[x-w,y,z-d],c=[x+w,y,z-d],e=[x+w,y,z+d],f=[x-w,y,z+d];
 const ridgeA=[x,y+rise,z-d],ridgeB=[x,y+rise,z+d];
 quad(b,a,c,ridgeA,ridgeA,color);quad(b,f,ridgeB,e,e,color);
 quad(b,a,ridgeA,ridgeB,f,color);quad(b,c,e,ridgeB,ridgeA,color);
}
function cylinderX(b,x,y,z,length,radius,color,segments=10){
 const left=x-length/2,right=x+length/2;
 for(let i=0;i<segments;i++){
  const a=i*Math.PI*2/segments,c=(i+1)*Math.PI*2/segments;
  const p1=[left,y+Math.cos(a)*radius,z+Math.sin(a)*radius];
  const p2=[right,y+Math.cos(a)*radius,z+Math.sin(a)*radius];
  const p3=[right,y+Math.cos(c)*radius,z+Math.sin(c)*radius];
  const p4=[left,y+Math.cos(c)*radius,z+Math.sin(c)*radius];
  quad(b,p1,p2,p3,p4,color);
  triangle(b,[left,y,z],p4,p1,color);triangle(b,[right,y,z],p2,p3,color);
 }
}
function cylinderY(b,x,y,z,height,radius,color,segments=10){
 for(let i=0;i<segments;i++){
  const a=i*Math.PI*2/segments,c=(i+1)*Math.PI*2/segments;
  const p1=[x+Math.cos(a)*radius,y,z+Math.sin(a)*radius];
  const p2=[x+Math.cos(c)*radius,y,z+Math.sin(c)*radius];
  const p3=[x+Math.cos(c)*radius,y+height,z+Math.sin(c)*radius];
  const p4=[x+Math.cos(a)*radius,y+height,z+Math.sin(a)*radius];
  quad(b,p1,p2,p3,p4,color);
  triangle(b,[x,y,z],p2,p1,color);triangle(b,[x,y+height,z],p4,p3,color);
 }
}
function cylinderZ(b,x,y,z,length,radius,color,segments=12){
 const back=z-length/2,front=z+length/2;
 for(let i=0;i<segments;i++){
  const a=i*Math.PI*2/segments,c=(i+1)*Math.PI*2/segments;
  const p1=[x+Math.cos(a)*radius,y+Math.sin(a)*radius,back];
  const p2=[x+Math.cos(c)*radius,y+Math.sin(c)*radius,back];
  const p3=[x+Math.cos(c)*radius,y+Math.sin(c)*radius,front];
  const p4=[x+Math.cos(a)*radius,y+Math.sin(a)*radius,front];
  quad(b,p1,p2,p3,p4,color);
  triangle(b,[x,y,back],p2,p1,color);triangle(b,[x,y,front],p4,p3,color);
 }
}
function wheelPair(b,z,radius=.72){
 cylinderX(b,0,1.0,z,3.55,radius,[.10,.12,.13],12);
 cylinderX(b,0,1.0,z,3.63,radius*.42,[.62,.22,.13],10);
}
function coupler(b,z){
 block(b,0,.91,z,.14,.18,.48,[.13,.14,.14]);
 block(b,0,.91,z+.48,.42,.12,.10,[.20,.21,.20]);
}

export function railwayStationGeometry(){
 const b=fresh(),steel=[.28,.31,.31],wood=[.37,.26,.16],stone=[.42,.43,.40];
 // Through track and its approach are long enough to remain visible at street level.
 block(b,0,-.08,0,2.75,.13,70,stone);
 block(b,-1.05,.05,0,.075,.16,70,steel);block(b,1.05,.05,0,.075,.16,70,steel);
 for(let z=-69;z<=69;z+=2.8)block(b,0,-.01,z,1.72,.11,.12,wood);
 // Passenger platform, tactile edge and small station building.
 block(b,4.45,0,0,2.65,.68,31,[.52,.50,.45]);
 block(b,2.05,.68,0,.18,.06,30.8,[.91,.74,.20]);
 block(b,9.0,.05,-7,3.2,3.15,8.2,[.72,.65,.49]);
 block(b,9.0,0,-7,3.45,.18,8.5,[.34,.35,.33]);
 roof(b,9,3.20,-7,3.65,8.55,1.25,[.28,.18,.14]);
 block(b,6.0,.68,-7,.10,2.20,1.15,[.30,.20,.14]);
 block(b,5.88,1.15,-7,.05,1.12,.75,[.42,.67,.69]);
 // Open canopy with timber supports.
 for(const z of [-27,-18,-9,0,9,18,27]){
  block(b,4.9,.68,z,.13,3.0,.13,[.24,.28,.28]);
  block(b,7.0,.68,z,.13,3.0,.13,[.24,.28,.28]);
 }
 block(b,5.95,3.58,0,1.45,.15,30,[.33,.38,.39]);
 // Station boards, lamps and two platform signals.
 for(const z of [-20,20]){
  block(b,4.9,.70,z,.10,2.0,.10,[.25,.25,.23]);
  block(b,4.9,2.33,z,1.6,.58,.10,[.88,.83,.66]);
 }
 for(const z of [-34,34]){
  block(b,-2.3,.05,z,.11,3.7,.11,[.24,.25,.24]);
  block(b,-2.3,3.42,z,.28,.42,.18,[.16,.20,.17]);
  block(b,-2.31,3.55,z-.19,.19,.19,.035,[.77,.20,.15]);
 }
 // Cobble connection from the town's central road to the entrance.
 block(b,15.0,.01,-7,8.8,.09,3.0,[.39,.39,.36]);
 return b;
}

export function steamTrainGeometry(){
 const b=fresh(),iron=[.12,.17,.16],red=[.62,.16,.11],brass=[.82,.61,.20],
  passenger=[.22,.42,.32],freight=[.46,.29,.16],roofColor=[.19,.22,.21];
 // Locomotive: frame, boiler, cab, chimney, lamp and running gear.
 block(b,0,.48,17,1.58,.55,5.1,red);cylinderZ(b,0,2.15,18.2,6.7,1.18,iron,14);
 block(b,0,1.25,13.8,1.52,3.25,2.0,[.17,.30,.25]);
 roof(b,0,4.50,13.8,1.83,2.3,.55,roofColor);
 for(const x of [-1.54,1.54])block(b,x,2.43,13.65,.05,.82,.63,[.50,.74,.72]);
 cylinderY(b,0,3.0,20.5,1.55,.52,iron,10);cylinderY(b,0,4.47,20.5,.28,.78,iron,10);
 cylinderY(b,0,3.15,17.1,.65,.27,brass,10);
 cylinderZ(b,0,2.18,21.62,.20,.43,[.89,.78,.45],12);
 for(const z of [14.2,17.1,20.1])wheelPair(b,z,z===17.1?.88:.72);
 for(const x of [-1.82,1.82])block(b,x,1.02,17.2,.06,.13,3.8,brass);
 coupler(b,22.5);
 // Coal-and-water tender, visibly heaped with dark fuel.
 block(b,0,.55,7.7,1.55,.50,3.7,red);block(b,0,1.05,7.7,1.47,2.05,3.5,[.25,.31,.27]);
 block(b,0,2.85,7.7,1.34,.42,3.22,[.12,.12,.11]);
 for(let z=5.2;z<=10.2;z+=1.2)cylinderY(b,(z%2)*.45-.2,3.20,z,.30,.56,[.08,.09,.08],7);
 for(const z of [5.8,9.6])wheelPair(b,z,.68);coupler(b,11.75);coupler(b,3.65);
 // Passenger coach with windows, end doors and warm trim.
 block(b,0,.55,-3.5,1.62,.48,5.35,[.28,.19,.13]);
 block(b,0,1.03,-3.5,1.55,2.85,5.15,passenger);roof(b,0,3.88,-3.5,1.78,5.4,.56,roofColor);
 for(const side of [-1,1])for(const z of [-7,-5.1,-3.2,-1.3,.6])
  block(b,side*1.56,2.18,z,.035,.72,.62,[.50,.76,.80]);
 for(const z of [-8.25,1.25])block(b,0,1.15,z,1.15,2.35,.07,[.40,.25,.14]);
 for(const z of [-6.6,-.6])wheelPair(b,z,.66);coupler(b,1.95);coupler(b,-8.95);
 // Freight wagon and distinct wooden cargo.
 block(b,0,.55,-14.8,1.62,.48,4.7,[.27,.20,.14]);
 block(b,0,1.02,-14.8,1.55,2.45,4.48,freight);
 for(const z of [-17.6,-15.1,-12.6])for(const x of [-.72,.72])
  block(b,x,1.22,z,.62,1.15,1.0,[.60,.43,.23]);
 for(const side of [-1,1])for(let z=-18.6;z<=-11;z+=1.1)
  block(b,side*1.58,1.03,z,.045,2.30,.055,[.29,.18,.11]);
 for(const z of [-17.2,-12.4])wheelPair(b,z,.66);coupler(b,-19.75);coupler(b,-9.85);
 return b;
}

export function trainInteriorGeometry(kind="passenger",{hideWalls=false}={}){
 const b=fresh(),floor=[.42,.29,.19],wall=[.34,.50,.42],trim=[.69,.52,.25],metal=[.23,.27,.27];
 block(b,0,-.22,0,3.2,.26,6.3,floor);
 // Large actual holes between window posts, so moving terrain is visible.
 if(!hideWalls){
  for(const x of [-3.08,3.08]){
   block(b,x,0,0,.18,1.15,6.2,wall);
   block(b,x,2.65,0,.18,.53,6.2,wall);
   for(const z of [-5.9,-3.45,-.98,1.48,3.95,5.95])
    block(b,x,1.15,z,.17,1.56,.13,trim);
  }
  block(b,0,0,-6.13,3.2,3.25,.18,wall);
  block(b,0,0,6.13,3.2,3.25,.18,wall);
  // Isometric cutaway: keep roof out of the interior view so passengers remain visible.
 }
 if(kind==="passenger"){
  for(const z of [-4.2,-1.4,1.4,4.2])for(const x of [-1.65,1.65]){
   block(b,x,0,z,.68,.62,.58,[.50,.20,.16]);
   block(b,x,.58,z-.45,.68,1.02,.13,[.58,.23,.18]);
  }
  block(b,0,.03,0,.08,.05,5.7,trim);
 }else if(kind==="locomotive"){
  block(b,0,.10,-3.8,2.65,2.05,1.65,metal);
  cylinderZ(b,0,1.42,-4.5,2.5,1.18,[.12,.16,.15],12);
  block(b,0,.25,3.85,2.50,1.65,.85,[.28,.34,.30]);
  for(const x of [-1.3,0,1.3])cylinderY(b,x,2.0,3.05,.12,.34,[.84,.70,.35],12);
  block(b,-1.45,.25,1.2,.55,1.05,.55,[.36,.24,.15]);
  block(b,1.45,.25,1.2,.55,1.05,.55,[.36,.24,.15]);
 }else if(kind==="tender"){
  block(b,0,.05,0,2.7,1.25,5.2,[.31,.34,.30]);
  for(let z=-4.2;z<=4.2;z+=1.2)for(const x of [-1.5,-.5,.5,1.5])
   cylinderY(b,x,1.28,z,.35,.48,[.08,.09,.08],7);
  block(b,0,.05,5.0,2.45,1.8,.55,[.24,.29,.27]);
 }else{
  for(const z of [-4.2,-1.4,1.4,4.2])for(const x of [-1.6,0,1.6]){
   block(b,x,0,z,.68,1.15,1.05,[.57,.39,.20]);
   block(b,x,1.13,z,.70,.08,1.07,trim);
  }
 }
 // Ceiling ribs and lamps unify the four carriage spaces.
 for(const z of [-5,-2.5,0,2.5,5])block(b,0,3.15,z,3.0,.10,.09,metal);
 for(const z of [-3,3])cylinderY(b,0,2.80,z,.28,.20,[.92,.75,.35],8);
 return b;
}
