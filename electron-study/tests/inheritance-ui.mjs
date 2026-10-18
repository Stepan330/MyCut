import {_electron as electron} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {multiply,inverse} from '../src/scene-transform.mjs';
const root=path.resolve(fileURLToPath(new URL('../',import.meta.url))),results=process.env.MYCUT_UI_RESULTS||path.join(root,'test-results/inheritance');await mkdir(results,{recursive:true});
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const app=await electron.launch({args:[root],env}),page=await app.firstWindow(),errors=[];page.on('pageerror',e=>errors.push(e.message));
const row=id=>page.locator(`[data-layer-id="${id}"]`),object=id=>page.locator(`[data-object="${id}"]`);
const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
const matrix=id=>object(id).evaluate(el=>{const m=el.getScreenCTM();return [m.a,m.b,m.c,m.d,m.e,m.f];});
const near=(a,b,tolerance=.001)=>a.forEach((v,i)=>assert.ok(Math.abs(v-b[i])<tolerance,`${a} != ${b}`));
async function input(name,value){const field=page.getByLabel(name,{exact:true});await field.fill(String(value));await field.press('Enter');await settle();}
async function select(id){await row(id).locator('.tree-label').click();await settle();}
async function drop(source,target){
  await row(source).scrollIntoViewIfNeeded();
  const a=await row(source).locator('.tree-label').boundingBox();
  await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();
  await page.mouse.move(a.x+a.width/2+12,a.y+a.height/2,{steps:3});
  await row(target).scrollIntoViewIfNeeded();const b=await row(target).boundingBox();
  await page.mouse.move(b.x+100,b.y+b.height/2,{steps:10});await page.mouse.move(b.x+101,b.y+b.height/2);
  await page.waitForFunction(id=>document.querySelector(`[data-layer-id="${id}"]`)?.classList.contains('drop-inside'),target);
  await page.mouse.up();await settle();
}
try{
  await row('card').waitFor();await settle();const original=await matrix('ellipse');
  await drop('ellipse','card');near(await matrix('ellipse'),original);
  await drop('card','title');near(await matrix('ellipse'),original);
  assert.equal(await row('ellipse').getAttribute('aria-level'),'3');
  await select('title');
  for(const [name,value] of [['Position X',128],['Rotation',27],['Scale X',1.3]]){
    const parentBefore=await matrix('title'),childBefore=await matrix('ellipse');await input(name,value);
    const delta=multiply(await matrix('title'),inverse(parentBefore));near(await matrix('ellipse'),multiply(delta,childBefore));
  }
  await page.getByRole('button',{name:'Link scale axes',exact:true}).click();
  const beforeUneven=await matrix('ellipse'),parentUneven=await matrix('title');await input('Scale Y',.8);
  near(await matrix('ellipse'),multiply(multiply(await matrix('title'),inverse(parentUneven)),beforeUneven));
  const opacity=page.getByLabel('Opacity slider',{exact:true});await opacity.focus();await opacity.press('Home');await opacity.press('ArrowRight');await opacity.blur();await settle();
  const parentOpacity=Number(await opacity.inputValue());assert.equal(Number(await object('ellipse').getAttribute('opacity')),parentOpacity);
  await select('card');await opacity.focus();await opacity.press('Home');await opacity.press('ArrowRight');await opacity.blur();await settle();
  assert.equal(Number(await object('ellipse').getAttribute('opacity')),parentOpacity*Number(await opacity.inputValue()));
  // Restore usable visibility without removing the hierarchy.
  await opacity.focus();await opacity.press('End');await opacity.press('ArrowLeft');await opacity.press('ArrowRight');await opacity.blur();await select('title');await opacity.focus();await opacity.press('End');await opacity.press('ArrowLeft');await opacity.press('ArrowRight');await opacity.blur();await settle();
  assert.equal(Number(await object('ellipse').getAttribute('opacity')),1);
  await select('ellipse');
  await page.getByLabel('Preview zoom',{exact:true}).selectOption('60');await settle();
  const moveBefore=await matrix('ellipse'),center=await object('ellipse').evaluate(el=>{const p=new DOMPoint(72,72).matrixTransform(el.getScreenCTM());return {x:p.x,y:p.y};});
  await page.mouse.move(center.x,center.y);await page.mouse.down();await page.mouse.move(center.x+22,center.y+17,{steps:7});await page.mouse.up();await settle();
  near(await matrix('ellipse'),[...moveBefore.slice(0,4),moveBefore[4]+22,moveBefore[5]+17],2);
  await page.getByRole('button',{name:'Undo',exact:true}).click();await settle();near(await matrix('ellipse'),moveBefore);await select('ellipse');
  const corner=await object('ellipse').evaluate(el=>{const p=new DOMPoint(144,144).matrixTransform(el.getScreenCTM());return {x:p.x,y:p.y};});
  const handle=await page.locator('[data-handle="7"]').boundingBox();assert.ok(Math.hypot(handle.x+handle.width/2-corner.x,handle.y+handle.height/2-corner.y)<1);
  const anchor=await object('ellipse').evaluate(el=>{const p=new DOMPoint(0,0).matrixTransform(el.getScreenCTM());return {x:p.x,y:p.y};});
  await page.mouse.move(corner.x,corner.y);await page.mouse.down();await page.mouse.move(corner.x+35,corner.y+25,{steps:8});await page.mouse.up();await settle();
  const anchorAfter=await object('ellipse').evaluate(el=>{const p=new DOMPoint(0,0).matrixTransform(el.getScreenCTM());return {x:p.x,y:p.y};});
  assert.ok(Math.hypot(anchorAfter.x-anchor.x,anchorAfter.y-anchor.y)<1);
  await page.getByRole('button',{name:'Undo',exact:true}).click();await settle();
  // Parent folders expose the same transform/opacity controls.
  await select('title');await row('title').click({button:'right'});await page.getByRole('menuitem',{name:'Move to new folder',exact:true}).click();
  const rename=page.getByLabel('Rename object inline',{exact:true});await rename.fill('Scene group');await rename.press('Enter');
  const beforeFolder=await matrix('ellipse');await input('Position X',25);const afterFolder=await matrix('ellipse');
  const svgScale=await page.locator('.artboard svg').evaluate(el=>el.getScreenCTM().a);near(afterFolder,[...beforeFolder.slice(0,4),beforeFolder[4]+25*svgScale,beforeFolder[5]]);
  await page.screenshot({path:path.join(results,'inherited-transforms.png')});
  assert.deepEqual(errors,[]);console.log('Inheritance UI checks passed: nested position/rotation/scale, multiplied opacity, keep-world parenting, accurate child handles/anchored resizing, folder transforms.');
}finally{await app.close();}
