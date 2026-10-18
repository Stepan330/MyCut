import test from 'node:test';
import assert from 'node:assert/strict';
import {shapeOutlinePatch} from '../src/shape-outline.mjs';
const item={kind:'Shape',shape:'rectangle',width:100,height:100,sx:1,sy:1,strokeWidth:10},world=[1,0,0,1,0,0];
test('whole shape scaling binds outline once, including nonuniform transforms',()=>{
 const first=shapeOutlinePatch(item,{sx:2,sy:3},world);
 assert.deepEqual(first.outlineBasis,[1,1]);
 const next={...item,...first};
 assert.deepEqual(shapeOutlinePatch(next,{sx:4},[2,0,0,3,0,0]).outlineBasis,[1,1]);
 assert.deepEqual(shapeOutlinePatch(item,{width:200,height:50},world).outlineBasis,[.5,2]);
});
test('shape tool retains outline thickness while whole object mode scales it',()=>{
 assert.equal(shapeOutlinePatch(item,{sx:2},world,false).outlineBasis,undefined);
 assert.deepEqual(shapeOutlinePatch({...item,outlineBasis:[1,1]},{sx:2,sy:.5},world,false).outlineBasis,[2,.5]);
 assert.deepEqual(shapeOutlinePatch({...item,outlineBasis:[1,1]},{strokeWidth:15},[2,0,0,3,0,0]).outlineBasis,[2,3]);
});
