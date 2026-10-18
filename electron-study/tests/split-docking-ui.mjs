import {_electron as electron} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(fileURLToPath(new URL('../',import.meta.url))),results=path.join(root,'test-results/split-docking');await mkdir(results,{recursive:true});const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const app=await electron.launch({args:[root],env}),page=await app.firstWindow(),errors=[];page.on('pageerror',e=>errors.push(e.message));
const tab=id=>page.locator(`[data-dock-tab="${id}"]`),group=id=>page.locator('.sidebar [data-dock-group]').filter({has:tab(id)}),settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
async function drag(source,p,edge){const r=await source.boundingBox();await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await page.mouse.down();await page.mouse.move(p.x,p.y,{steps:15});await settle();if(edge){assert.equal(await page.getByLabel('Dock placement preview',{exact:true}).getAttribute('data-dock-preview-edge'),edge);assert.equal(await page.locator('.dock-drop-highlight span,.dock-drag-preview').count(),0);}await page.mouse.up();await settle();}
async function returnAt(edge,id='details'){
  const r=await group('outliner').boundingBox(),p={x:r.x+r.width/2,y:r.y+r.height/2};if(edge==='left')p.x=r.x+5;if(edge==='right')p.x=r.x+r.width-5;if(edge==='top')p.y=r.y+36;if(edge==='bottom')p.y=r.y+r.height-5;
  await drag(tab(id),p,edge);assert.equal(await page.locator(`.sidebar [data-dock-tab="${id}"]`).count(),1);
}
try{
  await tab('details').waitFor();await page.getByLabel('Search objects',{exact:true}).fill('Studio');const side=await page.getByRole('separator',{name:'Resize sidebar',exact:true}).boundingBox();await page.mouse.move(side.x+2,side.y+side.height/2);await page.mouse.down();await page.mouse.move(side.x-300,side.y+side.height/2,{steps:10});await page.mouse.up();await settle();
  for(const edge of ['bottom','left','top','right']){await drag(tab('details'),{x:350,y:160});assert.equal(await page.locator('.dock-floating').count(),1);await returnAt(edge);assert.equal(await page.locator('.dock-floating').count(),0);const a=await group('outliner').boundingBox(),b=await group('details').boundingBox();if(edge==='bottom')assert.ok(b.y>a.y+a.height-2);if(edge==='top')assert.ok(a.y>b.y+b.height-2);if(edge==='left')assert.ok(a.x>b.x+b.width-2);if(edge==='right')assert.ok(b.x>a.x+a.width-2);assert.equal(await page.getByLabel('Search objects',{exact:true}).inputValue(),'Studio');}
  await page.getByRole('button',{name:'Brush tool',exact:true}).click();await page.getByRole('button',{name:'Tool settings',exact:true}).click();await page.getByRole('button',{name:'Pin tool settings',exact:true}).click();await returnAt('bottom','tool-settings');assert.equal(await page.locator('.sidebar .dock-split').count(),2);
  const splitter=page.locator('.sidebar > .dock-split > .dock-splitter'),s=await splitter.boundingBox(),before=await group('details').boundingBox();await page.mouse.move(s.x+2,s.y+s.height/2);await page.mouse.down();await page.mouse.move(s.x+35,s.y+s.height/2,{steps:8});await page.mouse.up();await settle();const after=await group('details').boundingBox();assert.ok(Math.abs(after.width-before.width)>15);
  await page.screenshot({path:path.join(results,'nested-horizontal-vertical.png')});assert.deepEqual(errors,[]);console.log('Split docking UI passed: return at all four edges, no captions, nested splits, resize and preserved search state.');
}finally{await app.close();}
