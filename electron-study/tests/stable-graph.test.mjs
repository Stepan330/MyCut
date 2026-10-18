import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultGraph,addGraphOperation,validateGraph} from '../src/graph-model.mjs';
import {createCrop,createSelectionGraph} from '../src/tool-effects.mjs';
import {inverse,multiply} from '../src/scene-transform.mjs';
import {ownBox} from '../src/content-bounds.mjs';
import {ControlZones} from '../src/control-zones.mjs';
test('node creation uses graph pointer including negative space and keeps every existing position',()=>{
 const graph=defaultGraph({}),before=structuredClone(graph),next=addGraphOperation(graph,'Blur','blur',{x:-145.5,y:622});
 assert.deepEqual(next.nodes.slice(0,-1),before.nodes);assert.deepEqual(next.nodes.at(-1),{id:'blur',type:'Blur',x:-145.5,y:622,params:{radius:5}});assert.deepEqual(next.edges,before.edges);
});
test('crop stores an independent affine mask frame and automatically lays out downstream nodes',()=>{
 const graph=defaultGraph({}),world=[.8,.6,-.6,.8,100,200],matrix=inverse(world),next=createCrop({graph},{x:100,y:200,width:300,height:100,matrix});
 assert.deepEqual(next.nodes.find(n=>n.id==='input'),graph.nodes.find(n=>n.id==='input'));assert.ok(next.nodes.find(n=>n.id==='output').x>graph.nodes.find(n=>n.id==='output').x);assert.deepEqual(multiply(world,next.nodes.find(n=>n.type==='RectangleMask').params.matrix),[1,0,0,1,0,0]);
 assert.throws(()=>validateGraph({...next,nodes:next.nodes.map(n=>n.type==='RectangleMask'?{...n,params:{...n.params,matrix:[0,0,0,0,0,0]}}:n)}));
});
test('pixel clipboard retains full source graph and multiplies it by a separate mask',()=>{
 const source={kind:'Image',graph:addGraphOperation(defaultGraph({}),'Blur','previous',{x:90,y:120})};
 const graph=createSelectionGraph({source,mask:'data:image/png;base64,AAAA',width:420,height:250});
 assert.ok(graph.nodes.some(n=>n.id==='previous'));assert.deepEqual(graph.nodes.find(n=>n.id==='selection-mask').params,{src:'data:image/png;base64,AAAA',width:420,height:250});
 assert.ok(graph.edges.some(e=>e.from==='input'&&e.to==='selection-clip'&&e.port==='base'));assert.ok(graph.edges.some(e=>e.from==='selection-mask'&&e.to==='selection-clip'&&e.port==='mask'));
});
test('selection copies can themselves be copied and retain compact mask bounds',()=>{
 const clip={mask:'data:image/png;base64,AAAA',width:420,height:250,bounds:{x:10,y:20,width:80,height:50}},graph=createSelectionGraph(clip),source={kind:'Image',width:420,height:250,graph};
 assert.deepEqual(ownBox(source),clip.bounds);const second=createSelectionGraph({...clip,source});validateGraph(second);assert.equal(new Set(second.nodes.map(n=>n.id)).size,second.nodes.length);
});
test('point controls honor shared UI settings in CSS pixels',()=>{const zones=new ControlZones(),points=[{x:0,y:0},{x:200,y:0}],settings={base:32,expansion:0,coefficient:0,influence:160,shrink:88};assert.equal(zones.pick(points,{x:-26,y:0},0,settings).radius,32);assert.equal(zones.pick(points,{x:-33,y:0},100,settings),null);});
test('adaptive controls expand with speed, stay separate and shrink again',()=>{
 const zones=new ControlZones(),points=[{x:0,y:0},{x:100,y:0}];zones.pick(points,{x:-100,y:0},0);
 const hit=zones.pick(points,{x:-25,y:0},16);assert.equal(hit.index,0);assert.ok(hit.radius>25);assert.equal(zones.pick(points,{x:50,y:0},32),null);
 for(let i=1;i<40;i++)zones.pick(points,{x:-25,y:0},32+i*100);assert.equal(zones.pick(points,{x:-25,y:0},4100),null);
});
