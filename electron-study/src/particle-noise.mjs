import {sampleNoise} from './procedural-noise.mjs';

// The same deterministic kernels as Noise2D. Density is a spatial field, not
// fresh per-frame random dots. The adapter can cache this field as a sprite.
export function particleNoise(x,y,seed=1){
 const broad=sampleNoise('FractalNoise',x,y,{seed,scale:24,octaves:3,roughness:.62});
 const pores=sampleNoise('WorleyNoise',x,y,{seed:seed+71,scale:11});
 return Math.max(0,Math.min(1,(broad*.78+pores*.22-.19)*1.65));
}
export function particleDensity(x,y,seed=1){
 const radius=Math.hypot(x,y);if(radius>=1)return 0;
 return (1-radius*radius)**1.7*particleNoise(x*54,y*54,seed);
}
export function contactDustDensity(x,y,body,seed=1){
 const dx=Math.abs(x)-body.width/2,dy=Math.abs(y)-body.height/2;
 const outside=Math.hypot(Math.max(0,dx),Math.max(0,dy)),inside=Math.min(Math.max(dx,dy),0),distance=outside+inside;
 return Math.exp(-(((distance-5)/18)**2))*particleNoise(x,y,seed);
}
export function particleFlow(x,y,seconds,seed=1){
 // Slowly advected coherent fields; adjacent particles share the air current.
 return {x:(sampleNoise('PerlinNoise',x+seconds*13,y-seconds*5,{seed,scale:64})-.5)*16,y:(sampleNoise('PerlinNoise',x+seconds*7,y+seconds*11,{seed:seed+101,scale:64})-.5)*16};
}
