/**
 * Pre-MR archive save protection.
 * Archive code uses original keys in JS, but this page writes to an isolated
 * localStorage namespace. Existing live saves are copied on first read only.
 * Never clears, writes or deletes the live-version keys.
 */
(()=>{
 "use strict";
 const ns="ue:archive:20261122:pre-mr:";
 const original={
  get:Storage.prototype.getItem,
  set:Storage.prototype.setItem,
  remove:Storage.prototype.removeItem,
  clear:Storage.prototype.clear
 };
 const k=value=>String(value);
 const own=key=>ns+"data:"+key;
 const tomb=key=>ns+"deleted:"+key;
 const cleared=ns+"cleared";
 const allowed=key=>!key.startsWith(ns);
 Storage.prototype.getItem=function(key){
  key=k(key);
  if(!allowed(key))return original.get.call(this,key);
  const value=original.get.call(this,own(key));
  if(value!==null)return value;
  if(original.get.call(this,tomb(key))!==null||original.get.call(this,cleared)!==null)return null;
  // Copy the user's existing save on first read; changes stay in the archive.
  const source=original.get.call(this,key);
  if(source===null)return null;
  try{original.set.call(this,own(key),source);}catch(_){}
  return source;
 };
 Storage.prototype.setItem=function(key,value){
  key=k(key);
  if(!allowed(key))return original.set.call(this,key,String(value));
  original.remove.call(this,tomb(key));
  return original.set.call(this,own(key),String(value));
 };
 Storage.prototype.removeItem=function(key){
  key=k(key);
  if(!allowed(key))return original.remove.call(this,key);
  original.remove.call(this,own(key));
  return original.set.call(this,tomb(key),"1");
 };
 Storage.prototype.clear=function(){
  const erase=[];
  for(let i=0;i<this.length;i++){
   const key=this.key(i);
   if(key?.startsWith(ns))erase.push(key);
  }
  for(const key of erase)original.remove.call(this,key);
  original.set.call(this,cleared,"1");
 };
})();
