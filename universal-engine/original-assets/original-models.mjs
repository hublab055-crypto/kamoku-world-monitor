/**
 * Original 3D assets for Universal Engine, designed from scratch.
 * MIT-licensed source, procedurally generated meshes with no third-party geometry.
 * 1 unit = 1 meter, Y up, +Z forward. Pivot group for each joint.
 */
export const ORIGINAL_MODELS = Object.freeze([
  {id:"pioneer",name:"開拓者・翠の外套",kind:"avatar",description:"旅装束、琥珀色の襟巻き、道具鞄を持つ冒険者"},
  {id:"scout",name:"斥候・藍の装束",kind:"avatar",description:"藍色の軽装、肩飾りと革の装備"},
  {id:"artisan",name:"職人・錆朱の作業着",kind:"avatar",description:"錆朱の上着、道具ベルト、丈夫な靴"},
  {id:"broadleaf",name:"星葉樹",kind:"nature",description:"枝を広げる青緑の広葉樹"},
  {id:"pine",name:"段笠針葉樹",kind:"nature",description:"層を重ねる針葉樹"},
  {id:"flowering",name:"霞桜",kind:"nature",description:"薄桃の花を咲かせる樹木"},
  {id:"boulder",name:"風化した岩",kind:"nature",description:"割れ目と地衣のある岩石"},
  {id:"hut",name:"開拓者の小屋",kind:"building",description:"板壁、深緑の屋根、煙突を持つ建物"},
  {id:"sword",name:"旅人の剣",kind:"equipment",description:"真鍮の鍔と銀色の刀身"},
  {id:"axe",name:"森番の斧",kind:"equipment",description:"幅広の斧頭と木製柄"},
  {id:"pickaxe",name:"採掘つるはし",kind:"equipment",description:"鋼の先端と長い木柄"},
  {id:"hammer",name:"建築用金槌",kind:"equipment",description:"木柄と重量のある金属頭"}
]);
export const ORIGINAL_LICENSE="MIT (procedural asset generation source)";

