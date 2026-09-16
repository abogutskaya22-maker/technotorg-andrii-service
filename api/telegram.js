const SUPABASE_URL = 'https://tuoubfmngreuwiolsykr.supabase.co';
const SUPABASE_KEY = 'sb_publishable_wvdhkwV3ScV7i5bBFFI6Qw_qrbkewR8';

async function tg(token, method, payload) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload)
  });
  return response.json();
}

async function getSummary(days) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/analytics_summary`, {
    method: 'POST', headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ days_back: days })
  });
  if (!response.ok) throw new Error(`analytics_summary_${response.status}`);
  const data = await response.json();
  return data?.[0] || null;
}

function periodTitle(days) {
  if (days === 1) return 'Сьогодні';
  if (days === 7) return 'Останні 7 днів';
  if (days === 30) return 'Останні 30 днів';
  return `Останні ${days} днів`;
}

function summaryText(row, days) {
  const conversion = Number(row?.conversion_percent || 0).toFixed(1).replace('.', ',');
  return [
    `<b>📊 Аналітика сайту — ${periodTitle(days)}</b>`, '',
    `👀 Відвідування: <b>${row?.page_views || 0}</b>`,
    `🤖 Почали оформлення заявки: <b>${row?.consultation_starts || 0}</b>`,
    `✅ Підтверджені заявки: <b>${row?.requests || 0}</b>`,
    `📞 Натиснули «Подзвонити»: <b>${row?.call_clicks || 0}</b>`,
    `💬 Перейшли в месенджер: <b>${row?.messenger_clicks || 0}</b>`, '',
    `🎯 Конверсія сайт → заявка: <b>${conversion}%</b>`
  ].join('\n');
}

const periodKeyboard = { inline_keyboard: [[
  { text: 'Сьогодні', callback_data: 'analytics:1' },
  { text: '7 днів', callback_data: 'analytics:7' },
  { text: '30 днів', callback_data: 'analytics:30' }
], [{ text: '🔄 Оновити', callback_data: 'analytics:1' }]] };

const mainKeyboard = { keyboard: [[{ text: '📊 Аналітика' }]], resize_keyboard: true, is_persistent: true };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false });

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const allowedChatId = String(process.env.TELEGRAM_CHAT_ID || '');
  if (!token || !allowedChatId) return res.status(503).json({ ok: false });

  const update = req.body || {};
  const message = update.message;
  const callback = update.callback_query;
  const chatId = String(message?.chat?.id ?? callback?.message?.chat?.id ?? '');
  const text = String(message?.text || '').trim();

  // Temporary safe registration probe: logs only a group/supergroup ID when the bot is explicitly addressed with /start.
  const isRegistrationProbe = (message?.chat?.type === 'group' || message?.chat?.type === 'supergroup') && /^\/start(?:@kimnatnyi_bot)?(?:\s|$)/i.test(text);
  if (chatId && chatId !== allowedChatId && isRegistrationProbe) {
    console.log('TELEGRAM_GROUP_REGISTRATION_CANDIDATE', chatId, message?.chat?.type);
    return res.status(200).json({ ok: true });
  }

  if (!chatId || chatId !== allowedChatId) {
    if (callback?.id) await tg(token, 'answerCallbackQuery', { callback_query_id: callback.id });
    return res.status(200).json({ ok: true });
  }

  try {
    if (callback?.data?.startsWith('analytics:')) {
      const days = Math.max(1, Math.min(365, Number(callback.data.split(':')[1]) || 1));
      const row = await getSummary(days);
      await tg(token, 'answerCallbackQuery', { callback_query_id: callback.id });
      await tg(token, 'editMessageText', { chat_id: chatId, message_id: callback.message.message_id, text: summaryText(row, days), parse_mode: 'HTML', reply_markup: periodKeyboard });
      return res.status(200).json({ ok: true });
    }

    if (text === '/start' || /^\/start@kimnatnyi_bot$/i.test(text)) {
      await tg(token, 'sendMessage', { chat_id: chatId, text: 'Готово 👌 Тут будуть приходити тільки нові заявки з сайту. Аналітику можна відкрити окремо через кнопку нижче.', reply_markup: mainKeyboard });
      return res.status(200).json({ ok: true });
    }

    if (text === '/analytics' || text === '📊 Аналітика') {
      const row = await getSummary(1);
      await tg(token, 'sendMessage', { chat_id: chatId, text: summaryText(row, 1), parse_mode: 'HTML', reply_markup: periodKeyboard });
      return res.status(200).json({ ok: true });
    }

    await tg(token, 'sendMessage', { chat_id: chatId, text: 'Оберіть дію в меню нижче.', reply_markup: mainKeyboard });
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('telegram webhook error', e);
    return res.status(200).json({ ok: true });
  }
}
