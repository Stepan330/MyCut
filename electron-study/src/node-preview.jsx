import React,{useEffect,useState} from 'react';
import {nodeImage} from './node-image.mjs';
export function NodePreview({owner,node,revision}){
 const [src,setSrc]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(true),[generation,setGeneration]=useState(0);
 useEffect(()=>{let stopped=false;const render=async()=>{setBusy(true);try{const result=await nodeImage(owner,node.id);if(!stopped){setSrc(result);setError('');setGeneration(v=>v+1);}}catch(e){if(!stopped)setError(e.message);}finally{if(!stopped)setBusy(false);}};const timer=setTimeout(render,100);return()=>{stopped=true;clearTimeout(timer);};},[owner,revision,node.id]);
 return <figure className="node-result-preview" aria-label={`Result of ${node.type} ${node.id}`} data-preview-generation={generation} aria-busy={busy}>{src&&<img src={src} alt={`${node.type} result`}/>}<figcaption>{error|| (busy?'Updating…':'Node result · RGBA')}</figcaption></figure>;
}
