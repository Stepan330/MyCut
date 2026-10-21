import React,{useEffect,useState} from 'react';
import {scheduleRaster} from './raster-scheduler.mjs';
import {stoneMaterialGraph} from './stone-material.mjs';
import {evaluationContext} from './engine-runtime.mjs';
export function StoneSurface({runtime,params,graph=stoneMaterialGraph(params),color='#655b4c',enabled}){
 const [image,setImage]=useState(null),key=JSON.stringify([graph,color]);
 useEffect(()=>{if(!enabled)return;let y=0;const width=256,height=168,pixels=new Uint8ClampedArray(width*height*4),sample=runtime.compile(graph,'height'),tint=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)),context=evaluationContext({mode:'interface'}),at=(x,y)=>sample({...context,position:{x,y}});
  return scheduleRaster(()=>{for(const end=Math.min(height,y+3);y<end;y++)for(let x=0;x<width;x++){const v=at(x,y),dx=at(x+1,y)-v,dy=at(x,y+1)-v,light=Math.max(-.5,Math.min(.5,(-dx-dy)*3.2)),shade=49+v*52+light*38,i=(y*width+x)*4;pixels[i]=(shade+5)*tint[0]/101;pixels[i+1]=(shade+3)*tint[1]/91;pixels[i+2]=(shade-4)*tint[2]/76;pixels[i+3]=255;}if(y<height)return false;const c=document.createElement('canvas');c.width=width;c.height=height;c.getContext('2d').putImageData(new ImageData(pixels,width,height),0,0);setImage({src:c.toDataURL('image/png'),key});return true;},{priority:0});
 },[key,enabled,runtime]);
 return enabled&&image?<img className="stone-surface" data-stone-surface data-material-seed={params.seed} data-ready={image.key===key} src={image.src} alt=""/>:null;
}
