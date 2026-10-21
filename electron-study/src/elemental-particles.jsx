import React,{useEffect,useRef} from 'react';
import {evaluationContext} from './engine-runtime.mjs';
import {stepElementalParticle,particleOpacity} from './elemental-materials.mjs';
import {particleDensity,contactDustDensity} from './particle-noise.mjs';
// Bounded atlas: rasterize noise once, never for every particle on every frame.
const atlas=new Map(),budget=900;
function noiseSprite(p){
 const field=p.material==='contact-dust-field',mist=p.material==='condensation-mist',variant=Math.abs(Math.round(p.seed*19))%12,seed=variant*997+31,b=p.sourceBody,key=[p.material,variant,field?b.width:0,field?b.height:0].join(':');
 if(atlas.has(key))return atlas.get(key);
 const width=field?Math.ceil((b.width+96)/3):64,height=field?Math.ceil((b.height+96)/3):64,c=document.createElement('canvas');c.width=width;c.height=height;const ctx=c.getContext('2d'),pixels=ctx.createImageData(width,height),color=mist?[186,211,227]:[184,162,140];
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){const alpha=field?contactDustDensity((x+.5-width/2)*3,(y+.5-height/2)*3,b,seed):particleDensity((x+.5)/width*2-1,(y+.5)/height*2-1,seed),i=(y*width+x)*4;pixels.data[i]=color[0];pixels.data[i+1]=color[1];pixels.data[i+2]=color[2];pixels.data[i+3]=Math.round(alpha*255);}
 ctx.putImageData(pixels,0,0);atlas.set(key,c);while(atlas.size>36)atlas.delete(atlas.keys().next().value);return c;
}
function draw(ctx,p){
 const alpha=particleOpacity(p);ctx.save();ctx.globalAlpha=alpha;ctx.translate(p.x,p.y);if(p.material==='water-droplet'&&p.z>1){ctx.save();ctx.globalAlpha=alpha*.18;ctx.filter=`blur(${2+p.z*.15}px)`;ctx.fillStyle='#000';ctx.beginPath();ctx.arc(0,0,p.size*(1+p.z*.012),0,Math.PI*2);ctx.fill();ctx.restore();}
 if(p.material==='stone-chip'){ctx.rotate(p.rotation);ctx.fillStyle='#9c8973';ctx.beginPath();ctx.moveTo(-p.size,-p.size*.5);ctx.lineTo(p.size*.5,-p.size);ctx.lineTo(p.size,p.size*.5);ctx.lineTo(-p.size*.4,p.size);ctx.closePath();ctx.fill();}
 else if(p.material==='contact-dust-field'){const b=p.sourceBody,image=noiseSprite(p),spread=1+p.age*.06;ctx.scale(spread,spread);ctx.drawImage(image,-(b.width+96)/2,-(b.height+96)/2,b.width+96,b.height+96);}
 else if(p.material==='stone-dust'){ctx.rotate(p.rotation);ctx.drawImage(noiseSprite(p),-p.size*1.35,-p.size,p.size*2.7,p.size*2);}
 else if(p.material==='water-ripple'){ctx.strokeStyle='#a8ecff';ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(0,0,p.size,p.size,0,0,Math.PI*2);ctx.stroke();}
 else if(p.material==='water-droplet'){ctx.rotate(Math.atan2(p.vy,p.vx));ctx.fillStyle='#69d2ec';ctx.beginPath();ctx.ellipse(0,0,p.size*(1+Math.min(1.5,Math.hypot(p.vx,p.vy)/140)),p.size*.7,0,0,Math.PI*2);ctx.fill();ctx.fillStyle='#d6f9ff';ctx.beginPath();ctx.arc(-p.size*.3,-p.size*.2,p.size*.28,0,Math.PI*2);ctx.fill();}
 else if(p.material==='condensation-mist'){ctx.rotate(p.rotation+Math.sin(p.age+p.seed)*.12);ctx.drawImage(noiseSprite(p),-p.size*1.4,-p.size,p.size*2.8,p.size*2);}
 else if(p.material==='hot-ember'){ctx.globalCompositeOperation='lighter';ctx.shadowColor='#ff6a1a';ctx.shadowBlur=8;ctx.strokeStyle=p.age/p.lifetime<.3?'#fff3bd':'#ff9641';ctx.lineWidth=p.size;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(-p.vx*.025,-p.vy*.025);ctx.stroke();}
 ctx.restore();
}
export function ElementalParticles({events,enabled,runtime,body}){
 const canvas=useRef(),particles=useRef([]),seen=useRef(0),occluder=useRef(body);occluder.current=body;
 useEffect(()=>{if(events?.id&&events.id!==seen.current){seen.current=events.id;if(canvas.current){canvas.current.dataset.lastCause=events.kind;canvas.current.dataset.lastElevation=events.body?.elevation??0;}if(enabled)particles.current=[...particles.current,...runtime.evaluate({nodes:[{id:'emission',type:'MaterialEmission',params:{element:events.element,kind:events.kind,seed:Math.round(events.id),velocityZ:events.velocity?.z??0},inputs:{origin:{x:events.x,y:events.y},body:events.body,velocity:{x:events.velocity?.x??0,y:events.velocity?.y??0}}}],edges:[]},'emission',evaluationContext({mode:'interface'}))].slice(-budget);}},[events,enabled,runtime]);
 useEffect(()=>{let frame,last=performance.now();const tick=now=>{const dt=Math.max(0,Math.min(.05,(now-last)/1000));last=now;const node=canvas.current,ctx=node.getContext('2d');ctx.clearRect(0,0,680,400);particles.current=enabled?particles.current.map(p=>stepElementalParticle(p,dt)).filter(p=>p.age<p.lifetime):[];for(const p of particles.current){ctx.save();const b=occluder.current;if(p.element==='earth'&&p.emissionRegion!=='surface'&&b){ctx.beginPath();ctx.rect(0,0,680,400);ctx.rect(b.x,b.y,b.width,b.height);ctx.clip('evenodd');}draw(ctx,p);ctx.restore();}node.dataset.particles=particles.current.length;node.dataset.surfaceParticles=particles.current.filter(p=>p.element==='earth'&&p.emissionRegion==='surface').length;node.dataset.gravityAxis='z';node.dataset.densityModel='area-perimeter';node.dataset.noise='fractal-worley';node.dataset.budget=budget;node.dataset.materials=[...new Set(particles.current.map(p=>p.material))].join(',');node.dataset.elements=[...new Set(particles.current.map(p=>p.element))].join(',');frame=requestAnimationFrame(tick);};frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame);},[enabled]);
 return <canvas ref={canvas} width="680" height="400" className="living-particles" aria-hidden="true"/>;
}
