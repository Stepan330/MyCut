import {graphFor,arrangeGraph,validateGraph} from './graph-model.mjs';
export function effectForTool(item,tool,targetId){const nodes=item?.graph?.nodes??[],type=({gradient:'Gradient',crop:'RectangleMask',fill:'SolidColor'})[tool]??'RasterEffect',matches=n=>n.type===type&&(type!=='RasterEffect'||n.params.tool===tool);let chosen=nodes.find(n=>n.id===targetId);if(tool==='crop'&&chosen?.type==='Crop')chosen=nodes.find(n=>n.id===item.graph.edges.find(e=>e.to===targetId&&e.port==='mask')?.from);return chosen&&matches(chosen)?chosen:[...nodes].reverse().find(matches);}
export function fillNodes(item,targetId){const graph=item?.graph;if(!graph)return {};const target=graph.nodes.find(n=>n.id===targetId);let color=target?.type==='SolidColor'?target:null,range=target?.type==='ColorRange'?target:null;for(const op of [...graph.nodes].reverse().filter(n=>n.type==='AlphaMultiply')){const c=graph.nodes.find(n=>n.id===graph.edges.find(e=>e.to===op.id&&e.port==='base')?.from),r=graph.nodes.find(n=>n.id===graph.edges.find(e=>e.to===op.id&&e.port==='mask')?.from);if(c?.type==='SolidColor'&&r?.type==='ColorRange'&&(!target||c===target||r===target)){color=c;range=r;break;}}return {color,range};}
export const lastEffect=(item,type)=>[...(item?.graph?.nodes??[])].reverse().find(n=>n.type===type);
export function appendEffect(item,nodes,edges,{output=nodes.at(-1).id}={}){
 const graph=graphFor(item),base=graph.edges.find(e=>e.to==='output'&&e.port==='base')?.from??'input';
 const bottom=Math.max(0,...graph.nodes.map(n=>n.y+400));const placed=arrangeGraph({nodes,edges:edges.filter(e=>e.from!=='$base')}).nodes.map(n=>({...n,y:n.y+bottom}));
 return validateGraph(arrangeGraph({...graph,nodes:[...graph.nodes,...placed],edges:[...graph.edges.filter(e=>e.to!=='output'||e.port!=='base'),...edges.map(e=>({...e,from:e.from==='$base'?base:e.from})),{from:output,to:'output',port:'base'}]},true));
}
export function createGradient(item,params,{empty=false}={}){
 const id=crypto.randomUUID(),mask=crypto.randomUUID(),multiply=crypto.randomUUID(),nodes=[{id,type:'Gradient',x:0,y:0,params}];
 if(empty)return appendEffect(item,nodes,[]);
 nodes.push({id:mask,type:'ConvertToAlphaMask',x:0,y:0},{id:multiply,type:'AlphaMultiply',x:0,y:0});
 return appendEffect(item,nodes,[{from:'$base',to:mask,port:'base'},{from:id,to:multiply,port:'base'},{from:mask,to:multiply,port:'mask'}]);
}
// Clipboard input stays intact; the independent mask remains editable/removable.
export function createSelectionGraph(clip){const item=clip.source??{kind:'Image'},existing=new Set(graphFor(item).nodes.map(n=>n.id)),mask=existing.has('selection-mask')?crypto.randomUUID():'selection-mask',op=existing.has('selection-clip')?crypto.randomUUID():'selection-clip';return appendEffect(item,[{id:mask,type:'BitmapMask',x:0,y:0,params:{src:clip.mask,width:clip.width,height:clip.height,...(clip.bounds?{bounds:clip.bounds}:null)}},{id:op,type:'AlphaMultiply',x:0,y:0}],[{from:'$base',to:op,port:'base'},{from:mask,to:op,port:'mask'}]);}
export function createCrop(item,params){const mask=crypto.randomUUID(),id=crypto.randomUUID();return appendEffect(item,[{id:mask,type:'RectangleMask',x:0,y:0,params},{id,type:'Crop',x:0,y:0}],[{from:'$base',to:id,port:'base'},{from:mask,to:id,port:'mask'}]);}
