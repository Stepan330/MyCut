import {_electron as electron} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(fileURLToPath(new URL('../',import.meta.url))),results=process.env.MYCUT_UI_RESULTS||path.join(root,'test-results/outliner-gestures');await mkdir(results,{recursive:true});
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const app=await electron.launch({args:[root],env});const page=await app.firstWindow(),errors=[];page.on('pageerror',e=>errors.push(e.message));
const field=()=>page.getByLabel('Rename object inline',{exact:true});
const folder=()=>page.getByRole('treeitem').filter({has:page.getByRole('button',{name:'Gesture folder',exact:true})});
const label=()=>folder().locator('.tree-label');
try{
  await page.locator('[data-layer-id="card"]').waitFor();
  await page.locator('.tree-root').click({button:'right'});await page.getByRole('menuitem',{name:'Create folder',exact:true}).click();
  await field().fill('Gesture folder');await field().press('Enter');
  await folder().click({button:'right'});await page.getByRole('menuitem',{name:'Create new layer',exact:true}).click();
  const child=page.getByRole('treeitem').filter({has:page.getByRole('button',{name:'New layer',exact:true})});
  await label().dblclick();assert.equal(await folder().getAttribute('aria-expanded'),'false');assert.equal(await child.count(),0);assert.equal(await field().count(),0);
  await label().dblclick();assert.equal(await folder().getAttribute('aria-expanded'),'true');assert.equal(await child.count(),1);
  // A single selection click must not start an editor by itself.
  await label().click();await page.waitForTimeout(650);assert.equal(await field().count(),0);
  await label().click();await field().waitFor();assert.equal(await field().inputValue(),'Gesture folder');
  await page.screenshot({path:path.join(results,'slow-click-inline.png')});await field().press('Escape');
  // A slow candidate followed immediately by a native second click is still
  // a fast double-click, not a rename intercepting the second click.
  await label().click({button:'right'});await page.keyboard.press('Escape');
  await label().click();await page.waitForTimeout(650);await label().dblclick();await page.waitForTimeout(550);
  assert.equal(await field().count(),0);assert.equal(await folder().getAttribute('aria-expanded'),'false');
  await label().dblclick();assert.equal(await folder().getAttribute('aria-expanded'),'true');
  await folder().click({button:'right'});
  const edit=page.getByRole('menuitem',{name:'Edit',exact:true}),submenu=page.getByRole('menu',{name:'Edit actions',exact:true});
  assert.equal(await page.getByRole('menuitem',{name:'Rename',exact:true}).count(),0);
  await page.keyboard.press('ArrowRight');await submenu.waitFor();assert.equal(await page.evaluate(()=>document.activeElement.getAttribute('aria-label')),'Edit properties');
  await page.keyboard.press('End');assert.equal(await page.evaluate(()=>document.activeElement.getAttribute('aria-label')),'Rename');
  await page.keyboard.press('ArrowLeft');assert.equal(await submenu.count(),0);assert.equal(await edit.evaluate(el=>el===document.activeElement),true);
  await edit.hover();await submenu.waitFor();
  assert.ok(await submenu.evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight;}));
  await page.screenshot({path:path.join(results,'edit-submenu.png')});
  await submenu.getByRole('menuitem',{name:'Rename',exact:true}).click();await field().fill('Renamed folder');await field().press('Enter');
  assert.equal(await page.getByRole('button',{name:'Renamed folder',exact:true}).count(),1);assert.equal(await child.count(),1);
  await page.getByRole('button',{name:'Undo',exact:true}).click();await label().waitFor();
  assert.deepEqual(errors,[]);console.log('Outliner gesture checks passed: fast folder toggle, slow inline rename, lone-click guard, competing double-click, nested Edit pointer/keyboard, viewport bounds, rename Undo.');
}finally{await app.close();}
