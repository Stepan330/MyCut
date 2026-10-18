export const extraShapeTools=[
  {id:'line',label:'Line',shortcut:'l'},{id:'arrow',label:'Arrow',shortcut:'a'},
  {id:'triangle',label:'Triangle',shortcut:'q'},{id:'diamond',label:'Diamond',shortcut:'d'},
  {id:'pentagon',label:'Pentagon',shortcut:'f'},{id:'hexagon',label:'Hexagon',shortcut:'g'},
  {id:'star',label:'Star',shortcut:'s'},{id:'polygon',label:'Polygon',shortcut:'p'},
  {id:'heart',label:'Heart',shortcut:'j'},{id:'callout',label:'Callout',shortcut:'k'}
];
export const shapeTypes=['rectangle','ellipse',...extraShapeTools.map(s=>s.id)];
export function shapePoints(item,w,h){
  if(['line','arrow'].includes(item.shape))return item.endpoints??[{x:item.drawReverseX?w:0,y:item.drawReverseY?h:0},{x:item.drawReverseX?0:w,y:item.drawReverseY?0:h}];
  if(item.vertices)return item.vertices;
  const sides=({triangle:3,diamond:4,pentagon:5,hexagon:6})[item.shape]??Math.max(3,Math.min(32,Math.round(item.sides??5))),star=item.shape==='star',count=star?sides*2:sides;
  return Array.from({length:count},(_,i)=>{const angle=-Math.PI/2+i*Math.PI*2/count,r=star&&i%2?Math.max(.1,Math.min(.9,item.innerRadius??.45)):1;return {x:w/2+Math.cos(angle)*w/2*r,y:h/2+Math.sin(angle)*h/2*r};});
}
export function shapeControls(item,w,h){
  if(item.shape==='heart')return [{x:w*(item.heartBulge??.38),y:h*.18}];
  if(item.shape==='callout')return [{x:item.tailX??w*.16,y:item.tailY??h}];
  if(['rectangle','ellipse'].includes(item.shape))return [];
  return shapePoints(item,w,h);
}
export function moveShapeControl(item,w,h,index,point,snap=false){
  if(item.shape==='heart')return {heartBulge:Math.max(.15,Math.min(.48,point.x/w))};
  if(item.shape==='callout')return {tailX:point.x,tailY:point.y};
  const points=shapePoints(item,w,h).map(p=>({...p})),line=['line','arrow'].includes(item.shape);
  if(line&&snap){const other=points[1-index],dx=point.x-other.x,dy=point.y-other.y,a=Math.round(Math.atan2(dy,dx)/(Math.PI/12))*Math.PI/12,l=Math.hypot(dx,dy);point={x:other.x+Math.cos(a)*l,y:other.y+Math.sin(a)*l};}
  points[index]={x:point.x,y:point.y};return {[line?'endpoints':'vertices']:points};
}
export function vectorShapePath(item,w,h){
  const x=n=>n*w,y=n=>n*h,polygon=points=>points.map((p,i)=>`${i?'L':'M'}${p[0]} ${p[1]}`).join(' ')+'Z';
  if(['line','arrow'].includes(item.shape)){
    const [start,end]=shapePoints(item,w,h).map(p=>[p.x,p.y]);
    if(item.shape==='line')return `M${start[0]} ${start[1]}L${end[0]} ${end[1]}`;
    const dx=end[0]-start[0],dy=end[1]-start[1],length=Math.max(1,Math.hypot(dx,dy)),u=[dx/length,dy/length],n=[-u[1],u[0]],head=length*(item.arrowHead??.3),shaft=(item.lineWidth??4)/2;
    const point=(base,along,across)=>[base[0]+u[0]*along+n[0]*across,base[1]+u[1]*along+n[1]*across];
    return polygon([point(start,0,shaft),point(end,-head,shaft),point(end,-head,head*.55),end,point(end,-head,-head*.55),point(end,-head,-shaft),point(start,0,-shaft)]);
  }
  if(item.shape==='heart'){const b=item.heartBulge??.38;return `M${x(.5)} ${y(.95)}C${x(b)} ${y(.8)} 0 ${y(.55)} 0 ${y(.28)}C0 ${y(-.05)} ${x(b)} ${y(-.08)} ${x(.5)} ${y(.18)}C${x(1-b)} ${y(-.08)} ${w} ${y(-.05)} ${w} ${y(.28)}C${w} ${y(.55)} ${x(1-b)} ${y(.8)} ${x(.5)} ${y(.95)}Z`;}
  if(item.shape==='callout')return `M${x(.1)} 0H${x(.9)}Q${w} 0 ${w} ${y(.12)}V${y(.64)}Q${w} ${y(.76)} ${x(.9)} ${y(.76)}H${x(.4)}L${item.tailX??x(.16)} ${item.tailY??h}L${x(.22)} ${y(.76)}H${x(.1)}Q0 ${y(.76)} 0 ${y(.64)}V${y(.12)}Q0 0 ${x(.1)} 0Z`;
  return polygon(shapePoints(item,w,h).map(p=>[p.x,p.y]));
}
