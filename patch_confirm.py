from pathlib import Path

p = Path("index.html")
s = p.read_text()

replacements = [
    ("Міні-консультацію", "Залишити заявку"),
    ("Міні консультацію", "Залишити заявку"),
    ("Міні-консультація", "Залишити заявку"),
    ("Міні консультація", "Залишити заявку"),
    ("міні-консультацію", "заявку"),
    ("міні консультацію", "заявку"),
    ("міні-консультації", "заявки"),
    ("міні консультації", "заявки"),
    ("міні-консультація", "заявка"),
    ("міні консультація", "заявка"),
]
for old, new in replacements:
    s = s.replace(old, new)

start = s.find("function finish(){")
end = s.find("document.addEventListener('click'", start)
if start == -1 or end == -1:
    raise SystemExit("finish() block not found")

new_block = r'''function requestSummary(){return `<b>Перевірте дані заявки ✅</b><br><br>Ім’я: ${esc(s.name)}<br>Телефон: ${esc(s.phone)}<br>Техніка: ${esc(s.machine)}<br>Марка: ${esc(s.brand)}<br>Модель: ${esc(s.model)}<br>Проблема: ${esc(s.issue)}<br>Код помилки: ${esc(s.error)}${s.changes?`<br><br><b>Деталі / зміни:</b> ${esc(s.changes)}`:''}<br><br><b>Все вірно?</b>`}
function requestBtnStyle(primary=false){return primary?'border:0;background:#d71920;color:#fff;border-radius:14px;padding:12px 22px;font:700 16px/1.1 inherit;cursor:pointer;box-shadow:0 6px 16px rgba(215,25,32,.18)':'border:1px solid #d8dce3;background:#fff;color:#252830;border-radius:14px;padding:12px 22px;font:700 16px/1.1 inherit;cursor:pointer'}
function photoBox(){const label=s.photoName?`📷 ${esc(s.photoName)}`:'📷 Додати фото техніки або проблеми';return `<div style="width:100%;margin-top:12px"><label for="requestPhoto" style="display:flex;align-items:center;justify-content:center;gap:8px;width:100%;box-sizing:border-box;padding:12px 14px;border:1px dashed #c9ced7;border-radius:14px;background:#fff;color:#4c515b;font-weight:700;cursor:pointer">${label}</label><input id="requestPhoto" type="file" accept="image/*" capture="environment" style="display:none" onchange="handleRequestPhoto(this)"><div id="requestPhotoHint" style="font-size:12px;color:#858b95;margin-top:6px;text-align:center">Фото не обов’язкове. Можна сфотографувати помилку, вузол або техніку.</div></div>`}
function showRequestReview(){i.disabled=true;b(requestSummary());c.innerHTML=`<div style="width:100%;display:grid;gap:12px">${photoBox()}<div style="display:flex;gap:10px;flex-wrap:wrap"><button type="button" style="${requestBtnStyle(true)}" onclick="confirmRequest()">Так, відправити</button><button type="button" style="${requestBtnStyle(false)}" onclick="editRequest()">Ні, змінити</button></div></div>`}
function resizeRequestPhoto(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>{const img=new Image();img.onload=()=>{let w=img.width,h=img.height,max=900;if(w>max||h>max){const k=Math.min(max/w,max/h);w=Math.round(w*k);h=Math.round(h*k)}const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0,w,h);resolve(canvas.toDataURL('image/jpeg',.65))};img.onerror=reject;img.src=reader.result};reader.onerror=reject;reader.readAsDataURL(file)})}
async function handleRequestPhoto(input){const file=input&&input.files&&input.files[0];if(!file)return;const hint=document.getElementById('requestPhotoHint');if(hint)hint.textContent='Готую фото…';try{s.photoData=await resizeRequestPhoto(file);s.photoName=file.name||'Фото';showRequestReview()}catch(e){s.photoData='';s.photoName='';if(hint)hint.textContent='Не вдалося додати фото. Спробуйте інше.'}}
async function sendRequestTo(url,payload){const r=await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});const text=await r.text();let j={};try{j=JSON.parse(text)}catch(_){throw new Error(`HTTP ${r.status}: ${text.slice(0,120)||'порожня відповідь'}`)}if(!r.ok||!j.ok)throw new Error((j.error||`HTTP ${r.status}`)+(j.description?`: ${j.description}`:''));return j}
async function confirmRequest(){const data={name:s.name,phone:s.phone,machine:s.machine,brand:s.brand,model:s.model,issue:s.issue,error:s.error,changes:s.changes||'',photoData:s.photoData||'',photoName:s.photoName||''};const payload={event:'service_request',data,occurredAt:new Date().toISOString()};c.innerHTML='<div style="font-weight:700;color:#666">Надсилаю заявку…</div>';let lastErr=null;for(const url of ['/api/analytics','https://technotorg-andrii-service.vercel.app/api/analytics']){try{await sendRequestTo(url,payload);c.innerHTML='';b(`<b>Заявку створено та передано Андрію ✅</b><br>Він зв’яжеться з Вами за номером <b>${esc(s.phone)}</b>.${s.photoData?'<br>Фото додано до заявки.':''}`);return}catch(e){lastErr=e}}const msg=esc(lastErr&&lastErr.message?lastErr.message:'невідома помилка');c.innerHTML=`<div style="width:100%;display:grid;gap:10px"><div style="padding:12px 14px;border-radius:14px;background:#fff1f1;color:#a30f15;font-weight:700">Не вдалося передати заявку. Спробуйте ще раз.</div><div style="font-size:12px;color:#8b5b5d;word-break:break-word">Технічна причина: ${msg}</div><button type="button" style="${requestBtnStyle(true)}" onclick="confirmRequest()">Повторити відправлення</button></div>`}
function editRequest(){c.innerHTML='<div style="width:100%;display:grid;gap:10px"><label style="font-weight:700">Внесіть деталі (чи зміни)</label><textarea id="requestChanges" rows="4" placeholder="Наприклад: інша модель, уточнення проблеми, зручний час для дзвінка..." style="width:100%;box-sizing:border-box;resize:vertical;padding:12px 14px;border:1px solid #d8dce3;border-radius:14px;font:inherit"></textarea><button type="button" style="border:0;background:#d71920;color:#fff;border-radius:14px;padding:12px 18px;font:700 15px/1.1 inherit;cursor:pointer" onclick="saveRequestChanges()">Зберегти зміни</button></div>';setTimeout(()=>{const x=document.getElementById('requestChanges');if(x)x.focus()},50)}
function saveRequestChanges(){const x=document.getElementById('requestChanges');const v=(x?x.value:'').trim();if(!v){b('Напишіть, будь ласка, що саме потрібно змінити або додати.');return}s.changes=v;c.innerHTML='';showRequestReview()}
function finish(){showRequestReview()}
'''

s = s[:start] + new_block + s[end:]
p.write_text(s)
