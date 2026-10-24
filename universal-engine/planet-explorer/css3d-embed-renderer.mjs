/**
 * CSS3D perspective projection for official-embed interaction surfaces.
 * This does not rasterize an iframe into WebGL. Due to DOM compositing,
 * an external iframe is opened in a modal instead of pretending to have
 * WebGL occlusion. Three.CSS3DRenderer is not loaded by this custom engine.
 */
import {projectScreen} from "./render.mjs";
export function surfaceCorners({x,y,z,width,aspect=16/9,rotation=0}){
 const rad=rotation*Math.PI/180,dx=Math.cos(rad)*width/2,dz=-Math.sin(rad)*width/2;
 const h=width/aspect/2;
 return [[x-dx,y+h,z-dz],[x+dx,y+h,z+dz],
   [x+dx,y-h,z+dz],[x-dx,y-h,z-dz]];
}
function solve8(a,b){
 const m=a.map((r,i)=>[...r,b[i]]);
 for(let i=0;i<8;i++){
  let best=i;
  for(let j=i+1;j<8;j++)if(Math.abs(m[j][i])>Math.abs(m[best][i]))best=j;
  if(Math.abs(m[best][i])<1e-10)return null;
  [m[i],m[best]]=[m[best],m[i]];
  const inv=1/m[i][i];
  for(let k=i;k<=8;k++)m[i][k]*=inv;
  for(let j=0;j<8;j++)if(j!==i){
   const f=m[j][i];for(let k=i;k<=8;k++)m[j][k]-=f*m[i][k];
  }
 }
 return m.map(row=>row[8]);
}
/** CSS element is 480×270 and maps to 4 perspective-projected corners. */
export function cssMatrixForCorners(points,w=480,h=270){
 const xy=[[0,0],[w,0],[w,h],[0,h]],A=[],b=[];
 for(let i=0;i<4;i++){
  const [x,y]=xy[i],[X,Y]=points[i];
  A.push([x,y,1,0,0,0,-X*x,-X*y]);b.push(X);
  A.push([0,0,0,x,y,1,-Y*x,-Y*y]);b.push(Y);
 }
 const s=solve8(A,b);if(!s)return null;
 const [a,c,tx,d,e,ty,p,q]=s;
 return "matrix3d("+[a,d,0,p,c,e,0,q,0,0,1,0,tx,ty,0,1].join(",")+")";
}
export class CSS3DEmbedRenderer {
 constructor(root){this.root=root;this.nodes=new Map();}
 attach(id,callback){
  let button=this.nodes.get(id);
  if(button)return button;
  button=document.createElement("button");button.type="button";
  button.className="ue-stream-embed-target";
  button.setAttribute("aria-label","公式動画プレイヤーを開く");
  button.textContent="▶ 公式プレイヤーを開く";
  button.addEventListener("click",callback);
  this.root.append(button);this.nodes.set(id,button);
  return button;
 }
 update(id,vp,world,rect){
  const el=this.nodes.get(id);if(!el)return;
  const projected=surfaceCorners(world).map(p=>projectScreen(vp,p));
  if(projected.some(p=>!p||!p.onScreen)){el.hidden=true;return;}
  const points=projected.map(p=>[p.u*rect.width,p.v*rect.height]);
  const matrix=cssMatrixForCorners(points);
  const width=Math.hypot(points[0][0]-points[1][0],points[0][1]-points[1][1]);
  if(!matrix||width<48||width>rect.width*3){el.hidden=true;return;}
  el.hidden=false;el.style.transform=matrix;
 }
 hideAll(){for(const el of this.nodes.values())el.hidden=true;}
 remove(id){this.nodes.get(id)?.remove();this.nodes.delete(id);}
 destroy(){for(const id of this.nodes.keys())this.remove(id);}
}
