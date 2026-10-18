import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CanvasPick} from '../src/canvas-pick.mjs';
import {niceValue} from '../src/scrub-value.mjs';
import {ownBox} from '../src/content-bounds.mjs';
import {toolById} from '../src/tools.mjs';
test('scene picking walks ancestors first and retains child scope after dragging',()=>{
  const pick=new CanvasPick(),scene=[{id:'root'},{id:'parent',parentId:'root'},{id:'child',parentId:'parent'},{id:'other'}],p={x:20,y:30};
  assert.equal(pick.pick(scene,'child',p),'root');assert.equal(pick.pick(scene,'child',p),'parent');assert.equal(pick.pick(scene,'child',p),'child');assert.equal(pick.pick(scene,'child',p),'child');
  pick.moved({x:40,y:30});assert.equal(pick.pick(scene,'child',p),'child');assert.equal(pick.pick(scene,'child',{x:80,y:90}),'child');assert.equal(pick.pick(scene,'other',p),'other');assert.equal(pick.pick(scene,'child',p),'root');
});
test('explicit selected child remains editable away from the drill point; unrelated picks still start at root',()=>{
  const pick=new CanvasPick(),scene=[{id:'root'},{id:'child',parentId:'root'},{id:'sibling',parentId:'root'}],p={x:0,y:0};
  assert.equal(pick.pick(scene,'child',p,'child'),'child');pick.reset();assert.equal(pick.pick(scene,'child',{x:40,y:90},'child'),'child');
  assert.equal(pick.pick(scene,'sibling',p,'child'),'root');pick.reset();assert.equal(pick.pick(scene,'child',p,'root'),'root');assert.equal(pick.pick(scene,'child',p,'root'),'child');
});
test('automatic scrub rounding follows requested magnitudes',()=>{
  for(const [value,expected] of [[1.645,1.5],[25.123,25],[125,120],[1579,1500],[119.9999,120]])assert.equal(niceValue(value),expected);
});
test('paint on a Layer defines content bounds without a full-document rectangle',()=>{
  assert.deepEqual(ownBox({kind:'Layer',paint:[{size:10,points:[{x:20,y:30},{x:50,y:40}]}]}),{x:15,y:25,width:40,height:20});
});
test('shape create/edit is metadata; mode is not saved as an object property',()=>{
  const shape=toolById('shape'),item={kind:'Shape',shape:'rectangle'};
  assert.equal(shape.patchFor(item,'width',120,{mode:'Create'}),null);assert.deepEqual(shape.patchFor(item,'width',120,{mode:'Edit'}),{width:120});assert.equal(shape.patchFor(item,'mode','Create',{mode:'Edit'}),null);
});
