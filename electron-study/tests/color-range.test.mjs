import test from 'node:test';import assert from 'node:assert/strict';
import {colorRangePixels,rangeForColor} from '../src/color-range.mjs';
import {defaultGraph,addGraphOperation,connectGraph,setGraphParameter,validateGraph} from '../src/graph-model.mjs';
import {nodeSpec} from '../src/generator-nodes.mjs';
test('range masks recompute from upstream pixels and exclude transparent pixels',()=>{
 const pixels=new Uint8ClampedArray([100,120,140,255,110,130,150,255,200,220,240,255,100,120,140,0]);
 const p={...rangeForColor('#64788c',15),mode:'All matching'},mask=colorRangePixels(pixels,4,1,p);assert.deepEqual([mask[3],mask[7],mask[11],mask[15]],[255,255,0,0]);
 pixels[0]=255;assert.equal(colorRangePixels(pixels,4,1,p)[3],0);assert.equal(colorRangePixels(pixels,4,1,{lowColor:'#000000',highColor:'#ffffff'})[3],255);
});
test('connected range respects seed and does not jump across unmatched pixels',()=>{
 const pixels=new Uint8ClampedArray([255,0,0,255,0,0,0,255,255,0,0,255]),p={lowColor:'#ff0000',highColor:'#ff0000',mode:'Connected',seedX:0,seedY:0};assert.deepEqual([...colorRangePixels(pixels,3,1,p)].filter((_,i)=>i%4===3),[255,0,0]);
});
test('range source and Transform have distinct validated responsibilities',()=>{
 let graph=addGraphOperation(defaultGraph({}),'ColorRange','range');graph=addGraphOperation(graph,'Transform','transform');graph=connectGraph(graph,'input','range','base');graph=connectGraph(graph,'range','transform','base');graph=connectGraph(graph,'transform','output','base');graph=setGraphParameter(graph,'transform','rotation',45);graph=setGraphParameter(graph,'range','lowColor','#123456');validateGraph(graph);
 assert.equal(graph.nodes.find(n=>n.id==='transform').params.rotation,45);assert.equal(setGraphParameter(graph,'range','x',50),graph);assert.deepEqual(nodeSpec('BitmapMask').parameters,[]);
});
