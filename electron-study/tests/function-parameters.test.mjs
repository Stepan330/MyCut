import test from 'node:test';
import assert from 'node:assert/strict';
import {addObjectEffect,parameterValue,setExposedValue} from '../src/object-effects.mjs';
import {graphFor,validateGraph,connectGraph,disconnectGraph,setGraphParameter,removeGraphNode} from '../src/graph-model.mjs';
import {expandedEdges,wrapFunction} from '../src/parameter-graph.mjs';
import {copyGraphNodes,pasteGraphNodes} from '../src/graph-clipboard.mjs';
const source={id:'text',kind:'Text',name:'Text',text:'Hello',x:100,y:100,sx:1,sy:1,rotation:0,opacity:1,visible:true,locked:false};
test('Shadow is a function containing primitive image nodes and wired parameter nodes',()=>{
 const owner=addObjectEffect(source,'shadow'),graph=graphFor(owner),fn=graph.nodes.find(n=>n.type==='Function');
 assert.ok(fn);assert.equal(graph.nodes.some(n=>n.type==='DropShadow'),false);
 for(const type of ['ConvertToAlphaMask','SolidColor','AlphaMultiply','Blur','Offset','Opacity','Add'])assert.ok(graph.nodes.some(n=>n.type===type));
 assert.equal(owner.exposedParameters.length,5);
 for(const p of owner.exposedParameters){assert.ok(fn.members.includes(p.parameterNode));for(const t of p.targets)assert.ok(graph.edges.some(e=>e.from===p.parameterNode&&e.to===t.node&&e.port==='param:'+t.key));}
 assert.ok(expandedEdges(graph).some(e=>e.from==='input'&&e.to===graph.nodes.find(n=>n.type==='ConvertToAlphaMask').id));
 validateGraph(graph);
});
test('typed parameter wires evaluate values, reject image/colour mismatches and support disconnect',()=>{
 let owner=addObjectEffect(source,'shadow'),graph=graphFor(owner);
 const blur=graph.nodes.find(n=>n.type==='Blur'),p=owner.exposedParameters.find(p=>p.name==='Blur'),color=graph.nodes.find(n=>n.type==='ColorParameter');
 assert.equal(connectGraph(graph,color.id,blur.id,'param:radius'),graph);
 assert.equal(connectGraph(graph,p.parameterNode,blur.id,'base'),graph);
 assert.equal(connectGraph(graph,'input',blur.id,'param:radius'),graph);
 graph=setGraphParameter(graph,blur.id,'radius',28);owner={...owner,graph};assert.equal(parameterValue(graph,p),28);assert.equal(graphFor(owner).nodes.find(n=>n.id===blur.id).params.radius,28);
 graph=disconnectGraph(graph,blur.id,'param:radius');assert.equal(graph.edges.some(e=>e.to===blur.id&&e.port==='param:radius'),false);validateGraph(graph);
});
test('function copy remaps every internal node, wire and interface; delete removes its body',()=>{
 const owner=addObjectEffect(source,'soften'),graph=graphFor(owner),fn=graph.nodes.find(n=>n.type==='Function');
 copyGraphNodes(owner,graph,[fn.id]);const result=pasteGraphNodes(owner,graph),copy=result.nodes.find(n=>n.type==='Function');validateGraph(result.graph);
 assert.ok(copy.members.every(id=>!fn.members.includes(id)));assert.ok(copy.members.includes(copy.output));
 const removed=removeGraphNode(graph,fn.id);assert.deepEqual(removed.nodes.map(n=>n.id),['input','output']);assert.equal(removed.edges.find(e=>e.to==='output').from,'input');
});
