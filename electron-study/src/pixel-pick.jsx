import {useEffect,useRef} from 'react';
import {nodeImage} from './node-image.mjs';
import {pixelBoundsKey} from './pixel-bounds-key.mjs';
import {inverse,transformPoint} from './scene-transform.mjs';
import {bounds} from './model.mjs';
import {alphaHit} from './pixel-pick.mjs';

// SVG hit testing ignores mask/filter transparency. Cache final branch alpha,
// not transient fade ghosts or the generator's unmasked resource rectangle.
export function usePixelPick(items,evaluated,previewOwner,previewNode){
 const cache=useRef(new Map());
 const entries=items.filter(n=>n.graph||n.kind==='Image'&&n.src).map(owner=>{
  const node=owner.id===previewOwner?previewNode??'output':'output';
  return {owner,node,key:pixelBoundsKey(owner,evaluated.get(owner.id)?.world,node,items)};
 });
 const signature=JSON.stringify(entries.map(e=>[e.owner.id,e.key]));
 useEffect(()=>{
  let stopped=false;
  const ids=new Set(entries.map(e=>e.owner.id));for(const id of cache.current.keys())if(!ids.has(id))cache.current.delete(id);
  const timer=setTimeout(()=>{for(const {owner,node,key} of entries){
   if(cache.current.get(owner.id)?.key===key)continue;
   (async()=>{try{
    const image=new Image();image.src=await nodeImage(owner,node);await image.decode();if(stopped)return;
    const canvas=document.createElement('canvas');canvas.width=960;canvas.height=600;
    const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);
    const pixels=ctx.getImageData(0,0,960,600).data,alpha=new Uint8Array(960*600);
    for(let i=0;i<alpha.length;i++)alpha[i]=pixels[i*4+3];
    if(!stopped)cache.current.set(owner.id,{key,alpha});
   }catch{/* Use source geometry until an accurate sample becomes available. */}})();
  }},60);
  return()=>{stopped=true;clearTimeout(timer);};
 },[signature]);
 return (id,point)=>{
  const owner=items.find(n=>n.id===id),state=evaluated.get(id);
  if(!owner||state?.opacity===0)return false;
  const entry=entries.find(e=>e.owner.id===id);if(!entry)return true;
  const sample=cache.current.get(id);
  if(sample?.key===entry.key)return alphaHit(sample.alpha,960,600,point);
  // Never let a pending full-composition filter rectangle steal all canvas clicks.
  const inv=state?.world&&inverse(state.world);if(!inv)return false;
  const p=transformPoint(inv,point),[w,h]=bounds(owner);
  return p.x>=0&&p.y>=0&&p.x<=w&&p.y<=h;
 };
}
