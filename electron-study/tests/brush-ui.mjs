import {_electron as electron} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(fileURLToPath(new URL('../',import.meta.url))),results=process.env.MYCUT_UI_RESULTS||path.join(root,'test-results/brush');await mkdir(results,{recursive:true});
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const app=await electron.launch({args:[root],env}),page=await app.firstWindow(),errors=[];page.on('pageerror',e=>errors.push(e.message));
const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
async function point(x,y){return page.locator('.artboard>svg').evaluate((el,p)=>{const q=new DOMPoint(p.x,p.y).matrixTransform(el.getScreenCTM());return {x:q.x,y:q.y};},{x,y});}
async function draw(y,abort=false){const a=await point(200,y),b=await point(430,y+15);await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:16});await settle();assert.ok(await page.locator('[data-dab-count]').count()>0,'live paint before pointerup');if(abort)await page.keyboard.press('Escape');await page.mouse.up();await settle();}
try{
  await page.getByRole('button',{name:'Brush tool',exact:true}).click();await settle();
  await page.getByLabel('Tool Size',{exact:true}).fill('36');await page.getByLabel('Tool Size',{exact:true}).press('Enter');
  await draw(340);let strokes=page.locator('[data-object="card"] [data-paint-stroke]');assert.equal(await strokes.count(),1);assert.equal(await strokes.first().getAttribute('data-brush-tip'),'Round');
  await page.getByLabel('Tool Tip',{exact:true}).selectOption('Soft');await page.getByRole('button',{name:'Tool settings',exact:true}).click();await page.getByRole('button',{name:'Advanced settings',exact:true}).click();await page.getByLabel('Tool Hardness',{exact:true}).fill('0.1');await page.getByLabel('Tool Flow',{exact:true}).fill('0.3');await page.getByRole('button',{name:'Close tool settings',exact:true}).click();await draw(390);assert.equal(await strokes.count(),2);assert.equal(await strokes.nth(1).locator('radialGradient').count(),1);assert.equal(await strokes.nth(1).locator('g[opacity="0.3"]').count()>0,true);
  await page.getByLabel('Tool Tip',{exact:true}).selectOption('Flat');await page.getByRole('button',{name:'Tool settings',exact:true}).click();await page.getByRole('button',{name:'Advanced settings',exact:true}).click();await page.getByLabel('Tool Tip angle',{exact:true}).fill('45');await page.getByLabel('Tool Tip angle',{exact:true}).press('Enter');await page.getByLabel('Tool Roundness',{exact:true}).fill('0.3');await page.getByLabel('Tool Stabilizer',{exact:true}).selectOption('Pulled string');await page.getByRole('button',{name:'Close tool settings',exact:true}).click();await draw(440);assert.equal(await strokes.count(),3);assert.ok(await strokes.nth(2).locator('rect').count()>0);assert.equal(await strokes.first().getAttribute('data-brush-tip'),'Round','settings do not mutate old strokes');
  await page.getByRole('button',{name:'Undo',exact:true}).click();assert.equal(await strokes.count(),2);await page.getByRole('button',{name:'Redo',exact:true}).click();assert.equal(await strokes.count(),3);await draw(300,true);assert.equal(await strokes.count(),3);
  await page.screenshot({path:path.join(results,'brush-types.png')});assert.deepEqual(errors,[]);console.log('Brush UI passed: live round/soft/flat, gradient, flow, immutable settings, Undo/Redo, Escape.');
}finally{await app.close();}
