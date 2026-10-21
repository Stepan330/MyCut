// Deterministic scalar fields. The same functions feed image generator nodes,
// UI material graphs and diffuse force fields; no frame-random texture flicker.
export const noiseTypes=['ValueNoise','PerlinNoise','WorleyNoise','FractalNoise'];
const smooth=t=>t*t*t*(t*(t*6-15)+10),mix=(a,b,t)=>a+(b-a)*t,clamp=v=>Math.max(0,Math.min(1,v));
export function hash2(x,y,seed=1){let h=Math.imul(x|0,374761393)^Math.imul(y|0,668265263)^Math.imul(seed|0,1442695041);h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967296;}
function value(x,y,seed){const ix=Math.floor(x),iy=Math.floor(y),u=smooth(x-ix),v=smooth(y-iy);return mix(mix(hash2(ix,iy,seed),hash2(ix+1,iy,seed),u),mix(hash2(ix,iy+1,seed),hash2(ix+1,iy+1,seed),u),v);}
function perlin(x,y,seed){const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,u=smooth(fx),v=smooth(fy),dot=(dx,dy)=>{const angle=hash2(ix+dx,iy+dy,seed)*Math.PI*2;return Math.cos(angle)*(fx-dx)+Math.sin(angle)*(fy-dy);};return clamp(.5+mix(mix(dot(0,0),dot(1,0),u),mix(dot(0,1),dot(1,1),u),v)*.7);}
function worley(x,y,seed){const ix=Math.floor(x),iy=Math.floor(y);let distance=2;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const px=ix+dx+hash2(ix+dx,iy+dy,seed),py=iy+dy+hash2(ix+dx,iy+dy,seed+109);distance=Math.min(distance,Math.hypot(x-px,y-py));}return clamp(distance/1.1);}
export function sampleNoise(type,x,y,{seed=1,scale=48,octaves=4,roughness=.5,contrast=1}={}){
 if(!noiseTypes.includes(type)||![x,y,seed,scale,octaves,roughness,contrast].every(Number.isFinite)||scale<=0||octaves<1||octaves>8||roughness<0||roughness>1||contrast<0||contrast>8)throw Error('Invalid procedural noise');
 x/=scale;y/=scale;let result;
 if(type==='ValueNoise')result=value(x,y,seed);else if(type==='PerlinNoise')result=perlin(x,y,seed);else if(type==='WorleyNoise')result=worley(x,y,seed);
 else{let sum=0,weight=0,amplitude=1;for(let i=0;i<Math.floor(octaves);i++){sum+=perlin(x,y,seed+i*37)*amplitude;weight+=amplitude;x*=2.03;y*=2.03;amplitude*=roughness;}result=sum/weight;}
 return clamp((result-.5)*contrast+.5);
}
export function noiseRow(type,params,region,width,height,y,target){for(let x=0;x<width;x++){const v=Math.round(sampleNoise(type,region.x+(x+.5)*region.width/width,region.y+(y+.5)*region.height/height,params)*255),i=(y*width+x)*4;target[i]=target[i+1]=target[i+2]=v;target[i+3]=255;}}
