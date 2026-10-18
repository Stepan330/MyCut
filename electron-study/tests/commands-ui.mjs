import {_electron as electron} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(fileURLToPath(new URL('../',import.meta.url))),results=process.env.MYCUT_UI_RESULTS||path.join(root,'test-results/commands');await mkdir(results,{recursive:true});
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const app=await electron.launch({args:[root],env}),page=await app.firstWindow(),errors=[];page.on('pageerror',e=>errors.push(e.message));
const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
const count=()=>page.getByRole('treeitem').count(),row=id=>page.locator(`[data-layer-id="${id}"]`);
const choose=()=>page.getByRole('button',{name:'Shapes tool',exact:true}).click();
async function key(k){await page.keyboard.press(k);await settle();}
try{
  await row('card').waitFor();await row('card').locator('.tree-label').click();await key('Control+c');await key('Control+v');assert.equal(await count(),5);
  const clone=await page.locator('[role=treeitem][aria-selected=true]').getAttribute('data-layer-id');assert.notEqual(clone,'card');assert.equal(await page.getByLabel('Object name',{exact:true}).inputValue(),'Studio image copy');assert.equal(await page.locator(`[data-object="${clone}"]`).count(),1);
  await key('Delete');assert.equal(await count(),4);assert.equal(await page.locator(`[data-object="${clone}"]`).count(),0);await key('Control+z');assert.equal(await count(),5);await key('Control+y');assert.equal(await count(),4);
  await row('card').locator('.tree-label').click();await key('Control+x');assert.equal(await row('card').count(),0);await key('Control+v');assert.equal(await count(),4);await key('Control+z');assert.equal(await count(),3);await key('Control+z');assert.equal(await row('card').count(),1);
  await row('card').locator('.tree-label').click();await key('Control+d');assert.equal(await count(),5);await key('Control+z');assert.equal(await count(),4);
  await row('background').locator('.tree-label').click();await key('Delete');assert.equal(await count(),4);await key('Control+x');assert.equal(await count(),4);
  await page.getByRole('button',{name:'Edit',exact:true}).click();assert.equal(await page.locator('.menu-popover').getByRole('button',{name:'Delete',exact:true}).isEnabled(),false);await page.locator('.menu-popover').getByRole('button',{name:'Select all',exact:true}).click();assert.equal(await page.locator('[aria-selected=true][role=treeitem]').count(),4);
  await row('card').locator('.tree-label').click();await row('card').click({button:'right'});await page.getByRole('menuitem',{name:'Edit',exact:true}).click();await page.getByRole('menuitem',{name:'Copy',exact:true}).click();await key('Control+v');assert.equal(await count(),5);await key('Control+z');
  // Native text editing must not delete or paste document objects.
  await row('title').locator('.tree-label').click();const field=page.getByLabel('Text content',{exact:true});await field.focus();await key('Control+a');await key('Delete');assert.equal(await count(),4);assert.equal(await field.inputValue(),'');await field.fill('Text clipboard');await key('Control+a');await key('Control+c');await field.fill('');await key('Control+v');assert.equal(await field.inputValue(),'Text clipboard');assert.equal(await count(),4);await field.press('Tab');
  // Stroke width stays non-scaling through object and inherited transforms.
  await choose();await page.getByLabel('Tool Shape',{exact:true}).selectOption('rectangle');const point=(x,y)=>page.locator('.artboard>svg').evaluate((el,p)=>{const a=new DOMPoint(p.x,p.y).matrixTransform(el.getScreenCTM());return {x:a.x,y:a.y};},{x,y});const a=await point(450,200),b=await point(600,300);await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:8});await page.mouse.up();await settle();
  const id=await page.locator('[role=treeitem][aria-selected=true]').getAttribute('data-layer-id'),shape=page.locator(`[data-object="${id}"] rect[vector-effect="non-scaling-stroke"]`).first();assert.equal(await shape.getAttribute('data-document-stroke'),'2');const outlineBefore=await shape.getAttribute('stroke-width');await page.getByLabel('Scale X',{exact:true}).fill('3');await page.getByLabel('Scale X',{exact:true}).press('Enter');assert.equal(await shape.getAttribute('vector-effect'),'non-scaling-stroke');assert.equal(await shape.getAttribute('stroke-width'),outlineBefore);
  await page.screenshot({path:path.join(results,'fixed-outline-and-commands.png')});assert.deepEqual(errors,[]);console.log('Commands UI passed: copy/paste/cut/duplicate/Delete, Undo/Redo, synchronized menus/selection/canvas, lock guards, native text shortcuts and non-scaling outline.');
}finally{await app.close();}
