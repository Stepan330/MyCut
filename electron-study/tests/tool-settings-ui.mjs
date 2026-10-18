import {_electron as electron} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(fileURLToPath(new URL('../',import.meta.url))),results=path.join(root,'test-results/tool-settings');await mkdir(results,{recursive:true});const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const app=await electron.launch({args:[root],env}),page=await app.firstWindow(),errors=[];page.on('pageerror',e=>errors.push(e.message));
const field=name=>page.getByLabel(name,{exact:true}),settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
async function type(name,value){await field(name).fill(value);await field(name).press('Enter');}
try{
  await page.getByRole('button',{name:'Brush tool',exact:true}).click();await page.getByRole('button',{name:'Tool settings',exact:true}).click();const panel=page.getByRole('dialog',{name:'Brush settings',exact:true}),more=page.getByRole('button',{name:'Advanced settings',exact:true});await panel.waitFor();
  assert.equal(await panel.getByRole('tab',{name:'Basic',exact:true}).count(),0);assert.equal(await panel.getByRole('tab',{name:'Advanced',exact:true}).count(),0);assert.equal(await more.getAttribute('aria-expanded'),'false');assert.equal(await field('Settings Size').count(),1);assert.equal(await field('Tool Smoothing value').count(),0);await page.screenshot({path:path.join(results,'basic-groups.png')});
  await more.click();for(const name of ['Tip shape','Paint','Smoothing','Pen dynamics'])assert.equal(await panel.getByRole('group',{name,exact:true}).count(),1);assert.equal(await field('Settings Size').count(),1);
  await type('Tool Smoothing value','3.751234');assert.equal(await field('Tool Smoothing value').inputValue(),'3.751234');await type('Tool Hardness value','0.37');assert.equal(await field('Tool Hardness').inputValue(),'0.37');await type('Tool Flow value','1.2');assert.equal(await field('Tool Flow value').inputValue(),'1');
  await more.click();assert.equal(await field('Settings Size').count(),1);assert.equal(await field('Tool Smoothing value').count(),0);await more.click();assert.equal(await field('Tool Smoothing value').inputValue(),'3.751234');await page.screenshot({path:path.join(results,'expanded-grouped-manual-values.png')});
  await page.getByRole('button',{name:'Close tool settings',exact:true}).click();await page.getByRole('button',{name:'Tool settings',exact:true}).click();assert.equal(await more.getAttribute('aria-expanded'),'false');await more.click();assert.equal(await field('Tool Smoothing value').inputValue(),'3.751234');await page.getByRole('button',{name:'Close tool settings',exact:true}).click();
  const at=async(x,y)=>page.locator('.artboard>svg').evaluate((el,p)=>{const q=new DOMPoint(p.x,p.y).matrixTransform(el.getScreenCTM());return {x:q.x,y:q.y};},{x,y}),a=await at(200,350),b=await at(350,410);await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:15});await page.mouse.up();await settle();assert.equal(await page.locator('[data-paint-stroke]').last().getAttribute('data-brush-smoothing'),'3.751234');
  assert.deepEqual(errors,[]);console.log('Tool settings UI passed: basic default, no inner tabs, grouped advanced expansion, exact manual smoothing above one reaching painted stroke, fraction limits, collapse/reopen retention.');
}finally{await app.close();}
