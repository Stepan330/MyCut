import {graphForRole} from './output-contract.mjs';
import {imageGeneratorTypes} from './generator-nodes.mjs';
import {graphCoverageBox} from './graph-coverage.mjs';
import {compositionDomain} from './generator-domain.mjs';
import {maskLocalTransform,graphTransform} from './mask-space.mjs';
import {shapePoints} from './vector-shapes.mjs';
import {bounds,evaluateScene,inverse,multiply,transformPoint,localMatrix} from './scene-transform.mjs';
import {brushExtent} from './brush-engine.mjs';
import {positiveGraphSources} from './graph-model.mjs';
import {isDescendant} from './effect-graph.mjs';
export function ownBox(node,world=multiply(node.parentOffset??[1,0,0,1,0,0],localMatrix(node))){
  const boxes=[],positive=node.graph?positiveGraphSources(node):null;
  const strokeBox=(points,size)=>{if(!points?.length)return;const r=size/2,xs=points.map(p=>p.x),ys=points.map(p=>p.y),x=Math.min(...xs)-r,y=Math.min(...ys)-r;boxes.push({x,y,width:Math.max(...xs)+r-x,height:Math.max(...ys)+r-y});};
  if(!positive||positive.has('input')){if(node.kind==='Drawing')strokeBox(node.points,brushExtent(node.brushSize??1,node.brush)*2);
    else if(!['Folder','Layer'].includes(node.kind)){const [width,height]=bounds(node);if(node.kind==='Shape'&&node.shape&&!['rectangle','ellipse','heart','callout'].includes(node.shape)){const pts=shapePoints(node,width,height),xs=pts.map(p=>p.x),ys=pts.map(p=>p.y),x=Math.min(...xs),y=Math.min(...ys);boxes.push({x,y,width:Math.max(.001,Math.max(...xs)-x),height:Math.max(.001,Math.max(...ys)-y)});}else boxes.push(node.cropRect??{x:0,y:0,width,height});}}
  if(node.graph?.nodes.some(n=>positive?.has(n.id)&&['RectangleMask','BitmapMask'].includes(n.type))){const [width,height]=bounds(node);boxes.push({x:0,y:0,width,height});}
  if(node.graph?.nodes.some(n=>positive?.has(n.id)&&imageGeneratorTypes.includes(n.type)))boxes.push(compositionDomain(world));
  for(const channel of ['paint','erasures'])for(const [index,stroke] of (node[channel]??[]).entries()){if(stroke.enabled===false||positive&&!positive.has(`${channel}-${index}`)||!positive&&channel==='erasures')continue;strokeBox(stroke.points,brushExtent(stroke.size,stroke.brush)*2);for(const segment of stroke.segments??[])if(!segment.erase)strokeBox(segment.points,brushExtent(segment.size,segment.brush)*2);}
  if(!boxes.length)return null;const x=Math.min(...boxes.map(b=>b.x)),y=Math.min(...boxes.map(b=>b.y));
  let result={x,y,width:Math.max(...boxes.map(b=>b.x+b.width))-x,height:Math.max(...boxes.map(b=>b.y+b.height))-y};
  if(node.graph?.nodes.some(n=>imageGeneratorTypes.includes(n.type))){const input=ownBox({...node,graph:undefined,paint:[],erasures:[],nodeInputs:[]},world);return graphCoverageBox(node,input,world,n=>n.type==='Paint_Mask'?ownBox({kind:'Layer',paint:[node[n.channel]?.[n.index]].filter(Boolean)},world):input??result);}
  let clip=node.cropRect;const graph=node.graph,output=graph?.edges.find(e=>e.to==='output'&&e.port==='base'),last=graph?.nodes.find(n=>n.id===output?.from);if(last?.enabled!==false&&last?.type==='Transform'){const points=corners(result).map(p=>transformPoint(graphTransform(last.params,world),p)),xs=points.map(p=>p.x),ys=points.map(p=>p.y);result={x:Math.min(...xs),y:Math.min(...ys),width:Math.max(...xs)-Math.min(...xs),height:Math.max(...ys)-Math.min(...ys)};}if(last?.enabled!==false&&['Crop','AlphaMultiply'].includes(last?.type)){const mask=graph.nodes.find(n=>n.id===graph.edges.find(e=>e.to===last.id&&e.port==='mask')?.from);if(mask?.enabled!==false){if(mask?.type==='BitmapMask'&&mask.params.bounds||mask?.type==='RectangleMask'){const p=mask.params,box=mask.type==='BitmapMask'?p.bounds:p,[w,h]=bounds(node),matrix=maskLocalTransform(p,world,w,h),points=corners(box).map(q=>transformPoint(matrix,q)),xs=points.map(q=>q.x),ys=points.map(q=>q.y);clip={x:Math.min(...xs),y:Math.min(...ys),width:Math.max(...xs)-Math.min(...xs),height:Math.max(...ys)-Math.min(...ys)};}}}
  if(clip){const c=clip,left=Math.max(result.x,c.x),top=Math.max(result.y,c.y),right=Math.min(result.x+result.width,c.x+c.width),bottom=Math.min(result.y+result.height,c.y+c.height);return right>left&&bottom>top?{x:left,y:top,width:right-left,height:bottom-top}:null;}return result;
}
export function corners(box){return [[0,0],[1,0],[0,1],[1,1]].map(([u,v])=>({x:box.x+box.width*u,y:box.y+box.height*v}));}
export function selectionBoxes(scene,evaluated=evaluateScene(scene)){
  const signalRoots=new Set(scene.flatMap(n=>(n.nodeInputs??[]).filter(s=>isDescendant(scene,s.sourceId,n.id)).map(s=>s.sourceId)));
  const children=new Map();for(const n of scene){const list=children.get(n.parentId)??[];list.push(n);children.set(n.parentId,list);}
  const result=new Map();
  function visit(node){
    if(result.has(node.id))return result.get(node.id);
    const geometryNode=node.graph?{...node,graph:graphForRole(node.graph,'geometry')}:node,own=ownBox(geometryNode,evaluated.get(node.id).world),points=own?corners(own):[],inv=inverse(evaluated.get(node.id).world);
    if(inv){const positive=geometryNode.graph?positiveGraphSources(geometryNode):null,signals=(node.nodeInputs??[]).filter((s,i)=>s.enabled!==false&&(positive?positive.has(`signal-${i}`):s.operation!=='Subtract')&&isDescendant(scene,s.sourceId,node.id)).map(s=>scene.find(n=>n.id===s.sourceId));
      for(const child of [...(children.get(node.id)??[]).filter(n=>!signalRoots.has(n.id)),...signals]){if(!child||child.visible===false)continue;const box=visit(child);if(box){const relative=multiply(inv,evaluated.get(child.id).world);points.push(...corners(box).map(p=>transformPoint(relative,p)));}}}
    const xs=points.map(p=>p.x),ys=points.map(p=>p.y),x=Math.min(...xs),y=Math.min(...ys);
    const box=points.length?{x,y,width:Math.max(.001,Math.max(...xs)-x),height:Math.max(.001,Math.max(...ys)-y)}:null;
    result.set(node.id,box);return box;
  }
  scene.forEach(visit);return result;
}
