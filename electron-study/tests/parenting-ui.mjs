import {_electron as electron} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(fileURLToPath(new URL('../',import.meta.url))),results=process.env.MYCUT_UI_RESULTS||path.join(root,'test-results/parenting');await mkdir(results,{recursive:true});
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const app=await electron.launch({args:[root],env}),page=await app.firstWindow(),errors=[];page.on('pageerror',e=>errors.push(e.message));
const row=id=>page.locator(`[data-layer-id="${id}"]`),field=()=>page.getByLabel('Rename object inline',{exact:true});
const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
async function undo(){await page.getByRole('button',{name:'Undo',exact:true}).click();await settle();}
async function command(target,name){await target.click({button:'right'});await page.getByRole('menuitem',{name,exact:true}).click();}
try{
  await row('card').waitFor();const original=await page.locator('[data-object="ellipse"]').getAttribute('transform');
  await row('ellipse').locator('.tree-label').dragTo(row('card'),{targetPosition:{x:100,y:11}});await settle();
  assert.equal(await row('ellipse').getAttribute('aria-level'),'2');assert.equal(await row('card').getAttribute('aria-expanded'),'true');
  assert.equal(await page.locator('[data-object="ellipse"]').getAttribute('transform'),original);
  await row('card').locator('.tree-label').dblclick();assert.equal(await row('ellipse').count(),0);
  await row('card').locator('.tree-label').dblclick();assert.equal(await row('ellipse').count(),1);
  // Same cycle/lock guards as the data model; no partial move.
  await row('card').locator('.tree-label').dragTo(row('ellipse'),{targetPosition:{x:100,y:11}});await settle();assert.equal(await row('card').getAttribute('aria-level'),'1');
  await row('ellipse').locator('.tree-label').dragTo(row('background'),{targetPosition:{x:100,y:11}});await settle();assert.equal(await row('ellipse').getAttribute('aria-level'),'2');
  await undo();assert.equal(await row('ellipse').getAttribute('aria-level'),'1');
  await page.getByRole('button',{name:'Redo',exact:true}).click();await settle();assert.equal(await row('ellipse').getAttribute('aria-level'),'2');
  await command(row('card'),'Create folder');await field().waitFor();assert.equal(await page.getByRole('dialog').count(),0);
  assert.equal(await field().inputValue(),'New folder');assert.equal(await field().evaluate(el=>el.selectionEnd-el.selectionStart),10);
  const folderRow=page.getByRole('treeitem').filter({has:field()});assert.equal(await folderRow.getAttribute('aria-level'),'2');
  const folderId=await folderRow.getAttribute('data-layer-id');await field().fill('Image children');
  await page.screenshot({path:path.join(results,'create-folder-inline.png')});await field().press('Enter');
  assert.equal(await row(folderId).locator('.tree-label').textContent(),'Image children');
  // Escape cancels only naming; a real default-named folder remains.
  await command(page.locator('.tree-root'),'Create folder');await field().press('Escape');
  assert.equal(await page.getByRole('button',{name:'New folder',exact:true}).count(),1);await undo();
  await row('card').locator('.tree-label').click();await row('title').locator('.tree-label').click({modifiers:['Control']});
  await command(row('card'),'Move to new folder');await field().waitFor();assert.equal(await page.getByRole('dialog').count(),0);
  await field().fill('Artwork');await field().press('Enter');assert.equal(await row('card').getAttribute('aria-level'),'2');assert.equal(await row('ellipse').getAttribute('aria-level'),'3');
  assert.equal(await page.locator('[data-object="ellipse"]').getAttribute('transform'),original);
  await page.screenshot({path:path.join(results,'object-parent-hierarchy.png')});
  assert.deepEqual(errors,[]);console.log('Parenting UI checks passed: real drop into Image, collapse, no geometry jump, cycle/lock guards, Undo/Redo, immediate inline create/group name, Escape retains new folder.');
}finally{await app.close();}
