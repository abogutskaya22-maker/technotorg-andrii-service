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
  const labels = {
    page_view: '👀 Відвідування сайту',
    consultation_started: '🤖 Початок міні-консультації',
    consultation_completed: '✅ Міні-консультацію завершено',
    messenger_clicked: '💬 Перехід у месенджер',
    call_clicked: '📞 Натиснули дзвінок'
  };

  let lines = [`<b>${labels[event] || '📊 Подія сайту'}</b>`, `🕒 ${clean(ts)}`];

  if (event === 'consultation_completed') {
    lines.push(
      `👤 Ім’я: ${clean(data.name, 120)}`,
      `📱 Телефон: ${clean(data.phone, 80)}`,
      `🚜 Техніка: ${clean(data.machine, 120)}`,
      `🏷 Марка: ${clean(data.brand, 120)}`,
      `🔢 Модель: ${clean(data.model, 160)}`,
      `⚠️ Проблема: ${clean(data.issue, 700)}`,
      `🧾 Код помилки: ${clean(data.error, 160)}`
    );
  } else {
    if (data.name) lines.push(`👤 Ім’я: ${clean(data.name, 120)}`);
    if (data.phone) lines.push(`📱 Телефон: ${clean(data.phone, 80)}`);

    if (event === 'messenger_clicked') {
      lines.push(`📲 Месенджер: ${clean(data.messenger, 40)}`, `📍 Звідки: ${clean(data.context, 80)}`);
    } else if (event === 'call_clicked' || event === 'consultation_started') {
      lines.push(`📍 Звідки: ${clean(data.context, 80)}`);
    }
  }

  try {
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
