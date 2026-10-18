// Radii and outline are document-space values, independent of object scaling.
export function shapeMetrics(item,w,h,world=[1,0,0,1,0,0]){
  const sx=Math.max(1e-8,Math.hypot(world[0],world[1])),sy=Math.max(1e-8,Math.hypot(world[2],world[3])),maximum=Math.min(w*sx,h*sy)/2,radius=Math.max(0,Math.min(item.cornerRadius??0,maximum));
  return {sx,sy,radius,maximum,rx:radius/sx,ry:radius/sy};
}
// Screen-space clearance separates rounding controls from resize handles.
export function cornerControlInset(item,w,h,world,scale,settings){
  const {sx,sy,rx,ry}=shapeMetrics(item,w,h,world);
  const clearance=settings.base+settings.expansion+8+(item.strokeWidth??0)*scale/2;
  return {x:Math.min(Math.max(clearance/(sx*scale),rx),w/3),y:Math.min(Math.max(clearance/(sy*scale),ry),h/3)};
}
