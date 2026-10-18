import test from 'node:test';
import assert from 'node:assert/strict';
import {compositionDomain} from '../src/generator-domain.mjs';
import {graphCoverageBox} from '../src/graph-coverage.mjs';
import {identity,localMatrix,inverse,transformPoint} from '../src/scene-transform.mjs';
import {arrangeGraph,addGraphOperation,defaultGraph,validateGraph} from '../src/graph-model.mjs';
import {colorRangePixels} from '../src/color-range.mjs';
test('composition domain encloses every document corner in rotated owner space',()=>{
 const world=localMatrix({width:120,height:80,x:180,y:220,sx:1.5,sy:.8,rotation:38}),box=compositionDomain(world);
 for(const p of [{x:0,y:0},{x:960,y:0},{x:0,y:600},{x:960,y:600}]){const q=transformPoint(inverse(world),p);assert.ok(q.x>=box.x-1e-8&&q.x<=box.x+box.width+1e-8&&q.y>=box.y-1e-8&&q.y<=box.y+box.height+1e-8);}
});
test('infinite generator is bounded by the connected input alpha, not all generator branches',()=>{
 const input={x:0,y:0,width:100,height:80},nodes=[{id:'input',type:'Input',x:0,y:0},{id:'output',type:'Output',x:600,y:0},{id:'gradient',type:'Gradient',x:300,y:0},{id:'alpha',type:'ConvertToAlphaMask',x:300,y:400},{id:'mix',type:'AlphaMultiply',x:600,y:400}],edges=[{from:'input',to:'alpha',port:'base'},{from:'gradient',to:'mix',port:'base'},{from:'alpha',to:'mix',port:'mask'},{from:'gradient',to:'output',port:'base'}],item={graph:{version:1,nodes,edges}};
 assert.deepEqual(graphCoverageBox(item,input,identity(),()=>null),{x:0,y:0,width:960,height:600});
 item.graph.edges.at(-1).from='mix';assert.deepEqual(graphCoverageBox(item,input,identity(),()=>null),input);
});
test('automatic layout anchors Input and leaves cursor-created nodes at the cursor',()=>{
 let graph=defaultGraph({});graph.nodes.find(n=>n.id==='input').x=170;graph.nodes.find(n=>n.id==='input').y=90;
 graph=addGraphOperation(graph,'Blur','blur',{x:880,y:350});assert.deepEqual([graph.nodes.at(-1).x,graph.nodes.at(-1).y],[880,350]);assert.equal(graph.nodes.find(n=>n.id==='output').x,330);
 const arranged=arrangeGraph(graph,true),input=arranged.nodes.find(n=>n.id==='input');assert.deepEqual([input.x,input.y],[170,90]);validateGraph(arranged);
});
test('range fuzziness preserves partial coverage, exclusions and inversion',()=>{
 const pixels=new Uint8ClampedArray([100,100,100,255,110,100,100,255,100,100,100,0]),params={lowColor:'#646464',highColor:'#646464',fuzziness:20,mode:'All matching'};
 const alpha=p=>[...colorRangePixels(pixels,3,1,p)].filter((_,i)=>i%4===3);
 assert.deepEqual(alpha(params),[255,128,0]);assert.deepEqual(alpha({...params,invert:true}),[0,127,0]);assert.equal(alpha({...params,excludeColors:['#646464']})[0],0);
 const graph=addGraphOperation(defaultGraph({}),'ColorRange','range');graph.nodes.at(-1).params={...graph.nodes.at(-1).params,...params,excludeColors:['#646464']};graph.nodes.at(-1).preview=true;validateGraph(JSON.parse(JSON.stringify(graph)));
});
