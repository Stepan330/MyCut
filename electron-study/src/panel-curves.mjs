const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
export function defaultPanelCurve(phase='grab'){
 return {duration:.5,keys:phase==='grab'?[{id:'start',t:0,value:0,mode:'hold'},{id:'peel',t:.4,value:0,mode:'smooth'},{id:'end',t:1,value:1,mode:'smooth'}]:[{id:'start',t:0,value:1,mode:'smooth'},{id:'end',t:1,value:0,mode:'smooth'}]};
}
export function validPanelCurve(curve){
 return !!curve&&Number.isFinite(curve.duration)&&curve.duration>=.02&&curve.duration<=30&&Array.isArray(curve.keys)&&curve.keys.length>=2&&curve.keys.length<=64&&curve.keys[0].t===0&&curve.keys.at(-1).t===1&&new Set(curve.keys.map(k=>k.id)).size===curve.keys.length&&curve.keys.every((k,i)=>typeof k.id==='string'&&Number.isFinite(k.t)&&k.t>=0&&k.t<=1&&(!i||k.t>curve.keys[i-1].t)&&Number.isFinite(k.value)&&k.value>=0&&k.value<=1&&['hold','linear','smooth','free'].includes(k.mode)&&['inTangent','outTangent'].every(p=>k[p]===undefined||Number.isFinite(k[p])&&Math.abs(k[p])<=20));
}
export function curveTangents(curve,index){
 const k=curve.keys[index];if(k.mode==='free')return {in:k.inTangent??0,out:k.outTangent??0};
 // Automatic horizontal tangents are useful for lift-off and landing holds.
 return {in:0,out:0};
}
export function samplePanelCurve(curve,seconds){
 const t=clamp(seconds/curve.duration),keys=curve.keys;if(t<=0)return keys[0].value;if(t>=1)return keys.at(-1).value;
 const i=keys.findIndex(k=>k.t>t),a=keys[i-1],b=keys[i],span=b.t-a.t,u=(t-a.t)/span;
 if(a.mode==='hold')return a.value;if(a.mode==='linear')return a.value+(b.value-a.value)*u;
 const m0=curveTangents(curve,i-1).out*span,m1=curveTangents(curve,i).in*span;
 return clamp((2*u**3-3*u*u+1)*a.value+(u**3-2*u*u+u)*m0+(-2*u**3+3*u*u)*b.value+(u**3-u*u)*m1);
}
