export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false });

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return res.status(503).json({ ok: false, error: 'analytics_not_configured' });

  const body = req.body || {};
  const event = String(body.event || '').slice(0, 60);
  const data = body.data && typeof body.data === 'object' ? body.data : {};
  const occurredAt = body.occurredAt ? new Date(body.occurredAt) : new Date();
  const safeDate = Number.isNaN(occurredAt.getTime()) ? new Date() : occurredAt;
  const ts = safeDate.toLocaleString('uk-UA', { timeZone: 'Europe/Kyiv' });

  const clean = (v, max = 500) => String(v ?? '—').replace(/[<>]/g, '').slice(0, max);

  if (event === 'page_view' || event === 'consultation_started') {
    return res.status(200).json({ ok: true, skipped: true });
  }

  const labels = {
    service_request: '🆕 Нова заявка з сайту',
    consultation_completed: '🆕 Нова заявка з сайту',
    messenger_clicked: '💬 Перехід у месенджер',
    call_clicked: '📞 Натиснули дзвінок'
  };

  let lines = [`<b>${labels[event] || '📊 Подія сайту'}</b>`, `🕒 ${clean(ts)}`];

  if (event === 'service_request' || event === 'consultation_completed') {
    lines.push(
      `👤 Ім’я: ${clean(data.name, 120)}`,
      `📱 Телефон: ${clean(data.phone, 80)}`,
      `🚜 Техніка: ${clean(data.machine, 120)}`,
      `🏷 Марка: ${clean(data.brand, 120)}`,
      `🔢 Модель: ${clean(data.model, 160)}`,
      `⚠️ Проблема: ${clean(data.issue, 700)}`,
      `🧾 Код помилки: ${clean(data.error, 160)}`
    );
    if (data.changes) lines.push(`📝 Деталі / зміни: ${clean(data.changes, 700)}`);
    lines.push('', '📌 Статус: нова заявка — потрібно зв’язатися з клієнтом');
  } else {
    if (data.name) lines.push(`👤 Ім’я: ${clean(data.name, 120)}`);
    if (data.phone) lines.push(`📱 Телефон: ${clean(data.phone, 80)}`);

    if (event === 'messenger_clicked') {
      lines.push(`📲 Месенджер: ${clean(data.messenger, 40)}`, `📍 Звідки: ${clean(data.context, 80)}`);
    } else if (event === 'call_clicked') {
      lines.push(`📍 Звідки: ${clean(data.context, 80)}`);
    }
  }

  try {
    const photoData = typeof data.photoData === 'string' ? data.photoData : '';
    const photoMatch = photoData.match(/^data:(image\/(?:jpeg|jpg|png|webp));base64,(.+)$/);

    if ((event === 'service_request' || event === 'consultation_completed') && photoMatch) {
      const mime = photoMatch[1] === 'image/jpg' ? 'image/jpeg' : photoMatch[1];
      const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
      const bytes = Buffer.from(photoMatch[2], 'base64');
      const form = new FormData();
      form.append('chat_id', chatId);
      form.append('caption', lines.join('\n').slice(0, 1000));
      form.append('parse_mode', 'HTML');
      form.append('photo', new Blob([bytes], { type: mime }), clean(data.photoName || `request.${ext}`, 120));

      const tgPhoto = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
        method: 'POST',
        body: form
      });
      const photoResult = await tgPhoto.json();
      if (!photoResult.ok) return res.status(502).json({ ok: false, error: 'telegram_photo_error' });
      return res.status(200).json({ ok: true, photo: true });
    }

    const tg = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: lines.join('\n'),
        parse_mode: 'HTML',
        disable_web_page_preview: true
      })
    });
    const result = await tg.json();
    if (!result.ok) return res.status(502).json({ ok: false, error: 'telegram_error' });
    return res.status(200).json({ ok: true });
  } catch {
    return res.status(500).json({ ok: false, error: 'analytics_failed' });
  }
}
