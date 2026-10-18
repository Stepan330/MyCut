import {_electron as electron} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(fileURLToPath(new URL('../',import.meta.url))),results=process.env.MYCUT_UI_RESULTS||path.join(root,'test-results/tools');await mkdir(results,{recursive:true});
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const app=await electron.launch({args:[root],env}),page=await app.firstWindow(),errors=[];page.on('pageerror',e=>errors.push(e.message));
async function choose(name){if(['Rectangle','Ellipse'].includes(name)){await page.getByRole('button',{name:'Shapes tool',exact:true}).click();await page.getByLabel('Tool Mode',{exact:true}).selectOption('Create');await page.getByLabel('Tool Shape',{exact:true}).selectOption(name.toLowerCase());}else await page.getByRole('button',{name:`${name} tool`,exact:true}).click();await settle();}
const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
const at=(x,y)=>page.locator('.artboard>svg').evaluate((el,p)=>{const a=new DOMPoint(p.x,p.y).matrixTransform(el.getScreenCTM());return {x:a.x,y:a.y};},{x,y});
async function drag(a,b){const p=await at(...a),q=await at(...b);await page.mouse.move(p.x,p.y);await page.mouse.down();await page.mouse.move(q.x,q.y,{steps:12});await page.mouse.up();await settle();}
const undo=async()=>{await page.getByRole('button',{name:'Undo',exact:true}).click();await settle();};
try{
  await page.getByRole('toolbar',{name:'Drawing tools'}).waitFor();assert.equal(await page.getByRole('toolbar',{name:'Drawing tools'}).getByRole('button').count(),24);
  await choose('Brush');await page.getByLabel('Tool Size',{exact:true}).fill('24');await drag([180,400],[350,430]);
  assert.equal(await page.getByRole('treeitem').count(),4);assert.equal(await page.locator('[data-object="card"] [data-paint-stroke]').count(),1);
  await undo();assert.equal(await page.locator('[data-paint-stroke]').count(),0);await page.getByRole('button',{name:'Redo',exact:true}).click();await settle();await page.getByRole('button',{name:'Studio image',exact:true}).click();
  await choose('Eraser');await drag([240,410],[280,420]);assert.equal(await page.locator('mask path').count(),1);await undo();assert.equal(await page.locator('mask path').count(),0);
  await choose('Rectangle');await drag([450,150],[610,260]);assert.equal(await page.getByRole('treeitem').count(),5);assert.equal(await page.locator('[data-object] rect[fill="#16cbe0"]').count(),1);
  // Escape cancels a partially drawn new shape as one operation.
  await page.getByLabel('Tool Mode',{exact:true}).selectOption('Create');const p=await at(500,300),q=await at(600,400);await page.mouse.move(p.x,p.y);await page.mouse.down();await page.mouse.move(q.x,q.y);await page.keyboard.press('Escape');await page.mouse.up();assert.equal(await page.getByRole('treeitem').count(),5);
  await choose('Text');const textAt=await at(90,210);await page.mouse.click(textAt.x,textAt.y);
  const editor=page.getByLabel('Canvas text editor',{exact:true});await editor.waitFor();await editor.fill('Hello\nMyCut editor');await editor.press('Control+Enter');await settle();assert.equal(await editor.count(),0);
  const textId=await page.locator('[role=treeitem][aria-selected=true]').getAttribute('data-layer-id');assert.match(await page.locator(`[data-object="${textId}"]`).textContent(),/HelloMyCut editor/);
  await page.getByLabel('Tool Font size',{exact:true}).fill('72');await page.getByLabel('Tool Font size',{exact:true}).press('Tab');assert.equal(await page.locator(`[data-object="${textId}"] text`).getAttribute('font-size'),'72');
  const textWidth=await page.locator(`[data-object="${textId}"] text`).evaluate(el=>el.getBBox().width);assert.ok(textWidth>300);
  // Reopen in-place editor; Escape restores the original text.
  const textClick=await page.locator(`[data-object="${textId}"] text`).boundingBox();await page.mouse.click(textClick.x+12,textClick.y+20);await editor.waitFor();await editor.fill('Discard this');await editor.press('Escape');assert.match(await page.locator(`[data-object="${textId}"]`).textContent(),/HelloMyCut editor/);
  await choose('Hand');const before=await page.locator('.artboard').boundingBox(),view=await page.getByLabel('Canvas preview',{exact:true}).boundingBox();
  await page.mouse.move(view.x+view.width/2,view.y+view.height/2);await page.mouse.down();await page.mouse.move(view.x+view.width/2+50,view.y+view.height/2+30,{steps:8});await page.mouse.up();await settle();const after=await page.locator('.artboard').boundingBox();assert.ok(Math.abs(after.x-before.x-50)<2);
  const count=await page.getByRole('treeitem').count(),mouse={x:view.x+view.width/2+50,y:view.y+view.height/2+30};
  const underCursor=()=>page.locator('.artboard>svg').evaluate((el,p)=>{const a=new DOMPoint(p.x,p.y).matrixTransform(el.getScreenCTM().inverse());return {x:a.x,y:a.y};},mouse);
  const worldBefore=await underCursor();await page.mouse.wheel(0,-120);await settle();assert.ok(Number(await page.getByLabel('Preview zoom',{exact:true}).inputValue())>86);assert.equal(await page.getByRole('treeitem').count(),count);const worldAfter=await underCursor();assert.ok(Math.hypot(worldAfter.x-worldBefore.x,worldAfter.y-worldBefore.y)<1);
  await page.getByRole('button',{name:'Fit canvas',exact:true}).click();await settle();const fitted=await page.locator('.artboard').boundingBox();assert.ok(fitted.width<=view.width&&fitted.height<=view.height);
  await choose('Selection');const panBefore=await page.locator('.artboard').boundingBox();await page.keyboard.down('Space');await page.mouse.move(mouse.x,mouse.y);await page.mouse.down();await page.mouse.move(mouse.x+30,mouse.y+20,{steps:6});await page.mouse.up();await page.keyboard.up('Space');await settle();assert.ok(Math.abs((await page.locator('.artboard').boundingBox()).x-panBefore.x-30)<2);assert.equal(await page.getByRole('treeitem').count(),count);await page.getByRole('button',{name:'Fit canvas',exact:true}).click();
  await choose('Image adjustments');
  // Generate a valid local PNG fixture using Chromium, without network access.
  const data=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=200;c.height=120;const x=c.getContext('2d');x.fillStyle='#e09030';x.fillRect(0,0,200,120);return c.toDataURL().split(',')[1];});
  await page.getByLabel('Import image file',{exact:true}).setInputFiles({name:'test-image.png',mimeType:'image/png',buffer:Buffer.from(data,'base64')});
  await page.getByRole('button',{name:'test-image.png',exact:true}).waitFor();assert.equal(await page.locator('[data-object] image').count(),1);
  const brightness=page.getByLabel('Tool Brightness',{exact:true});await brightness.focus();await brightness.press('Home');await brightness.press('ArrowRight');await brightness.blur();await settle();
  assert.ok(await page.locator('feFuncR').evaluateAll(els=>els.some(el=>Number(el.getAttribute('slope'))<1)));
  await page.screenshot({path:path.join(results,'tools-editor.png')});assert.deepEqual(errors,[]);console.log('Tools UI passed: generated controls, brush/eraser, shape/cancel, multiline text/style, pan/wheel/fit, import and image adjustments, Undo/Redo.');
}finally{await app.close();}