export class Shape {
  constructor(){this.positions=[];this.normals=[];this.colors=[];this.indices=[];}
  triangle(a,b,c,color){
    const n=cross(sub(b,a),sub(c,a)),mag=Math.hypot(...n)||1,unit=n.map(v=>v/mag);
    const i=this.positions.length/3;
    for(const p of [a,b,c]){this.positions.push(...p);this.normals.push(...unit);this.colors.push(...color);}
    this.indices.push(i,i+1,i+2);
    return this;
  }
  quad(a,b,c,d,color){this.triangle(a,b,c,color);this.triangle(a,c,d,color);return this;}
  box(x,y,z,rx,h,rz,color){
    const p=[[x-rx,y,z-rz],[x+rx,y,z-rz],[x+rx,y+h,z-rz],[x-rx,y+h,z-rz],
      [x-rx,y,z+rz],[x+rx,y,z+rz],[x+rx,y+h,z+rz],[x-rx,y+h,z+rz]];
    for(const [a,b,c,d] of [[0,3,2,1],[4,5,6,7],[0,4,7,3],[1,2,6,5],[3,7,6,2],[0,1,5,4]])
      this.quad(p[a],p[b],p[c],p[d],color);
    return this;
  }
  prism(x,y,z,rx0,rz0,rx1,rz1,h,color){
    const p=[[x-rx0,y,z-rz0],[x+rx0,y,z-rz0],[x+rx0,y,z+rz0],[x-rx0,y,z+rz0],
      [x-rx1,y+h,z-rz1],[x+rx1,y+h,z-rz1],[x+rx1,y+h,z+rz1],[x-rx1,y+h,z+rz1]];
    for(const [a,b,c,d] of [[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]])
      this.quad(p[a],p[b],p[c],p[d],color);
    return this;
  }
  cone(x,y,z,r,h,color,n=7){
    const top=[x,y+h,z];
    for(let i=0;i<n;i++){
      const a=i*Math.PI*2/n,b=(i+1)*Math.PI*2/n;
      const p=[x+r*Math.cos(a),y,z+r*Math.sin(a)];
      const q=[x+r*Math.cos(b),y,z+r*Math.sin(b)];
      this.triangle(p,q,top,color);
      this.triangle([x,y,z],q,p,color);
    }
    return this;
  }
  cylinder(x,y,z,r,h,color,n=8,topR=r){
    for(let i=0;i<n;i++){
      const a=2*Math.PI*i/n,b=2*Math.PI*(i+1)/n;
      const p=[x+r*Math.cos(a),y,z+r*Math.sin(a)],q=[x+r*Math.cos(b),y,z+r*Math.sin(b)];
      const pt=[x+topR*Math.cos(a),y+h,z+topR*Math.sin(a)];
      const qt=[x+topR*Math.cos(b),y+h,z+topR*Math.sin(b)];
      this.quad(p,q,qt,pt,color);
      this.triangle([x,y,z],q,p,color);
      this.triangle([x,y+h,z],pt,qt,color);
    }
    return this;
  }
  crystal(x,y,z,rx,ry,rz,color){
    const top=[x,y+ry,z],bot=[x,y-ry*.86,z];
    const ring=[];
    for(let i=0;i<7;i++){
      const a=i*2*Math.PI/7;
      ring.push([x+rx*Math.cos(a),y+ry*.05,z+rz*Math.sin(a)]);
    }
    for(let i=0;i<7;i++){
      const colorFace=color.map((v,k)=>Math.max(0,Math.min(1,v*(.80+.28*(i%3)/2))));
      this.triangle(ring[i],ring[(i+1)%7],top,colorFace);
      this.triangle(ring[(i+1)%7],ring[i],bot,colorFace);
    }
    return this;
  }
  append(other){
    const i=this.positions.length/3;
    this.positions.push(...other.positions);this.normals.push(...other.normals);this.colors.push(...other.colors);
    this.indices.push(...other.indices.map(n=>n+i));
    return this;
  }
}
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const col=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);
const palette={
 pioneer:{coat:col("#33766c"),edge:col("#1e514f"),shirt:col("#e8d5ac"),trim:col("#d7a954"),cloth:col("#34495a"),hair:col("#43372f"),boots:col("#44382f")},
 scout:{coat:col("#385e89"),edge:col("#283f66"),shirt:col("#d2d4ba"),trim:col("#c3ba86"),cloth:col("#394451"),hair:col("#5a3c27"),boots:col("#2c3740")},
 artisan:{coat:col("#a65b46"),edge:col("#713c37"),shirt:col("#f0d7aa"),trim:col("#b89e73"),cloth:col("#515046"),hair:col("#372b26"),boots:col("#493b31")}
};
const skin=col("#d6a47a"),leather=col("#70513d"),metal=col("#bfc8c3"),brass=col("#d0a84e");
const part=(name,pivot,mesh)=>({name,pivot,geometry:mesh});
function makeAvatar(id){
  const c=palette[id],parts=[];
  const add=(name,pivot,fn)=>{const m=new Shape();fn(m);parts.push(part(name,pivot,m));};
  add("上衣・外套","torso",m=>{
    m.prism(0,-.14,0,.31,.17,.375,.215,.73,c.coat);
    m.prism(0,.44,.065,.14,.20,.10,.18,.24,c.shirt);
    m.box(0,.46,.214,.13,.06,.033,c.trim);
    m.box(-.23,.20,.23,.045,.52,.035,c.edge);
    m.box(.23,.20,.23,.045,.52,.035,c.edge);
    m.box(.12,.26,.244,.032,.30,.032,leather);
    m.box(-.12,.18,-.26,.21,.42,.14,leather);
    m.box(-.12,.42,-.415,.13,.10,.022,brass);
    m.box(0,.52,.12,.33,.105,.22,c.edge);
  });
  add("腰・ベルト","pelvis",m=>{
    m.prism(0,-.13,0,.28,.16,.30,.17,.31,c.cloth);
    m.box(0,.07,.205,.34,.09,.07,leather);
    m.box(0,.06,.279,.095,.10,.028,brass);
    m.box(.29,-.06,.13,.13,.28,.13,leather);
    m.box(-.27,-.18,.06,.15,.25,.11,c.edge);
    m.box(.0,-.25,-.16,.24,.25,.08,c.coat);
  });
  add("首・襟","neck",m=>{
    m.cylinder(0,0,0,.104,.17,skin,7);
    m.box(0,-.02,.13,.20,.078,.09,c.trim);
    m.box(.12,.01,.15,.07,.23,.06,c.trim);
  });
  add("頭・顔・髪","head",m=>{
    m.crystal(0,.19,0,.225,.255,.205,skin);
    m.prism(0,.32,-.015,.238,.218,.206,.188,.14,c.hair);
    m.box(-.11,.37,.19,.12,.070,.045,c.hair);
    m.box(.12,.38,.18,.085,.05,.04,c.hair);
    m.box(-.082,.20,.203,.026,.030,.013,col("#242d33"));
    m.box(.082,.20,.203,.026,.030,.013,col("#242d33"));
    m.prism(0,.112,.21,.04,.03,.026,.035,.05,skin);
    m.box(0,.077,.21,.050,.018,.014,col("#8c6159"));
    if(id==="scout"){
      m.cylinder(0,.46,-.008,.24,.055,c.edge,9);
      m.prism(0,.47,-.01,.26,.19,.19,.14,.12,c.coat);
    }
    if(id==="artisan"){
      m.box(0,.39,.08,.27,.055,.27,leather);
      m.box(0,.39,.28,.30,.018,.16,c.trim);
    }
  });
  for(const side of ["left","right"]){
    const sign=side==="left"?-1:1;
    add(side+"上腕",side+"Shoulder",m=>{
      m.prism(0,-.47,0,.143,.155,.155,.165,.49,c.coat);
      m.box(0,-.12,.14,.17,.12,.06,c.edge);
      if(side==="left")m.box(0,-.15,.20,.17,.035,.022,c.trim);
    });
    add(side+"前腕",side+"Elbow",m=>{
      m.prism(0,-.39,0,.112,.12,.127,.13,.39,c.edge);
      m.box(0,-.39,0,.13,.085,.137,leather);
      m.box(0,-.34,.138,.14,.045,.015,c.trim);
    });
    add(side+"手",side+"Wrist",m=>{
      m.prism(0,-.14,0,.108,.105,.105,.10,.16,skin);
      m.box(sign*.11,-.11,.036,.04,.085,.065,skin);
    });
    add(side+"太腿",side+"Hip",m=>{
      m.prism(0,-.47,0,.174,.155,.183,.176,.47,c.cloth);
      m.box(0,-.15,.175,.16,.045,.02,c.edge);
    });
    add(side+"脛",side+"Knee",m=>{
      m.prism(0,-.43,0,.14,.145,.15,.145,.43,c.cloth);
      m.box(0,-.43,0,.158,.23,.166,c.boots);
      m.box(0,-.37,.17,.168,.052,.03,c.trim);
    });
    add(side+"足・靴",side+"Foot",m=>{
      m.box(0,-.028,.13,.165,.13,.278,c.boots);
      m.box(0,-.01,.31,.167,.076,.10,c.edge);
    });
  }
  return {id,name:ORIGINAL_MODELS.find(m=>m.id===id).name,kind:"avatar",parts};
}
function makeTree(id){
  const parts=[];
  function add(name,fn){const mesh=new Shape();fn(mesh);parts.push(part(name,null,mesh));}
  const wood=col("#654a39"),wood2=col("#815d42");
  const leaf1=id==="flowering"?col("#e8a5b2"):col("#327b73");
  const leaf2=id==="flowering"?col("#f4c4cd"):col("#43987e");
  if(id==="broadleaf"){
    add("幹と分枝",m=>{
      m.cylinder(0,0,0,.37,5.2,wood,7,.20);
      for(const [x,y,z,a] of [[1.0,4.3,.1,.14],[-1.1,4.7,.4,.14],[.6,5.2,-.8,.10]]){
        m.cone(x*.4,y*.7,z*.4,.20,1.6,wood2,5);
      }
    });
    add("星形の葉群",m=>{
      for(const [x,y,z,r] of [[0,5.45,0,1.9],[-1.65,4.9,.1,1.45],[1.45,5.0,.3,1.50],
        [-.4,6.5,.8,1.35],[.5,6.7,-.6,1.45]]){
        m.crystal(x,y,z,r,r*.73,r*.88,(x<0?leaf1:leaf2));
      }
    });
  }else if(id==="pine"){
    add("まっすぐな幹",m=>m.cylinder(0,0,0,.33,6.9,wood,8,.14));
    add("段笠の針葉",m=>{
      for(let i=0;i<4;i++){
        const y=2.1+i*1.15,r=2.6-i*.42;
        m.cone(0,y,0,r,2.75-i*.18,i%2?col("#2d6c63"):col("#25635d"),8);
      }
      m.cone(0,6.4,0,.75,1.8,col("#4d9883"),7);
    });
  }else{
    add("曲枝・淡樹皮",m=>{
      m.cylinder(0,0,0,.30,4.6,wood2,7,.17);
      m.cone(-.8,2.8,.3,.17,2.0,wood,5);
      m.cone(.7,3.1,-.1,.17,2.0,wood,5);
    });
    add("花霞の枝葉",m=>{
      for(const [x,y,z,r] of [[0,5.4,0,1.8],[-1.45,4.65,.2,1.2],[1.3,4.7,-.3,1.3],
       [-.8,6,.6,1.2],[.55,6.25,-.7,1.25]]){
        m.crystal(x,y,z,r,r*.68,r*.92,(x<0?leaf1:leaf2));
      }
      for(const [x,y,z] of [[1.2,4.7,1],[.4,5.95,1.1],[-1,5.2,.95],[-.7,4.4,-1]]){
        m.crystal(x,y,z,.27,.26,.21,col("#f6dde1"));
      }
    });
  }
  return {id,name:ORIGINAL_MODELS.find(m=>m.id===id).name,kind:"nature",parts};
}
function makeRock(){
  const rock=col("#74818a"),lichen=col("#b6bd8b"),parts=[];
  const b=new Shape();
  b.crystal(0,.69,0,1.34,.85,.99,rock);
  b.crystal(-.8,.41,.58,.55,.45,.40,col("#64757c"));
  b.crystal(.55,.4,-.55,.52,.4,.43,col("#899298"));
  parts.push(part("岩塊",null,b));
  const m=new Shape();m.box(-.25,1.26,.41,.26,.025,.12,lichen);
  m.box(.52,.86,.50,.14,.025,.09,lichen);
  parts.push(part("苔と地衣",null,m));
  return {id:"boulder",name:"風化した岩",kind:"nature",parts};
}
function makeHut(){
  const parts=[],add=(name,fn)=>{const mesh=new Shape();fn(mesh);parts.push(part(name,null,mesh));};
  const stone=col("#777a72"),plank=col("#977354"),plank2=col("#76523d"),roof=col("#326a69"),
    frame=col("#4b362a"),brass2=col("#caa866");
  add("土台",m=>m.box(0,0,0,2.95,.26,2.6,stone));
  add("木壁と梁",m=>{
    // Wall segments leave an actual open 1.4m-wide doorway on +Z.
    m.box(0,.27,-2.40,2.74,2.75,.08,plank);
    for(const side of [-1,1]){
      m.box(side*2.66,.27,0,.08,2.75,2.40,plank);
      m.box(side*1.71,.27,2.40,1.03,2.75,.08,plank);
    }
    m.box(0,2.37,2.40,.70,.65,.08,plank);
    for(let x=-2.5;x<=2.5;x+=.65){if(Math.abs(x)>.75)m.box(x,.26,2.49,.038,2.74,.045,plank2);
      m.box(x,.26,-2.49,.038,2.74,.045,plank2);}
    for(let z=-2.12;z<=2.1;z+=.7){m.box(-2.76,.26,z,.055,2.74,.035,plank2);
      m.box(2.76,.26,z,.055,2.74,.035,plank2);}
    m.box(0,2.92,2.45,2.84,.22,.10,frame);
  });
  add("切妻の深緑屋根",m=>{
    const L=[-3.23,3.03,-2.83],P=[0,4.42,-2.83],R=[3.23,3.03,-2.83],
          Lb=[-3.23,3.03,2.83],Pb=[0,4.42,2.83],Rb=[3.23,3.03,2.83];
    m.quad(L,P,Pb,Lb,roof);m.quad(P,R,Rb,Pb,col("#2b595d"));
    m.triangle(L,R,P,plank2);m.triangle(Lb,Pb,Rb,plank2);
    m.box(0,4.36,0,.12,.12,3.0,col("#b3a779"));
  });
  add("扉・窓・取手",m=>{
    m.box(-.74,.27,2.51,.08,2.15,.10,frame);
    m.box(.74,.27,2.51,.08,2.15,.10,frame);
    m.box(0,2.39,2.51,.82,.10,.10,frame);
    for(const x of [-1.8,1.8]){
      m.box(x,1.38,2.49,.52,.76,.11,frame);
      m.box(x,1.50,2.60,.42,.57,.05,col("#88c0bb"));
      m.box(x,1.78,2.67,.44,.06,.04,frame);
      m.box(x,1.50,2.67,.05,.6,.04,frame);
    }
    m.box(1.65,3.20,-.55,.36,1.95,.35,stone);
    m.box(1.65,5.05,-.55,.46,.17,.45,col("#65645e"));
  });
  return {id:"hut",name:"開拓者の小屋",kind:"building",parts};
}
function toolMesh(id){
  const m=new Shape(),dark=col("#504237"),steel=col("#b3c4c5"),bright=col("#dce5df");
  if(id==="sword"){
    m.cylinder(0,0,0,.065,.83,dark,7,.054);
    m.box(0,.72,0,.32,.12,.09,brass);
    m.prism(0,.83,0,.18,.038,.10,.025,1.18,steel);
    m.crystal(0,2.04,0,.095,.16,.025,bright);
    m.box(0,-.09,0,.13,.14,.13,brass);
  }else if(id==="axe"){
    m.cylinder(0,0,0,.072,1.95,dark,7,.056);
    m.box(.23,1.42,0,.38,.39,.13,steel);
    m.prism(.57,1.47,0,.12,.13,.17,.08,.5,bright);
    m.box(-.12,1.51,0,.21,.28,.13,col("#718991"));
  }else if(id==="pickaxe"){
    m.cylinder(0,0,0,.063,2.2,dark,8,.056);
    m.box(0,1.90,0,.71,.15,.12,steel);
    m.crystal(-.75,1.98,0,.25,.15,.11,bright);
    m.crystal(.75,1.98,0,.25,.15,.11,bright);
  }else{
    m.cylinder(0,0,0,.065,1.78,dark,8,.055);
    m.box(0,1.55,0,.46,.34,.24,steel);
    m.box(-.30,1.64,0,.18,.30,.22,col("#7b8f99"));
  }
  return m;
}
export function buildOriginalModel(id){
  if(!ORIGINAL_MODELS.some(m=>m.id===id))throw new RangeError("Unknown original model: "+id);
  if(palette[id])return makeAvatar(id);
  if(["broadleaf","pine","flowering"].includes(id))return makeTree(id);
  if(id==="boulder")return makeRock();
  if(id==="hut")return makeHut();
  return {id,name:ORIGINAL_MODELS.find(m=>m.id===id).name,kind:"equipment",
    parts:[part("工具",null,toolMesh(id))]};
}
export function modelBounds(model){
  const vertices=model.parts.flatMap(p=>p.geometry.positions);
  if(!vertices.length) return {min:[0,0,0],max:[0,0,0]};
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(let i=0;i<vertices.length;i+=3){
    for(let j=0;j<3;j++){min[j]=Math.min(min[j],vertices[i+j]);max[j]=Math.max(max[j],vertices[i+j]);}
  }
  return {min,max};
}
