import {test} from 'node:test';
import assert from 'node:assert/strict';
import {labelGesture} from '../src/click-gesture.mjs';
const before={id:'folder',time:100,x:10,y:10};
const current={...before,time:750,detail:1,selected:true,folder:true};
test('slow second click on selected label proposes rename, never a lone click',()=>{
  assert.equal(labelGesture(before,current),'rename');assert.equal(labelGesture(null,current),'select');
  assert.equal(labelGesture(before,{...current,selected:false}),'select');
});
test('native fast double-click toggles only folders, regardless of elapsed time',()=>{
  assert.equal(labelGesture(before,{...current,detail:2}),'toggle');
  assert.equal(labelGesture(before,{...current,detail:2,folder:false}),'select');
});
test('rename needs same label, small movement and deliberate timing',()=>{
  for(const override of [{id:'other'},{x:16},{time:599},{time:1901}])assert.equal(labelGesture(before,{...current,...override}),'select');
});
test('modified and keyboard activation do not rename or collapse folders',()=>{
  for(const override of [{modified:true},{detail:0},{detail:2,modified:true}])assert.equal(labelGesture(before,{...current,...override}),'select');
});
