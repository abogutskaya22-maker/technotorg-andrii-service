import {test} from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {telegramPhoto} from '../lib/telegram-photo.js';
import {identifyImage} from '../lib/image-type.js';
import handler from '../api/analytics.js';
const picture = sharp({create:{width:240,height:160,channels:3,background:'#da1846'}});
for (const format of ['jpeg','png','webp']) {
  test(`${format}: accept real bytes with blank/wrong MIME and filename, output JPEG`,async()=>{
    const bytes=await picture.clone().toFormat(format).toBuffer();
    assert.equal(identifyImage(bytes,'phone.HEIC','application/octet-stream').format,format);
    for (const mime of ['','application/octet-stream','image/heic']) {
      const out=await telegramPhoto({photoData:`data:${mime};base64,${bytes.toString('base64')}`,photoName:'phone.HEIC'});
      assert.equal((await sharp(out.bytes).metadata()).format,'jpeg');
    }
  });
}
test('reject fake, truncated, invalid base64, SVG, oversized and missing attachment',async()=>{
  for (const bytes of [Buffer.from('not an image'),Buffer.from([255,216,255,0]),Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')]) {
    await assert.rejects(telegramPhoto({photoData:`data:image/jpeg;base64,${bytes.toString('base64')}`}));
  }
  for (const data of [{photoName:'missing.jpg'},{photoData:'garbage'},{photoData:'data:image/jpeg;base64,@@=='},{photoData:'x'.repeat(3*1024*1024+1)}]) await assert.rejects(telegramPhoto(data));
  assert.equal(await telegramPhoto({}),null);
});
test('panorama is padded to Telegram aspect ratio',async()=>{
  const bytes=await sharp({create:{width:1000,height:10,channels:3,background:'#fff'}}).png().toBuffer();
  const out=await telegramPhoto({photoData:`data:image/png;base64,${bytes.toString('base64')}`});
  const meta=await sharp(out.bytes).metadata();assert.ok(meta.width/meta.height<=20);
});
test('delivery includes JPEG attachment and request fields; errors never report success or silently drop photo',async()=>{
  const original=globalThis.fetch,token=process.env.TELEGRAM_BOT_TOKEN;
  process.env.TELEGRAM_BOT_TOKEN='test-token';const calls=[];let telegramOk=true;
  globalThis.fetch=async(url,opts)=>{
    if(String(url).includes('supabase.co'))return {ok:true};
    calls.push({url,opts});return {json:async()=>telegramOk?{ok:true,result:{message_id:123,photo:[{}]}}:{ok:false,description:'photo rejected'}};
  };
  const response=()=>({code:200,status(n){this.code=n;return this},json(body){this.body=body;return this}});
  try {
    const bytes=await picture.clone().png().toBuffer();
    const data={name:'Тест Фото',phone:'НЕ ТЕЛЕФОНУВАТИ',machine:'Трактор',issue:'Перевірка',photoData:`data:image/png;base64,${bytes.toString('base64')}`,photoName:'test.png'};
    let res=response();await handler({method:'POST',body:{event:'service_request',data}},res);
    assert.equal(res.code,200);assert.equal(res.body.photo,true);assert.equal(res.body.messageId,123);
    assert.ok(calls[0].url.endsWith('/sendPhoto'));assert.match(calls[0].opts.body.get('caption'),/Тест Фото/);
    assert.match(calls[0].opts.body.get('caption'),/Перевірка/);
    assert.equal((await sharp(Buffer.from(await calls[0].opts.body.get('photo').arrayBuffer())).metadata()).format,'jpeg');
    calls.length=0;res=response();await handler({method:'POST',body:{event:'service_request',data:{...data,photoData:'bad'}}},res);
    assert.equal(res.code,400);assert.equal(calls.length,0);
    telegramOk=false;res=response();await handler({method:'POST',body:{event:'service_request',data}},res);
    assert.equal(res.code,502);assert.equal(res.body.ok,false);
    telegramOk=true;res=response();await handler({method:'POST',body:{event:'service_request',data:{name:'Без фото'}}},res);
    assert.equal(res.code,200);assert.ok(calls.at(-1).url.endsWith('/sendMessage'));
  } finally {globalThis.fetch=original;if(token===undefined)delete process.env.TELEGRAM_BOT_TOKEN;else process.env.TELEGRAM_BOT_TOKEN=token;}
});
