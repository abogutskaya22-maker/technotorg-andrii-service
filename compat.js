(function(){
  'use strict';
  var MARKER='stable-actions-v3';

  function txt(el){
    return (el && (el.innerText||el.textContent)||'').replace(/\s+/g,' ').trim().toLowerCase();
  }

  function style(){
    if(document.getElementById('compat-style')) return;
    var s=document.createElement('style');
    s.id='compat-style';
    s.textContent='.compatOv{position:fixed;inset:0;background:rgba(20,22,28,.55);z-index:2147483647;display:flex;align-items:flex-end;justify-content:center;padding:14px;box-sizing:border-box}.compatBox{width:min(620px,100%);max-height:92vh;overflow:auto;background:#fff;border-radius:22px;padding:20px;box-sizing:border-box;box-shadow:0 18px 60px rgba(0,0,0,.25);font-family:Arial,sans-serif;color:#252830}.compatBox h3{margin:0 0 8px;font-size:24px}.compatBox p{margin:0 0 14px;color:#666}.compatCall a{display:flex;align-items:center;justify-content:space-between;gap:12px;text-decoration:none;background:#d71920;color:#fff;padding:15px 16px;border-radius:14px;margin-top:10px;font-weight:700;font-size:16px}.compatCall small{font-weight:500;opacity:.9}.compatRow{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px}.compatBtn{border:0;border-radius:14px;padding:13px 18px;font-weight:700;font-size:16px;cursor:pointer}.compatLight{background:#f2f3f5;color:#252830}';
    document.head.appendChild(s);
  }

  function close(){
    var x=document.getElementById('compat-ov');
    if(x) x.remove();
  }

  function overlay(html){
    style();
    close();
    var ov=document.createElement('div');
    ov.className='compatOv';
    ov.id='compat-ov';
    ov.setAttribute('data-stable-actions',MARKER);
    ov.innerHTML='<div class="compatBox">'+html+'</div>';
    ov.addEventListener('click',function(e){ if(e.target===ov) close(); });
    document.body.appendChild(ov);
    return ov;
  }

  function calls(){
    overlay('<h3>Подзвонити Андрію</h3><p>Оберіть номер, на який зручно зателефонувати:</p><div class="compatCall"><a href="tel:+380665628743"><span>+38 (066) 562-87-43</span><small>Vodafone</small></a><a href="tel:+380969897456"><span>+38 (096) 989-74-56</span><small>Kyivstar</small></a></div><div class="compatRow"><button type="button" class="compatBtn compatLight" id="compat-close">Закрити</button></div>');
    var b=document.getElementById('compat-close');
    if(b) b.onclick=close;
  }

  function actionFor(node){
    var el=node;
    while(el && el!==document.body){
      if(el.nodeType===1){
        var oc=(el.getAttribute('onclick')||'').toLowerCase();
        if(oc.indexOf('opencallsheet')!==-1) return 'call';
        if(oc.indexOf('openconsult')!==-1) return 'assistant';
        if(/^(button|a)$/i.test(el.tagName)){
          var t=txt(el);
          if(t==='подзвонити' || t==='подзвонити андрію' || t.indexOf('подзвонити')===0) return 'call';
          if(t==='залишити заявку' || t==='міні-консультація' || t==='консультація') return 'assistant';
        }
      }
      el=el.parentElement;
    }
    return '';
  }

  function clickHandler(e){
    if(document.getElementById('compat-ov')) return;
    var action=actionFor(e.target);
    if(!action) return;

    if(action==='call'){
      e.preventDefault();
      e.stopPropagation();
      if(typeof e.stopImmediatePropagation==='function') e.stopImmediatePropagation();
      calls();
      return;
    }

    /* IMPORTANT: do not intercept “Залишити заявку”.
       The main page already contains the AI consultation/chat flow (openConsult).
       Let the original site handler open that assistant. */
  }

  /* Window capture runs before document/element handlers, making the phone chooser reliable. */
  window.addEventListener('click',clickHandler,true);

  window.__stableActionsVersion=MARKER;
  window.__compatCalls=calls;
})();
