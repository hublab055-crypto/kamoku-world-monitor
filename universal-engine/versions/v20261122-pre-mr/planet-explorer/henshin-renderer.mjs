/** GPU resources are bounded: two equipment meshes replaced only on project changes. */
import {ownerPrimitiveGeometry} from './owner-primitive-geometry.mjs';
import {henshinEquipmentGeometry,henshinPanelGeometry,rgb} from './henshin-geometry.mjs';
import {xrMul as mul,xrTranslate as trans,xrScale as scale} from './xr-spatial.mjs';
import {worldPoint,localPoint} from './henshin-runtime.mjs';
const size=(x,y,z)=>[x,0,0,0,0,y,0,0,0,0,z,0,0,0,0,1];
export class HenshinSceneRenderer{
 constructor(host,makeMesh){this.host=host;this.makeMesh=makeMesh;this.cube=makeMesh(ownerPrimitiveGeometry('cube'));this.ball=makeMesh(ownerPrimitiveGeometry('sphere'));this.panel=makeMesh(henshinPanelGeometry());this.revision=-1;this.runtime=null;}
 sync(runtime){if(this.runtime===runtime&&this.revision===runtime.revision)return;this.belt?.destroy();this.item?.destroy();this.belt=this.makeMesh(henshinEquipmentGeometry(runtime.project));this.item=this.makeMesh(henshinEquipmentGeometry(runtime.project,'item'));this.runtime=runtime;this.revision=runtime.revision;}
 draw(mesh,vp,model,color=[1,1,1]){this.host.drawMesh(mesh,mul(vp,model),[.55,.9,.45],1,.88,color);}
 box(vp,root,pos,dims,color){this.draw(this.cube,vp,mul(root,mul(trans(pos[0],pos[1]-dims[1]/2,pos[2]),size(...dims))),color);}
 segment(vp,root,a,b,width,color){const d=b.map((v,i)=>v-a[i]),n=Math.hypot(...d);if(n<.001)return;const y=d.map(v=>v/n),seed=Math.abs(y[1])>.92?[0,0,1]:[0,1,0],cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],u=cross(seed,y),l=Math.hypot(...u)||1,x=u.map(v=>v/l),z=cross(x,y),model=[...x.map(v=>v*width),0,...y.map(v=>v*n),0,...z.map(v=>v*width),0,...a,1];this.draw(this.cube,vp,mul(root,model),color);}
 avatar(vp,root,runtime,{head=true,moving=false,phase=0,pose=null,belt=true}={}){this.sync(runtime);const p=runtime.project,main=rgb(p.color),accent=rgb(p.accent),dark=[.07,.10,.13];pose??=runtime.poseAt(runtime.now,{moving,phase});if(runtime.transformed){this.box(vp,root,[0,1.17,0],[.47,.46,.25],dark);this.box(vp,root,[0,1.31,.02],[.43,.15,.27],main);this.box(vp,root,[0,1.16,.02],[.06,.39,.27],accent);this.box(vp,root,[0,.82,0],[.33,.22,.23],dark);
 if(head){this.draw(this.ball,vp,mul(root,mul(trans(0,1.45,0),size(.30,.36,.28))),dark);for(const sign of [-1,1])this.box(vp,root,[sign*.074,1.66,.13],[.11,.08,.045],main);this.box(vp,root,[0,1.55,.14],[.16,.045,.035],[.65,.73,.79]);if(p.profile==='zeroone')for(const sign of [-1,1])this.box(vp,root,[sign*.08,1.85,.01],[.015,.18,.025],main);if(p.profile==='gaim')this.box(vp,root,[0,1.82,.04],[.26,.025,.03],accent);}
 for(const side of ['left','right']){const s=side==='left'?-1:1;this.segment(vp,root,pose[side+'Shoulder'],pose[side+'Elbow'],.12,dark);this.segment(vp,root,pose[side+'Elbow'],pose[side+'Hand'],.11,main);this.box(vp,root,pose[side+'Hand'],[.12,.12,.12],dark);this.segment(vp,root,[s*.15,.84,0],pose[side+'Knee'],.16,dark);this.segment(vp,root,pose[side+'Knee'],pose[side+'Foot'],.14,main);this.box(vp,root,pose[side+'Foot'],[.15,.12,.25],dark);}}
 if(belt)this.draw(this.belt,vp,mul(root,mul(trans(0,p.waist*1.64,.12),scale(p.beltScale))));this.effects(vp,root,runtime);
 }
 effects(vp,root,runtime){const age=runtime.now-runtime.fxAt;if(age<0||age>2.4)return;const tint=rgb(runtime.project.color),power=runtime.effectPower;for(let i=0;i<28;i++){const a=i*2.39996+age,r=(.35+age*(runtime.fxKind==='attack'?.9:.25))*power;this.box(vp,root,[Math.cos(a)*r,.8+(i%7)*.13,Math.sin(a)*r],[.018,.018,.018],tint);}}
 room(xr,runtime){if(!runtime.enabled||!runtime.root)return;this.sync(runtime);const vp=mul(xr.projection,xr.view),p=runtime.project;if(!xr.showAvatar){let pose=runtime.poseAt();if(!runtime.editing&&runtime.playStart===null){pose=structuredClone(pose);for(const hand of ['left','right']){const m=runtime.hands[hand];if(!m)continue;const pos=localPoint(runtime.root,[m[12],m[13],m[14]]);pose[hand+'Hand']=pos;pose[hand+'Elbow']=pose[hand+'Shoulder'].map((v,i)=>v*.45+pos[i]*.55+(i===1?-.08:0));}}
 this.avatar(vp,runtime.root,runtime,{head:false,pose,belt:false});this.draw(this.belt,vp,mul(runtime.beltModel,scale(p.beltScale)));}
 if(runtime.itemModel)this.draw(this.item,vp,mul(runtime.itemModel,scale(p.itemScale)));if(runtime.panel)this.draw(this.panel,vp,runtime.panel);
 if(runtime.preview){this.avatar(vp,runtime.preview,runtime,{head:true});if(runtime.editing)for(const pos of Object.values(p.pose))this.draw(this.ball,vp,mul(runtime.preview,mul(trans(pos[0],pos[1]-.035,pos[2]),size(.07,.07,.07))),[.78,1,.3]);}
 }
 destroy(){for(const m of [this.cube,this.ball,this.panel,this.belt,this.item])m?.destroy();}
}
