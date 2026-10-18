import {_electron as electron} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(fileURLToPath(new URL('../',import.meta.url))),results=process.env.MYCUT_UI_RESULTS||path.join(root,'test-results/scrub-bounds');await mkdir(results,{recursive:true});
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const app=await electron.launch({args:[root],env}),page=await app.firstWindow(),errors=[];page.on('pageerror',e=>errors.push(e.message));
const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
async function choose(name){if(['Rectangle','Ellipse'].includes(name)){await page.getByRole('button',{name:'Shapes tool',exact:true}).click();await page.getByLabel('Tool Mode',{exact:true}).selectOption('Create');await page.getByLabel('Tool Shape',{exact:true}).selectOption(name.toLowerCase());}else await page.getByRole('button',{name:`${name} tool`,exact:true}).click();}
const at=(x,y)=>page.locator('.artboard>svg').evaluate((el,p)=>{const q=new DOMPoint(p.x,p.y).matrixTransform(el.getScreenCTM());return {x:q.x,y:q.y};},{x,y});
const selected=()=>page.locator('[role=treeitem][aria-selected=true]').getAttribute('data-layer-id');
async function scrub(label,dx,abort=false){const field=page.getByLabel(label,{exact:true});await field.scrollIntoViewIfNeeded();const r=await field.boundingBox();await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await page.mouse.down();await page.mouse.move(r.x+r.width/2+dx,r.y+r.height/2,{steps:8});if(abort)await page.keyboard.press('Escape');await page.mouse.up();await settle();}
async function undo(){await page.getByRole('button',{name:'Undo',exact:true}).click();await settle();}
try{
  await page.getByRole('toolbar',{name:'Drawing tools'}).waitFor();
  await scrub('Position X',30);assert.equal(await page.getByLabel('Position X',{exact:true}).inputValue(),'150');await undo();assert.equal(await page.getByLabel('Position X',{exact:true}).inputValue(),'120');
  await scrub('Position X',40,true);assert.equal(await page.getByLabel('Position X',{exact:true}).inputValue(),'120');
  await choose('Rectangle');const a=await at(450,100),b=await at(600,200);await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:8});await page.mouse.up();await settle();
  const rect=await selected();await page.getByRole('button',{name:'Tool settings',exact:true}).click();await page.getByRole('button',{name:'Advanced settings',exact:true}).click();await scrub('Settings Outline width',8);assert.equal(await page.getByLabel('Settings Outline width',{exact:true}).inputValue(),'10');await page.getByRole('button',{name:'Close tool settings',exact:true}).click();await undo();await page.getByRole('button',{name:'Tool settings',exact:true}).click();await page.getByRole('button',{name:'Advanced settings',exact:true}).click();assert.equal(await page.getByLabel('Settings Outline width',{exact:true}).inputValue(),'2');await page.getByRole('button',{name:'Close tool settings',exact:true}).click();
  await page.getByLabel('Shape width',{exact:true}).fill('220');await page.getByLabel('Shape width',{exact:true}).press('Enter');assert.equal(await page.locator(`[data-object="${rect}"] .selection rect`).getAttribute('width'),'220');
  await page.getByLabel('Shape height',{exact:true}).fill('130');await page.getByLabel('Shape height',{exact:true}).press('Enter');assert.equal(await page.locator(`[data-object="${rect}"] .selection rect`).getAttribute('height'),'130');
  await page.locator('.tree-root').click({button:'right'});await page.getByRole('menuitem',{name:'Create new layer',exact:true}).click();await choose('Brush');await page.getByLabel('Tool Size',{exact:true}).fill('20');await page.getByLabel('Tool Size',{exact:true}).press('Enter');const p=await at(350,430);await page.mouse.click(p.x,p.y);await settle();const dot=await selected();await choose('Selection');
  const box=page.locator(`[data-object="${dot}"] .selection rect`);assert.equal(Number(await box.getAttribute('width')),20);assert.equal(Number(await box.getAttribute('height')),20);
  await choose('Selection');await page.mouse.move(p.x,p.y);await page.mouse.down();await page.mouse.move(p.x+30,p.y+20,{steps:8});await page.mouse.up();await settle();assert.equal(await page.getByLabel('Scale X',{exact:true}).inputValue(),'1');assert.notEqual(await page.getByLabel('Position X',{exact:true}).inputValue(),'0');await undo();
  const h=await page.locator('[data-handle="7"]').boundingBox();await page.mouse.move(h.x+h.width/2,h.y+h.height/2);await page.mouse.down();await page.mouse.move(h.x+h.width/2+25,h.y+h.height/2+25,{steps:8});await page.mouse.up();await settle();assert.ok(Number(await page.getByLabel('Scale X',{exact:true}).inputValue())>1);await undo();
  // A real folder frame comes from its dot, not 960×600.
  await page.locator(`[data-layer-id="${dot}"]`).click({button:'right'});await page.getByRole('menuitem',{name:'Move to new folder',exact:true}).click();await page.getByLabel('Rename object inline',{exact:true}).press('Enter');
  assert.equal(Number(await page.locator('.group-selection rect').getAttribute('width')),20);assert.equal(await page.locator('[data-handle]').count(),8);
  const groupCorner=await page.locator('[data-handle="7"]').boundingBox();await page.mouse.move(groupCorner.x+groupCorner.width/2,groupCorner.y+groupCorner.height/2);await page.mouse.down();await page.mouse.move(groupCorner.x+groupCorner.width/2+20,groupCorner.y+groupCorner.height/2+20,{steps:8});await page.mouse.up();await settle();assert.ok(Number(await page.getByLabel('Scale X',{exact:true}).inputValue())>1);await undo();
  await page.locator('[data-layer-id="title"] .tree-label').click();await page.getByRole('button',{name:'Edit text on canvas',exact:true}).click();
  const editor=page.getByLabel('Canvas text editor',{exact:true});await editor.waitFor();await editor.fill('Direct edit');await editor.press('Control+Enter');assert.match(await page.locator('[data-object="title"]').textContent(),/Direct edit/);
  await page.screenshot({path:path.join(results,'scrub-and-content-bounds.png')});assert.deepEqual(errors,[]);console.log('Scrub/bounds UI passed: shared numeric dragging, one Undo/Escape, rectangle dimensions, tight dot frame/move/resize, group frame/resize, explicit canvas text editing.');
}finally{await app.close();}
