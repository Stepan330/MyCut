import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Tool,tools,toolById,shapeBox,strokePath} from '../src/tools.mjs';
import {bounds,updateItem,initialScene} from '../src/model.mjs';
test('text and shapes expose a shared outline group with distinct semantic icons',()=>{
  for(const id of ['text','shape']){const tool=toolById(id);for(const key of ['stroke','strokeWidth']){assert.ok(tool.primaryParameters.includes(key));assert.equal(tool.parameters.find(p=>p.id===key).group,'Outline');}assert.equal(tool.parameters.find(p=>p.id==='color').icon,'fill');assert.equal(tool.parameters.find(p=>p.id==='stroke').icon,'outline');assert.deepEqual(tool.patchFor({kind:id==='text'?'Text':'Shape'},'strokeWidth',8,{mode:'Edit'}),{strokeWidth:8});}
  assert.equal(toolById('text').defaults.strokeWidth,0);
});
test('all tools share metadata and behavior contract and have unique IDs/shortcuts',()=>{
  assert.equal(new Set(tools.map(t=>t.id)).size,tools.length);assert.equal(new Set(tools.filter(t=>t.shortcut).map(t=>t.shortcut)).size,tools.filter(t=>t.shortcut).length);
  for(const t of tools){assert.ok(t instanceof Tool);assert.ok(t.icon&&t.label&&t.hint);assert.equal(typeof t.begin,'function');assert.equal(typeof t.move,'function');assert.equal(typeof t.end,'function');}
});
test('tool descriptors validate control values instead of UI-specific constraints',()=>{
  const brush=toolById('brush');assert.equal(brush.validate('size',-20),1);assert.equal(brush.validate('size',Infinity),undefined);assert.equal(brush.validate('color','#123abc'),'#123abc');assert.equal(brush.validate('color','url(x)'),undefined);assert.equal(toolById('text').validate('fontFamily','unknown'),undefined);
});
test('shape creation normalizes reverse drag and Shift squares',()=>{
  assert.deepEqual(shapeBox({x:100,y:50},{x:30,y:80}),{x:30,y:50,width:70,height:30});assert.deepEqual(shapeBox({x:100,y:50},{x:30,y:80},true),{x:30,y:50,width:70,height:70});
});
test('single point strokes draw a round dot and multiple points form a path',()=>{
  assert.equal(strokePath([{x:2,y:3}]),'M2.00 3.00 l.01 0');assert.match(strokePath([{x:2,y:3},{x:4,y:5}]),/L4.00 5.00$/);
});
test('tool behavior dispatch uses the same descriptor as the generated UI',()=>{
  const calls=[],c={startStroke:p=>calls.push(p),extendStroke:p=>calls.push(p)};toolById('brush').begin(c,{x:1,y:2});toolById('brush').move(c,{x:3,y:4});assert.equal(calls.length,2);assert.equal(toolById('missing').id,'select');
});
test('intrinsic dimensions support text, shapes, strokes and imported images',()=>{
  assert.deepEqual(bounds({kind:'Text',width:300,height:220}),[300,220]);assert.deepEqual(bounds({kind:'Shape'}),[144,144]);const scene=initialScene();assert.equal(updateItem(scene,'title',{height:0}),scene);assert.equal(updateItem(scene,'title',{fontSize:NaN}),scene);
});
test('selected-object property binding belongs to the tool rather than UI branches',()=>{
  assert.equal(toolById('brush').patchFor({kind:'Drawing'},'size',30),null);
  assert.equal(toolById('shape').matches({kind:'Shape'},{mode:'Create'}),false);assert.equal(toolById('shape').matches({kind:'Shape'},{mode:'Edit'}),true);
  assert.equal(toolById('image').valueFor({kind:'Image',contrast:1.5},'contrast'),1.5);assert.equal(toolById('text').patchFor({kind:'Image'},'color','#123456'),null);
});
