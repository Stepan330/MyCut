import test from 'node:test';
import assert from 'node:assert/strict';
import {addObjectEffect,removeObjectEffect,exposeParameter,setExposedValue,syncExposedGraph,validateObjectEffects} from '../src/object-effects.mjs';
import {graphFor,validateGraph,setGraphParameter} from '../src/graph-model.mjs';
import {encodeProject,decodeProject} from '../src/project-file.mjs';
const source={id:'text',name:'Text',kind:'Text',text:'Test',x:0,y:0,sx:1,sy:1,rotation:0,visible:true,locked:false,opacity:1};
test('automatic effects are ordinary editable graph nodes and removal reconnects the chain',()=>{
 let owner=addObjectEffect(source,'shadow');owner=addObjectEffect(owner,'correction');
 assert.equal(owner.objectEffects.length,2);validateGraph(owner.graph);validateObjectEffects(owner);
 const shadow=owner.objectEffects[0],blur=owner.exposedParameters.find(p=>p.effect===shadow.id&&p.name==='Blur');
 owner=setExposedValue(owner,blur.id,24);assert.equal(owner.graph.nodes.find(n=>n.id===blur.targets[0].node).params.radius,24);
 owner=removeObjectEffect(owner,shadow.id);assert.equal(owner.objectEffects.length,1);assert.equal(owner.graph.nodes.some(n=>n.type==='DropShadow'),false);validateGraph(owner.graph);validateObjectEffects(owner);
 assert.equal(owner.graph.edges.find(e=>e.to===owner.objectEffects[0].nodes[0]).from,'input');
 const project=decodeProject(encodeProject({items:[owner],assets:[]}));assert.deepEqual(project.items[0].exposedParameters,owner.exposedParameters);
});
test('one parameter fans out to multiple nodes and edits on either node flow back to all targets',()=>{
 let owner=addObjectEffect(addObjectEffect(source,'soften'),'soften');
 const [a,b]=owner.exposedParameters;
 owner={...owner,exposedParameters:[{...a,name:'Shared blur',group:'Surface',targets:[...a.targets,...b.targets]}]};
 owner=setExposedValue(owner,a.id,17);assert.ok(owner.graph.nodes.filter(n=>n.type==='Blur').every(n=>n.params.radius===17));
 let graph=setGraphParameter(graphFor(owner),b.targets[0].node,'radius',31);
 owner=syncExposedGraph(owner,graph);assert.ok(graphFor(owner).nodes.filter(n=>n.type==='Blur').every(n=>n.params.radius===31));validateObjectEffects(owner);
});
test('manually exposed fields are named/grouped references; invalid project bindings are rejected',()=>{
 let owner=addObjectEffect(source,'soften');owner={...owner,exposedParameters:[]};const node=owner.graph.nodes.find(n=>n.type==='Blur');
 owner=exposeParameter(owner,node.id,'radius');assert.equal(owner.exposedParameters.length,1);
 assert.equal(exposeParameter(owner,node.id,'radius').exposedParameters.length,1);
 assert.throws(()=>validateObjectEffects({...owner,exposedParameters:[{...owner.exposedParameters[0],targets:[{node:'missing',key:'radius'}]}]}));
});
