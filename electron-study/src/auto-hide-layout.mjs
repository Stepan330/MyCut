export const autoHideStripSize=28;
export const dockSplitSize=axis=>axis==='horizontal'?9:5;
export function dockRegionPlan(plan,axis,placement){
 if(!plan)return null;const startAllowed=axis==='horizontal'?placement==='right':placement==='bottom',endAllowed=axis==='horizontal'?placement==='left':placement==='top';
 return {...plan,size:plan.size+(startAllowed?0:plan.start)+(endAllowed?0:plan.end),leadingGap:startAllowed?0:plan.start};
}
// Calculate from the expanded split, before removing any space. Releases travel
// toward the opposite side of the anchored edge, including through parent splits.
export function inlineDockPlan(tree,extent,axis,placement='right',swapped=false,collapseAxis=axis,side){
 if(!tree)return null;
 if(tree.group){const g=tree.group,anchor=preferredAutoHideAnchor(g,collapseAxis==='horizontal',side,placement,g.dock),active=g.autoHide&&collapseAxis===axis,size=active?(g.autoHideMode!=='inline'||g.autoHideCollapsed?autoHideStripSize:g.autoHideSize?.[axis==='horizontal'?'width':'height']??extent):extent,release=extent-size;
  return {size,start:active&&['right','bottom'].includes(anchor)?release:0,end:active&&['left','top'].includes(anchor)?release:0,group:g.id};
 }
 const children=swapped?[...tree.children].reverse():tree.children,ratio=swapped?1-tree.ratio:tree.ratio,same=tree.axis===axis,gap=same?dockSplitSize(tree.axis):0,available=extent-gap;
 const plans=children.map((child,i)=>inlineDockPlan(child,same?available*(i===0?ratio:1-ratio):extent,axis,placement,false,tree.axis,i));
 if(!same){const size=Math.max(...plans.map(p=>p.size));return {size,start:Math.min(...plans.map(p=>p.start)),end:Math.min(...plans.map(p=>p.end)),children:plans};}
 // Only the neighbour in the released direction may consume the space.
 const towardEnd=plans[0].end,towardStart=plans[1].start;plans[1].size+=towardEnd;plans[0].size+=towardStart;plans[0].end=0;plans[1].start=0;
 return {size:plans[0].size+plans[1].size+gap,start:plans[0].start,end:plans[1].end,children:plans};
}
export const allowedAutoHideAnchors=vertical=>vertical?['left','right']:['top','bottom'];
export function preferredAutoHideAnchor(group,vertical,side,placement,dock){return allowedAutoHideAnchors(vertical).includes(group.autoHideAnchor)?group.autoHideAnchor:autoHideAnchor(vertical,side,placement,dock);}
export function autoHideAnchor(vertical,side,placement='right',dock='top'){
  if(side===0)return vertical?'left':'top';if(side===1)return vertical?'right':'bottom';
  if(dock==='floating')return 'top';if(dock==='content')return 'bottom';
  return vertical?(placement==='left'?'left':'right'):(placement==='top'?'top':'bottom');
}
export function withinPanelEdge(point,rect,padding=10){
  return !!point&&!!rect&&point.x>=rect.x-padding&&point.x<=rect.x+rect.width+padding&&point.y>=rect.y-padding&&point.y<=rect.y+rect.height+padding;
}
export function autoHideSlot(group,axis){
  if(!group?.autoHide)return null;
  return group.autoHideMode==='inline'&&!group.autoHideCollapsed?group.autoHideSize?.[axis==='horizontal'?'width':'height']??(axis==='horizontal'?400:430):autoHideStripSize;
}
export function autoHideExtent(tree,axis,collapseAxis=axis){
  if(!tree)return autoHideStripSize;if(tree.group)return axis===collapseAxis?autoHideSlot(tree.group,axis)??autoHideStripSize:tree.group.autoHideSize?.[axis==='horizontal'?'width':'height']??(axis==='horizontal'?400:430);
  const sizes=tree.children.map(child=>autoHideExtent(child,axis,tree.axis)),gap=tree.children.some(child=>child.group?.autoHide)?0:dockSplitSize(tree.axis);return tree.axis===axis?sizes.reduce((a,b)=>a+b,gap):Math.max(...sizes);
}
export function atAutoHideWindowEdge(point,rect,container,viewport,edge,vertical){
  if(!point||!rect||!container)return false;
  const right=r=>r.x+r.width,bottom=r=>r.y+r.height;
  if(vertical){
    if(point.y<rect.y||point.y>bottom(rect))return false;
    if(edge==='right')return Math.abs(viewport.width-right(container))<=12&&Math.abs(right(rect)-right(container))<=6&&point.x>=viewport.width-6&&point.x<=viewport.width;
    if(edge==='left')return Math.abs(container.x)<=12&&Math.abs(rect.x-container.x)<=6&&point.x>=0&&point.x<=6;
  }else{
    if(point.x<rect.x||point.x>right(rect))return false;
    if(edge==='bottom')return Math.abs(viewport.height-bottom(container))<=32&&Math.abs(bottom(rect)-bottom(container))<=6&&point.y>=viewport.height-6&&point.y<=viewport.height;
    if(edge==='top')return Math.abs(container.y)<=12&&Math.abs(rect.y-container.y)<=6&&point.y>=0&&point.y<=6;
  }
  return false;
}
