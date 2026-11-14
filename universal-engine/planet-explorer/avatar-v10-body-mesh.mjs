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
