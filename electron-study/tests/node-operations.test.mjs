import {test} from 'node:test';
import assert from 'node:assert/strict';
import {graphOperations} from '../src/blend-modes.mjs';
import {defaultGraph,graphFor,changeGraphOperation,inputPorts,validateGraph} from '../src/graph-model.mjs';
import {encodeProject,decodeProject} from '../src/project-file.mjs';
test('all blend operations preserve ID, position and connections and survive metadata reconciliation',()=>{
  const owner={id:'owner',name:'Owner',kind:'Layer',x:0,y:0,sx:1,sy:1,rotation:0,paint:[{size:10,points:[{x:10,y:10}]}]},original=defaultGraph(owner);
  for(const type of graphOperations){const graph=changeGraphOperation(original,'paint-op-0',type),node=graph.nodes.find(n=>n.id==='paint-op-0');assert.equal(node.type,type);assert.deepEqual(inputPorts(node),['base','mask']);assert.deepEqual(graph.edges,original.edges);assert.equal(node.x,original.nodes.find(n=>n.id===node.id).x);assert.equal(graphFor({...owner,graph}).nodes.find(n=>n.id===node.id).type,type);validateGraph(graph);assert.equal(decodeProject(encodeProject({items:[{...owner,graph}],assets:[]})).items[0].graph.nodes.find(n=>n.id===node.id).type,type);}
  assert.equal(changeGraphOperation(original,'input','Multiply'),original);assert.equal(changeGraphOperation(original,'paint-op-0','Unknown'),original);
});
