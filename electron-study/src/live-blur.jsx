import React,{useEffect,useRef,useState} from 'react';
import {layerPng} from './project-assets.jsx';
import {inverse,transformPoint} from './scene-transform.mjs';
import {blurPixels} from './blur-pixels.mjs';
export function LiveBlur({owner,node,base,world,rect,signature,dependencies,sourceOwners=[],children}){
 const [render,setRender]=useState(null),[busy,setBusy]=useState(true),[error,setError]=useState(''),[revision,setRevision]=useState(0),generation=useRef(0);
 useEffect(()=>{const rendered=e=>{if(e.detail.owner===owner&&dependencies.includes(e.detail.id)||sourceOwners.includes(e.detail.owner))setRevision(v=>v+1);};window.addEventListener('mycut-effect-rendered',rendered);return()=>window.removeEventListener('mycut-effect-rendered',rendered);},[signature]);
 useEffect(()=>{
  let stopped=false;setBusy(true);setError('');
  if(!base){setRender(null);setBusy(false);return;}
  const timer=setTimeout(()=>{(async()=>{try{
   
   const p=node.params??{},sx=node.type==='Blur'?p.radius??5:p.x??12,sy=node.type==='Blur'?sx:p.y??0;
   const box={x:rect.x-4*sx-2,y:rect.y-4*sy-2,width:rect.width+8*sx+4,height:rect.height+8*sy+4};
   const corners=[[0,0],[1,0],[0,1],[1,1]].map(([u,v])=>transformPoint(world,{x:box.x+u*box.width,y:box.y+v*box.height}));
   const region={x:Math.floor(Math.min(...corners.map(p=>p.x))),y:Math.floor(Math.min(...corners.map(p=>p.y)))};
   region.width=Math.ceil(Math.max(...corners.map(p=>p.x)))-region.x;region.height=Math.ceil(Math.max(...corners.map(p=>p.y)))-region.y;
   const svg=document.querySelector('.artboard>svg'),png=await layerPng(svg,new Set([owner]),{opaqueLayer:true,outputFrom:base,world,waitForEffects:false,region}),image=new Image();image.src=png;await image.decode();if(stopped)return;
   const ratio=Math.min(1,2048/box.width,2048/box.height),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.ceil(box.width*ratio));canvas.height=Math.max(1,Math.ceil(box.height*ratio));
   const ctx=canvas.getContext('2d',{willReadFrequently:true}),inv=inverse(world);if(!inv)throw Error('Cannot blur a singular transform');
   ctx.setTransform(inv[0]*ratio,inv[1]*ratio,inv[2]*ratio,inv[3]*ratio,(inv[4]-box.x)*ratio,(inv[5]-box.y)*ratio);
   ctx.drawImage(image,region.x,region.y,region.width,region.height);ctx.resetTransform();
   const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);
   const result=blurPixels(pixels.data,canvas.width,canvas.height,sx*ratio,sy*ratio);ctx.putImageData(new ImageData(result,canvas.width,canvas.height),0,0);
   if(!stopped){generation.current++;setRender({box,src:canvas.toDataURL()});setBusy(false);requestAnimationFrame(()=>window.dispatchEvent(new CustomEvent('mycut-effect-rendered',{detail:{owner,id:node.id}})));}
  }catch(e){if(!stopped){setError(e.message);setBusy(false);}}})();},24);
  return()=>{stopped=true;clearTimeout(timer);};
 },[signature,revision]);
 return <g data-filter-node={node.type} data-live-blur={node.id} data-live-generation={generation.current} data-live-busy={busy} data-live-error={error}>{render?<image {...render.box} href={render.src} preserveAspectRatio="none"/>:children}</g>;
}
