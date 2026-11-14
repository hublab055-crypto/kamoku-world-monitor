import {fetchAvatarV10} from "./avatar-v10.mjs?v=20261114-base-swim";
import {SkinnedFrontierAsset} from "./frontier-skinned-renderer.mjs?v=20261114-crew-social-base-swim";

export class AvatarV10Assets {
 constructor(gl) {
  this.gl=gl;
  this.models=new Map();
  this.disposed=false;
 }

 load(model) {
  if(model==="classic"||this.disposed)return Promise.resolve(null);
  if(this.models.has(model))return this.models.get(model).pending;
  const record={asset:null,pending:null};
  this.models.set(model,record);
  record.pending=fetchAvatarV10(model).then(buffer=>{
   if(this.disposed)return null;
   record.asset=new SkinnedFrontierAsset(this.gl,buffer);
   return record.asset;
  });
  return record.pending;
 }

 get(model) {
  return this.models.get(model)?.asset||null;
 }

 prefetch(model) {
  if(!this.models.has(model))this.load(model).catch(error=>console.warn("Avatar V10:",error));
 }

 destroy() {
  this.disposed=true;
  for(const {asset} of this.models.values())asset?.destroy();
  this.models.clear();
 }
}
