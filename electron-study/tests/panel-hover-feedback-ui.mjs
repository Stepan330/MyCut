import {_electron as electron} from 'playwright';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(fileURLToPath(new URL('../',import.meta.url))),env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const app=await electron.launch({args:[root],env}),page=await app.firstWindow(),errors=[];page.on('pageerror',e=>errors.push(e.message));
const panel=page.locator('.sidebar .dock-group').filter({has:page.locator('[data-dock-tab=details]')});
try{
  await page.emulateMedia({reducedMotion:'no-preference'});await panel.getByRole('button',{name:'Panel group settings',exact:true}).click();await page.getByRole('menuitemcheckbox',{name:'Auto-hide window',exact:true}).click();
  const lock=panel.getByRole('button',{name:'Lock auto-hide panel',exact:true});await lock.click();assert.equal(await lock.getAttribute('aria-pressed'),'true');assert.equal(await panel.locator('[data-lock-feedback]').count(),1);await page.waitForTimeout(180);assert.ok(await panel.locator('[data-lock-feedback]').evaluate(el=>Number(getComputedStyle(el).opacity))>.2);await page.waitForTimeout(400);assert.equal(await panel.locator('[data-lock-feedback]').count(),0);
  await lock.click();await page.locator('.viewport').focus();const body=await panel.locator('.dock-group-body').boundingBox();await page.mouse.move(body.x-7,body.y+body.height/2);await page.waitForTimeout(650);assert.equal(await panel.getAttribute('data-collapsed'),'false','outer edge and resize boundary keep panel open');
  await page.mouse.move(300,160);await page.waitForTimeout(180);assert.equal(await panel.getAttribute('data-collapsed'),'false','panel remains visible through 0.3 second grace');await page.waitForTimeout(180);assert.equal(await panel.getAttribute('data-collapsed'),'true','collapse starts after 0.3 second grace');
  const strip=panel.getByRole('button',{name:'Show Details',exact:true});await strip.hover();await page.waitForTimeout(450);assert.equal(await panel.getAttribute('data-collapsed'),'false');const r=await panel.locator('.dock-group-body').boundingBox();await page.mouse.move(r.x-7,r.y+50);await page.waitForTimeout(650);assert.equal(await panel.getAttribute('data-collapsed'),'false','reopened panel also recognizes its actual overlay border');assert.deepEqual(errors,[]);
  console.log('Panel hover feedback passed: 300ms close grace, 100ms reveal, outer resize boundary keeps panel open, lock highlight animates and clears.');
}finally{await app.close();}
