import {_electron as electron} from 'playwright';import assert from 'node:assert/strict';import path from 'node:path';import {mkdir} from 'node:fs/promises';import {fileURLToPath} from 'node:url';
const root=path.resolve(fileURLToPath(new URL('../',import.meta.url))),env={...process.env};delete env.ELECTRON_RUN_AS_NODE;const app=await electron.launch({args:[root],env}),page=await app.firstWindow(),errors=[];page.on('pageerror',e=>errors.push(e.message));const results=path.join(root,'test-results/dock-preview-animation');await mkdir(results,{recursive:true});
const center=async el=>{const r=await el.boundingBox();return {x:r.x+r.width/2,y:r.y+r.height/2};};
try{
 await page.locator('[data-dock-tab=details]').waitFor();const start=await center(page.locator('[data-dock-tab=details]')),one=await center(page.locator('[data-dock-tab=outliner]')),two=await center(page.locator('[data-dock-tab=content-browser]'));
 await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(one.x,one.y,{steps:10});await page.waitForTimeout(300);
 const preview=page.getByLabel('Dock placement preview',{exact:true}),before=await preview.boundingBox();await page.mouse.move(two.x,two.y);await page.waitForTimeout(35);
 const moving=await preview.evaluate(el=>{const r=el.getBoundingClientRect();return {width:r.width,height:r.height,left:r.left,top:r.top,target:[parseFloat(el.style.left),parseFloat(el.style.top),parseFloat(el.style.width),parseFloat(el.style.height)],animations:el.getAnimations().length};});
 assert.ok(moving.animations>0,'placement highlight animates its geometry');
 assert.ok(Math.abs(moving.width-moving.target[2])+Math.abs(moving.height-moving.target[3])>2,'preview is between old and target dimensions');
 await page.waitForTimeout(300);const settled=await preview.boundingBox();assert.ok(Math.abs(settled.width-moving.target[2])<1&&Math.abs(settled.height-moving.target[3])<1);assert.notEqual(settled.width,before.width);
 await page.screenshot({path:path.join(results,'preview.png')});await page.keyboard.press('Escape');await page.mouse.up();assert.equal(await preview.count(),0);
 await page.getByRole('button',{name:'Interface settings',exact:true}).click();await page.getByLabel('Animate buttons and zones',{exact:true}).uncheck();await page.getByRole('button',{name:'Close settings',exact:true}).click();
 await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(one.x,one.y,{steps:10});assert.equal(await preview.evaluate(el=>getComputedStyle(el).transitionDuration),'0s','disabled animation preference reaches body portal');await page.keyboard.press('Escape');await page.mouse.up();assert.deepEqual(errors,[]);console.log('Dock placement preview animates position/size, settles exactly, cancels cleanly and respects disabled animations.');
}catch(e){await page.screenshot({path:path.join(results,'failure.png')});throw e;}finally{await app.close();}
