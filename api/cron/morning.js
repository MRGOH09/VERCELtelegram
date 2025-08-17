import { todayYMD } from '../../lib/time.js'
import { computeLeaderboards, pushBranchLeaderboards, personalMorningReports, breakStreaksOneShot } from '../../lib/cron-utils.js'
import supabase from '../../lib/supabase.js'
import { zh } from '../../lib/i18n.js'
import { formatTemplate } from '../../lib/helpers.js'

export default async function handler(req, res) {
  try {
    const nowYmd = todayYMD()
    // 每月 1 号自动入账月度分摊（旅行/医疗/车险），幂等
    const d = new Date()
    if (d.getDate() === 1) {
      const yyyymm = d.toISOString().slice(0,7)
      const ymd = `${yyyymm}-01`
      const { data: profs } = await supabase
        .from('user_profile')
        .select('user_id,travel_budget_annual,annual_medical_insurance,annual_car_insurance')
      for (const p of profs||[]) {
        const posts = [
          { g: 'B', c: 'travel_auto', amt: Number(p.travel_budget_annual||0)/12 },
          { g: 'C', c: 'ins_med_auto', amt: Number(p.annual_medical_insurance||0)/12 },
          { g: 'C', c: 'ins_car_auto', amt: Number(p.annual_car_insurance||0)/12 }
        ].filter(x=>x.amt>0)
        for (const it of posts) {
          const { data: exist } = await supabase
            .from('records')
            .select('id').eq('user_id', p.user_id).eq('ymd', ymd).eq('category_code', it.c).eq('is_voided', false).maybeSingle()
          if (!exist) {
            await supabase.from('records').insert([{ user_id: p.user_id, category_group: it.g, category_code: it.c, amount: it.amt, note: 'Auto-post', ymd }])
          }
        }
      }
    }
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

