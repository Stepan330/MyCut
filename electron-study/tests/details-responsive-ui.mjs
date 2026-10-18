import {_electron as electron} from 'playwright';
import assert from 'node:assert/strict';
import path from 'node:path';
import {mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=path.resolve(fileURLToPath(new URL('../',import.meta.url))),env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const app=await electron.launch({args:[root],env}),page=await app.firstWindow(),errors=[];page.on('pageerror',e=>errors.push(e.message));
const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
try{
  const tab=page.locator('[data-dock-tab=details]');const r=await tab.boundingBox();await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await page.mouse.down();await page.mouse.move(320,160,{steps:15});await page.mouse.up();await settle();
  const panel=page.locator('.dock-floating').filter({has:tab});await panel.waitFor();await mkdir(path.join(root,'test-results/details-responsive'),{recursive:true});
  const widths=[];
  for(const width of [860,360,250]){
    await panel.evaluate((el,width)=>{el.style.width=width+'px';el.style.height='650px';el.style.left='80px';el.style.top='120px';},width);await settle();
    const metrics=await panel.locator('.adaptive-properties').first().evaluate(el=>{
      const rows=[...el.querySelectorAll('.adaptive-property')],box=n=>{const r=n.getBoundingClientRect();return {x:r.x,right:r.right,width:r.width};};
      return {ui:el.getBoundingClientRect().width/el.offsetWidth,overflow:el.scrollWidth-el.clientWidth,rows:rows.map(n=>({label:n.dataset.property,controls:box(n.querySelector('.property-controls')),spacer:box(n.querySelector('.property-spacer'))})),fields:[...el.querySelectorAll('.number-field')].map(box),link:box(el.querySelector('[aria-label="Link scale axes"]')),scaleLabel:box(el.querySelector('[data-property=Scale]>.property-label'))};
    });
    assert.ok(metrics.overflow<2,'no horizontal overflow at '+width);assert.ok(metrics.link.right<=metrics.scaleLabel.x+1,'link button precedes Scale label');
    const controls=metrics.rows[0].controls;assert.ok(controls.width/metrics.ui<=241,'controls stay compact');for(const row of metrics.rows)assert.ok(Math.abs(row.controls.right-controls.right)<2,'control columns align at right edge');
    assert.ok(metrics.fields.every(f=>f.width/metrics.ui<=121),'numeric fields never stretch');widths.push(metrics.rows[0].spacer.width/metrics.ui);
    await panel.screenshot({path:path.join(root,'test-results/details-responsive',width===860?'wide.png':width===360?'narrow.png':'compact.png')});
  }
  assert.ok(widths[0]>400&&widths[1]<3&&widths[2]<3,'spacer absorbs wide layout and disappears in narrow layout');
  await page.getByLabel('Scale X',{exact:true}).fill('1.25');await page.getByLabel('Scale X',{exact:true}).press('Enter');assert.equal(await page.getByLabel('Scale Y',{exact:true}).inputValue(),'1.25');await page.getByRole('button',{name:'Link scale axes',exact:true}).click();await page.getByLabel('Scale X',{exact:true}).fill('1.5');await page.getByLabel('Scale X',{exact:true}).press('Enter');assert.equal(await page.getByLabel('Scale Y',{exact:true}).inputValue(),'1.25');await page.getByRole('button',{name:'Undo',exact:true}).click();assert.equal(await page.getByLabel('Scale X',{exact:true}).inputValue(),'1.25');
  assert.deepEqual(errors,[]);console.log('Responsive Details passed: wide/normal/narrow layouts, compact right-aligned fields, expandable spacer, leading scale link, no overflow, linked/unlinked edits and Undo.');
}finally{await app.close();}
