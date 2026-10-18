import test from 'node:test';
import assert from 'node:assert/strict';
import {blurPixels} from '../src/blur-pixels.mjs';
test('blur is continuous across rows and preserves premultiplied colour at transparent edges',()=>{
 const w=101,h=101,p=new Uint8ClampedArray(w*h*4);
 for(let y=40;y<61;y++)for(let x=40;x<61;x++)p.set([50,100,200,255],(y*w+x)*4);
 const out=blurPixels(p,w,h,8);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const i=(y*w+x)*4;
  assert.equal(out[i+3],out[((h-1-y)*w+x)*4+3],'no row seam');
  assert.equal(out[i+3],out[(y*w+w-1-x)*4+3],'no column seam');
  if(out[i+3])for(let c=0;c<3;c++)assert.ok(Math.abs(out[i+c]-[50,100,200][c])<=1,'no dark/coloured halo');
 }
 assert.ok(out[(50*w+30)*4+3]>0,'signal expands beyond original bounds');
 assert.equal(out[3],0,'fully transparent pixels stay empty');
});
test('zero radius and directional blur do not introduce unintended spread',()=>{
 const p=new Uint8ClampedArray(25*4);p.set([255,0,0,128],12*4);
 const out=blurPixels(p,5,5,1,0);
 assert.ok(out[11*4+3]>0);assert.equal(out[7*4+3],0);
 assert.deepEqual(blurPixels(p,5,5,0),p);
});
