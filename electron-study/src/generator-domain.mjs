import {inverse,transformPoint} from './scene-transform.mjs';
export function compositionDomain(world,width=960,height=600){
 const inv=inverse(world);if(!inv)return {x:0,y:0,width,height};
 const points=[[0,0],[width,0],[0,height],[width,height]].map(([x,y])=>transformPoint(inv,{x,y})),xs=points.map(p=>p.x),ys=points.map(p=>p.y),x=Math.min(...xs),y=Math.min(...ys);
 return {x,y,width:Math.max(...xs)-x,height:Math.max(...ys)-y};
}
