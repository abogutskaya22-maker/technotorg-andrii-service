export default function handler(req, res) {
  return res.status(410).json({ ok: false, error: 'setup_completed' });
}
