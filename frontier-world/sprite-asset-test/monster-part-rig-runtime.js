/* Frontier World MON3: render independent transparent PNGs on MON2 joints.
 * This is an opt-in reusable runtime. Asset PNGs are not shipped yet.
 * Coordinates are editor units (200x240); source artboard uses 2px/unit.
 */
(function(root,factory){
  var api=factory();
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  if(root)root.FWMonsterPartRig=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";
  var DIRS=["front","left","right","back"];
  function finite2(p){return Array.isArray(p)&&p.length===2&&p.every(function(n){return typeof n==="number"&&Number.isFinite(n)})}
  function sub(a,b){return [a[0]-b[0],a[1]-b[1]]}
  function length(a){return Math.hypot(a[0],a[1])}
  function angle(a){return Math.atan2(a[1],a[0])}
  function validate(manifest){
    var errors=[],j=manifest&&manifest.restPose,parts=manifest&&manifest.parts;
    if(!manifest||!Array.isArray(manifest.logicalCanvas)||!Array.isArray(manifest.sourceArtboardPx))errors.push("Missing canvas dimensions");
    if(!j||typeof j!=="object")errors.push("Missing restPose");
    if(!Array.isArray(parts)||parts.length===0)return errors.concat(["Missing parts"]);
    var ids=new Set();
    parts.forEach(function(part){
      if(!part||typeof part.id!=="string"||ids.has(part.id))errors.push("Missing or duplicate part id");
      else ids.add(part.id);
      if(part.pivotJoint&&!finite2(j&&j[part.pivotJoint]))errors.push(part.id+": invalid pivotJoint");
      if(part.axisJoint&&!finite2(j&&j[part.axisJoint]))errors.push(part.id+": invalid axisJoint");
      if(!part.layer||DIRS.some(function(d){return !Number.isFinite(part.layer[d])}))errors.push(part.id+": missing direction layer");
    });
    parts.forEach(function(part){if(part.inheritRotationFrom&&!ids.has(part.inheritRotationFrom))errors.push(part.id+": invalid rotation parent")});
    return errors;
  }
  function evaluate(manifest,direction,pose){
    if(DIRS.indexOf(direction)<0)throw Error("Invalid direction");
    var problems=validate(manifest);if(problems.length)throw Error(problems.join("; "));
    var rest=manifest.restPose,parts=manifest.parts,cache=Object.create(null),res=[];
    var byId=Object.create(null);
    parts.forEach(function(part){byId[part.id]=part});
    function rot(part,stack){
      if(cache[part.id]!==undefined)return cache[part.id];
      if(stack.has(part.id))throw Error("Cycle in rotation inheritance: "+part.id);
      stack.add(part.id);
      var r=0;
      if(part.axisJoint){
        if(!finite2(pose[part.pivotJoint])||!finite2(pose[part.axisJoint]))throw Error("Missing joints for "+part.id);
        var base=sub(rest[part.axisJoint],rest[part.pivotJoint]);
        var next=sub(pose[part.axisJoint],pose[part.pivotJoint]);
        if(length(next)<0.01||length(base)<0.01)throw Error("Degenerate bone: "+part.id);
        r=angle(next)-angle(base);
      }else if(part.inheritRotationFrom){
        r=rot(byId[part.inheritRotationFrom],stack);
      }
      stack.delete(part.id);cache[part.id]=r;return r;
    }
    parts.forEach(function(part){
      var base=part.pivotJoint?rest[part.pivotJoint]:[100,215];
      var target=part.pivotJoint?pose[part.pivotJoint]:[100,215];
      if(!finite2(target))throw Error("Missing joint: "+part.pivotJoint);
      var crop=part.cropPxByDirection&&part.cropPxByDirection[direction];
      if(crop&&(!Array.isArray(crop)||crop.length!==4||crop.some(function(n){return !Number.isFinite(n)})))throw Error("Bad crop: "+part.id);
      var ppu=manifest.pixelsPerLogicalUnit||2;
      res.push({
        id:part.id,direction:direction,imagePath:part.imagePattern.replace("{direction}",direction),
        layer:part.layer[direction],rotation:rot(part,new Set()),pivotTarget:target.slice(),
        pivotLocalPx:[base[0]*ppu-(crop?crop[0]:0),base[1]*ppu-(crop?crop[1]:0)],
        artboard:manifest.sourceArtboardPx
      });
    });
    return res.sort(function(a,b){return a.layer-b.layer});
  }
  function draw(ctx,manifest,direction,pose,images,opts){
    opts=opts||{};var out=evaluate(manifest,direction,pose);
    var scale=Number.isFinite(opts.scale)?opts.scale:128/240;
    var x=Number(opts.x)||0,y=Number(opts.y)||0,ppu=manifest.pixelsPerLogicalUnit||2;
    ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);
    out.forEach(function(t){
      var im=images&&images[t.imagePath];
      if(!im||!im.width||!im.height)return;
      ctx.save();ctx.translate(t.pivotTarget[0],t.pivotTarget[1]);ctx.rotate(t.rotation);
      ctx.scale(1/ppu,1/ppu);ctx.drawImage(im,-t.pivotLocalPx[0],-t.pivotLocalPx[1]);ctx.restore();
    });
    ctx.restore();return out;
  }
  return Object.freeze({validate:validate,evaluate:evaluate,draw:draw});
});