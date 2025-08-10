import supabase from '../../../lib/supabase.js'
import { format } from 'date-fns'

async function recomputeDaily(userId, ymd) {
  const { data: sums } = await supabase
    .from('records')
    .select('category_group,amount')
    .eq('user_id', userId)
    .eq('ymd', ymd)
    .eq('is_voided', false)
  let a = 0, b = 0, c = 0
  for (const r of sums || []) {
    if (r.category_group === 'A') a += Number(r.amount)
    else if (r.category_group === 'B') b += Number(r.amount)
    else if (r.category_group === 'C') c += Number(r.amount)
  }
  const total = (sums || []).length
  await supabase.from('daily_summary').upsert({ user_id: userId, ymd, sum_a: a, sum_b: b, sum_c: c, total_count: total })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  try {
    const id = req.query.id
    const { category_group, category_code, amount, note } = req.body || {}
    const { data: oldRec, error: oldErr } = await supabase
      .from('records')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (oldErr) throw oldErr
    if (!oldRec) return res.status(404).json({ error: 'record not found' })

    // Soft-void old
    await supabase.from('records').update({ is_voided: true }).eq('id', id)

    // Insert new corrected
    const insertPayload = {
      user_id: oldRec.user_id,
      category_group: category_group || oldRec.category_group,
      category_code: category_code || oldRec.category_code,
      amount: typeof amount === 'number' ? amount : oldRec.amount,
      note: note ?? oldRec.note,
      ymd: oldRec.ymd,
      parent_id: oldRec.id
    }
    const { data: newRec, error: insErr } = await supabase
      .from('records')
      .insert([insertPayload])
      .select('*')
      .single()
    if (insErr) throw insErr

    // Recompute daily summary for that day
    await recomputeDaily(oldRec.user_id, oldRec.ymd)

    // Audit
    await supabase.from('event_audit').insert([{
      event_id: newRec.id,
      user_id: oldRec.user_id,
      action: 'correct',
      old: oldRec,
      new: newRec
    }])

    return res.status(200).json({ ok: true, record: newRec })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ error: 'Internal error', detail: String(e.message || e) })
  }
}

