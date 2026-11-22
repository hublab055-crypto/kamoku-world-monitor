/**
 * Optional low-poly joint sleeves/finger pieces for rig-v2.
 * Generated entirely from Universal Engine procedural geometry.
 */
import {Shape} from "../original-assets/original-models.mjs";
const dress={
 pioneer:{cloth:[.20,.44,.40],trim:[.67,.56,.35],boots:[.27,.23,.19]},
 scout:{cloth:[.21,.36,.55],trim:[.62,.62,.48],boots:[.19,.23,.28]},
 artisan:{cloth:[.59,.31,.26],trim:[.67,.55,.38],boots:[.27,.24,.19]}
};
const skin=[.84,.64,.46];
function add(items,name,pivot,callback) {
 const geometry=new Shape();
 callback(geometry);
 items.push({name,pivot,geometry});
}
export function makeJointCovers(style="pioneer"){
 if(!Object.hasOwn(dress,style))throw RangeError("Unknown clothing style");
 const pal=dress[style],parts=[];
 for(const side of ["left","right"]){
  const label=side==="left"?"L":"R";
  add(parts,label+" shoulder pad",side+"Shoulder",m=>{
   m.crystal(0,-.05,0,.155,.15,.16,pal.cloth);
  });
  add(parts,label+" elbow cap",side+"Elbow",m=>{
   m.crystal(0,-.01,0,.108,.12,.105,pal.trim);
  });
  add(parts,label+" wrist joint",side+"Wrist",m=>{
   m.crystal(0,-.012,0,.09,.09,.10,skin);
  });
  add(parts,label+" hip fabric",side+"Hip",m=>{
   m.crystal(0,-.03,0,.17,.17,.17,pal.cloth);
  });
  add(parts,label+" knee pad",side+"Knee",m=>{
   m.crystal(0,-.018,.016,.133,.13,.13,pal.cloth);
  });
  add(parts,label+" ankle boot",side+"Ankle",m=>{
   m.crystal(0,-.025,0,.133,.102,.15,pal.boots);
  });
  add(parts,label+" toe tip",side+"Toe",m=>{
   m.box(0,-.022,.02,.132,.08,.13,pal.boots);
  });
  for(const finger of ["Thumb","Index","Middle","Ring","Little"]){
   add(parts,label+" "+finger+" finger proximal",side+finger+"1",m=>{
    m.cylinder(0,-.085,0,.029,.10,skin,5,.026);
   });
   add(parts,label+" "+finger+" finger distal",side+finger+"2",m=>{
    m.cylinder(0,-.065,0,.024,.077,skin,5,.019);
   });
  }
 }
 add(parts,"lower spine fabric","lowerSpine",m=>m.crystal(0,0,0,.22,.18,.19,pal.cloth));
 add(parts,"upper chest fabric","chest",m=>m.crystal(0,.08,0,.23,.15,.17,pal.cloth));
 return parts;
}
