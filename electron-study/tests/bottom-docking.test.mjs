import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initialDockLayout,dockToContent} from '../src/dock-layout.mjs';
test('bottom docking works alongside existing sidebar, creates content and merges tabs without duplicates',()=>{
  const sidebar=initialDockLayout(),floating={id:'floating',dock:'floating',tabs:['content-browser'],active:'content-browser',gestureMode:'arc'},first=dockToContent([...sidebar,floating],['content-browser'],'content-root');assert.deepEqual(first.filter(g=>g.dock!=='content'),sidebar);assert.equal(first.find(g=>g.dock==='content').active,'content-browser');
  const second=dockToContent([...first,{id:'graph',dock:'floating',tabs:['effects-graph'],active:'effects-graph'}],['effects-graph'],'unused');assert.equal(second.filter(g=>g.dock==='content').length,1);assert.deepEqual(second.find(g=>g.dock==='content').tabs,['content-browser','effects-graph']);assert.equal(second.find(g=>g.dock==='content').active,'effects-graph');assert.equal(new Set(second.flatMap(g=>g.tabs)).size,4);
});
