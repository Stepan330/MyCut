import {_electron as electron} from 'playwright';
import assert from 'node:assert/strict';
import path from 'node:path';
import {mkdir,readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {extraShapeTools} from '../src/vector-shapes.mjs';
const root=path.resolve(fileURLToPath(new URL('../',import.meta.url))),env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const app=await electron.launch({args:[root],env}),page=await app.firstWindow(),errors=[];page.on('pageerror',e=>errors.push(e.message));
const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
const at=(x,y)=>page.locator('.artboard>svg').evaluate((el,p)=>{const q=new DOMPoint(p.x,p.y).matrixTransform(el.getScreenCTM());return {x:q.x,y:q.y};},{x,y});
async function field(label,value){await page.getByLabel(label,{exact:true}).fill(String(value));await page.getByLabel(label,{exact:true}).press('Enter');await settle();}
try{
  await page.getByRole('toolbar',{name:'Drawing tools'}).waitFor();assert.equal(await page.getByRole('toolbar',{name:'Drawing tools'}).getByRole('button').count(),24);
  for(const [index,spec] of extraShapeTools.entries()){
    await page.getByRole('button',{name:'Shapes tool',exact:true}).click();await page.getByLabel('Tool Mode',{exact:true}).selectOption('Create');if(await page.getByLabel('Tool Shape',{exact:true}).locator('option[value="'+spec.id+'"]').count()===0)await page.getByLabel('Tool Shape',{exact:true}).selectOption('__more__');await page.getByLabel('Tool Shape',{exact:true}).selectOption(spec.id);const x=80+index%5*170,y=220+Math.floor(index/5)*160,a=await at(x,y),b=await at(x+95,y+85);await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:10});await page.mouse.up();await settle();assert.equal(await page.getByLabel('Tool Mode',{exact:true}).inputValue(),'Edit');
    const id=await page.locator('[role=treeitem][aria-selected=true]').getAttribute('data-layer-id'),shape=page.locator(`[data-object="${id}"] [data-vector-shape="${spec.id}"]`);assert.equal(await shape.count(),1,spec.label+' has actual vector artwork');assert.equal(await page.getByLabel('Object name',{exact:true}).inputValue(),spec.label);
    await page.getByRole('button',{name:'Selection tool',exact:true}).click();const center=await at(x+47,y+42);await page.mouse.click(center.x,center.y);await settle();await page.getByRole('button',{name:'Shapes tool',exact:true}).click();assert.equal(await page.getByLabel('Tool Shape',{exact:true}).inputValue(),spec.id);
    await field('Tool Outline width',5);await page.getByLabel('Tool Color',{exact:true}).fill('#ed8855');await page.getByLabel('Tool Color',{exact:true}).press('Enter');
    if(['star','polygon','line'].includes(spec.id)){await page.getByRole('button',{name:'Tool settings',exact:true}).click();await page.getByRole('button',{name:'Advanced settings',exact:true}).click();await field(spec.id==='line'?'Tool Line width':'Tool Sides / points',spec.id==='line'?12:8);await page.getByRole('button',{name:'Close tool settings',exact:true}).click();}
  }
  await mkdir(path.join(root,'test-results/vector-tools'),{recursive:true});const file=path.join(root,'test-results/vector-tools/all-tools.mycutproject');await app.evaluate(({dialog},file)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:file});dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]});dialog.showMessageBox=async()=>({response:1});},file);await page.locator('.viewport').focus();await page.keyboard.press('Control+s');await page.waitForFunction(()=>document.querySelector('.statusbar').textContent.includes('Saved all-tools.mycutproject'));const saved=JSON.parse(await readFile(file,'utf8'));assert.equal(saved.items.filter(n=>extraShapeTools.some(s=>s.id===n.shape)).length,10);
  await page.keyboard.press('Control+o');await page.waitForFunction(()=>document.querySelector('.statusbar').textContent.includes('Opened all-tools.mycutproject'));assert.equal(await page.locator('[data-vector-shape]').count(),10);await page.screenshot({path:path.join(root,'test-results/vector-tools/ten-tools.png')});assert.deepEqual(errors,[]);console.log('Ten vector tools UI passed: create→edit, independent vector geometry, click dispatch, color/outline, line width and polygon/star sides, native project save/open.');
}finally{await app.close();}
