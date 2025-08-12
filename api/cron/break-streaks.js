import { todayYMD } from '../../lib/time.js'
import { breakStreaksOneShot } from '../../lib/cron-utils.js'

export default async function handler(req, res) {
  try {
    await breakStreaksOneShot()
    console.info('[cron:break-streaks]', { ymd: todayYMD() })
    return res.status(200).json({ ok: true })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ ok: false, error: String(e.message || e) })
  }
}

