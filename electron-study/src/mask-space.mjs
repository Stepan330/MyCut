import {identity,inverse,multiply,transformPoint} from './scene-transform.mjs';
export const maskTypes=['RectangleMask','BitmapMask','ConvertToAlphaMask','Paint_Mask'];
export function graphTransform(p={},world=identity()){
 const a=(p.rotation??0)*Math.PI/180,c=Math.cos(a),s=Math.sin(a),sx=p.scaleX??1,sy=p.scaleY??1,px=p.pivotX??0,py=p.pivotY??0,matrix=[c*sx,s*sx,-s*sy,c*sy,(p.x??0)+px-c*sx*px+s*sy*py,(p.y??0)+py-s*sx*px-c*sy*py];
 return p.coordinateSpace==='Global'?multiply(inverse(world)??identity(),multiply(matrix,world)):matrix;
}
// Legacy saved matrices retain their original binding until a space is chosen.
export function maskSpace(params={},world=identity()){
 params??={};
 if(params.coordinateSpace==='Global')return identity();
 if(params.coordinateSpace==='Local')return world;
 return params.matrix?multiply(world,params.matrix):world;
}
export function maskRotation(params={},width=960,height=600){
 params??={};
 const x=params.x??0,y=params.y??0,w=params.width??width,h=params.height??height;
 const cx=x+w/2,cy=y+h/2,a=(params.rotation??0)*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
 return [c,s,-s,c,cx-c*cx+s*cy,cy-s*cx-c*cy];
}
export function maskLocalTransform(params,world,w,h){return multiply(inverse(world)??identity(),multiply(maskSpace(params,world),maskRotation(params,w,h)));}
export function maskItem(node,w=960,h=600){const p=node.params??{};return {id:node.id,kind:'Shape',x:p.x??0,y:p.y??0,width:p.width??w,height:p.height??h,rotation:p.rotation??0,sx:1,sy:1,visible:true,locked:false};}
export function changeMaskSpace(node,coordinateSpace,world){
 const p=node.params??{},next={...p,coordinateSpace};delete next.matrix;
 if(['RectangleMask','BitmapMask'].includes(node.type)){
  const width=p.width??300,height=p.height??200,center={x:(p.x??0)+width/2,y:(p.y??0)+height/2};
  const from=maskSpace(p,world),to=maskSpace(next,world),point=transformPoint(multiply(inverse(to),from),center);
  const dx=point.x-center.x,dy=point.y-center.y;next.x=point.x-width/2;next.y=point.y-height/2;
  if(p.bounds)next.bounds={...p.bounds,x:p.bounds.x+dx,y:p.bounds.y+dy};
 }
 return {...node,params:next};
}
export function resizeMask(params,item,patch){
 const next={...item,...patch},width=next.width*next.sx,height=next.height*next.sy;
 const box=params.bounds,priorX=params.x??0,priorY=params.y??0;const transformed=box?{bounds:{x:next.x+(box.x-priorX)*width/item.width,y:next.y+(box.y-priorY)*height/item.height,width:box.width*width/item.width,height:box.height*height/item.height}}:null;
 return {...params,x:next.x,y:next.y,width,height,rotation:next.rotation,...transformed};
}
