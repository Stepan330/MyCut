const number=(id,label,value,min,max,step=.1)=>({id,label,type:'number',default:value,min,max,step});
const amount=(value=1,min=0,max=3)=>number('amount','Amount',value,min,max);
const radius=()=>number('radius','Radius',5,0,100);
const color=()=>({id:'color',label:'Color',type:'color',default:'#39c9ed'});
export const filterNodes=[
  ['Blur','Blur',[radius()]],['DirectionalBlur','Directional blur',[number('x','Horizontal radius',12,0,100),number('y','Vertical radius',0,0,100)]],
  ['Sharpen','Sharpen',[amount(.7,0,4)]],['UnsharpMask','Unsharp mask',[radius(),amount(1,0,4)]],
  ['Emboss','Emboss',[amount(1,0,4)]],['EdgeDetect','Edge detect',[amount(1,0,4)]],
  ['Brightness','Brightness',[amount(1.3)]],['Contrast','Contrast',[amount(1.4)]],['Saturation','Saturation',[amount(.4)]],
  ['HueRotate','Hue rotation',[number('angle','Angle',90,-180,180,1)]],['Grayscale','Grayscale',[amount(1,0,1)]],['Sepia','Sepia',[amount(1,0,1)]],['Invert','Invert',[amount(1,0,1)]],
  ['Exposure','Exposure',[number('stops','Stops',1,-5,5)]],['Gamma','Gamma',[amount(1.6,.1,5)]],['Threshold','Threshold',[amount(.5,0,1)]],['Posterize','Posterize',[number('levels','Levels',4,2,32,1)]],
  ['Colorize','Colorize',[color(),amount(.6,0,1)]],['Temperature','Temperature',[amount(.3,-1,1)]],['Tint','Tint',[amount(.3,-1,1)]],['Opacity','Opacity',[amount(.5,0,1)]],['AlphaThreshold','Alpha threshold',[amount(.5,0,1)]],
  ['Dilate','Dilate',[radius()]],['Erode','Erode',[radius()]],
  ['DropShadow','Drop shadow',[radius(),number('x','Offset X',10,-200,200),number('y','Offset Y',10,-200,200),color(),amount(.7,0,1)]],
  ['InnerShadow','Inner shadow',[radius(),number('x','Offset X',5,-200,200),number('y','Offset Y',5,-200,200),color(),amount(.7,0,1)]],
  ['Glow','Glow',[radius(),color(),amount(.8,0,1)]],['Offset','Offset',[number('x','Offset X',20,-500,500),number('y','Offset Y',0,-500,500)]],
  ['Displace','Displace',[amount(20,0,100),number('frequency','Frequency',.04,.001,.2,.001),number('seed','Seed',1,0,1000,1)]],
  ['Turbulence','Turbulence',[number('frequency','Frequency',.06,.001,.2,.001),number('seed','Seed',1,0,1000,1),amount(.4,0,1)]]
].map(([type,label,parameters])=>({type,label,parameters}));
export const filterTypes=filterNodes.map(n=>n.type);
export const filterSpec=type=>filterNodes.find(n=>n.type===type);
export const filterDefaults=type=>Object.fromEntries((filterSpec(type)?.parameters??[]).map(p=>[p.id,p.default]));
export function validFilterValue(type,key,value){const p=filterSpec(type)?.parameters.find(p=>p.id===key);return !!p&&(p.type==='color'?typeof value==='string'&&/^#[\da-f]{6}$/i.test(value):typeof value==='number'&&Number.isFinite(value)&&value>=p.min&&value<=p.max&&(p.step!==1||Number.isInteger(value)));}
export function validateFilterParams(node){if(node.enabled!==undefined&&typeof node.enabled!=='boolean')throw Error('Invalid effect state');if(node.params===undefined)return;if(!node.params||typeof node.params!=='object'||Array.isArray(node.params)||Object.entries(node.params).some(([k,v])=>!validFilterValue(node.type,k,v)))throw Error('Invalid filter parameters');}
