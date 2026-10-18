export const retouchTools=[
  {id:'blurBrush',label:'Blur brush',icon:'blur'},
  {id:'sharpenBrush',label:'Sharpen brush',icon:'sharpen'},
  {id:'smudge',label:'Smudge',icon:'smudge'},
  {id:'dodge',label:'Dodge',icon:'dodge'},
  {id:'burn',label:'Burn',icon:'burn'},
  {id:'sponge',label:'Sponge',icon:'sponge'},
  {id:'clone',label:'Clone stamp',icon:'clone'},
  {id:'heal',label:'Healing brush',icon:'heal'},
  {id:'liquify',label:'Liquify',icon:'liquify'}
];
// Separable box blur, with premultiplied color so transparent edges don't darken.
export function blurPixels(data,w,h,radius){
  const r=Math.max(1,Math.min(30,Math.round(radius))),tmp=new Float32Array(data.length),out=new Uint8ClampedArray(data.length);
  for(let y=0;y<h;y++)for(let c=0;c<4;c++){let sum=0;const value=x=>{const i=(y*w+Math.max(0,Math.min(w-1,x)))*4;return c===3?data[i+3]:data[i+c]*data[i+3]/255;};for(let x=-r;x<=r;x++)sum+=value(x);for(let x=0;x<w;x++){tmp[(y*w+x)*4+c]=sum/(2*r+1);sum+=value(x+r+1)-value(x-r);}}
  for(let x=0;x<w;x++)for(let c=0;c<4;c++){let sum=0;const value=y=>tmp[(Math.max(0,Math.min(h-1,y))*w+x)*4+c];for(let y=-r;y<=r;y++)sum+=value(y);for(let y=0;y<h;y++){out[(y*w+x)*4+c]=sum/(2*r+1);sum+=value(y+r+1)-value(y-r);}}
  for(let i=0;i<out.length;i+=4)if(out[i+3])for(let c=0;c<3;c++)out[i+c]=out[i+c]*255/out[i+3];return out;
}
export function retouchPixels(data,w,h,path,{id,size=60,strength=.5,mode='Desaturate',source,selection}={}){
  if(!path.length)return data.slice();const r=Math.max(1,size/2),coverage=new Float32Array(w*h),dx=new Float32Array(w*h),dy=new Float32Array(w*h),first=path[0];
  const safePath=path.map(p=>({x:Math.max(-r,Math.min(w+r,p.x)),y:Math.max(-r,Math.min(h+r,p.y))}));
  let previous=safePath[0];
  for(const point of safePath){const distance=Math.hypot(point.x-previous.x,point.y-previous.y),steps=Math.max(1,Math.ceil(distance/Math.max(1,r/3)));for(let s=0;s<=steps;s++){
    const x=previous.x+(point.x-previous.x)*s/steps,y=previous.y+(point.y-previous.y)*s/steps;
    for(let yy=Math.max(0,Math.floor(y-r));yy<Math.min(h,y+r+1);yy++)for(let xx=Math.max(0,Math.floor(x-r));xx<Math.min(w,x+r+1);xx++){
      const i=yy*w+xx,d=Math.hypot(xx+.5-x,yy+.5-y)/r,t=Math.max(0,1-d*d)*strength*(selection?selection[i]/255:1);if(t>coverage[i]){coverage[i]=t;dx[i]=point.x-previous.x;dy[i]=point.y-previous.y;}
    }
  }previous=point;}
  const result=data.slice(),soft=['blurBrush','sharpenBrush','heal'].includes(id)?blurPixels(data,w,h,Math.min(15,r/4)):null;
  const sample=(x,y,c)=>data[(Math.max(0,Math.min(h-1,Math.round(y)))*w+Math.max(0,Math.min(w-1,Math.round(x))))*4+c];
  const offset=source?{x:source.x-first.x,y:source.y-first.y}:{x:0,y:0};
  for(let i=0;i<coverage.length;i++){const t=coverage[i];if(!t)continue;const x=i%w,y=Math.floor(i/w),k=i*4,luma=.2126*data[k]+.7152*data[k+1]+.0722*data[k+2];
    for(let c=0;c<4;c++){const value=data[k+c];let target=value;
      if(id==='blurBrush')target=soft[k+c];
      if(id==='sharpenBrush'&&c<3)target=Math.max(0,Math.min(255,2*value-soft[k+c]));
      if(id==='dodge'&&c<3)target=value+(255-value)*.65;
      if(id==='burn'&&c<3)target=value*.35;
      if(id==='sponge'&&c<3)target=mode==='Saturate'?luma+(value-luma)*2:luma;
      if(id==='clone'||id==='heal'){target=sample(x+offset.x,y+offset.y,c);if(id==='heal'&&c<3){const sx=Math.max(0,Math.min(w-1,Math.round(x+offset.x))),sy=Math.max(0,Math.min(h-1,Math.round(y+offset.y)));target=Math.max(0,Math.min(255,target+soft[k+c]-soft[(sy*w+sx)*4+c]));}}
      if(id==='smudge')target=sample(first.x,first.y,c);
      if(id==='liquify')target=sample(x-dx[i]*2,y-dy[i]*2,c);
      result[k+c]=value+(target-value)*t;
    }
  }return result;
}
