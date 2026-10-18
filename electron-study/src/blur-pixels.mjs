// Gaussian approximation with floating-point, premultiplied intermediates.
// No 8-bit intermediate passes, tiles or GPU downsampling seams.
function boxes(sigma){
 if(sigma<=0)return [1,1,1];
 let low=Math.floor(Math.sqrt(4*sigma*sigma+1));if(!(low%2))low--;
 const high=low+2,count=Math.round((12*sigma*sigma-3*low*low-12*low-9)/(-4*low-4));
 return Array.from({length:3},(_,i)=>i<count?low:high);
}
function pass(src,dst,w,h,r,horizontal){
 const length=horizontal?w:h,lines=horizontal?h:w,stride=horizontal?4:w*4,divisor=2*r+1;
 for(let line=0;line<lines;line++){
  const offset=horizontal?line*w*4:line*4,sums=[0,0,0,0];
  for(let p=0;p<=Math.min(r,length-1);p++)for(let c=0;c<4;c++)sums[c]+=src[offset+p*stride+c];
  for(let p=0;p<length;p++){
   const index=offset+p*stride;
   for(let c=0;c<4;c++)dst[index+c]=sums[c]/divisor;
   const remove=p-r,add=p+r+1;
   for(let c=0;c<4;c++){if(remove>=0)sums[c]-=src[offset+remove*stride+c];if(add<length)sums[c]+=src[offset+add*stride+c];}
  }
 }
}
export function blurPixels(pixels,w,h,sigmaX,sigmaY=sigmaX){
 let src=new Float32Array(pixels.length),dst=new Float32Array(pixels.length);
 for(let i=0;i<pixels.length;i+=4){const a=pixels[i+3]/255;src[i]=pixels[i]*a;src[i+1]=pixels[i+1]*a;src[i+2]=pixels[i+2]*a;src[i+3]=pixels[i+3];}
 const xs=boxes(sigmaX),ys=boxes(sigmaY);
 for(let i=0;i<3;i++)for(const [r,horizontal] of [[(xs[i]-1)/2,true],[(ys[i]-1)/2,false]]){
  if(!r)continue;pass(src,dst,w,h,r,horizontal);[src,dst]=[dst,src];
 }
 const result=new Uint8ClampedArray(pixels.length);
 for(let i=0;i<result.length;i+=4){
  const alpha=src[i+3];result[i+3]=Math.round(alpha);if(!result[i+3])continue;
  // Correlated, sub-LSB RGB dither removes visible contour bands without
  // creating alpha outside the signal or a periodic row/column seam.
  let hash=Math.imul((i/4)^0x45d9f3b,0x45d9f3b);hash=Math.imul(hash^(hash>>>16),0x45d9f3b);
  const noise=((hash^(hash>>>16))>>>0)/4294967296-.5;
  for(let c=0;c<3;c++)result[i+c]=src[i+c]*255/alpha+noise;
 }
 return result;
}
