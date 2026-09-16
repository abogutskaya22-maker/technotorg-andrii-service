// Content signatures are authoritative. Names and MIME are only hints for unknown containers.
const extensions = { jpg:'jpeg', jpeg:'jpeg', jpe:'jpeg', jfif:'jpeg', png:'png', webp:'webp', heic:'heif', heif:'heif', hif:'heif', avif:'avif', gif:'gif', bmp:'bmp', tif:'tiff', tiff:'tiff' };
const mimeTypes = { jpeg:'image/jpeg', png:'image/png', webp:'image/webp', heif:'image/heic', avif:'image/avif', gif:'image/gif', bmp:'image/bmp', tiff:'image/tiff' };
export const PHOTO_ACCEPT = 'image/*,.jpg,.jpeg,.jpe,.jfif,.png,.webp,.heic,.heif,.hif,.avif,.gif,.bmp,.tif,.tiff';
export const MAX_INPUT_BYTES = 20 * 1024 * 1024;
export function identifyImage(bytes, name = '', mime = '') {
  const text = (a,b) => String.fromCharCode(...bytes.subarray(a,b));
  const starts = (...v) => v.every((n,i) => bytes[i] === n);
  let format;
  if (starts(255,216,255)) format = 'jpeg';
  else if (starts(137,80,78,71,13,10,26,10)) format = 'png';
  else if (text(0,4) === 'RIFF' && text(8,12) === 'WEBP') format = 'webp';
  else if (/^GIF8[79]a$/.test(text(0,6))) format = 'gif';
  else if (text(0,2) === 'BM') format = 'bmp';
  else if (starts(73,73,42,0) || starts(77,77,0,42)) format = 'tiff';
  else if (text(4,8) === 'ftyp' && bytes.length >= 16) {
    const size = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0);
    const brands = [text(8,12)];
    for (let p=16; p+4<=Math.min(size,bytes.length); p+=4) brands.push(text(p,p+4));
    if (brands.some(b => ['avif','avis'].includes(b))) format = 'avif';
    else if (brands.some(b => ['heic','heix','hevc','hevx','heim','heis','hevm','hevs'].includes(b))) format = 'heif';
    else if (brands.some(b => ['mif1','msf1'].includes(b))) {
      const hint = extensions[name.toLowerCase().split('.').pop()];
      format = hint === 'avif' || /image\/avif/i.test(mime) ? 'avif' : 'heif';
    }
  }
  if (!format) throw new Error('Оберіть справжнє фото: JPG, PNG, WebP, HEIC/HEIF, AVIF, GIF, BMP або TIFF.');
  return {format, mime: mimeTypes[format]};
}
