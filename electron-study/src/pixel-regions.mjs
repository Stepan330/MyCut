// Masks use one byte per pixel. Matching includes alpha to separate transparent pixels.
export function colorRegion(data,width,height,x,y,tolerance=24,connected=true){
  const mask=new Uint8Array(width*height);x=Math.floor(x);y=Math.floor(y);if(x<0||y<0||x>=width||y>=height)return mask;
  const seed=(y*width+x)*4,color=Array.from(data.slice(seed,seed+4)),matches=i=>color.every((v,c)=>Math.abs(v-data[i*4+c])<=tolerance);
  if(!connected){for(let i=0;i<mask.length;i++)if(matches(i))mask[i]=255;return mask;}
  const queue=new Int32Array(mask.length),seen=new Uint8Array(mask.length);let read=0,write=0;queue[write++]=y*width+x;seen[y*width+x]=1;
  while(read<write){const i=queue[read++];if(!matches(i))continue;mask[i]=255;const col=i%width;for(const n of [col?i-1:-1,col<width-1?i+1:-1,i-width,i+width])if(n>=0&&n<mask.length&&!seen[n]){seen[n]=1;queue[write++]=n;}}
  return mask;
}
export function combineMasks(previous,next,mode='Replace'){
  if(!previous||mode==='Replace')return next.slice();
  return next.map((v,i)=>mode==='Add'?Math.max(v,previous[i]):mode==='Subtract'?Math.max(0,previous[i]-v):Math.min(v,previous[i]));
}
export function rectangleMask(width,height,a,b){const mask=new Uint8Array(width*height),x1=Math.max(0,Math.floor(Math.min(a.x,b.x))),x2=Math.min(width,Math.ceil(Math.max(a.x,b.x))),y1=Math.max(0,Math.floor(Math.min(a.y,b.y))),y2=Math.min(height,Math.ceil(Math.max(a.y,b.y)));for(let y=y1;y<y2;y++)mask.fill(255,y*width+x1,y*width+x2);return mask;}
