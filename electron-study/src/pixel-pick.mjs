// Exactly transparent pixels are empty; even alpha=1 is still visible signal.
export function alphaHit(alpha,width,height,{x,y}){
 const px=Math.floor(x),py=Math.floor(y);
 return px>=0&&py>=0&&px<width&&py<height&&alpha[py*width+px]>0;
}
