// Shape-tool edits retain document-space outline; whole-object sizing transforms
// the already-stroked silhouette, including nonuniform scaling.
export function shapeOutlinePatch(item,patch,world,whole=true){
 if(item.kind!=='Shape'||!['rectangle','ellipse',undefined].includes(item.shape))return patch;
 const axes=[Math.hypot(world[0],world[1]),Math.hypot(world[2],world[3])].map(v=>Math.max(1e-8,v));
 if('strokeWidth' in patch)return {...patch,outlineBasis:axes};
 if(!['sx','sy','width','height'].some(k=>k in patch))return patch;
 if(!whole&&!item.outlineBasis)return patch;
 const basis=[...(item.outlineBasis??axes)];
 for(const [i,scale,size] of [[0,'sx','width'],[1,'sy','height']]){
  if(whole&&size in patch)basis[i]/=Math.max(1e-8,patch[size]/(item[size]??144));
  if(!whole&&scale in patch)basis[i]*=Math.abs(patch[scale]/(item[scale]||1));
 }
 return {...patch,outlineBasis:basis.map(v=>Math.max(1e-8,v))};
}
