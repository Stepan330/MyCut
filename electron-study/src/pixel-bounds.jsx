import {useEffect,useState} from 'react';
import {interactionSource} from './output-contract.mjs';
import {nodeImage} from './node-image.mjs';
import {inverse} from './scene-transform.mjs';
import {alphaBounds} from './alpha-bounds.mjs';
import {pixelBoundsKey,pixelFrameKey} from './pixel-bounds-key.mjs';
export function usePixelBounds(owner,world,displayNode='output',scene=[]){
 displayNode=interactionSource(owner,'geometry',displayNode);
 const [result,setResult]=useState(null);
 const key=pixelBoundsKey(owner,world,displayNode,scene),frameKey=pixelFrameKey(owner,world);
 useEffect(()=>{if(!owner?.graph)return;let stopped=false;const timer=setTimeout(async()=>{try{const src=await nodeImage(owner,displayNode??'output'),image=new Image();image.src=src;await image.decode();if(stopped)return;const matrix=inverse(world);if(!matrix)return;const canvas=document.createElement('canvas');canvas.width=960;canvas.height=600;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);const box=alphaBounds(ctx.getImageData(0,0,960,600).data,960,600,matrix);if(!stopped)setResult({key,frameKey,box});}catch{/* Retain the last measured frame until its replacement is ready. */}},80);return()=>{stopped=true;clearTimeout(timer);};},[key]);
 // UI-only edits never invalidate measured pixels. Signal changes retain their
 // previous frame while rendering; actual transform drags use fresh geometry.
 return owner?.graph&&result&&(result.key===key||result.frameKey===frameKey)?result:undefined;
}
