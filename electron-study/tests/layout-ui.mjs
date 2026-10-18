import {_electron as electron} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(fileURLToPath(new URL('../',import.meta.url))),results=process.env.MYCUT_UI_RESULTS||path.join(root,'test-results/layout');await mkdir(results,{recursive:true});
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const app=await electron.launch({args:[root],env}),page=await app.firstWindow(),errors=[];page.on('pageerror',e=>errors.push(e.message));
const selected=()=>page.locator('[role=treeitem][aria-selected=true]').getAttribute('data-layer-id');
async function russian(key,code){await page.getByLabel('Canvas preview',{exact:true}).focus();await page.evaluate(({key,code})=>document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key,code,ctrlKey:true,bubbles:true,cancelable:true})),{key,code});}
try{
  await page.locator('[data-layer-id="ellipse"]').waitFor();await page.locator('[data-layer-id="ellipse"]').click({button:'right'});await page.getByRole('menuitem',{name:'Move to new folder',exact:true}).click();await page.getByLabel('Rename object inline',{exact:true}).press('Enter');const parent=await selected();
  await page.locator('[data-layer-id="ellipse"] .tree-label').click();const count=await page.getByRole('treeitem').count();await russian('в','KeyD');const clone=await selected();assert.notEqual(clone,'ellipse');assert.equal(await page.getByRole('treeitem').count(),count+1);
  // The copy stays inside the same collapsed subtree, rather than jumping to root.
  await page.locator(`[data-layer-id="${parent}"] .tree-label`).dblclick();assert.equal(await page.locator(`[data-layer-id="${clone}"]`).count(),0);await page.locator(`[data-layer-id="${parent}"] .tree-label`).dblclick();assert.equal(await page.locator(`[data-layer-id="${clone}"]`).count(),1);
  await russian('я','KeyZ');assert.equal(await page.getByRole('treeitem').count(),count);await russian('н','KeyY');assert.equal(await page.getByRole('treeitem').count(),count+1);
  await page.getByRole('button',{name:'Brush tool',exact:true}).click();const bar=page.getByLabel('Tool parameters',{exact:true});assert.equal(await bar.locator('label').count(),4);assert.equal(await page.getByLabel('Tool Hardness',{exact:true}).count(),0);
  await page.getByRole('button',{name:'Tool settings',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Brush settings',exact:true});await dialog.waitFor();assert.equal(await dialog.getByRole('tablist').count(),1);assert.equal(await dialog.locator('label').count(),4);await page.getByRole('button',{name:'Advanced settings',exact:true}).click();assert.ok(await dialog.locator('label svg').count()>5);await page.getByLabel('Tool Flow',{exact:true}).fill('0.42');await page.getByRole('button',{name:'Close tool settings',exact:true}).click();
  await page.getByRole('button',{name:'Tool settings',exact:true}).click();await page.getByRole('button',{name:'Advanced settings',exact:true}).click();assert.equal(await page.getByLabel('Tool Flow',{exact:true}).inputValue(),'0.42');await page.screenshot({path:path.join(results,'tool-settings.png')});await page.getByRole('button',{name:'Close tool settings',exact:true}).press('Escape');assert.equal(await dialog.count(),0);assert.equal(await page.getByRole('button',{name:'Tool settings',exact:true}).evaluate(el=>el===document.activeElement),true);
  await page.screenshot({path:path.join(results,'compact-tool-bar.png')});assert.deepEqual(errors,[]);console.log('Layout UI passed: nested duplicate, Russian Ctrl+D/Z/Y, compact toolbar, icon settings, live retained values, Escape and focus restoration.');
}finally{await app.close();}
