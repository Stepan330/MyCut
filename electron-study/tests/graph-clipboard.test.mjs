import test from 'node:test';
import assert from 'node:assert/strict';
import {copyGraphNodes,pasteGraphNodes} from '../src/graph-clipboard.mjs';
const owner={id:'photo'},graph={version:1,nodes:[{id:'input',type:'Input',x:0,y:0},{id:'blur',type:'Blur',x:100,y:100,params:{radius:12}},{id:'crop',type:'Crop',x:300,y:100},{id:'output',type:'Output',x:500,y:100}],edges:[{from:'input',to:'blur',port:'base'},{from:'blur',to:'crop',port:'base'},{from:'crop',to:'output',port:'base'}]};
test('node clipboard clones parameters and internal wires without changing manual layout',()=>{
 assert.ok(copyGraphNodes(owner,graph,['input','blur','crop','output']));let i=0;const result=pasteGraphNodes(owner,graph,()=> 'copy-'+i++);
 assert.equal(result.nodes.length,2);assert.deepEqual(result.graph.nodes.slice(0,4),graph.nodes);
 assert.deepEqual(result.nodes[0].params,{radius:12});assert.equal(result.nodes[0].x,132);
 assert.deepEqual(result.graph.edges.at(-1),{from:'copy-0',to:'copy-1',port:'base'});
 result.nodes[0].params.radius=30;assert.equal(graph.nodes[1].params.radius,12);
 const again=pasteGraphNodes({id:'other'},graph,()=> 'again-'+i++);assert.equal(again.nodes[0].x,164);
});
test('Input/Output remain unique and copying them alone does not overwrite clipboard',()=>{
 assert.equal(copyGraphNodes(owner,graph,['input','output']),false);
 assert.ok(pasteGraphNodes(owner,graph,()=>crypto.randomUUID()).nodes.length>0);
});
