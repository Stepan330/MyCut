// Finite CPU adapter used only by Architecture Lab. It samples an immutable
// accumulated backdrop, never the current object's partially composited pixels.
export function sampleIndex(value,size,mode='Transparent'){
 if(!Number.isInteger(size)||size<1||!Number.isFinite(value))return -1;
 value=Math.floor(value);if(value>=0&&value<size)return value;
 if(mode==='Clamp')return Math.max(0,Math.min(size-1,value));
 if(mode==='Repeat')return (value%size+size)%size;
 if(mode==='Mirror'){const n=(value%(size*2)+size*2)%(size*2);return n<size?n:size*2-1-n;}
 return -1;
}
export function sampleBackdrop(pixels,width,height,region,{amount=0,direction=0,outside='Transparent'}={}){
 const {x,y,width:w,height:h}=region;if(![x,y,w,h,amount,direction].every(Number.isFinite)||!Number.isInteger(w)||!Number.isInteger(h)||w<=0||h<=0||w*h>4000000)throw Error('Finite sampling region exceeds budget');
 const output=new Uint8ClampedArray(w*h*4),angle=direction*Math.PI/180;
 for(let py=0;py<h;py++)for(let px=0;px<w;px++){
  const distance=amount*Math.sin((px/w-.5)*Math.PI),sx=x+px+Math.cos(angle)*distance,sy=y+py+Math.sin(angle)*distance,fx=Math.floor(sx),fy=Math.floor(sy),tx=sx-fx,ty=sy-fy,dst=(py*w+px)*4,rgba=[0,0,0,0];
  for(const [dx,dy,weight] of [[0,0,(1-tx)*(1-ty)],[1,0,tx*(1-ty)],[0,1,(1-tx)*ty],[1,1,tx*ty]]){const ix=sampleIndex(fx+dx,width,outside),iy=sampleIndex(fy+dy,height,outside);if(ix<0||iy<0)continue;const at=(iy*width+ix)*4,a=pixels[at+3]/255;for(let c=0;c<3;c++)rgba[c]+=pixels[at+c]*a*weight;rgba[3]+=a*weight;}
  output[dst+3]=rgba[3]*255;if(rgba[3])for(let c=0;c<3;c++)output[dst+c]=rgba[c]/rgba[3];
 }
 return output;
}
export function resizePrototypeCanvas(canvas,width,height,mode='Resize canvas',anchor='Center'){
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<320||width>960||height<240||height>720)throw Error('Canvas size outside prototype budget');
 const next=structuredClone(canvas),rx=width/canvas.width,ry=height/canvas.height;next.width=width;next.height=height;next.resizeMode=mode;next.anchor=anchor;
 if(mode==='Scale content'){next.transform={x:canvas.transform.x*rx,y:canvas.transform.y*ry,sx:canvas.transform.sx*rx,sy:canvas.transform.sy*ry};next.glass={...canvas.glass,x:canvas.glass.x*rx,y:canvas.glass.y*ry,width:canvas.glass.width*rx,height:canvas.glass.height*ry};}
 else if(mode==='Reflow'){next.transform={x:0,y:0,sx:1,sy:1};next.glass={...next.glass,x:width*.3,y:height*.25,width:width*.5,height:height*.5};}
 else if(anchor==='Center'){const dx=(width-canvas.width)/2,dy=(height-canvas.height)/2;next.transform={...next.transform,x:next.transform.x+dx,y:next.transform.y+dy};next.glass={...next.glass,x:next.glass.x+dx,y:next.glass.y+dy};}
 return next;
}
