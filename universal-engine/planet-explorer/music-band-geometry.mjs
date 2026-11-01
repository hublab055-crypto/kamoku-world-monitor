/** Low-poly, locally animated musician and audience figures.
 * Shape is baked once per pose/role to avoid rebuilding meshes in the VR loop.
 */
const make=()=>({positions:[],normals:[],colors:[],indices:[]});
const tri=(g,a,b,c,color)=>{
 const u=b.map((v,i)=>v-a[i]),v=c.map((x,i)=>x-a[i]);
 const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
 const len=Math.hypot(...n)||1,k=g.positions.length/3;
 for(const p of [a,b,c]){g.positions.push(...p);g.normals.push(...n.map(v=>v/len));g.colors.push(...color);}
 g.indices.push(k,k+1,k+2);
};
const quad=(g,a,b,c,d,color)=>{tri(g,a,b,c,color);tri(g,a,c,d,color);};
const box=(g,x,y,z,hw,height,hd,color)=>{
 const v=[
  [x-hw,y,z-hd],[x+hw,y,z-hd],[x+hw,y+height,z-hd],[x-hw,y+height,z-hd],
  [x-hw,y,z+hd],[x+hw,y,z+hd],[x+hw,y+height,z+hd],[x-hw,y+height,z+hd]
 ];
 for(const [a,b,c,d]of [[0,1,2,3],[4,7,6,5],[0,4,5,1],[3,2,6,7],[1,5,6,2],[4,0,3,7]])
  quad(g,v[a],v[b],v[c],v[d],color);
};
const strut=(g,a,b,w,color)=>{
 const dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2],len=Math.hypot(dx,dy,dz)||1;
 const side=Math.hypot(dx,dz)>1e-5?[-dz/len,0,dx/len]:[1,0,0];
 const other=[dy*side[2]/len-dz*side[1]/len,
  dz*side[0]/len-dx*side[2]/len,dx*side[1]/len-dy*side[0]/len];
 const edge=p=>[[1,1],[-1,1],[-1,-1],[1,-1]].map(([u,v])=>p.map((x,i)=>x+w*(side[i]*u+other[i]*v)));
 const a4=edge(a),b4=edge(b);
 for(let i=0;i<4;i++)quad(g,a4[i],a4[(i+1)%4],b4[(i+1)%4],b4[i],color);
 quad(g,a4[3],a4[2],a4[1],a4[0],color);quad(g,b4[0],b4[1],b4[2],b4[3],color);
};
export const MUSIC_POSE_FRAMES=4;
export const MUSIC_BAND_RENDER_ROLES=Object.freeze(["lead","guitar","keys","bass","drums","audience"]);
export function bandFigureGeometry(role="lead",frame=0){
 const g=make(),pose=(Number(frame)||0)%MUSIC_POSE_FRAMES;
 if(!MUSIC_BAND_RENDER_ROLES.includes(role))throw Error("未対応の楽団モデルです");
 const skin=[.82,.62,.46],hair=[.22,.17,.12],pants=[.21,.24,.28];
 const color=role==="lead"?[.59,.25,.55]:role==="keys"?[.29,.48,.68]:
  role==="guitar"?[.53,.38,.21]:role==="bass"?[.28,.52,.38]:
  role==="drums"?[.63,.33,.25]:[.49,.48,.44];
 const shift=Math.sin(pose*Math.PI/2)*.055,playing=role!=="audience";
 box(g,0,.88,0,.27,.88,.17,color);
 box(g,0,1.81,0,.21,.32,.20,skin);box(g,0,2.06,0,.23,.16,.22,hair);
 strut(g,[-.13,.86,0],[-.15,.11,.04+shift],.105,pants);
 strut(g,[.13,.86,0],[.16,.11,-.04-shift],.105,pants);
 const left=role==="keys"?[-.43,1.17,.37]:role==="drums"?[-.37,1.15,.27]:
  role==="audience"?[-.17,1.56,.4]:[-.45,1.16,.18];
 const right=role==="keys"?[.43,1.17,.37]:role==="drums"?[.40,1.10,.25]:
  role==="audience"?[.17,1.56,.4]:[.35,1.31,.35];
 const beat=Math.sin(pose*Math.PI/2)*.18;
 if(playing){left[1]+=beat;right[1]-=beat;}
 if(role==="audience"){left[0]+=.07*Math.sin(pose*Math.PI/2);right[0]-=.07*Math.sin(pose*Math.PI/2);}
 strut(g,[-.29,1.67,0],left,.085,skin);
 strut(g,[.29,1.67,0],right,.085,skin);
 // Fretboard, drumsticks and visible player interaction silhouettes.
 if(role==="guitar"||role==="bass"){
  const wood=[.60,.37,.16],metal=[.78,.71,.53];
  box(g,0,1.03,.33,.30,.36,.09,wood);
  strut(g,[.02,1.17,.34],[.55,1.42,.32],.072,wood);
  for(let i=0;i<3;i++)strut(g,[-.18+i*.18,1.05,.45],[.50,1.36,.41],.008,metal);
 }else if(role==="keys"){
  const dark=[.22,.23,.27],ivory=[.93,.91,.80];
  box(g,0,1.04,.54,.75,.20,.30,dark);
  for(let i=0;i<9;i++)box(g,-.60+i*.15,1.25,.60,.067,.03,.20,ivory);
 }else if(role==="drums"){
  box(g,0,.96,.66,.48,.40,.38,[.57,.30,.21]);
  strut(g,left,[left[0]+.12,left[1]+.25,left[2]+.20],.026,[.78,.67,.43]);
  strut(g,right,[right[0]+.12,right[1]+.23,right[2]+.20],.026,[.78,.67,.43]);
 }else if(role==="lead"){
  strut(g,[.12,1.22,.35],[.12,1.75,.35],.045,[.59,.61,.65]);
  box(g,.12,1.73,.35,.11,.14,.09,[.20,.23,.27]);
 }else {
  // Audience claps lightly during the show.
  box(g,0,-.02,-.13,.35,.32,.18,[.37,.24,.15]);
 }
 return g;
}
