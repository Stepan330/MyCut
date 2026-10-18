import {_electron as electron} from 'playwright';
import assert from 'node:assert/strict';
import path from 'node:path';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {evaluateScene,transformPoint} from '../src/scene-transform.mjs';
const root=path.resolve(fileURLToPath(new URL('../',import.meta.url))),env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const app=await electron.launch({args:[root],env}),page=await app.firstWindow(),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
  await page.getByRole('toolbar',{name:'Drawing tools'}).waitFor();const file=path.join(root,'tests/fixtures/shape-picking.mycutproject');await app.evaluate(({dialog},file)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]});dialog.showMessageBox=async()=>({response:1});},file);
  await page.locator('.viewport').focus();await page.keyboard.press('Control+o');await page.waitForFunction(()=>document.querySelector('.statusbar').textContent.includes('Opened shape-picking.mycutproject'));
  await page.locator('[data-layer-id="card"]').click();await page.getByRole('button',{name:'Selection tool',exact:true}).click();
  const items=JSON.parse(await readFile(file,'utf8')).items,p=transformPoint(evaluateScene(items).get('ellipse').world,{x:50,y:50}),screen=await page.locator('.artboard>svg').evaluate((svg,p)=>{const s=new DOMPoint(p.x,p.y).matrixTransform(svg.getScreenCTM());return {x:s.x,y:s.y};},p);
  await page.mouse.click(screen.x,screen.y);assert.equal(await page.locator('[data-layer-id="ellipse"]').getAttribute('aria-selected'),'true');assert.equal(await page.getByRole('button',{name:'Selection tool',exact:true}).getAttribute('aria-pressed'),'true');
  await page.mouse.click(screen.x,screen.y);await page.getByLabel('Tool Mode',{exact:true}).waitFor();assert.equal(await page.getByLabel('Tool Mode',{exact:true}).inputValue(),'Edit');assert.equal(await page.getByLabel('Tool Shape',{exact:true}).inputValue(),'ellipse');
  assert.deepEqual(errors,[]);console.log('Graph source picking passed: first click selects nested circle, second click enters Shapes Edit.');
}finally{await app.close();}
