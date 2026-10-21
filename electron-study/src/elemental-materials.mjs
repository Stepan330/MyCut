import {particleFlow} from './particle-noise.mjs';
// Element is a behavioral/material contract, not a palette. Shared by pure
// graph nodes and the Interface World adapter; it never writes document data.
// Top-down world: X/Y are the interface plane; gravity acts along Z into it.
export const elementalMaterials=Object.freeze({
 earth:Object.freeze({id:'earth',label:'Earth · stone / dust',substance:'Diffuse mineral dust at the contact footprint',hard:Object.freeze({frequency:8,damping:.92}),softFrequency:8,softDamping:.9}),
 water:Object.freeze({id:'water',label:'Water · droplets / ripples',substance:'Water droplets and surface ripples',hard:Object.freeze({frequency:10,damping:.8}),softFrequency:10,softDamping:.65}),
 air:Object.freeze({id:'air',label:'Air · condensation mist',substance:'Condensation mist carried by air',hard:Object.freeze({frequency:14,damping:.76}),softFrequency:12,softDamping:.65}),
 fire:Object.freeze({id:'fire',label:'Fire · hot embers',substance:'Incandescent embers and sparks',hard:Object.freeze({frequency:21,damping:.68}),softFrequency:21,softDamping:.58}),
});
export function elementalMaterial(id){const material=elementalMaterials[id];if(!material)throw Error('Unknown elemental material');return material;}
export function materialPose(element,energy=0,seconds=0){
 elementalMaterial(element);if(!Number.isFinite(energy)||!Number.isFinite(seconds))throw Error('Invalid material stimulus');const e=Math.max(0,Math.min(1.3,energy));
 if(element==='earth')return {scale:{x:1+e*.0015,y:1+e*.0015},skew:e*.02};
 if(element==='water'){const x=1+e*.035*Math.sin(seconds*8);return {scale:{x,y:1/x},skew:Math.sin(seconds*6)*e*.65};}
 if(element==='air')return {scale:{x:1+Math.sin(seconds*2.4)*e*.012,y:1+Math.cos(seconds*1.8)*e*.007},skew:Math.sin(seconds*2)*e*.5};
 const impulse=(.6+.4*Math.sin(seconds*19))*e;return {scale:{x:1-impulse*.012,y:1+impulse*.026},skew:Math.sin(seconds*13)*e*.2};
}
const random=seed=>{let n=seed|0;return ()=>{n^=n<<13;n^=n>>>17;n^=n<<5;return (n>>>0)/4294967296;};};
export function spawnElementalEffect({element,origin,body,velocity={x:0,y:0,z:0},kind='press',seed=1}){
 elementalMaterial(element);
 if(!origin||![origin.x,origin.y].every(Number.isFinite)||!body||![body.x,body.y,body.width,body.height,body.elevation??0].every(Number.isFinite)||body.width<=0||body.height<=0||!['press','lift','dismiss','impact','fracture','drag'].includes(kind))throw Error('Elemental emission requires a body, cause and contact footprint');
 const rand=random(seed||1),height=Math.max(0,body.elevation??0),supported=height<2,earth=element==='earth',surfaceCount=earth?1:0,perimeter=2*(body.width+body.height),area=body.width*body.height;
 // Spatial density, capped per burst. A drag emits smaller overlapping parcels
 // along the travelled footprint instead of multiplying full press explosions.
 const density=earth?perimeter/7:element==='air'?area/410:perimeter/(element==='water'?20:12),strength=kind==='impact'?1.3:kind==='fracture'?1.6:kind==='drag'?.24:1,count=earth&&!supported?surfaceCount:Math.max(8,Math.min(320,Math.ceil(density*strength))),particles=[];
 const contour=(index,total)=>{const length=2*(body.width+body.height),d=(index+rand())/Math.max(1,total)*length,band=4+rand()*9;let x,y,nx,ny;if(d<body.width){x=body.x+d;y=body.y;nx=0;ny=-1;}else if(d<body.width+body.height){x=body.x+body.width;y=body.y+d-body.width;nx=1;ny=0;}else if(d<2*body.width+body.height){x=body.x+body.width-(d-body.width-body.height);y=body.y+body.height;nx=0;ny=1;}else{x=body.x;y=body.y+body.height-(d-2*body.width-body.height);nx=-1;ny=0;}return {x:x+nx*band,y:y+ny*band,nx,ny};};
 for(let i=0;i<count;i++){
  const contact=contour(i,count),surface=earth&&i>=count-surfaceCount,location=surface||element==='air'||element==='fire'&&kind==='dismiss'?{x:body.x+rand()*body.width,y:body.y+rand()*body.height}:contact;
  const base={id:seed+'-'+i,element,cause:kind,sourceBody:{...body},contact:{kind:'perimeter-band',body:{...body},planeZ:0},emissionRegion:surface?'surface':element==='air'?'volume':'contour',origin:{...origin},x:location.x,y:location.y,z:surface?height+1:element==='earth'?.5+rand()*2:height+2,age:0,noiseSeed:(seed|0)&65535,opacityScale:kind==='drag'?.48:1,seed:rand()*Math.PI*2,rotation:rand()*Math.PI,spin:(rand()-.5)*2};
  const inheritedX=Math.max(-60,Math.min(60,(velocity.x??0)*.08)),inheritedY=Math.max(-60,Math.min(60,(velocity.y??0)*.08));
  if(earth){const chip=kind==='fracture'&&i%4===0;particles.push({...base,material:chip?'stone-chip':'stone-dust',vx:(rand()-.5)*(surface?3:14)+inheritedX,vy:(rand()-.5)*(surface?3:14)+inheritedY,vz:surface?1:kind==='impact'?12+rand()*14:4+rand()*7,lifetime:surface?.9:1.2+rand()*.6,size:chip?2+rand()*2:surface?1.5:5+rand()*8});}
  else if(element==='water'){const ripple=i<2;particles.push({...base,x:ripple?Math.max(body.x,Math.min(body.x+body.width,origin.x)):location.x,y:ripple?Math.max(body.y,Math.min(body.y+body.height,origin.y)):location.y,z:ripple?height:height+2,material:ripple?'water-ripple':'water-droplet',emissionRegion:ripple?'surface':'contour',vx:ripple?0:contact.nx*(12+rand()*28)+inheritedX,vy:ripple?0:contact.ny*(12+rand()*28)+inheritedY,vz:ripple?0:8+rand()*18,lifetime:ripple?1.1:1.2+rand()*.5,size:ripple?5+i*5:1.5+rand()*2.5});}
  else if(element==='air')particles.push({...base,material:'condensation-mist',vx:(rand()-.5)*9+inheritedX,vy:(rand()-.5)*9+inheritedY,vz:5+rand()*8,lifetime:1.8+rand()*.8,size:13+rand()*16});
  else particles.push({...base,material:'hot-ember',vx:(rand()-.5)*18+inheritedX,vy:(rand()-.5)*18+inheritedY,vz:15+rand()*25,lifetime:.65+rand()*.6,size:1+rand()*2});
 }
 if(earth&&supported&&particles.length&&kind!=='drag'){particles.unshift({...particles[0],id:seed+'-contact-field',material:'contact-dust-field',emissionRegion:'contact-field',x:body.x+body.width/2,y:body.y+body.height/2,z:0,vx:0,vy:0,vz:0,size:1,lifetime:1.2});}
 return particles;
}
export function stepElementalParticle(p,dt){
 if(!Number.isFinite(dt)||dt<0)throw Error('Invalid particle time step');
 const next={...p,age:p.age+dt},drag=p.element==='earth'?2.4:p.element==='water'?1.1:p.element==='air'?1.3:.7;
 if(p.material==='contact-dust-field')return next;
 if(p.material==='water-ripple'){next.size=p.size+dt*27;return next;}
 const gravityZ=p.element==='earth'?-48:p.element==='water'?-80:p.element==='air'?8:24;
 const flow=['air','earth'].includes(p.element)?particleFlow(p.x,p.y,p.age,p.noiseSeed):null,flowX=flow?flow.x*(p.element==='earth'?.28:1):p.element==='fire'?Math.sin(p.age*10+p.seed)*5:0,flowY=flow?flow.y*(p.element==='earth'?.28:1):p.element==='fire'?Math.cos(p.age*9+p.seed)*5:0;
 next.vx=(p.vx+flowX*dt)*Math.exp(-drag*dt);next.vy=(p.vy+flowY*dt)*Math.exp(-drag*dt);next.vz=(p.vz+gravityZ*dt)*Math.exp(-.3*dt);next.x=p.x+next.vx*dt;next.y=p.y+next.vy*dt;next.z=p.z+next.vz*dt;next.rotation=p.rotation+p.spin*dt;
 if(p.element==='air')next.size=p.size+dt*13;
 if(p.material==='stone-dust'&&p.emissionRegion!=='surface')next.size=p.size+dt*3;
 if(next.z<0&&['earth','water'].includes(p.element)){next.z=0;next.vz=0;if(p.element==='water'){next.material='water-ripple';next.age=0;next.lifetime=.6;next.size=3;next.vx=0;next.vy=0;}else{next.vx*=.8;next.vy*=.8;}}
 return next;
}
export function particleOpacity(p){
 if(p.age>=p.lifetime)return 0;const t=Math.min(1,p.age/p.lifetime),energy=p.opacityScale??1;
 if(p.element==='air')return energy*Math.sin(Math.PI*t)*.16*Math.exp(-p.z*.012);
 if(p.element==='fire')return (1-t)*(.6+.4*Math.sin(p.age*28+p.seed)**2);
 if(p.material==='contact-dust-field')return energy*Math.sin(Math.PI*t)*.085;
 if(p.material==='stone-dust')return energy*Math.sin(Math.PI*Math.min(1,t*1.6))*(1-t)*(p.emissionRegion==='surface'?.055:.11);
 return (1-t)**1.3*(p.material==='water-ripple'?.45:.85);
}
