export function alphaBounds(pixels,width,height,matrix=[1,0,0,1,0,0]){
 const [a,b,c,d,e,f]=matrix,dx0=Math.min(0,a)+Math.min(0,c),dx1=Math.max(0,a)+Math.max(0,c),dy0=Math.min(0,b)+Math.min(0,d),dy1=Math.max(0,b)+Math.max(0,d);let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(pixels[(y*width+x)*4+3]>0){const px=a*x+c*y+e,py=b*x+d*y+f;left=Math.min(left,px+dx0);right=Math.max(right,px+dx1);top=Math.min(top,py+dy0);bottom=Math.max(bottom,py+dy1);}
 return left===Infinity?null:{x:left,y:top,width:right-left,height:bottom-top};
}
