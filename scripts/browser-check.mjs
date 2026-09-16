import {chromium,webkit} from '@playwright/test';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import assert from 'node:assert/strict';
const remote=process.env.CHECK_URL;
const server=remote?null:createServer(async(req,res)=>{
  const url=new URL(req.url,'http://local');
  const file=path.join(process.cwd(),'dist',url.pathname==='/'?'index.html':url.pathname);
  try {res.setHeader('content-type',file.endsWith('.js')?'text/javascript':file.endsWith('.html')?'text/html':'image/png');res.end(await readFile(file))}catch{res.writeHead(404).end()}
});
if(server)await new Promise(resolve=>server.listen(4173,'127.0.0.1',resolve));
const url=remote || 'http://127.0.0.1:4173';
const base=sharp({create:{width:360,height:240,channels:3,background:'#db1846'}});
const fixtures=[];
for(const fmt of ['jpeg','png','webp','avif','gif','tiff']) fixtures.push({name:`photo.${fmt}`,mimeType:`image/${fmt}`,buffer:await base.clone().toFormat(fmt).toBuffer()});
const jpeg=fixtures[0].buffer;
fixtures.push({name:'Samsung.JPG',mimeType:'',buffer:jpeg},{name:'Samsung.HEIC',mimeType:'application/octet-stream',buffer:jpeg},{name:'no-extension',mimeType:'image/x-unknown',buffer:fixtures[1].buffer});
const bmp=Buffer.alloc(54+12*2);bmp.write('BM');bmp.writeUInt32LE(bmp.length,2);bmp.writeUInt32LE(54,10);bmp.writeUInt32LE(40,14);bmp.writeInt32LE(4,18);bmp.writeInt32LE(2,22);bmp.writeUInt16LE(1,26);bmp.writeUInt16LE(24,28);bmp.fill(120,54);
fixtures.push({name:'photo.bmp',mimeType:'image/bmp',buffer:bmp});
let heic;
try{heic=await readFile('tests/fixtures/sample.heic')}catch{
  const response=await fetch('https://raw.githubusercontent.com/strukturag/libheif/master/examples/example.heic');if(!response.ok)throw new Error('HEIC fixture download failed');heic=Buffer.from(await response.arrayBuffer());
}
fixtures.push({name:'iPhone.HEIC',mimeType:'image/heic',buffer:heic},{name:'Samsung.HEIF',mimeType:'',buffer:heic});
const report=[];
try{
  for (const [name,engine] of [['chromium',chromium],['webkit',webkit]]) {
    const browser=await engine.launch();
    try {
      const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
      const errors=[];page.on('pageerror',e=>errors.push(e.message));let sent;
      await page.route('**/api/analytics',async route=>{
        const body=route.request().postDataJSON();if(body.event==='service_request')sent=body;
        await route.fulfill({json:{ok:true,photo:!!body.data?.photoData}});
      });
      await page.goto(url);await page.locator('.mobile button[onclick="openConsult()"]').click();
      assert.ok((await page.locator('body').innerText()).includes('Андрій'));
      for(const value of ['ТЕСТ ФОТО — НЕ ТЕЛЕФОНУВАТИ','0000000000','Трактор','New Holland','TEST','Тестова перевірка фото','Немає']) {
        await page.locator('#input').fill(value);await page.locator('#input').press('Enter');await page.waitForTimeout(200);
      }
      for(const fixture of fixtures) {
        await page.locator('#photoInput').setInputFiles(fixture);
        await page.waitForFunction(()=>!photoBusy,null,{timeout:120000});
        const out=await page.evaluate(()=>({data:s.photoData,name:s.photoName,last:document.getElementById('msgs').lastElementChild.textContent}));
        assert.equal(out.name,fixture.name.replace(/\.[^.]+$/,'')+'.jpg',`${name} ${fixture.name}: ${out.last}`);
        const metadata=await sharp(Buffer.from(out.data.split(',')[1],'base64')).metadata();assert.equal(metadata.format,'jpeg');
        assert.ok(metadata.width<=1280&&metadata.height<=1280);
        report.push({browser:name,file:fixture.name,mime:fixture.mimeType,result:'pass',width:metadata.width,height:metadata.height});
      }
      const previous=await page.evaluate(()=>s.photoData);
      for(const fixture of [{name:'fake.jpg',mimeType:'image/jpeg',buffer:Buffer.from('hello')},{name:'broken.png',mimeType:'image/png',buffer:fixtures[1].buffer.subarray(0,30)},{name:'empty.jpg',mimeType:'image/jpeg',buffer:Buffer.alloc(0)},{name:'huge.jpg',mimeType:'image/jpeg',buffer:Buffer.alloc(21*1024*1024)}]) {
        await page.locator('#photoInput').setInputFiles(fixture);await page.waitForFunction(()=>!photoBusy);
        assert.equal(await page.evaluate(()=>s.photoData),previous);report.push({browser:name,file:fixture.name,result:'rejected; previous photo preserved'});
      }
      await page.getByRole('button',{name:'Продовжити →',exact:true}).click();await page.getByRole('button',{name:'Так, все вірно'}).waitFor();
      await mkdir('test-results',{recursive:true});await page.screenshot({path:`test-results/${name}-review.png`});
      await page.getByRole('button',{name:'Так, все вірно'}).click();await page.getByText('Заявку надіслано!',{exact:true}).waitFor();
      assert.ok(sent.data.photoData.startsWith('data:image/jpeg;base64,'));assert.equal(sent.data.machine,'Трактор');assert.equal(sent.data.issue,'Тестова перевірка фото');
      assert.deepEqual(errors,[]);report.push({browser:name,flow:'full request',result:'pass'});
    } finally {await browser.close()}
  }
} finally {server?.close()}
await writeFile('test-results/browser-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
