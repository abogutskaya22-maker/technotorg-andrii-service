export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ ok: false });

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return res.status(503).json({ ok: false, error: 'telegram_not_configured' });

  const webhookUrl = 'https://technotorg-andrii-service.vercel.app/api/telegram';
  try {
    const [webhookResponse, commandsResponse] = await Promise.all([
      fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: webhookUrl, allowed_updates: ['message', 'callback_query'] })
      }),
      fetch(`https://api.telegram.org/bot${token}/setMyCommands`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ commands: [
          { command: 'start', description: 'Відкрити меню бота' },
          { command: 'analytics', description: 'Переглянути аналітику сайту' }
        ] })
      })
    ]);

    const webhook = await webhookResponse.json();
    const commands = await commandsResponse.json();
    if (!webhook.ok || !commands.ok) {
      return res.status(502).json({ ok: false, webhook, commands });
    }
    return res.status(200).json({ ok: true, webhook: webhook.result, commands: commands.result });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}
