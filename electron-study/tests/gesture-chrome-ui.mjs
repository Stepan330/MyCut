import {_electron as electron} from 'playwright';
import assert from 'node:assert/strict';
import path from 'node:path';
import {mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=path.resolve(fileURLToPath(new URL('../',import.meta.url))),results=path.join(root,'test-results/gesture-chrome');await mkdir(results,{recursive:true});
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const app=await electron.launch({args:[root],env}),page=await app.firstWindow(),errors=[];page.on('pageerror',e=>errors.push(e.message));
const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
async function dragHeader(p,edge){const r=await page.locator('.gesture-surface').boundingBox();await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await page.mouse.down();await page.mouse.move(p.x,p.y,{steps:18});await settle();if(edge){assert.equal(await page.locator('.dock-restore-edge').count(),1);assert.equal(await page.locator('.dock-drop-highlight').getAttribute('data-dock-preview-edge'),edge);}await page.mouse.up();await settle();}
try{
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.getByRole('button',{name:'Group sidebar tabs',exact:true}).click();assert.equal(await page.locator('.sidebar-group-button').count(),0);
  assert.equal(await page.locator('.sidebar .dock-group-header [role=tab] svg').count(),2);
  await page.locator('.sidebar').getByRole('button',{name:'Panel group settings',exact:true}).click();await page.getByRole('menuitemradio',{name:'Semicircle',exact:true}).click();
  const trailStyle=await page.locator('.gesture-trail').evaluate(el=>({opacity:Number(getComputedStyle(el).opacity),filter:getComputedStyle(el).filter}));assert.ok(trailStyle.opacity<=.4);assert.match(trailStyle.filter,/blur\(3px\)/);assert.match(trailStyle.filter,/30px/,'trail halo is ten times broader than the previous 3px halo');
  const header=await page.locator('.gesture-header').boundingBox();assert.ok(header.height>=76);assert.equal(await page.locator('.gesture-tab-strip > button svg').count(),0);assert.equal(await page.locator('.gesture-deck-face svg').count(),2);assert.equal(await page.locator('.gesture-deck-rotor').evaluate(el=>getComputedStyle(el).transformStyle),'preserve-3d');const faces=await page.locator('.gesture-deck-face').evaluateAll(nodes=>nodes.map(n=>getComputedStyle(n).transform));assert.notEqual(faces[0],faces[1],'card faces have perpendicular transforms');
  const r=await page.locator('.gesture-tab-strip').boundingBox();await page.mouse.move(r.x+r.width/2,r.y+r.height+8);await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await settle();assert.ok(Number(await page.locator('.gesture-deck').evaluate(el=>el.style.getPropertyValue('--deck-strength')))>0);const tilt=await page.locator('.gesture-deck').evaluate(el=>el.style.getPropertyValue('--deck-x'));await page.mouse.move(r.x+r.width+15,r.y+r.height/2);assert.notEqual(await page.locator('.gesture-deck').evaluate(el=>el.style.getPropertyValue('--deck-x')),tilt,'preview follows pointer outside header');await page.waitForTimeout(550);assert.equal(Number(await page.locator('.gesture-deck').evaluate(el=>el.style.getPropertyValue('--deck-strength'))),0);
  await page.mouse.move(r.x+60,r.y+50);await page.mouse.move(r.x+120,r.y+25,{steps:15});await settle();assert.ok(await page.locator('.gesture-trail line').count()>0);await page.screenshot({path:path.join(results,'trail.png')});await page.waitForTimeout(500);assert.equal(await page.locator('.gesture-trail line').count(),0);
  const before=await page.locator('.left-workspace').boundingBox();await dragHeader({x:320,y:180});assert.equal(await page.locator('.dock-floating').count(),1);assert.equal(await page.locator('.dock-floating [data-dock-tab]').count(),2);
  assert.equal(await page.locator('.dock-empty,.dock-restore-targets').count(),0);assert.equal(await page.getByRole('separator',{name:'Resize sidebar',exact:true}).isVisible(),false);
  const expanded=await page.locator('.left-workspace').boundingBox();assert.ok(expanded.width>before.width+250);await page.screenshot({path:path.join(results,'collapsed.png')});
  for(const edge of ['left','top','bottom','right']){
    const w=await page.locator('.workspace').boundingBox(),p={x:w.x+w.width/2,y:w.y+w.height/2};if(edge==='left')p.x=w.x+15;if(edge==='right')p.x=w.x+w.width-15;if(edge==='top')p.y=w.y+15;if(edge==='bottom')p.y=w.y+w.height-15;
    await dragHeader(p,edge);assert.equal(await page.locator('.dock-floating').count(),0);assert.equal(await page.locator('.sidebar').getAttribute('data-placement'),edge);assert.equal(await page.locator('.sidebar [data-dock-tab]').count(),2);assert.equal(await page.locator('.dock-restore-targets').count(),0);
    const side=await page.locator('.sidebar').boundingBox(),left=await page.locator('.left-workspace').boundingBox();if(edge==='left')assert.ok(side.x+side.width<=left.x);if(edge==='right')assert.ok(left.x+left.width<=side.x);if(edge==='top')assert.ok(side.y+side.height<=left.y);if(edge==='bottom')assert.ok(left.y+left.height<=side.y);
    if(edge!=='right')await dragHeader({x:400,y:210});
  }
  // Cancelling a new zone must leave the original floating group and no blank sidebar.
  await dragHeader({x:400,y:210});const start=await page.locator('.gesture-surface').boundingBox(),w=await page.locator('.workspace').boundingBox();
  await page.mouse.move(start.x+start.width/2,start.y+start.height/2);await page.mouse.down();await page.mouse.move(w.x+w.width-15,w.y+w.height/2,{steps:15});await settle();assert.equal(await page.locator('.dock-restore-targets').count(),1);await page.keyboard.press('Escape');await page.mouse.up();await settle();assert.equal(await page.locator('.dock-restore-targets,.dock-drop-highlight').count(),0);assert.equal(await page.locator('.dock-floating [data-dock-tab]').count(),2);assert.equal(await page.locator('.sidebar').isVisible(),false);
  await page.screenshot({path:path.join(results,'restored.png')});assert.deepEqual(errors,[]);console.log('Gesture chrome UI passed: clean tall header, fading trail, whole-group drag, empty collapse, four edge restore zones, Escape cancellation.');
}finally{await app.close();}
