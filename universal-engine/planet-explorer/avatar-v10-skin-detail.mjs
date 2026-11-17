/** Keep original GLB palms, fingers, feet and face when the torso is procedural. */
export function isAvatarHandDetail(primitive){
 const name=String(primitive?.name||"");
 return /^(?:bare[_ -]?hand|palm|thumb(?:tip)?|index[123]?|middle[123]?|ring[123]?|pinky[123]?|little[123]?)[_ -]?[LR]$/i.test(name)
  || /^finger[\w-]*[_ -][LR]$/i.test(name);
}
export function preserveAvatarSkinDetail(primitive){
 const name=String(primitive?.name||"");
 return /(?:face|skull|head|hair|eyes|brow|lip|mouth|ear|teeth|lash|^bare[_ -]?foot[_ -]?[LR]$)/i.test(name)
  || isAvatarHandDetail(primitive);
}
