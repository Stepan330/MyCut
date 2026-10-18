export const imageMimeTypes=['image/png','image/jpeg','image/webp'];
export async function readImageFile(file){
  if(!imageMimeTypes.includes(file.type))throw new Error('Choose PNG, JPEG or WebP');
  if(file.size>25*1024*1024)throw new Error('Image exceeds 25 MB');
  const src=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('Cannot read image'));reader.readAsDataURL(file);});
  const image=new Image();image.src=src;await image.decode();
  if(!image.naturalWidth||image.naturalWidth*image.naturalHeight>40000000)throw new Error('Image exceeds 40 megapixels');
  return {src,naturalWidth:image.naturalWidth,naturalHeight:image.naturalHeight,name:file.name||'Clipboard image'};
}
