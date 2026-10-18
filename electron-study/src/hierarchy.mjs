// Parent membership is model data, independent of the object's content type.
import {pruneDeletedSignals} from './prune-signals.mjs';
import {evaluateScene,identity,inverse,multiply} from './scene-transform.mjs';
const parentOf=item=>item.parentId??null;
export function subtreeIds(scene,id){
  const result=new Set();
  const visit=id=>{if(result.has(id))return;result.add(id);scene.filter(n=>parentOf(n)===id).forEach(n=>visit(n.id));};
  if(scene.some(n=>n.id===id))visit(id);return result;
}
export function orderedScene(scene){
  const result=[],seen=new Set();
  const visit=parent=>scene.filter(n=>parentOf(n)===parent).forEach(n=>{if(seen.has(n.id))return;seen.add(n.id);result.push(n);visit(n.id);});
  visit(null);return result;
}
export function effectiveState(scene,id,key){
  const map=new Map(scene.map(n=>[n.id,n])),seen=new Set();let item=map.get(id);
  while(item&&!seen.has(item.id)){seen.add(item.id);if(key==='locked'&&item.locked)return true;if(key==='visible'&&!item.visible)return false;item=map.get(parentOf(item));}
  return key==='visible';
}
export function canModify(scene,ids){
  return ids.length>0&&ids.every(id=>scene.some(n=>n.id===id)&&!effectiveState(scene,id,'locked')&&[...subtreeIds(scene,id)].every(child=>!effectiveState(scene,child,'locked')));
}
export function topSelection(scene,ids){
  const selected=new Set(ids);
  return orderedScene(scene).filter(n=>selected.has(n.id)&&!scene.some(p=>selected.has(p.id)&&p.id!==n.id&&subtreeIds(scene,p.id).has(n.id))).map(n=>n.id);
}
export function moveLayers(scene,ids,targetId,side){
  if(!['before','after','inside'].includes(side)||!canModify(scene,ids))return scene;
  const roots=topSelection(scene,ids),movingIds=new Set(roots.flatMap(id=>[...subtreeIds(scene,id)]));
  const target=scene.find(n=>n.id===targetId);
  if(!target||movingIds.has(targetId))return scene;
  const parent=side==='inside'?target.id:parentOf(target);
  if(parent&&(movingIds.has(parent)||effectiveState(scene,parent,'locked')))return scene;
  const evaluated=evaluateScene(scene),parentInverse=inverse(parent?evaluated.get(parent).world:identity());
  // A singular parent cannot preserve the child's world placement.
  if(!parentInverse)return scene;
  const ordered=orderedScene(scene),moving=ordered.filter(n=>movingIds.has(n.id)).map(n=>roots.includes(n.id)&&parentOf(n)!==parent?{...n,parentId:parent,parentOffset:multiply(parentInverse,evaluated.get(n.id).space)}:n);
  const rest=ordered.filter(n=>!movingIds.has(n.id));
  const afterIds=subtreeIds(rest,targetId);
  const index=side==='before'?rest.findIndex(n=>n.id===targetId):Math.max(...rest.map((n,i)=>afterIds.has(n.id)?i:-1))+1;
  rest.splice(index,0,...moving);
  return rest.length===scene.length&&rest.every((n,i)=>n===scene[i])?scene:rest;
}
export function createNode(scene,node,parentId=null){
  if(scene.some(n=>n.id===node.id)||!node.name.trim())return scene;
  const parent=scene.find(n=>n.id===parentId);
  if(parentId&&(!parent||effectiveState(scene,parentId,'locked')))return scene;
  const next=orderedScene(scene),index=parent?next.findIndex(n=>n.id===parentId)+1:0;
  next.splice(index,0,{...node,parentId});return next;
}
export function groupLayers(scene,ids,node){
  if(!canModify(scene,ids)||!['Folder','Layer'].includes(node.kind)||scene.some(n=>n.id===node.id))return scene;
  const roots=topSelection(scene,ids),members=roots.map(id=>scene.find(n=>n.id===id));
  const parent=members.every(n=>parentOf(n)===parentOf(members[0]))?parentOf(members[0]):null;
  const next=createNode(scene,node,parent);if(next===scene)return scene;
  // Preserve the first member's position among siblings when grouping.
  const folder=next.find(n=>n.id===node.id),without=next.filter(n=>n.id!==node.id);
  const first=without.findIndex(n=>n.id===roots[0]);
  if(parent===parentOf(members[0]))without.splice(first,0,folder);else without.unshift(folder);
  return moveLayers(without,roots,node.id,'inside');
}
export function deleteLayers(scene,ids){
  if(!canModify(scene,ids))return scene;
  const removed=new Set(ids.flatMap(id=>[...subtreeIds(scene,id)]));return scene.filter(n=>!removed.has(n.id)).map(n=>pruneDeletedSignals(n,removed));
}
export function treeRows(scene,query='',sort=null,collapsed=new Set()){
  const q=query.trim().toLowerCase(),matches=new Set();
  if(q){for(const n of scene)if(`${n.name} ${n.kind}`.toLowerCase().includes(q)){matches.add(n.id);let parent=parentOf(n);while(parent&&!matches.has(parent)){matches.add(parent);parent=parentOf(scene.find(n=>n.id===parent)||{});}}}
  const result=[],seen=new Set();
  const visit=(parent,depth)=>{
    const siblings=scene.filter(n=>parentOf(n)===parent&&(!q||matches.has(n.id)));
    if(sort)siblings.sort((a,b)=>(a[sort.key].localeCompare(b[sort.key])||a.id.localeCompare(b.id))*sort.direction);
    for(const item of siblings){if(seen.has(item.id))continue;seen.add(item.id);result.push({...item,depth});if(q||!collapsed.has(item.id))visit(item.id,depth+1);}
  };visit(null,0);return result;
}
export function rangeSelection(rows,anchor,id){const ids=rows.map(n=>n.id),a=ids.indexOf(anchor),b=ids.indexOf(id);return a<0||b<0?[id]:ids.slice(Math.min(a,b),Math.max(a,b)+1);}
export function renameLayer(scene,id,name){
  if(typeof name!=='string'||!canModify(scene,[id]))return scene;
  const trimmed=name.trim(),item=scene.find(n=>n.id===id);
  if(!trimmed||trimmed.length>100||item.name===trimmed)return scene;
  return scene.map(n=>n.id===id?{...n,name:trimmed}:n);
}
