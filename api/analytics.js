const SUPABASE_URL = 'https://tuoubfmngreuwiolsykr.supabase.co';
const SUPABASE_KEY = 'sb_publishable_wvdhkwV3ScV7i5bBFFI6Qw_qrbkewR8';

async function saveAnalyticsEvent(event, data, occurredAt) {
  const allowed = new Set([
    'page_view',
    'consultation_started',
    'consultation_completed',
    'service_request',
    'messenger_clicked',
    'call_clicked'
  ]);
  if (!allowed.has(event)) return;

  const metadata = {};
  if (data?.machine) metadata.machine = String(data.machine).slice(0, 120);
  if (data?.brand) metadata.brand = String(data.brand).slice(0, 120);
  if (data?.model) metadata.model = String(data.model).slice(0, 160);

  const payload = {
    event_type: event,
    occurred_at: occurredAt.toISOString(),
    session_id: data?.sessionId ? String(data.sessionId).slice(0, 120) : null,
    context: data?.context ? String(data.context).slice(0, 120) : null,
    messenger: data?.messenger ? String(data.messenger).slice(0, 60) : null,
    metadata
  };

  const response = await fetch(`${SUPABASE_URL}/rest/v1/site_events`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'content-type': 'application/json',
      Prefer: 'return=minimal'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const details = await response.text().catch(() => '');
    throw new Error(`supabase_event_error_${response.status}:${details.slice(0, 200)}`);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false });

  const body = req.body || {};
  const event = String(body.event || '').slice(0, 60);
  const data = body.data && typeof body.data === 'object' ? body.data : {};
  const occurredAt = body.occurredAt ? new Date(body.occurredAt) : new Date();
  const safeDate = Number.isNaN(occurredAt.getTime()) ? new Date() : occurredAt;

  try {
    await saveAnalyticsEvent(event, data, safeDate);
  } catch (e) {
    console.error('analytics storage failed', e);
  }

  // Аналітика накопичується тихо. У Telegram надсилаємо тільки реальну підтверджену заявку.
  if (event !== 'service_request') {
    return res.status(200).json({ ok: true, tracked: true });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return res.status(503).json({ ok: false, error: 'telegram_not_configured' });

  const ts = safeDate.toLocaleString('uk-UA', { timeZone: 'Europe/Kyiv' });
  const clean = (v, max = 500) => String(v ?? '—').replace(/[<>]/g, '').slice(0, max);
  const lines = [
    '<b>🆕 Нова заявка з сайту</b>',
    `🕒 ${clean(ts)}`,
    `👤 Ім’я: ${clean(data.name, 120)}`,
    `📱 Телефон: ${clean(data.phone, 80)}`,
    `🚜 Техніка: ${clean(data.machine, 120)}`,
    `🏷 Марка: ${clean(data.brand, 120)}`,
    `🔢 Модель: ${clean(data.model, 160)}`,
    `⚠️ Проблема: ${clean(data.issue, 700)}`,
    `🧾 Код помилки: ${clean(data.error, 160)}`
  ];
  if (data.changes) lines.push(`📝 Уточнення / зміни: ${clean(data.changes, 700)}`);
  lines.push('', '📌 Статус: нова заявка — потрібно зв’язатися з клієнтом');

  try {
    const photoData = typeof data.photoData === 'string' ? data.photoData : '';
    const photoMatch = photoData.match(/^data:(image\/(?:jpeg|jpg|png|webp));base64,(.+)$/);

    if (photoMatch) {
      const mime = photoMatch[1] === 'image/jpg' ? 'image/jpeg' : photoMatch[1];
      const bytes = Buffer.from(photoMatch[2], 'base64');
      const form = new FormData();
      form.append('chat_id', chatId);
      form.append('caption', lines.join('\n').slice(0, 1000));
      form.append('parse_mode', 'HTML');
      form.append('photo', new Blob([bytes], { type: mime }), clean(data.photoName || 'request.jpg', 120));

      const tgPhoto = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
        method: 'POST',
        body: form
      });
      const photoResult = await tgPhoto.json();
      if (!photoResult.ok) return res.status(502).json({ ok: false, error: 'telegram_photo_error', description: photoResult.description || '' });
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
    if (!result.ok) return res.status(502).json({ ok: false, error: 'telegram_error', description: result.description || '' });
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: 'request_delivery_failed', description: String(e?.message || e) });
  }
}
