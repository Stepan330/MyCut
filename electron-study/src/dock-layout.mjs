export const initialDockLayout=()=>[
  {id:'sidebar-top',dock:'top',route:[{axis:'vertical',side:0,ratio:.35}],tabs:['outliner'],active:'outliner'},
  {id:'sidebar-bottom',dock:'bottom',route:[{axis:'vertical',side:1,ratio:.35}],tabs:['details'],active:'details'},
];
export function dockTree(groups,depth=0){
  if(!groups.length)return null;if(groups.length===1)return {group:groups[0]};
  const segment=groups.find(g=>g.route?.[depth])?.route[depth]??{axis:'vertical',ratio:.5},left=groups.filter(g=>(g.route?.[depth]?.side??0)===0),right=groups.filter(g=>g.route?.[depth]?.side===1);
  if(!left.length||!right.length){if(depth>40||!groups.some(g=>g.route?.[depth])){const middle=Math.ceil(groups.length/2);return {axis:'vertical',ratio:.5,children:[dockTree(groups.slice(0,middle)),dockTree(groups.slice(middle))]};}return dockTree(groups,depth+1);}
  return {axis:segment.axis,ratio:segment.ratio??.5,children:[dockTree(left,depth+1),dockTree(right,depth+1)]};
}
export function normalizeDock(groups){
  const tree=dockTree(groups.filter(g=>g.dock!=='floating'&&g.dock!=='content')),routes=new Map();
  const visit=(node,path)=>{if(!node)return;if(node.group){routes.set(node.group.id,path);return;}node.children.forEach((child,side)=>visit(child,[...path,{axis:node.axis,side,ratio:node.ratio}]));};visit(tree,[]);
  return groups.map(g=>g.dock==='floating'?g:{...g,route:routes.get(g.id)??[]});
}
export function removeDockTab(groups,tab){return normalizeDock(groups.map(g=>{const tabs=g.tabs.filter(id=>id!==tab);return {...g,tabs,active:g.active===tab?tabs[0]:g.active};}).filter(g=>g.tabs.length));}
export function dockTab(groups,tab,target,index=Infinity){
  const destination=groups.find(g=>g.id===target);if(!destination||!groups.some(g=>g.tabs.includes(tab)))return groups;
  const next=removeDockTab(groups,tab),existing=next.find(g=>g.id===target);
  const tabs=[...(existing?.tabs??[])];tabs.splice(Math.max(0,Math.min(index,tabs.length)),0,tab);
  const group={...(existing??destination),tabs,active:tab};
  return existing?next.map(g=>g.id===target?group:g):[...next,group];
}
export function floatTab(groups,tab,position,newId){
  if(!groups.some(g=>g.tabs.includes(tab)))return groups;
  const owner=groups.find(g=>g.tabs.includes(tab));
  if(owner.dock==='floating'&&owner.tabs.length===1)return groups.map(g=>g===owner?{...g,position}:g);
  return [...removeDockTab(groups,tab),{id:newId,dock:'floating',tabs:[tab],active:tab,position}];
}
export function splitDockTab(groups,tab,target,edge,newId){
  const owner=groups.find(g=>g.tabs.includes(tab)),destination=groups.find(g=>g.id===target);
  if(!owner||!destination||destination.dock==='floating'||!['left','right','top','bottom'].includes(edge)||owner===destination&&owner.tabs.length===1)return groups;
  const next=removeDockTab(groups,tab),base=next.find(g=>g.id===target);if(!base)return groups;
  const side=['right','bottom'].includes(edge)?1:0,axis=['left','right'].includes(edge)?'horizontal':'vertical',route=base.route??[];
  return next.map(g=>g.id===target?{...g,route:[...route,{axis,side:1-side,ratio:.5}]}:g).concat({id:newId,dock:'split',route:[...route,{axis,side,ratio:.5}],tabs:[tab],active:tab});
}
export function dockSplitRatio(groups,path,ratio){
  if(!Number.isFinite(ratio))return groups;ratio=Math.max(.15,Math.min(.85,ratio));
  return groups.map(g=>{if(g.dock==='floating'||!g.route?.[path.length]||!path.every((p,i)=>g.route[i]?.side===p.side&&g.route[i]?.axis===p.axis))return g;return {...g,route:g.route.map((p,i)=>i===path.length?{...p,ratio}:p)};});
}
export function dockDropZone(rect,x,y){
  const u=(x-rect.x)/rect.width,v=(y-rect.y)/rect.height;
  const edges=[['left',u],['right',1-u],['top',v],['bottom',1-v]].sort((a,b)=>a[1]-b[1]);
  if(edges[0][1]>.28)return {kind:'merge',rect};
  const edge=edges[0][0],preview={...rect};if(edge==='left'||edge==='right'){preview.width/=2;if(edge==='right')preview.x+=preview.width;}else {preview.height/=2;if(edge==='bottom')preview.y+=preview.height;}
  return {kind:'split',edge,rect:preview};
}

export function moveDockGroup(groups,sourceId,drop,position,newId){
  const source=groups.find(g=>g.id===sourceId);if(!source||drop?.target===sourceId)return groups;
  if(!drop)return normalizeDock([...groups.filter(g=>g.id!==sourceId),{...source,id:source.dock==='floating'?source.id:newId,dock:'floating',position}]);
  if(drop.target==='empty-sidebar')return normalizeDock([...groups.filter(g=>g.id!==sourceId),{...source,id:newId,dock:'top',route:[],position:undefined}]);
  if(!groups.some(g=>g.id===drop.target))return groups;
  let next=groups,target=drop.target;
  source.tabs.forEach((tab,i)=>{if(i===0&&drop.kind==='split'){next=splitDockTab(next,tab,target,drop.edge,newId);target=newId;}else next=dockTab(next,tab,target);});
  return normalizeDock(next.map(g=>g.id===target?{...g,...(drop.kind==='split'?{gestureSwitch:source.gestureSwitch,gestureMode:source.gestureMode}:null),active:source.active}:g));
}

export function workspaceDockZone(rect,x,y){
  if(x<rect.x||y<rect.y||x>rect.x+rect.width||y>rect.y+rect.height)return null;
  const edges=[['left',x-rect.x],['right',rect.x+rect.width-x],['top',y-rect.y],['bottom',rect.y+rect.height-y]].sort((a,b)=>a[1]-b[1]);
  if(edges[0][1]>64)return null;
  const edge=edges[0][0],r={...rect};
  if(edge==='left'||edge==='right'){r.width=Math.min(400,rect.width*.38);if(edge==='right')r.x+=rect.width-r.width;}
  else {r.height=Math.min(330,rect.height*.4);if(edge==='bottom')r.y+=rect.height-r.height;}
  return {target:'empty-sidebar',kind:'restore',edge,rect:r};
}
export function dockToContent(groups,tabs,newId){
  const source=groups.find(g=>g.tabs.includes(tabs[0]));if(!source||!tabs.length)return groups;
  let next=groups;for(const tab of tabs)next=removeDockTab(next,tab);
  const target=next.find(g=>g.dock==='content'),active=tabs.includes(source.active)?source.active:tabs[0];
  return normalizeDock(target?next.map(g=>g.id===target.id?{...g,tabs:[...g.tabs,...tabs],active,autoHide:false}:g):[...next,{...source,id:newId,dock:'content',route:[],position:undefined,tabs:[...tabs],active,autoHide:false}]);
}
