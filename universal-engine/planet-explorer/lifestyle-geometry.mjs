/* Lightweight, original 3D furniture and campsite meshes; no external assets. */
import {Shape} from "../original-assets/original-models.mjs";
const c=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);
const wood=c("#8b6542"),edge=c("#513827"),lightWood=c("#b88c56"),cloth=c("#e2d3a9"),
  clay=c("#c3a589"),stone=c("#858983"),metal=c("#9baba9");
export function furnitureGeometry(kind){
 const m=new Shape();
 if(kind==="bed"){
  m.box(0,.40,0,.76,.22,1.22,wood);m.box(0,.62,0,.7,.17,1.1,c("#b9ae8c"));
  m.box(0,.78,-.83,.68,.13,.28,cloth);m.box(0,.78,.38,.70,.07,.49,c("#4d7977"));
  for(const z of [-1.06,1.06])m.box(0,.37,z,.80,.75,.085,edge);
 }else if(kind==="chair"){
  for(const x of [-.3,.3])for(const z of [-.3,.3])m.box(x,.38,z,.06,.52,.07,edge);
  m.box(0,.85,0,.4,.12,.41,wood);m.box(0,.85,-.35,.42,.77,.08,lightWood);
 }else if(kind==="table"){
  m.box(0,1.17,0,.88,.16,.57,lightWood);
  for(const x of [-.69,.69])for(const z of [-.39,.39])m.box(x,.40,z,.08,.85,.08,wood);
  m.box(0,1.26,0,.18,.015,.14,c("#a9a28b"));
 }else if(kind==="fireplace"){
  m.box(0,.37,0,.64,.18,.52,stone);
  for(const x of [-.56,.56])m.box(x,.56,-.08,.11,1.30,.43,stone);
  m.box(0,1.65,-.08,.7,.18,.48,stone);
  m.box(0,.44,-.39,.50,.12,.10,wood);
  m.box(0,.56,-.33,.37,.26,.16,c("#5b3325"));
  m.box(0,1.82,-.25,.33,.39,.32,stone);
 }else if(kind==="kitchen"){
  m.box(0,.37,0,.96,.87,.49,wood);
  m.box(0,1.24,0,1.04,.13,.57,stone);
  m.box(-.45,1.35,.03,.28,.05,.29,metal);
  m.box(-.45,1.39,.03,.20,.02,.19,c("#5b777c"));
  m.box(.47,1.39,0,.22,.035,.22,c("#414b4f"));
  m.box(.47,.63,.52,.35,.46,.06,lightWood);
  m.box(-.45,.63,.52,.35,.46,.06,lightWood);
  m.box(0,1.44,-.44,.09,.41,.07,metal);
  m.box(0,1.81,-.44,.32,.04,.08,metal);
 }else if(kind==="bookshelf"){
  m.box(0,.41,0,.88,2.11,.31,wood);
  for(const y of [.59,1.27,1.94]){
   m.box(0,y,.06,.86,.10,.33,lightWood);
   for(let i=0;i<7;i++){
    const palette=["#526f86","#a85a45","#9b834f","#4c7866","#8b647b"];
    m.box(-.68+i*.22,y+.10,.04,.087,.46+(i%3)*.038,.16,c(palette[(i+Math.round(y*4))%5]));
    m.box(-.68+i*.22,y+.25,.213,.065,.018,.013,c("#edd59b"));
   }
  }
  m.box(-.85,.41,0,.07,2.1,.34,edge);m.box(.85,.41,0,.07,2.1,.34,edge);
 }else if(kind==="lamp"){
  m.box(0,.40,0,.23,.12,.22,edge);
  m.cylinder(0,.52,0,.055,1.15,metal,8);
  m.cone(0,1.63,0,.38,.48,c("#e9c97b"),8);
  m.box(0,2.08,0,.18,.08,.18,edge);
 }else if(kind==="chest"){
  m.box(0,.4,0,.62,.71,.43,wood);m.box(0,1.08,0,.66,.17,.46,lightWood);
  m.box(0,.74,.445,.14,.21,.03,metal);
  for(const x of [-.53,.53])m.box(x,.40,0,.065,.81,.45,edge);
 }else throw new RangeError("Unknown furniture geometry "+kind);
 return m;
}
export function campGeometry(kind,cutaway=false){
 const m=new Shape();
 if(kind==="bedroll"){
  m.box(0,.08,0,.69,.12,1.18,c("#4e5e44"));
  m.box(0,.21,0,.60,.14,1.06,c("#a9a991"));
  m.box(0,.31,-.84,.60,.11,.24,cloth);
  m.box(0,.35,.40,.61,.06,.48,c("#627d7f"));
 }else if(kind==="tent"){
  // Foldable A-frame tent, open front, triangular rear and two cloth slopes.
  const xl=-1.55,xr=1.55,top=[0,2.27,0],frontZ=1.65,backZ=-1.65;
  m.box(0,.04,0,1.56,.08,1.66,c("#897355"));
  if(!cutaway){
   m.quad([xl,.11,frontZ],[0,2.27,frontZ],[0,2.27,backZ],[xl,.11,backZ],c("#6d8a65"));
   m.quad([0,2.27,frontZ],[xr,.11,frontZ],[xr,.11,backZ],[0,2.27,backZ],c("#839d79"));
   m.triangle([xl,.11,backZ],[xr,.11,backZ],[0,2.27,backZ],c("#586c50"));
  }
  for(const z of [-1.65,1.65]){
   m.box(0,.11,z,.06,2.16,.06,wood);
   for(const x of [-1.55,1.55])m.box(x,.07,z,.11,.20,.12,metal);
  }
  m.box(0,.16,-.48,.62,.12,.88,c("#b9af87"));
  m.box(0,.27,-1.05,.52,.10,.21,cloth);
 }else throw new RangeError("Unknown camp "+kind);
 return m;
}
export function flameGeometry(){
 const m=new Shape();
 for(const [x,z,size] of [[-.17,0,.55],[.1,-.13,.72],[.20,.10,.50]]){
  m.cone(x,.55,z,.14*size,.72*size,c("#f08d38"),6);
  m.cone(x,.56,z,.072*size,.47*size,c("#fbd477"),6);
 }
 return m;
}
