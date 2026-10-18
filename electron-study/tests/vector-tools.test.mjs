import {test} from 'node:test';
import assert from 'node:assert/strict';
import {extraShapeTools,vectorShapePath,shapePoints,moveShapeControl} from '../src/vector-shapes.mjs';
import {toolById,toolForObject,isShapeTool} from '../src/tools.mjs';
import {encodeProject,decodeProject} from '../src/project-file.mjs';
test('ten forms belong to one Shapes tool with Create/Edit and outline',()=>{
  assert.equal(extraShapeTools.length,10);
  const items=extraShapeTools.map((spec,i)=>{const tool=toolById('shape'),item={id:'item-'+i,name:spec.label,kind:'Shape',shape:spec.id,x:10,y:10,sx:1,sy:1,rotation:0,width:100,height:80};assert.ok(isShapeTool(tool));assert.equal(toolForObject(item).id,'shape');assert.equal(tool.matches(item,{mode:'Create'}),false);assert.equal(tool.matches(item,{mode:'Edit'}),true);assert.equal(toolById('shape').matches(item,{mode:'Edit'}),true);assert.deepEqual(tool.patchFor(item,'strokeWidth',8,{mode:'Edit'}),{strokeWidth:8});for(const key of ['mode','color','stroke','strokeWidth'])assert.ok(tool.primaryParameters.includes(key));return item;});
  assert.deepEqual(decodeProject(encodeProject({items,assets:[]})).items,items);
});
test('vector geometry is finite, directional and parameterized',()=>{
  for(const spec of extraShapeTools){const d=vectorShapePath({shape:spec.id},150,100);assert.ok(d.startsWith('M'));assert.ok(!/NaN|Infinity/.test(d));}
  assert.notEqual(vectorShapePath({shape:'line'},100,80),vectorShapePath({shape:'line',drawReverseX:true},100,80));
  assert.notEqual(vectorShapePath({shape:'star',sides:5},100,80),vectorShapePath({shape:'star',sides:7},100,80));
  assert.notEqual(vectorShapePath({shape:'star',innerRadius:.3},100,80),vectorShapePath({shape:'star',innerRadius:.7},100,80));
});
