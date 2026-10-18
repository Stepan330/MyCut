import {test} from 'node:test';
import assert from 'node:assert/strict';
import {effectNodes,attachSignal,signalSources} from '../src/effect-graph.mjs';
import {toolById,toolParameterGroups} from '../src/tools.mjs';
import {ownBox} from '../src/content-bounds.mjs';
import {readImageFile} from '../src/image-import.mjs';
import {groupLayers} from '../src/hierarchy.mjs';
import {copyObjects,pasteObjects,duplicateObjects} from '../src/editor-commands.mjs';
test('copy/paste and duplicate remap NodeInput references to copied descendants',()=>{
  const scene=[{id:'owner',kind:'Layer',name:'Owner',nodeInputs:[{sourceId:'child',operation:'Add'}]},{id:'child',kind:'Shape',name:'Child',parentId:'owner'}];let id=0;const newId=()=>`copy-${++id}`;
  for(const next of [pasteObjects(scene,copyObjects(scene,['owner']),{newId}),duplicateObjects(scene,['owner'],{newId})]){const owner=next.scene.find(n=>n.id===next.ids[0]),child=next.scene.find(n=>n.parentId===owner.id);assert.equal(owner.nodeInputs[0].sourceId,child.id);assert.notEqual(child.id,'child');assert.equal(scene[0].nodeInputs[0].sourceId,'child');}
});
test('Move to new layer uses same world-preserving grouping contract as folders',()=>{
  const node={id:'child',kind:'Shape',name:'Child',x:12,y:15,sx:1,sy:1,rotation:0,opacity:1};const next=groupLayers([node],['child'],{id:'layer',kind:'Layer',name:'New layer',x:0,y:0,sx:1,sy:1,rotation:0,opacity:1});assert.equal(next.length,2);assert.equal(next.find(n=>n.id==='child').parentId,'layer');assert.equal(next.find(n=>n.id==='child').x,12);
});
test('shape toolbar prioritizes paint and outline, dimensions are secondary, radius validates',()=>{
  const tool=toolById('shape');assert.deepEqual(tool.primaryParameters,['mode','shape','color','lineWidth','stroke','strokeWidth']);assert.ok(toolParameterGroups(tool,true).some(g=>g.parameters.some(p=>p.id==='cornerRadius')));assert.equal(tool.validate('cornerRadius',-1),0);assert.equal(tool.validate('cornerRadius',NaN),undefined);
});
test('text modes and types use the common tool property binding contract',()=>{
  const tool=toolById('text');assert.equal(tool.matches({kind:'Text'},{mode:'Create'}),false);assert.equal(tool.matches({kind:'Text'},{mode:'Edit'}),true);assert.equal(tool.validate('textType','Paragraph'),'Paragraph');assert.equal(tool.validate('fontWeight','700'),'700');assert.equal(tool.patchFor({kind:'Text'},'mode','Create',{mode:'Edit'}),null);
});
test('graph starts with input/output and derives additive and subtractive paint masks',()=>{
  assert.deepEqual(effectNodes({}).map(n=>n.type),['Input','Output']);assert.deepEqual(effectNodes({paint:[{}],erasures:[{}]}).map(n=>n.type),['Input','Add','Paint_Mask','Subtract','Paint_Mask','Output']);
});
test('NodeInput accepts descendants only, rejects duplicate, missing, self and cyclic sources',()=>{
  const scene=[{id:'a'},{id:'b',parentId:'a'},{id:'c',parentId:'b'},{id:'other'}];const next=attachSignal(scene,'a','b');assert.notEqual(next,scene);assert.deepEqual([...signalSources(next)],['b','c']);assert.equal(attachSignal(next,'a','b'),next);for(const [a,b] of [['a','a'],['a','other'],['b','a'],['a','missing']])assert.equal(attachSignal(scene,a,b),scene);assert.equal(scene[0].nodeInputs,undefined);
});
test('editable mask segments expand content bounds, erased segments do not enlarge bounds',()=>{
  const node={kind:'Layer',paint:[{points:[{x:5,y:5}],size:10,segments:[{points:[{x:30,y:5}],size:10},{points:[{x:200,y:0}],size:10,erase:true}]}]};assert.equal(ownBox(node).width,35);
});
test('unsupported and oversize files are rejected before decoding or reading',async()=>{
  await assert.rejects(readImageFile({type:'text/html',size:1}),/PNG/);await assert.rejects(readImageFile({type:'image/png',size:26*1024*1024}),/25 MB/);
});
