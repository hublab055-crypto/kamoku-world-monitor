/** Construct a complete adult study-body surface from the skinned casual
 * mesh when the authored V10 GLB has no nude/base torso and limb surfaces.
 *
 * The cloned mesh retains the original skin joint weights, triangle topology
 * and bind-pose node. It is a neutral anatomical approximation based on the
 * clothed model, not a replacement for an artist-authored bare-body sculpt.
 */
export function createAvatarV10BodyMesh(rig){
 if(!rig?.isV10||!Array.isArray(rig.primitives))return null;
 const bases=rig.primitives.filter(p=>p.wardrobe?.includes("base")&&
  /(?:body|torso|trunk|pelvis|limb|thigh|legs)/i.test(p.name||""));
 if(bases.some(p=>p.arrays.positions.length>2400))return null;
 const clothing=rig.primitives.filter(p=>p.wardrobe?.includes("casual")&&
  !/(?:hair|shoe|boot|belt|equipment|helmet|glove|accessory|hardware|toe|sole)/i.test(p.name||""))
  .sort((a,b)=>b.arrays.positions.length-a.arrays.positions.length)[0];
 if(!clothing||clothing.arrays.positions.length<1800)return null;
 const skin=rig.primitives.find(p=>/Face and skull/i.test(p.name||""));
 const sourceColors=skin?.arrays.colors;
 let average=[.73,.52,.39];
 if(sourceColors?.length>=90){
  average=[0,0,0];
  const count=Math.min(300,sourceColors.length/3);
  for(let i=0;i<count;i++)for(let axis=0;axis<3;axis++)average[axis]+=sourceColors[i*3+axis]/count;
 }
 // A subtle shrink keeps the study body inside the original cloth silhouette.
 const arrays=Object.fromEntries(Object.entries(clothing.arrays).map(([key,data])=>[key,new Float32Array(data)]));
 for(let i=0;i<arrays.positions.length;i+=3){
  arrays.positions[i]*=.99;arrays.positions[i+2]*=.985;
 }
 for(let i=0;i<arrays.colors.length;i+=3){
  arrays.colors[i]=average[0];arrays.colors[i+1]=average[1];arrays.colors[i+2]=average[2];
 }
 return {...clothing,name:"V10 generated full body skin",wardrobe:["base","swim"],
  arrays,indices:new Uint32Array(clothing.indices),textureImage:null,gloveColor:null,names:[]};
}

/** Restore the visible heel, arch and toe region in study/swim modes.
 * Compact V10 archives retain skinned casual/work footwear but omit the
 * author's base-body foot meshes. Re-use its *foot* topology and skinning as a
 * neutral skin-colored placeholder, without modifying dressed footwear.
 * Never combine footwear from both feet into a single missing leg/torso mesh.
 */
export function createAvatarV10FootMeshes(rig){
 if(!rig?.isV10||!Array.isArray(rig.primitives))return [];
 const footName=/(?:shoe|boot|sneaker|sandal|slipper|footwear|sole|toe|heel)/i;
 if(rig.primitives.some(p=>p.wardrobe?.includes("base")&&footName.test(p.name||"")))
  return [];
 const feet=rig.primitives.filter(p=>footName.test(p.name||"")&&
  (p.wardrobe?.includes("casual")||p.wardrobe?.includes("work"))&&
  p.arrays?.positions?.length>=9);
 // Some outfits share the same node across work and casual; copy once.
 const unique=[...new Map(feet.map(p=>[p.node+":"+(p.name||""),p])).values()];
 if(!unique.length)return [];
 const face=rig.primitives.find(p=>/Face and skull/i.test(p.name||""));
 const colors=face?.arrays?.colors;
 const skin=[.73,.52,.39];
 if(colors?.length>=90){
  const count=Math.min(300,Math.floor(colors.length/3));
  for(let c=0;c<3;c++){
   skin[c]=0;
   for(let i=0;i<count;i++)skin[c]+=colors[i*3+c]/count;
  }
 }
 return unique.map((source,index)=>{
  const arrays=Object.fromEntries(Object.entries(source.arrays).map(([key,data])=>
   [key,new Float32Array(data)]));
  const pos=arrays.positions;
  let minY=Infinity,sumX=0,sumZ=0,n=pos.length/3;
  for(let i=0;i<pos.length;i+=3){
   sumX+=pos[i];sumZ+=pos[i+2];minY=Math.min(minY,pos[i+1]);
  }
  const cx=sumX/n,cz=sumZ/n;
  // Shoe geometry is only a stopgap foot surface; flatten the instep slightly
  // while keeping the sole (ground contact) and skinned node placement intact.
  for(let i=0;i<pos.length;i+=3){
   pos[i]=cx+(pos[i]-cx)*.90;
   pos[i+1]=minY+(pos[i+1]-minY)*.84;
   pos[i+2]=cz+(pos[i+2]-cz)*.94;
  }
  for(let i=0;i<arrays.colors.length;i+=3)
   arrays.colors.set(skin,i);
  return {...source,name:"V10 generated foot skin "+(index+1),
   wardrobe:["base","swim"],arrays,indices:new Uint32Array(source.indices),
   textureImage:null,gloveColor:null,names:[]};
 });
}
