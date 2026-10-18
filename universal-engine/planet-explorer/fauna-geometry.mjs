/** Lightweight original low-poly meshes (no external model or texture dependency). */
const mesh=()=>({positions:[],normals:[],colors:[],indices:[]});
const sub=(a,b)=>a.map((x,i)=>x-b[i]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function tri(m,a,b,c,color){
 const n=cross(sub(b,a),sub(c,a)),len=Math.hypot(...n)||1,k=m.positions.length/3;
 m.positions.push(...a,...b,...c);for(let i=0;i<3;i++){m.normals.push(...n.map(v=>v/len));m.colors.push(...color);}
 m.indices.push(k,k+1,k+2);
}
function quad(m,a,b,c,d,color){tri(m,a,b,c,color);tri(m,a,c,d,color);}
function cube(m,x,y,z,w,h,d,color){
 const a=[[x-w/2,y,z-d/2],[x+w/2,y,z-d/2],[x+w/2,y+h,z-d/2],[x-w/2,y+h,z-d/2],
  [x-w/2,y,z+d/2],[x+w/2,y,z+d/2],[x+w/2,y+h,z+d/2],[x-w/2,y+h,z+d/2]];
 for(const [i,j,k,l]of [[0,3,2,1],[4,5,6,7],[0,1,5,4],[3,7,6,2],[1,2,6,5],[4,7,3,0]])
  quad(m,a[i],a[j],a[k],a[l],color);
}
function spike(m,x,y,z,h,r,c,n=6){
 for(let i=0;i<n;i++){
  const a=i*Math.PI*2/n,b=(i+1)*Math.PI*2/n;
  tri(m,[x+r*Math.cos(a),y,z+r*Math.sin(a)],[x+r*Math.cos(b),y,z+r*Math.sin(b)],[x,y+h,z],c);
 }
}
export function faunaGeometry(kind,gear={},pose={}){
 const m=mesh(),coat={
  horse:[.53,.37,.22],cattle:[.38,.24,.17],sheep:[.77,.70,.57],goat:[.57,.46,.33],
  chicken:[.66,.31,.16],dog:[.47,.50,.49],cat:[.53,.50,.38]
 }[kind]||[.6,.5,.4];
 const dark=[.20,.17,.14],pale=[.83,.75,.60];
 if(kind==="chicken"){
  cube(m,0,.37,0,.42,.42,.59,coat);cube(m,0,.66,.25,.24,.29,.25,coat);
  spike(m,0,.86,.27,.17,.13,[.86,.16,.09]);spike(m,0,.65,.46,-.14,.10,[.9,.7,.18]);
  cube(m,-.13,.02,-.09,.05,.37,.06,dark);cube(m,.13,.02,-.09,.05,.37,.06,dark);
  spike(m,0,.55,-.35,.38,.16,dark);
  return m;
 }
 const small=kind==="cat",wolf=kind==="dog";
 const scale=small?.48:wolf?.76:kind==="sheep"?.92:kind==="goat"?.95:kind==="cattle"?1.35:1.18;
 const shoulder=kind==="cattle"?1.35:kind==="horse"?1.47:kind==="sheep"?.94:kind==="goat"?1.07:small?.53:.85;
 const bodyD=kind==="horse"?1.55:kind==="cattle"?1.56:1.18;
 cube(m,0,shoulder*.48,-.07,scale*.69,shoulder*.56,bodyD,coat);
 for(const x of [-scale*.23,scale*.23])for(const z of [-bodyD*.37,bodyD*.37]){
  const legIndex=(x>0?1:0)+(z>0?2:0);
  const phase=(pose.phase||0)+(pose.gait==="trot"?(legIndex===0||legIndex===3?0:Math.PI):
    pose.gait==="gallop"?(z>0?0:Math.PI*.7)+(x>0?.4:0):legIndex*Math.PI*.5);
  const swing=kind==="horse"&&pose.moving?Math.sin(phase)*(pose.gait==="gallop"?.29:pose.gait==="trot"?.21:.13):0;
  const lift=Math.max(0,Math.cos(phase))*(pose.moving?.09:0);
  const legZ=z+swing;
  cube(m,x,.08+lift,legZ,scale*.17,shoulder*.40,scale*.19,coat);
  if(kind==="horse")cube(m,x,lift,legZ,scale*.20,.13,scale*.20,dark);
 }
 const neckZ=bodyD*.41;
 cube(m,0,shoulder*.65,neckZ,scale*.37,shoulder*.60,scale*.38,coat);
 cube(m,0,shoulder*1.09-headDrop,neckZ+scale*.17+headForward,scale*.47,shoulder*.27,scale*.55,coat);
 cube(m,0,shoulder*1.00-headDrop,neckZ+scale*.45+headForward,scale*.34,shoulder*.13,scale*.28,wolf?dark:pale);
 for(const x of [-scale*.19,scale*.19]){
  spike(m,x,shoulder*1.23-headDrop,neckZ+scale*.11+headForward,small?.18:.26,scale*.11,coat);
  cube(m,x*.7,shoulder*1.17-headDrop,neckZ+scale*.39+headForward,scale*.055,.055,.047,dark);
 }
 cube(m,0,shoulder*.70,-bodyD*.57,scale*.12,small?.35:.58,scale*.12,dark);
 if(kind==="horse"){
  // Mane along the crest and dark lower legs/hooves.
  for(let z=0;z<4;z++)spike(m,0,shoulder*(.96+z*.055),.17+z*.16,.17,scale*.12,dark);
  if(gear.bit)cube(m,0,shoulder*1.02-headDrop,neckZ+scale*.57+headForward,scale*.41,.055,.05,[.77,.78,.76]);
  if(gear.reins){cube(m,scale*.19,shoulder*.66,neckZ+scale*.43,.03,.68,.035,dark);
   cube(m,-scale*.19,shoulder*.66,neckZ+scale*.43,.03,.68,.035,dark);}
  if(gear.saddle){cube(m,0,shoulder*.96,-.20,scale*.63,.11,.61,[.24,.17,.13]);
   cube(m,0,shoulder*.94,-.18,scale*.67,.04,.75,pale);}
  if(gear.horseshoes)for(const x of [-scale*.23,scale*.23])for(const z of [-bodyD*.37,bodyD*.37])
   cube(m,x,.015,z,scale*.22,.035,scale*.23,[.70,.74,.78]);
 }
 if(kind==="cattle")for(const x of [-scale*.31,scale*.31])
  spike(m,x,shoulder*1.23,neckZ+.06,.38,scale*.09,pale);
 if(kind==="sheep")for(const x of [-scale*.19,scale*.19])for(const z of [-.36,0,.36])
  cube(m,x,shoulder*.66,z,scale*.36,.43,scale*.41,pale);
 if(kind==="goat"){for(const x of [-scale*.21,scale*.21])spike(m,x,shoulder*1.21,neckZ+.04,.50,.08,dark);
  spike(m,0,shoulder*.95,neckZ+scale*.45,-.22,.10,dark);}
 return m;
}