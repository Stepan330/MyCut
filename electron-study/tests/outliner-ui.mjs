import {_electron as electron} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(fileURLToPath(new URL('../',import.meta.url))),results=process.env.MYCUT_UI_RESULTS||path.join(root,'test-results/outliner-actions');await mkdir(results,{recursive:true});
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const app=await electron.launch({args:[root],env});const page=await app.firstWindow(),errors=[];page.on('pageerror',e=>errors.push(e.message));
const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
const row=id=>page.locator(`[data-layer-id="${id}"]`);
const menu=()=>page.getByRole('menu',{name:'Outliner actions'});
async function choose(name){if(['Rename','Edit properties'].includes(name))await menu().getByRole('menuitem',{name:'Edit',exact:true}).click();await menu().getByRole('menuitem',{name,exact:true}).click();await settle();}
async function name(value){const input=page.getByLabel('Rename object inline',{exact:true});assert.equal(await page.getByRole('dialog').count(),0);await input.fill(value);await input.press('Enter');await settle();}
async function undo(){await page.getByRole('button',{name:'Undo',exact:true}).click();await settle();}
try{
  await row('card').waitFor();assert.equal(await row('background').getAttribute('draggable'),'false');
  await row('background').click({button:'right'});assert.equal(await menu().getByRole('menuitem',{name:'Delete',exact:true}).isEnabled(),false);assert.equal(await menu().getByRole('menuitem',{name:'Move to new folder',exact:true}).isEnabled(),false);await page.keyboard.press('Escape');
  await row('card').click({button:'right'});
  assert.deepEqual(await menu().getByRole('group').evaluateAll(groups=>groups.map(g=>g.getAttribute('aria-label'))),['Object','Hierarchy','Create','Manage']);
  assert.equal(await menu().getByRole('menuitem').count(),await menu().locator('[role=menuitem] .context-icon svg').count());
  assert.equal(await page.evaluate(()=>document.activeElement.textContent.trim()),'Edit');
  await page.keyboard.press('ArrowDown');assert.equal(await page.evaluate(()=>document.activeElement.getAttribute('aria-label')),'Move to new folder');
  await page.keyboard.press('End');assert.equal(await page.evaluate(()=>document.activeElement.getAttribute('aria-label')),'Delete');
  await choose('Edit properties');assert.equal(await page.getByLabel('Object name',{exact:true}).evaluate(el=>el===document.activeElement),true);
  await row('title').locator('.tree-label').click();await row('card').locator('.tree-label').click({modifiers:['Shift']});
  await row('title').locator('.tree-label').dragTo(row('ellipse'),{targetPosition:{x:100,y:21}});await settle();
  assert.deepEqual(await page.getByRole('treeitem').evaluateAll(nodes=>nodes.map(n=>n.dataset.layerId)),['ellipse','title','card','background']);await undo();
  await row('title').locator('.tree-label').click();await row('ellipse').locator('.tree-label').click({modifiers:['Shift']});
  assert.equal(await page.locator('[role=treeitem][aria-selected=true]').count(),3);
  await row('card').click({button:'right'});assert.equal(await menu().getByRole('menuitem',{name:'Edit',exact:true}).isEnabled(),true);
  await choose('Move to new folder');await name('Artwork');
  const artwork=page.getByRole('treeitem').filter({has:page.getByRole('button',{name:'Artwork',exact:true})});const folderId=await artwork.getAttribute('data-layer-id');
  assert.equal(await row('card').getAttribute('aria-level'),'2');assert.equal(await row('title').getAttribute('aria-level'),'2');
  assert.equal(await page.locator('[data-object]').count(),4,'folders do not draw pixels');
  await page.getByRole('button',{name:'Toggle Artwork',exact:true}).click();assert.equal(await row('card').count(),0);
  await page.getByLabel('Search objects',{exact:true}).fill('Studio');assert.equal(await row('card').count(),1);assert.equal(await artwork.count(),1);await page.getByRole('button',{name:'Clear object search',exact:true}).click();
  await page.getByRole('button',{name:'Toggle Artwork',exact:true}).click();
  await artwork.click({button:'right'});await choose('Rename');await page.getByLabel('Rename object inline',{exact:true}).fill('Art group');await page.getByLabel('Rename object inline',{exact:true}).press('Enter');assert.equal(await page.getByRole('button',{name:'Art group',exact:true}).count(),1);
  await undo();assert.equal(await page.getByRole('button',{name:'Artwork',exact:true}).count(),1);
  // Root context creates inside composition; folder context creates inside folder.
  await page.locator('.tree-root').click({button:'right'});assert.equal(await menu().getByRole('menuitem',{name:'Delete',exact:true}).isEnabled(),false);await choose('Create folder');await name('Empty');
  const empty=page.getByRole('treeitem').filter({has:page.getByRole('button',{name:'Empty',exact:true})});const emptyId=await empty.getAttribute('data-layer-id');
  await empty.click({button:'right'});await choose('Create new layer');assert.equal(await page.getByLabel('Object name',{exact:true}).inputValue(),'New layer');
  const newLayer=page.getByRole('treeitem').filter({has:page.getByRole('button',{name:'New layer',exact:true})});assert.equal(await newLayer.getAttribute('aria-level'),'2');
  await empty.click({button:'right'});await choose('Delete');assert.equal(await row(emptyId).count(),0);assert.equal(await newLayer.count(),0);await undo();assert.equal(await row(emptyId).count(),1);assert.equal(await newLayer.count(),1);
  // A folder with a locked child cannot be moved/deleted, nor can its child drag.
  await row('card').locator('.tree-label').click();await page.getByRole('button',{name:'Toggle object lock',exact:true}).click();await settle();assert.equal(await artwork.getAttribute('draggable'),'false');
  await artwork.click({button:'right'});assert.equal(await menu().getByRole('menuitem',{name:'Delete',exact:true}).isEnabled(),false);await page.keyboard.press('Escape');await undo();
  // Resize the divider beneath Outliner; scene/selection remain intact.
  const before=await page.getByRole('region',{name:'Outliner',exact:true}).boundingBox();
  const divider=page.getByRole('separator',{name:'Resize Outliner height'}),r=await divider.boundingBox();await page.mouse.move(r.x+r.width/2,r.y+2);await page.mouse.down();await page.mouse.move(r.x+r.width/2,r.y+100,{steps:5});await page.mouse.up();
  const after=await page.getByRole('region',{name:'Outliner',exact:true}).boundingBox();assert.ok(after.height>before.height+50);
  // Right click actual empty space: only creation actions apply, not the old selection.
  const scroll=await page.locator('.tree-scroll').boundingBox();await page.mouse.click(scroll.x+100,scroll.y+scroll.height-8,{button:'right'});
  assert.equal(await menu().getByRole('menuitem',{name:'Edit',exact:true}).isEnabled(),false);assert.equal(await menu().getByRole('menuitem',{name:'Create folder',exact:true}).isEnabled(),true);
  assert.equal(await menu().getByRole('group').first().getAttribute('aria-label'),'Create');
  assert.ok(await menu().evaluate(el=>el.getBoundingClientRect().bottom<=innerHeight&&el.getBoundingClientRect().right<=innerWidth));
  await page.screenshot({path:path.join(results,'outliner-context.png')});await page.keyboard.press('Escape');
  // Real drop into folder center establishes parent membership.
  await row('card').locator('.tree-label').dragTo(empty,{targetPosition:{x:100,y:11}});await settle();assert.equal(await row('card').getAttribute('aria-level'),'2');
  await empty.locator('.folder-toggle').click();assert.equal(await row('card').count(),0);await empty.locator('.folder-toggle').click();assert.equal(await row('card').count(),1);
  await undo();await artwork.locator('.folder-toggle').click();assert.equal(await row('card').count(),0);
  // Deleting all unlocked layers must leave a usable empty document.
  await page.getByRole('button',{name:'File',exact:true}).click();await page.getByRole('button',{name:'Reset sample scene',exact:true}).click();await settle();
  await row('background').locator('.tree-label').click();await page.getByRole('button',{name:'Toggle object lock',exact:true}).click();
  await row('title').locator('.tree-label').click();await row('background').locator('.tree-label').click({modifiers:['Shift']});
  await row('card').click({button:'right'});await choose('Delete');assert.equal(await page.getByRole('treeitem').count(),0);
  assert.equal(await page.getByText('Select an object',{exact:true}).count(),1);
  await page.getByRole('button',{name:'Add object',exact:true}).click();assert.equal(await page.getByRole('treeitem').count(),1);await undo();assert.equal(await page.getByRole('treeitem').count(),0);await undo();assert.equal(await page.getByRole('treeitem').count(),4);
  assert.deepEqual(errors,[]);console.log('Outliner UI checks passed: locks, Shift range, multi-context, group/rename/create/delete+Undo, real hierarchy, ancestor search, collapse, inherited lock guard, vertical resize, empty/root menus, folder drop.');
}finally{await app.close();}
