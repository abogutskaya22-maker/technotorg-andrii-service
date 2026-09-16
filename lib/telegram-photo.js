import sharp from 'sharp';
import {identifyImage} from './image-type.js';
export async function telegramPhoto(data) {
  if (data.photoData === undefined || data.photoData === null || data.photoData === '') {
    if (data.photoName) throw new Error('missing_photo');
    return null;
  }
  if (typeof data.photoData !== 'string' || data.photoData.length>3*1024*1024) throw new Error('invalid_photo');
  const match=/^data:([^;,]*);base64,([A-Za-z0-9+/]+={0,2})$/.exec(data.photoData);
  if (!match || match[2].length%4) throw new Error('invalid_photo');
  const bytes=Buffer.from(match[2],'base64');
  if (bytes.length>2*1024*1024 || bytes.toString('base64')!==match[2]) throw new Error('invalid_photo');
  const {format}=identifyImage(bytes.subarray(0,4096),data.photoName,match[1]);
  // The browser normalizes phone formats. Re-decode on the server; never trust MIME alone.
  if (!['jpeg','png','webp'].includes(format)) throw new Error('photo_not_normalized');
  const options={limitInputPixels:80_000_000,failOn:'warning'};
  const decoded=await sharp(bytes,options).rotate().resize({width:1280,height:1280,fit:'inside',withoutEnlargement:true}).flatten({background:'#fff'}).jpeg({quality:82}).toBuffer({resolveWithObject:true});
  let output=decoded.data;
  const {width,height}=decoded.info;
  if (width/height>20 || height/width>20) {
    output=await sharp(output).extend({top:0,left:0,right:Math.max(0,Math.ceil(height/20)-width),bottom:Math.max(0,Math.ceil(width/20)-height),background:'#fff'}).jpeg({quality:82}).toBuffer();
  }
  return {bytes:output,mime:'image/jpeg',name:'request.jpg'};
}
