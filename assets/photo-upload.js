import {identifyImage, MAX_INPUT_BYTES} from '../lib/image-type.js';
const MAX_PIXELS = 80_000_000;
function dimensions(width, height) {
  if (!(width>0 && height>0) || width*height>MAX_PIXELS) throw new Error('Фото має завелику роздільність. Оберіть версію до 80 мегапікселів.');
}
function canvasJpeg(canvas, quality) {
  return new Promise((resolve,reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Не вдалося підготувати фото.')), 'image/jpeg', quality));
}
function loadImage(blob) {
  return new Promise((resolve,reject) => {
    const url=URL.createObjectURL(blob), img=new Image();
    img.onload=()=>{URL.revokeObjectURL(url);resolve(img)};
    img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('decode_failed'))};
    img.src=url;
  });
}
async function decode(blob, format) {
  // Prefer native decoders (including iOS HEIC) and preserve EXIF orientation.
  try {return await loadImage(blob)} catch (_) {}
  if (format==='heif' || format==='avif') {
    const {heicTo}=await import('heic-to/csp');
    const jpeg=await heicTo({blob,type:'image/jpeg',quality:0.92});
    return loadImage(jpeg);
  }
  if (format==='tiff') {
    const {default:UTIF}=await import('utif');
    const buffer=await blob.arrayBuffer(), pages=UTIF.decode(buffer);
    const page=pages.find(p=>p.t256?.[0] && p.t257?.[0]);
    if (!page) throw new Error('decode_failed');
    dimensions(page.t256[0],page.t257[0]);
    UTIF.decodeImage(buffer,page);
    const rgba=UTIF.toRGBA8(page), canvas=document.createElement('canvas');
    canvas.width=page.width;canvas.height=page.height;
    canvas.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(rgba),page.width,page.height),0,0);
    return canvas;
  }
  throw new Error('decode_failed');
}
export async function preparePhoto(file) {
  if (!file.size) throw new Error('Цей файл порожній. Оберіть інше фото.');
  if (file.size>MAX_INPUT_BYTES) throw new Error('Фото завелике. Оберіть файл до 20 МБ.');
  const {format,mime}=identifyImage(new Uint8Array(await file.slice(0,4096).arrayBuffer()),file.name,file.type);
  let source,timer;
  try {source=await Promise.race([decode(file.slice(0,file.size,mime),format),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('decode_timeout')),90000)})])}
  catch (_) {throw new Error('Не вдалося прочитати фото. Спробуйте інше фото або збережіть його як JPG.');}
  finally {clearTimeout(timer)}
  const width=source.naturalWidth || source.width, height=source.naturalHeight || source.height;
  dimensions(width,height);
  const scale=Math.min(1,1280/Math.max(width,height));
  const w=Math.max(1,Math.round(width*scale)),h=Math.max(1,Math.round(height*scale));
  // White padding also keeps very narrow panoramas within Telegram's 20:1 limit.
  const canvas=document.createElement('canvas');
  canvas.width=Math.max(w,Math.ceil(h/20));canvas.height=Math.max(h,Math.ceil(w/20));
  const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.drawImage(source,(canvas.width-w)/2,(canvas.height-h)/2,w,h);
  let jpeg=await canvasJpeg(canvas,0.82);
  if (jpeg.size>2*1024*1024) jpeg=await canvasJpeg(canvas,0.65);
  if (jpeg.size>2*1024*1024) throw new Error('Не вдалося зменшити фото. Оберіть інше.');
  const photoData=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(new Error('Не вдалося прочитати фото.'));r.readAsDataURL(jpeg)});
  return {photoData,photoName:(file.name.replace(/\.[^.]+$/,'') || 'photo')+'.jpg'};
}
