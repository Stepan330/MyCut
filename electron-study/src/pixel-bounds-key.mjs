import {isDescendant} from './effect-graph.mjs';
const appearance=n=>({...n,graph:n.graph?{...n.graph,nodes:n.graph.nodes.map(({x,y,expanded,preview,...node})=>node)}:undefined});
export function pixelBoundsKey(owner,world,node='output',scene=[]){return owner?JSON.stringify({owner:appearance(owner),world,node:node??'output',children:scene.filter(n=>isDescendant(scene,n.id,owner.id)).map(appearance)}):null;}
export function pixelFrameKey(owner,world){return owner?JSON.stringify({id:owner.id,world,width:owner.width,height:owner.height,points:owner.points,endpoints:owner.endpoints,strokeWidth:owner.strokeWidth,lineWidth:owner.lineWidth,cornerRadius:owner.cornerRadius,shape:owner.shape}):null;}
