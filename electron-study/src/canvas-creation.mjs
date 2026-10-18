import {createNode,effectiveState} from './hierarchy.mjs';
import {evaluateScene,inverse} from './scene-transform.mjs';
import {attachSignal} from './effect-graph.mjs';
import {arrangeGraph,graphFor,validateGraph} from './graph-model.mjs';
export function createCanvasObject(scene,node,selectedId){
 const selected=scene.find(n=>n.id===selectedId),parent=node.kind==='Shape'&&selected&&selected.kind!=='Background'&&!effectiveState(scene,selected.id,'locked')?selected:null;
 const offset=parent&&inverse(evaluateScene(scene).get(parent.id).world);if(parent&&!offset)throw Error('Cannot create a shape inside a zero-scale object');
 let next=createNode(scene,{...node,...(offset?{parentOffset:offset}:null)},parent?.id??null);if(next===scene)throw Error('Cannot create this object');
 if(parent){next=attachSignal(next,parent.id,node.id);const owner=next.find(n=>n.id===parent.id),graph=validateGraph(arrangeGraph(graphFor(owner),true));next=next.map(n=>n.id===owner.id?{...n,graph}:n);}
 const owner=parent&&next.find(n=>n.id===parent.id),source=owner&&graphFor(owner).nodes.find(n=>n.type==='NodeInput'&&n.sourceId===node.id);
 return {scene:next,node:next.find(n=>n.id===node.id),owner,source};
}
