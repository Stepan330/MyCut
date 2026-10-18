import test from 'node:test';
import assert from 'node:assert/strict';
import {pixelBoundsKey,pixelFrameKey} from '../src/pixel-bounds-key.mjs';
const world=[1,0,0,1,30,40],owner={id:'photo',x:30,y:40,width:200,height:100,graph:{version:1,nodes:[{id:'blur',type:'Blur',x:20,y:30,params:{radius:10}}],edges:[]}};
test('graph card UI never invalidates measured pixel bounds',()=>{
 const next=structuredClone(owner);Object.assign(next.graph.nodes[0],{x:400,y:500,expanded:true,preview:true});
 assert.equal(pixelBoundsKey(owner,world),pixelBoundsKey(next,world));
});
test('signal changes remeasure but keep previous frame until ready',()=>{
 const next=structuredClone(owner);next.graph.nodes[0].params.radius=40;
 assert.notEqual(pixelBoundsKey(owner,world),pixelBoundsKey(next,world));
 assert.equal(pixelFrameKey(owner,world),pixelFrameKey(next,world));
 assert.notEqual(pixelBoundsKey(owner,world,'blur'),pixelBoundsKey(owner,world,'output'));
});
test('actual source geometry changes must not reuse a stale frame',()=>{
 assert.notEqual(pixelFrameKey(owner,world),pixelFrameKey({...owner,width:400},world));
 assert.notEqual(pixelFrameKey(owner,world),pixelFrameKey(owner,[1,0,0,1,40,40]));
 assert.equal(pixelBoundsKey(null),null);assert.equal(pixelFrameKey(null),null);
});
