import {test} from 'node:test';
import assert from 'node:assert/strict';
import {menuSections} from '../src/menu-model.mjs';
const actions=[{label:'Delete',group:'manage',priority:90,enabled:true},{label:'Folder',group:'create',priority:20,enabled:true},{label:'Rename',group:'object',priority:20,enabled:false},{label:'Edit',group:'object',priority:10,enabled:true},{label:'Layer',group:'create',priority:10,enabled:true},{label:'Move',group:'hierarchy',priority:10,enabled:true}];
test('object commands lead, destructive actions are separate and last',()=>{
  const sections=menuSections(actions);assert.deepEqual(sections.map(s=>s.id),['object','hierarchy','create','manage']);
  assert.deepEqual(sections[0].actions.map(a=>a.label),['Edit','Rename']);assert.deepEqual(sections[2].actions.map(a=>a.label),['Layer','Folder']);
});
test('empty/root context prioritizes creation without losing disabled commands',()=>{
  const sections=menuSections(actions,{creationContext:true});assert.equal(sections[0].id,'create');
  assert.equal(sections.flatMap(s=>s.actions).length,actions.length);assert.equal(sections.find(s=>s.id==='object').actions[1].enabled,false);
});
test('grouping does not mutate descriptors or invent unavailable functionality',()=>{
  const before=structuredClone(actions);menuSections(actions);assert.deepEqual(actions,before);assert.deepEqual(menuSections([]),[]);
});
