import {expandedEdges} from './parameter-graph.mjs';
import {graphFor} from './graph-model.mjs';
import {compositionDomain} from './generator-domain.mjs';
import {graphTransform,maskLocalTransform,maskTypes} from './mask-space.mjs';
import {transformPoint} from './scene-transform.mjs';
const union=boxes=>{boxes=boxes.filter(Boolean);if(!boxes.length)return null;const x=Math.min(...boxes.map(b=>b.x)),y=Math.min(...boxes.map(b=>b.y));return {x,y,width:Math.max(...boxes.map(b=>b.x+b.width))-x,height:Math.max(...boxes.map(b=>b.y+b.height))-y};};
const intersect=(a,b)=>{if(!a||!b)return null;const x=Math.max(a.x,b.x),y=Math.max(a.y,b.y),right=Math.min(a.x+a.width,b.x+b.width),bottom=Math.min(a.y+a.height,b.y+b.height);return right>x&&bottom>y?{x,y,width:right-x,height:bottom-y}:null;};
const transformed=(box,matrix)=>{if(!box)return null;const p=[[0,0],[1,0],[0,1],[1,1]].map(([u,v])=>transformPoint(matrix,{x:box.x+box.width*u,y:box.y+box.height*v}));return union(p.map(p=>({...p,width:0,height:0})));};
export function graphCoverageBox(item,inputBox,world,sourceBox){
 const graph=graphFor(item);graph.edges=expandedEdges(graph);const cache=new Map(),nodes=new Map(graph.nodes.map(n=>[n.id,n]));
 const visit=id=>{if(cache.has(id))return cache.get(id);const n=nodes.get(id);if(!n)return null;const base=port=>visit(graph.edges.find(e=>e.to===id&&e.port===port)?.from);let box;
  if(n.enabled===false)box=base('base');else if(n.type==='Input')box=inputBox;
  else if(n.type==='Function')box=visit(n.output);
  else if(['Gradient','SolidColor'].includes(n.type))box=compositionDomain(world);
  else if(n.type==='RectangleMask')box={x:n.params?.x??0,y:n.params?.y??0,width:n.params?.width??300,height:n.params?.height??200};
  else if(n.type==='BitmapMask')box=n.params.bounds??{x:n.params.x??0,y:n.params.y??0,width:n.params.width,height:n.params.height};
  else if(['Paint_Mask','NodeInput'].includes(n.type))box=sourceBox(n);
  else if(['AlphaMultiply','Crop'].includes(n.type))box=intersect(base('base'),base('mask'));
  else if(n.type==='Transform')box=transformed(base('base'),graphTransform(n.params,world));
  else if(n.type==='Subtract')box=base('base');
  else box=union([base('base'),base('mask')]);
  if(n.enabled!==false&&maskTypes.includes(n.type))box=transformed(box,maskLocalTransform(n.params,world,item.width??960,item.height??600));cache.set(id,box);return box;
 };return visit('output');
}
