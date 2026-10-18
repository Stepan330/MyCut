import {_electron as electron} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(fileURLToPath(new URL('../',import.meta.url))),results=process.env.MYCUT_UI_RESULTS||path.join(root,'test-results/inline-rename');await mkdir(results,{recursive:true});
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const app=await electron.launch({args:[root],env});const page=await app.firstWindow(),errors=[];page.on('pageerror',e=>errors.push(e.message));
const field=()=>page.getByLabel('Rename object inline',{exact:true}),row=id=>page.locator(`[data-layer-id="${id}"]`);
const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
async function undo(){await page.getByRole('button',{name:'Undo',exact:true}).click();await settle();}
try{
  await row('card').waitFor();const before=await page.locator('[data-object="card"]').getAttribute('transform');
  await row('card').click({button:'right'});assert.equal(await page.locator('.context-caption').count(),0);
  await page.getByRole('menuitem',{name:'Edit',exact:true}).click();await page.getByRole('menuitem',{name:'Rename',exact:true}).click();
  assert.equal(await page.getByRole('dialog').count(),0);assert.equal(await field().inputValue(),'Studio image');assert.equal(await row('card').getAttribute('draggable'),'false');
  assert.equal(await field().evaluate(el=>el.selectionEnd-el.selectionStart),12);
  await field().fill('Studio hero');await page.screenshot({path:path.join(results,'inline-rename-editing.png')});await field().press('Enter');await settle();
  assert.equal(await field().count(),0);assert.equal(await page.getByLabel('Object name',{exact:true}).inputValue(),'Studio hero');
  assert.equal(await row('card').getAttribute('aria-selected'),'true');assert.equal(await page.locator('[data-object="card"]').getAttribute('transform'),before);
  await undo();assert.equal(await row('card').getByRole('button',{name:'Studio image',exact:true}).count(),1);assert.equal(await page.getByRole('button',{name:'Undo',exact:true}).isEnabled(),false);
  await page.getByRole('button',{name:'Redo',exact:true}).click();await settle();assert.equal(await page.getByLabel('Object name',{exact:true}).inputValue(),'Studio hero');await undo();
  await row('card').locator('.tree-label').click();await page.keyboard.press('F2');await field().fill('Cancelled');await field().press('Escape');await settle();assert.equal(await row('card').getByRole('button',{name:'Studio image',exact:true}).count(),1);
  assert.equal(await page.getByRole('button',{name:'Undo',exact:true}).isEnabled(),false);
  await page.keyboard.press('F2');await field().fill(' ');await field().press('Enter');assert.equal(await field().count(),1);assert.equal(await field().getAttribute('aria-invalid'),'true');await field().press('Escape');await settle();
  await page.keyboard.press('F2');await field().press('Enter');await settle();assert.equal(await page.getByRole('button',{name:'Undo',exact:true}).isEnabled(),false);
  await page.keyboard.press('F2');await field().fill('Blur name');await page.getByRole('button',{name:'Global',exact:true}).click();await settle();assert.equal(await page.getByLabel('Object name',{exact:true}).inputValue(),'Blur name');await undo();
  await row('background').locator('.tree-label').click();await page.keyboard.press('F2');assert.equal(await field().count(),0);
  await row('title').locator('.tree-label').click();await row('card').locator('.tree-label').click({modifiers:['Shift']});await page.keyboard.press('F2');assert.equal(await field().count(),0);
  assert.deepEqual(errors,[]);console.log('Inline rename checks passed: menu/F2, in-row editor, selected text, no modal/header, Enter/Escape/blur, empty/no-op validation, stable selection/geometry, one Undo/Redo, lock and multiselect guards.');
}finally{await app.close();}
