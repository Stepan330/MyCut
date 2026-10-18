import test from 'node:test';
import assert from 'node:assert/strict';
import {alphaHit} from '../src/pixel-pick.mjs';
test('pixel picking rejects transparent mask/filter regions but keeps faint blur',()=>{
 const alpha=new Uint8Array([0,1,128,255]);
 assert.equal(alphaHit(alpha,2,2,{x:.5,y:.5}),false);
 for(const p of [{x:1.5,y:.5},{x:.5,y:1.5},{x:1.5,y:1.5}])assert.equal(alphaHit(alpha,2,2,p),true);
 for(const p of [{x:-.1,y:0},{x:2,y:1},{x:1,y:2}])assert.equal(alphaHit(alpha,2,2,p),false);
});
