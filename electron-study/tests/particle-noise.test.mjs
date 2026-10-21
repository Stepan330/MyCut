import {test} from 'node:test';
import assert from 'node:assert/strict';
import {particleDensity,particleNoise,contactDustDensity,particleFlow} from '../src/particle-noise.mjs';
import {spawnElementalEffect} from '../src/elemental-materials.mjs';
import {HardGeometry} from '../src/engine-runtime.mjs';

test('particle density is a deterministic, bounded, non-radial noise field with a soft edge',()=>{
 const values=[];for(let y=-.8;y<=.8;y+=.1)for(let x=-.8;x<=.8;x+=.1){const a=particleDensity(x,y,23);assert.equal(a,particleDensity(x,y,23));assert.ok(a>=0&&a<=1);values.push(a);}
 assert.ok(new Set(values.map(v=>v.toFixed(3))).size>80);assert.notEqual(particleDensity(.4,0,23),particleDensity(0,.4,23));assert.equal(particleDensity(1,0,23),0);assert.ok(particleDensity(.999,0,23)<.0001);assert.notEqual(particleNoise(12,34,2),particleNoise(12,34,3));
});
test('contact noise follows all four sides of a footprint, not a point or screen-down gravity',()=>{
 const body={width:260,height:170},points=[[130,0],[-130,0],[0,85],[0,-85]];assert.ok(points.every(([x,y])=>contactDustDensity(x,y,body,3)>0));assert.ok(contactDustDensity(130,0,body,3)>contactDustDensity(0,0,body,3)*100);assert.ok(contactDustDensity(500,0,body,3)<1e-8);
});
test('coherent air flow is repeatable and continuous in space and time',()=>{
 const a=particleFlow(100,90,.5,41),b=particleFlow(100.001,90,.50001,41);assert.deepEqual(a,particleFlow(100,90,.5,41));assert.ok(Math.hypot(a.x-b.x,a.y-b.y)<.01);assert.notDeepEqual(a,particleFlow(240,90,.5,41));
});
test('mist density follows area and dust follows perimeter, with bounded bursts and minimal surface dust',()=>{
 const spawn=(element,width,height,kind='press')=>spawnElementalEffect({element,body:{x:10,y:20,width,height,elevation:0},origin:{x:10,y:20},seed:41,kind});
 for(const material of ['air','earth']){const small=spawn(material,130,85),large=spawn(material,260,170);assert.ok(large.length>small.length*1.8);assert.ok(large.length>=100);assert.ok(spawn(material,4000,3000).length<=321);assert.ok(spawn(material,260,170,'drag').length<large.length/2);}
 assert.equal(spawn('earth',260,170).filter(p=>p.emissionRegion==='surface').length,1);
});
test('direct manipulation updates actual Hard geometry and target together without a stale spring',()=>{
 const body=new HardGeometry({x:10,y:20,width:260,height:170,elevation:0});body.setTarget({x:300});body.step(.04);const current={...body.actual};body.place(current);assert.deepEqual(body.actual,current);body.place({...current,x:140,y:80});assert.equal(body.hitTest({x:150,y:90}),true);assert.equal(body.hitTest({x:20,y:30}),false);assert.equal(body.step(.1).x,140);assert.equal(body.velocity.x,0);assert.throws(()=>body.place({width:-10}));
});
