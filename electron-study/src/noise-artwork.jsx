import React,{useEffect,useState} from 'react';
import {scheduleRaster} from './raster-scheduler.mjs';
import {noiseRow} from './procedural-noise.mjs';
// Cooperative raster budget shared by every noise generator, not N expensive
// independent frame callbacks. Captures wait for the existing live-busy contract.
export function NoiseArtwork({node,region}){
 const [result,setResult]=useState(null),[error,setError]=useState(''),key=JSON.stringify([node.type,node.params,region]);
 useEffect(()=>{setError('');let y=0;const width=Math.max(1,Math.min(1024,Math.ceil(region.width))),height=Math.max(1,Math.min(768,Math.ceil(region.height))),pixels=new Uint8ClampedArray(width*height*4);return scheduleRaster(()=>{for(let end=Math.min(height,y+4);y<end;y++)noiseRow(node.type,node.params??{},region,width,height,y,pixels);if(y<height)return false;const c=document.createElement('canvas');c.width=width;c.height=height;c.getContext('2d').putImageData(new ImageData(pixels,width,height),0,0);setResult({key,src:c.toDataURL('image/png')});return true;},{onError:error=>setError(error.message)});},[key]);
 return <g data-noise-generator={node.type} data-live-busy={!error&&result?.key!==key?'true':'false'} data-live-error={error||undefined}>{result&&<image {...region} href={result.src} preserveAspectRatio="none"/>}</g>;
}
