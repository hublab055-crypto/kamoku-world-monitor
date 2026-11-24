import {thickness} from "./workshop-geometry.mjs";
const eps=1e-6,rot=(x,z,yaw)=>[x*Math.cos(yaw)+z*Math.sin(yaw),-x*Math.sin(yaw)+z*Math.cos(yaw)];
const same=(a,b)=>Math.abs(a.lat-b.lat)<eps&&Math.abs(a.lon-b.lon)<eps;
const near=(a,b)=>Math.abs(a.lat-b.lat)<.0001&&Math.abs(a.lon-b.lon)<.0001;
export function placePart(state,id,site,x=0,z=0,y=0,yaw=0){const p=state.free(id);if(!site||![site.lat,site.lon,x,z,y,yaw].every(Number.isFinite)||y<0||Math.max(Math.abs(x),Math.abs(z),y)>100000)throw Error("配置座標が不正");p.pose={site:{...site},x,y,z,yaw};return p.pose;}
export function holeCenter(p,h){const [x,z]=rot(h.x,h.y,p.pose.yaw);return [p.pose.x+x,p.pose.z+z];}
export function alignParts(state,a,b,type,{holeA=0,holeB=0,yaw=0,site}={}){
 const p=state.part(a),q=state.free(b);if(p===q||!["bolt","weld"].includes(type)||!Number.isFinite(yaw))throw Error("別部品・接合方式を選択");
 if(p.pose&&!near(p.pose.site,site))throw Error("設置済み部品の近くへ移動してください");
 if(q.pose&&!near(q.pose.site,site))throw Error("相手部品の近くへ移動してください");
 if(!p.pose)placePart(state,a,site);let x=p.pose.x,z=p.pose.z;
 if(type==="bolt"){const h=p.holes[holeA],k=q.holes[holeB];if(!h?.through||!k?.through)throw Error("両方に貫通穴が必要です");[x,z]=holeCenter(p,h);const [dx,dz]=rot(k.x,k.y,yaw);x-=dx;z-=dz;}
 return placePart(state,b,p.pose.site,x,z,p.pose.y+thickness(p),yaw);
}
export function checkAlignment(p,q,type,holeA=0,holeB=0){if(!p.pose||!q.pose||!same(p.pose.site,q.pose.site))throw Error("同じ作業地点で位置合わせしてください");
 const gap=q.pose.y-(p.pose.y+thickness(p));if(Math.abs(gap)>1e-4)throw Error("接合面に隙間または干渉があります");
 if(type==="bolt"){const h=p.holes[holeA],k=q.holes[holeB];if(!h?.through||!k?.through)throw Error("貫通穴が必要");const a=holeCenter(p,h),b=holeCenter(q,k);if(Math.hypot(a[0]-b[0],a[1]-b[1])>1e-4)throw Error("穴軸が一致していません");return {x:a[0],z:a[1],y:p.pose.y,length:thickness(p)+thickness(q)};}
 if(Math.hypot(p.pose.x-q.pose.x,p.pose.z-q.pose.z)>1e-4)throw Error("溶接面の中心を合わせてください");return null;
}
export function fastenerParts(j,p){if(!j.fastener||!p.pose)return [];const {x,y,z,length}=j.fastener,d=j.diameter;return [{x,y,z,d,l:length},{x,y:y+length,z,d:d*1.65,l:d*.65},{x,y:y-d*.55,z,d:d*1.65,l:d*.55}];}
