import { todayYMD } from '../../lib/time.js'
import { computeLeaderboards, pushBranchLeaderboards, personalMorningReports } from '../../lib/cron-utils.js'
import { zh } from '../../lib/i18n.js'
import { formatTemplate } from '../../lib/helpers.js'

export default async function handler(req, res) {
  try {
    const nowYmd = todayYMD()
    await computeLeaderboards(new Date())
    const br = await pushBranchLeaderboards(new Date(), (code, stat) => formatTemplate(zh.cron.branch_lead, { code, rate: stat.rate||0, done: stat.done||0, total: stat.total||0 }))
    const pr = await personalMorningReports(new Date(), (myRank, topText) => formatTemplate(zh.cron.morning_rank, { rank: myRank, top: topText }))
    console.info('[cron:morning]', { ymd: nowYmd, sent: (br.sent||0)+(pr.sent||0), failed: (br.failed||0)+(pr.failed||0) })
    return res.status(200).json({ ok: true })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ ok: false, error: String(e.message || e) })
  }
}

