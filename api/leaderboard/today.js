export default async function handler(req, res) {
  return res.status(410).json({ ok: false, error: 'Deprecated. Use /api/metrics?type=leaderboard' })
}

