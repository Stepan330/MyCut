// Shared transform math. Scene units here; adaptive hit zones use CSS screen px.
export const handles = [[0,0],[.5,0],[1,0],[0,.5],[1,.5],[0,1],[.5,1],[1,1]];
export const interactionDefaults = { base:16, expansion:28, coefficient:.04, influence:160, shrink:88, graphZoneScale:3 };
const rotate=(x,y,angle)=>{const a=angle*Math.PI/180;return {x:x*Math.cos(a)-y*Math.sin(a),y:x*Math.sin(a)+y*Math.cos(a)};};
export function worldPoint(item,size,u,v,box={x:0,y:0,width:size[0],height:size[1]}) {
  const [w,h]=size,p=rotate((box.x+u*box.width-w/2)*item.sx,(box.y+v*box.height-h/2)*item.sy,item.rotation);
  return {x:item.x+w*item.sx/2+p.x,y:item.y+h*item.sy/2+p.y};
}
export function resizeItem(original,size,index,start,pointer,{shift=false,alt=false,snapStep=0}={},box={x:0,y:0,width:size[0],height:size[1]}) {
  if(original.locked||!handles[index])return {};
  const [u,v]=handles[index],[w,h]=size;
  const [ax,ay]=alt?[.5,.5]:[1-u,1-v];
  const anchor=worldPoint(original,size,ax,ay,box),handle=worldPoint(original,size,u,v,box);
  // Preserve grab offset: clicking anywhere inside an expanded zone cannot jump.
  const delta=rotate(handle.x+pointer.x-start.x-anchor.x,handle.y+pointer.y-start.y-anchor.y,-original.rotation);
  const bx=(u-ax)*box.width,by=(v-ay)*box.height;
  const corner=u!==.5&&v!==.5,proportional=corner?!shift:shift;
  let sx=original.sx,sy=original.sy;
  const clamp=(value,initial)=>Math.sign(initial||1)*Math.max(.02,Math.min(100,Math.abs(value)*Math.sign(value||1)*Math.sign(initial||1)));
  if(proportional){
    const dx=bx*sx,dy=by*sy,den=dx*dx+dy*dy;
    const ratio=Math.min(100/Math.max(.02,Math.abs(sx),Math.abs(sy)),Math.max(.02/Math.max(.02,Math.min(Math.abs(sx),Math.abs(sy))),den>1e-10?(delta.x*dx+delta.y*dy)/den:1));
    sx=clamp(sx*ratio,sx);sy=clamp(sy*ratio,sy);
  }else {if(bx)sx=clamp(delta.x/bx,sx);if(by)sy=clamp(delta.y/by,sy);}
  if(snapStep>0){const snap=v=>Math.sign(v||1)*Math.max(.02,Math.min(100,Math.round(Math.abs(v)/snapStep)*snapStep));if(bx)sx=snap(sx);if(by)sy=proportional&&original.sx?clamp(original.sy*sx/original.sx,original.sy):snap(sy);}
  const offset=rotate((box.x+ax*box.width-w/2)*sx,(box.y+ay*box.height-h/2)*sy,original.rotation);
  return {sx,sy,x:anchor.x-offset.x-w*sx/2,y:anchor.y-offset.y-h*sy/2};
}
export function expansion(speed,distance,s=interactionDefaults) {
  const proximity=Math.max(0,Math.min(1,1-Math.max(0,distance)/s.influence));
  return Math.min(s.expansion,Math.max(0,speed-260)*s.coefficient*proximity*proximity);
}
export class AdaptiveZones {
  constructor(count=8){this.extra=Array(count).fill(0);}
  update(speed,distances,dt,settings=interactionDefaults){
    this.extra=this.extra.map((old,i)=>Math.max(expansion(speed,distances[i]??Infinity,settings),old-settings.shrink*Math.min(.1,Math.max(0,dt))));
    return this.extra.map(extra=>settings.base+extra);
  }
}
export function rotationRing(center,points,settings=interactionDefaults) {
  const corners=[0,2,5,7].map(i=>points[i]);
  const clearance=settings.base+settings.expansion+8;
  const radius=Math.max(clearance+12,...corners.map(p=>Math.hypot(p.x-center.x,p.y-center.y)+28));
  return {center,radius,clearance,points};
}
export function ringPoint(ring,angle){return {x:ring.center.x+Math.cos(angle)*ring.radius,y:ring.center.y+Math.sin(angle)*ring.radius};}
export function ringAvailable(ring,point){return ring.points.every(p=>Math.hypot(p.x-point.x,p.y-point.y)>ring.clearance);}
export function ringProjection(ring,pointer){
  if(!pointer)return null;
  const angle=Math.atan2(pointer.y-ring.center.y,pointer.x-ring.center.x),point=ringPoint(ring,angle);
  return {point,distance:Math.abs(Math.hypot(pointer.x-ring.center.x,pointer.y-ring.center.y)-ring.radius),available:ringAvailable(ring,point)};
}
export function ringSegments(ring,pointer,count=192){
  const result=[];
  for(let i=0;i<count;i++){
    const a=ringPoint(ring,i*Math.PI*2/count),b=ringPoint(ring,(i+1)*Math.PI*2/count);
    if(!ringAvailable(ring,a)||!ringAvailable(ring,b))continue;
    const distance=pointer?Math.hypot((a.x+b.x)/2-pointer.x,(a.y+b.y)/2-pointer.y):Infinity;
    result.push({a,b,opacity:.14+.74*Math.max(0,1-distance/150)});
  }
  return result;
}
// Incremental angle avoids discontinuities at +/-180 degrees and supports full turns.
export function angleDelta(previous,current){return Math.atan2(Math.sin(current-previous),Math.cos(current-previous));}
export function rotationValue(original,total,{shift=false,ctrl=false}={}){
  const angle=original+total*180/Math.PI*(ctrl?.1:1);
  return shift?Math.round(angle/15)*15:angle;
}
