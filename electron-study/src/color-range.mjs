const rgb=color=>color.slice(1).match(/../g).map(v=>parseInt(v,16));
export function rangeForColor(color,tolerance=24){const c=rgb(color),hex=values=>'#'+values.map(v=>Math.round(Math.max(0,Math.min(255,v)))).map(v=>v.toString(16).padStart(2,'0')).join('');return {lowColor:hex(c.map(v=>v-tolerance)),highColor:hex(c.map(v=>v+tolerance))};}
export function colorRangePixels(data,width,height,params={}){
 const lo=rgb(params.lowColor??'#000000'),hi=rgb(params.highColor??'#ffffff'),excluded=(params.excludeColors??[]).map(rgb),fuzz=params.fuzziness??0,mask=new Uint8Array(width*height);
 const coverage=i=>{if(!data[i*4+3])return 0;const delta=Math.max(...lo.map((v,c)=>Math.max(Math.min(v,hi[c])-data[i*4+c],data[i*4+c]-Math.max(v,hi[c]),0)));let alpha=delta===0?255:fuzz>0?Math.round(255*Math.max(0,1-delta/fuzz)):0;for(const color of excluded){const distance=Math.max(...color.map((v,c)=>Math.abs(v-data[i*4+c])));alpha=Math.min(alpha,Math.round(255*Math.min(1,distance/Math.max(1,fuzz))));}return alpha;};
 if(params.mode!=='Connected'){for(let i=0;i<mask.length;i++)mask[i]=coverage(i);}
 else {const x=Math.floor(params.seedX??0),y=Math.floor(params.seedY??0);if(x>=0&&x<width&&y>=0&&y<height){const seen=new Uint8Array(mask.length),queue=new Int32Array(mask.length);let read=0,write=1;queue[0]=y*width+x;seen[queue[0]]=1;while(read<write){const i=queue[read++],alpha=coverage(i);if(!alpha)continue;mask[i]=alpha;const col=i%width;for(const n of [col?i-1:-1,col<width-1?i+1:-1,i-width,i+width])if(n>=0&&n<mask.length&&!seen[n]){seen[n]=1;queue[write++]=n;}}}}
 const result=new Uint8ClampedArray(data.length);for(let i=0;i<mask.length;i++){result[i*4]=result[i*4+1]=result[i*4+2]=255;result[i*4+3]=data[i*4+3]?params.invert?255-mask[i]:mask[i]:0;}return result;
}
