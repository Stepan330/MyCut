import {canModify,effectiveState,orderedScene,subtreeIds,topSelection} from './hierarchy.mjs';
import {evaluateScene,identity,inverse,transformPoint} from './scene-transform.mjs';
import {shortcutKey} from './keyboard.mjs';
export const commandSpecs=[
  {id:'undo',label:'Undo',shortcut:'Ctrl+Z',icon:'undo'},
  {id:'redo',label:'Redo',shortcut:'Ctrl+Shift+Z',icon:'redo'},
  {id:'cut',label:'Cut',shortcut:'Ctrl+X',icon:'cut'},
  {id:'copy',label:'Copy',shortcut:'Ctrl+C',icon:'copy'},
  {id:'paste',label:'Paste',shortcut:'Ctrl+V',icon:'paste'},
  {id:'duplicate',label:'Duplicate',shortcut:'Ctrl+D',icon:'copy'},
  {id:'delete',label:'Delete',shortcut:'Delete',icon:'delete'},
  {id:'selectAll',label:'Select all',shortcut:'Ctrl+A',icon:'pointer'},
];
export function commandForKey(e){
  const key=shortcutKey(e),mod=e.ctrlKey||e.metaKey;if(e.altKey)return null;
  if(!mod)return key==='delete'||key==='backspace'?'delete':null;
  if(key==='z')return e.shiftKey?'redo':'undo';if(key==='y')return 'redo';
  return ({c:'copy',v:'paste',x:'cut',d:'duplicate',a:'selectAll'})[key]??null;
}
export function copyObjects(scene,ids){
  const roots=topSelection(scene,ids);if(!roots.length)return null;
  const selected=new Set(roots.flatMap(id=>[...subtreeIds(scene,id)])),evaluated=evaluateScene(scene);
  const nodes=structuredClone(orderedScene(scene).filter(n=>selected.has(n.id)));
  for(const node of nodes)if(roots.includes(node.id)){node.parentId=null;node.parentOffset=[...evaluated.get(node.id).space];node.opacity=evaluated.get(node.id).opacity;node.visible=effectiveState(scene,node.id,'visible');node.locked=effectiveState(scene,node.id,'locked');}
  return {version:1,roots,nodes};
}
export function pasteObjects(scene,snapshot,{offset=20,newId=()=>crypto.randomUUID()}={}){
  if(!snapshot||snapshot.version!==1||!snapshot.roots.length)return {scene,ids:[]};
  const nodes=structuredClone(snapshot.nodes),ids=new Map(nodes.map(n=>[n.id,newId()]));
  for(const node of nodes){const old=node.id;node.id=ids.get(old);if(node.nodeInputs)node.nodeInputs=node.nodeInputs.filter(s=>ids.has(s.sourceId)).map(s=>({...s,sourceId:ids.get(s.sourceId)}));if(snapshot.roots.includes(old)){
    node.parentId=null;node.name+=' copy';const inv=inverse(node.parentOffset??identity());
    if(inv){const a=transformPoint(inv,{x:0,y:0}),b=transformPoint(inv,{x:offset,y:offset});node.x=(node.x??0)+b.x-a.x;node.y=(node.y??0)+b.y-a.y;}
  }else node.parentId=ids.get(node.parentId);}
  return {scene:[...nodes,...scene],ids:snapshot.roots.map(id=>ids.get(id))};
}
export function commandAllowed(id,scene,ids,{clipboard=null,history={past:[],future:[]}}={}){
  if(id==='undo')return history.past.length>0;if(id==='redo')return history.future.length>0;
  if(id==='paste')return !!clipboard;if(id==='selectAll')return scene.length>0;
  if(id==='copy')return topSelection(scene,ids).length>0;
  if(id==='duplicate'){const roots=topSelection(scene,ids);return roots.length>0&&roots.every(id=>{const parent=scene.find(n=>n.id===id)?.parentId;return !parent||!effectiveState(scene,parent,'locked');});}
  return canModify(scene,ids);
}
export function duplicateObjects(scene,selection,{offset=20,newId=()=>crypto.randomUUID()}={}){
  if(!commandAllowed('duplicate',scene,selection))return {scene,ids:[]};
  const roots=topSelection(scene,selection),included=new Set(roots.flatMap(id=>[...subtreeIds(scene,id)]));
  const nodes=structuredClone(orderedScene(scene).filter(n=>included.has(n.id))),ids=new Map(nodes.map(n=>[n.id,newId()])),evaluated=evaluateScene(scene);
  for(const node of nodes){const old=node.id;node.id=ids.get(old);
    if(node.nodeInputs)node.nodeInputs=node.nodeInputs.filter(s=>ids.has(s.sourceId)).map(s=>({...s,sourceId:ids.get(s.sourceId)}));
    if(roots.includes(old)){
      node.name+=' copy';const inv=inverse(evaluated.get(old).space);
      if(inv){const a=transformPoint(inv,{x:0,y:0}),b=transformPoint(inv,{x:offset,y:offset});node.x=(node.x??0)+b.x-a.x;node.y=(node.y??0)+b.y-a.y;}
    }else node.parentId=ids.get(node.parentId);
  }
  return {scene:[...nodes,...scene],ids:roots.map(id=>ids.get(id))};
}
