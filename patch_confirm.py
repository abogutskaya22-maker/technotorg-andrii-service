from pathlib import Path

p = Path("index.html")
s = p.read_text()

# User-facing wording: this is a service request, not a mini consultation.
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
function showRequestReview(){i.disabled=true;b(requestSummary());c.innerHTML='<button class="chip" type="button" onclick="confirmRequest()">Так</button><button class="chip" type="button" onclick="editRequest()">Ні</button>'}
function confirmRequest(){c.innerHTML='';trackEvent('service_request',{name:s.name,phone:s.phone,machine:s.machine,brand:s.brand,model:s.model,issue:s.issue,error:s.error,changes:s.changes||''});b(`<b>Заявку створено та передано Андрію ✅</b><br>Він зв’яжеться з Вами за номером <b>${esc(s.phone)}</b>.`)}
function editRequest(){c.innerHTML='<div style="width:100%;display:grid;gap:10px"><label style="font-weight:700">Внесіть деталі (чи зміни)</label><textarea id="requestChanges" rows="4" placeholder="Наприклад: інша модель, уточнення проблеми, зручний час для дзвінка..." style="width:100%;resize:vertical;padding:12px 14px;border:1px solid #d8dce3;border-radius:14px;font:inherit"></textarea><button class="chip" type="button" onclick="saveRequestChanges()">Зберегти зміни</button></div>';setTimeout(()=>{const x=document.getElementById('requestChanges');if(x)x.focus()},50)}
function saveRequestChanges(){const x=document.getElementById('requestChanges');const v=(x?x.value:'').trim();if(!v){b('Напишіть, будь ласка, що саме потрібно змінити або додати.');return}s.changes=v;c.innerHTML='';showRequestReview()}
function finish(){showRequestReview()}
'''

s = s[:start] + new_block + s[end:]
p.write_text(s)
