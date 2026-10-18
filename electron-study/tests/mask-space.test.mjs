import test from 'node:test';import assert from 'node:assert/strict';
import {maskSpace,maskLocalTransform,maskRotation,changeMaskSpace,resizeMask} from '../src/mask-space.mjs';
import {multiply,transformPoint,identity} from '../src/scene-transform.mjs';
import {defaultGraph,setGraphParameter,validateGraph} from '../src/graph-model.mjs';
import {nodeDefaults} from '../src/generator-nodes.mjs';
const world=[0,2,-2,0,300,100];
test('global mask stays in document axes while local mask inherits affine owner transform',()=>{
 const p={x:10,y:20,width:100,height:60,rotation:0};
 assert.deepEqual(maskSpace({...p,coordinateSpace:'Global'},world),identity());
 assert.deepEqual(maskSpace({...p,coordinateSpace:'Local'},world),world);
 assert.deepEqual(multiply(world,maskLocalTransform({...p,coordinateSpace:'Global'},world)),identity());
 assert.deepEqual(multiply(world,maskLocalTransform({...p,coordinateSpace:'Local'},world)),world);
});
test('mask rotation holds center, space switching holds world center and removes legacy binding',()=>{
 const p={x:150,y:170,width:100,height:60,coordinateSpace:'Global',rotation:45},center={x:200,y:200};
 const rotated=transformPoint(maskRotation(p),center);assert.ok(Math.hypot(rotated.x-center.x,rotated.y-center.y)<1e-9);
 const next=changeMaskSpace({type:'RectangleMask',params:{...p,matrix:identity()}},'Local',world);
 assert.ok(!('matrix' in next.params));const q=transformPoint(world,{x:next.params.x+50,y:next.params.y+30});assert.deepEqual(q,center);
 const back=changeMaskSpace(next,'Global',world);assert.equal(back.params.x,150);assert.equal(back.params.y,170);
});
test('all mask sources expose validated space and rotation parameters',()=>{
 for(const type of ['RectangleMask','BitmapMask','Paint_Mask','ConvertToAlphaMask']){
  const graph=defaultGraph({});graph.nodes.push({id:'mask',type,x:100,y:100,params:nodeDefaults(type)});
  validateGraph(graph);let next=setGraphParameter(graph,'mask','rotation',30);next=setGraphParameter(next,'mask','coordinateSpace','Global');assert.equal(next.nodes.at(-1).params.rotation,30);validateGraph(next);
 }
});
test('shared rectangle resize bakes scale and keeps bitmap bounds proportional',()=>{
 const p={x:10,y:20,width:100,height:60,bounds:{x:20,y:30,width:50,height:20}},item={...p,sx:1,sy:1,rotation:0};const next=resizeMask(p,item,{x:15,sx:2});assert.equal(next.width,200);assert.deepEqual(next.bounds,{x:35,y:30,width:100,height:20});
});
