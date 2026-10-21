// Session-only editing depth. It is deliberately not document data or keyboard focus.
export function editContexts({selected,graphOpen,graphNode,contentEditing}){
 return [selected&&{kind:'object',id:selected},graphOpen&&{kind:'graph'},graphNode&&{kind:'node',id:graphNode.id},contentEditing&&{kind:'content',id:selected}].filter(Boolean);
}
export function unwindContext(contexts){return contexts.length?{removed:contexts.at(-1),remaining:contexts.slice(0,-1)}:{removed:null,remaining:[]};}
export function shouldUnwind(contexts,{hit,selected,insideHandle=false,creating=false,modified=false}){
 if(creating||modified||insideHandle||hit===selected)return false;
 return contexts.some(c=>['content','node','graph'].includes(c.kind));
}
export function marqueeIds(scene,boxes,evaluated,start,end,{touch=end.x<start.x}={}){
 const left=Math.min(start.x,end.x),right=Math.max(start.x,end.x),top=Math.min(start.y,end.y),bottom=Math.max(start.y,end.y);
 const nodes=new Map(scene.map(n=>[n.id,n]));
 return scene.filter(n=>{let parent=nodes.get(n.parentId),seen=new Set();while(parent&&!seen.has(parent.id)){seen.add(parent.id);if(parent.selectionDepthLocked)return false;parent=nodes.get(parent.parentId);}const b=boxes.get(n.id),m=evaluated.get(n.id)?.world;if(!b||!m||n.visible===false||n.locked||n.kind==='Background')return false;const points=[[b.x,b.y],[b.x+b.width,b.y],[b.x,b.y+b.height],[b.x+b.width,b.y+b.height]].map(([x,y])=>({x:m[0]*x+m[2]*y+m[4],y:m[1]*x+m[3]*y+m[5]}));const x0=Math.min(...points.map(p=>p.x)),x1=Math.max(...points.map(p=>p.x)),y0=Math.min(...points.map(p=>p.y)),y1=Math.max(...points.map(p=>p.y));return touch?x1>=left&&x0<=right&&y1>=top&&y0<=bottom:x0>=left&&x1<=right&&y0>=top&&y1<=bottom;}).map(n=>n.id);
}
