export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (req.method === 'GET') {
    const status = { configured: Boolean(token && chatId), token: Boolean(token), chatId: Boolean(chatId) };
    if (!token || !chatId) return res.status(200).json(status);
    try {
      const botResp = await fetch(`https://api.telegram.org/bot${token}/getMe`);
      const botJson = await botResp.json();
      status.botOk = Boolean(botJson && botJson.ok);
      const chatResp = await fetch(`https://api.telegram.org/bot${token}/getChat?chat_id=${encodeURIComponent(chatId)}`);
      const chatJson = await chatResp.json();
      status.chatOk = Boolean(chatJson && chatJson.ok);
      if (String(req.query?.test || '') === '1') {
        const testResp = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text: '✅ Тест зв’язку із сайтом: бот отримує повідомлення.' })
        });
        const testJson = await testResp.json();
        status.sendOk = Boolean(testJson && testJson.ok);
        if (!status.sendOk) status.sendError = testJson?.description || 'unknown';
      }
      return res.status(200).json(status);
    } catch (e) {
      return res.status(200).json({ ...status, diagnosticError: String(e?.message || e) });
    }
  }

  if (req.method !== 'POST') return res.status(405).json({ ok: false });
  if (!token || !chatId) return res.status(503).json({ ok: false, error: 'analytics_not_configured' });

  const body = req.body || {};
  const event = String(body.event || '').slice(0, 60);
  const data = body.data && typeof body.data === 'object' ? body.data : {};
  const occurredAt = body.occurredAt ? new Date(body.occurredAt) : new Date();
  const safeDate = Number.isNaN(occurredAt.getTime()) ? new Date() : occurredAt;
  const ts = safeDate.toLocaleString('uk-UA', { timeZone: 'Europe/Kyiv' });
  const clean = (v, max = 500) => String(v ?? '—').replace(/[<>]/g, '').slice(0, max);

  if (event === 'page_view' || event === 'consultation_started') return res.status(200).json({ ok: true, skipped: true });

  const labels = { service_request: '🆕 Нова заявка з сайту', consultation_completed: '🆕 Нова заявка з сайту', messenger_clicked: '💬 Перехід у месенджер', call_clicked: '📞 Натиснули дзвінок' };
  let lines = [`<b>${labels[event] || '📊 Подія сайту'}</b>`, `🕒 ${clean(ts)}`];

  if (event === 'service_request' || event === 'consultation_completed') {
    lines.push(`👤 Ім’я: ${clean(data.name,120)}`, `📱 Телефон: ${clean(data.phone,80)}`, `🚜 Техніка: ${clean(data.machine,120)}`, `🏷 Марка: ${clean(data.brand,120)}`, `🔢 Модель: ${clean(data.model,160)}`, `⚠️ Проблема: ${clean(data.issue,700)}`, `🧾 Код помилки: ${clean(data.error,160)}`);
    if (data.changes) lines.push(`📝 Деталі / зміни: ${clean(data.changes,700)}`);
    lines.push('', '📌 Статус: нова заявка — потрібно зв’язатися з клієнтом');
  }

  try {
    const photoData = typeof data.photoData === 'string' ? data.photoData : '';
    const photoMatch = photoData.match(/^data:(image\/(?:jpeg|jpg|png|webp));base64,(.+)$/);
    if ((event === 'service_request' || event === 'consultation_completed') && photoMatch) {
      const mime = photoMatch[1] === 'image/jpg' ? 'image/jpeg' : photoMatch[1];
      const bytes = Buffer.from(photoMatch[2], 'base64');
      const form = new FormData();
      form.append('chat_id', chatId);
      form.append('caption', lines.join('\n').slice(0,1000));
      form.append('parse_mode','HTML');
      form.append('photo', new Blob([bytes], { type: mime }), clean(data.photoName || 'request.jpg',120));
      const tgPhoto = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, { method:'POST', body:form });
      const photoResult = await tgPhoto.json();
      if (!photoResult.ok) return res.status(502).json({ ok:false, error:'telegram_photo_error', description:photoResult.description||'' });
      return res.status(200).json({ ok:true, photo:true });
    }
    const tg = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({ chat_id:chatId, text:lines.join('\n'), parse_mode:'HTML', disable_web_page_preview:true }) });
    const result = await tg.json();
    if (!result.ok) return res.status(502).json({ ok:false, error:'telegram_error', description:result.description||'' });
    return res.status(200).json({ ok:true });
  } catch (e) {
    return res.status(500).json({ ok:false, error:'analytics_failed', description:String(e?.message||e) });
  }
}
