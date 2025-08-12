import { todayYMD } from '../../lib/time.js'
import { dailyReports } from '../../lib/cron-utils.js'
import { zh } from '../../lib/i18n.js'
import { formatTemplate } from '../../lib/helpers.js'

export default async function handler(req, res) {
  try {
    const { sent, failed } = await dailyReports(new Date(), ({a,b,c,pa,pb,pc, travel}) =>
      formatTemplate(zh.cron.daily_report, { a: a.toFixed?.(2) || a, b: b.toFixed?.(2) || b, c: c.toFixed?.(2) || c, pa, pb, pc, travel }))
    console.info('[cron:daily-report]', { ymd: todayYMD(), sent, failed })
    return res.status(200).json({ ok: true })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ ok: false, error: String(e.message || e) })
  }
}

