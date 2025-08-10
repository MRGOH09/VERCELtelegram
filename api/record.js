import supabase from '../lib/supabase.js'
import { formatYMD } from '../lib/helpers.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  try {
    const { userId, category_group, category_code, amount, note, ymd } = req.body || {}

    if (!userId || !['A','B','C'].includes(category_group) || !category_code || typeof amount !== 'number') {
      return res.status(400).json({ error: 'Invalid payload' })
    }

    const recordYmd = ymd || formatYMD(new Date())

    const { data: inserted, error: insertErr } = await supabase
      .from('records')
      .insert([{ user_id: userId, category_group, category_code, amount, note: note || null, ymd: recordYmd }])
      .select('*')
      .single()

    if (insertErr) throw insertErr

    // Recompute daily summary for this user & day
    const { data: sums, error: sumErr } = await supabase
      .from('records')
      .select('category_group, amount')
      .eq('user_id', userId)
      .eq('ymd', recordYmd)
      .eq('is_voided', false)

    if (sumErr) throw sumErr

    let sumA = 0, sumB = 0, sumC = 0
    for (const r of sums || []) {
      if (r.category_group === 'A') sumA += Number(r.amount)
      else if (r.category_group === 'B') sumB += Number(r.amount)
      else if (r.category_group === 'C') sumC += Number(r.amount)
    }

    const totalCount = (sums || []).length

    const { error: upsertDailyErr } = await supabase
      .from('daily_summary')
      .upsert({ user_id: userId, ymd: recordYmd, sum_a: sumA, sum_b: sumB, sum_c: sumC, total_count: totalCount })

    if (upsertDailyErr) throw upsertDailyErr

    // Update streaks and totals
    const todayYmd = formatYMD(new Date())
    const { data: profile, error: profErr } = await supabase
      .from('user_profile')
      .select('current_streak, max_streak, last_record')
      .eq('user_id', userId)
      .single()
    if (profErr) throw profErr

    let currentStreak = profile?.current_streak || 0
    let maxStreak = profile?.max_streak || 0
    let lastRecord = profile?.last_record || null

    if (recordYmd === todayYmd) {
      const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1)
      const yYmd = formatYMD(yesterday)
      if (lastRecord === todayYmd) {
        // already counted today
      } else if (lastRecord === yYmd) {
        currentStreak = currentStreak + 1
      } else {
        currentStreak = 1
      }
      if (currentStreak > maxStreak) maxStreak = currentStreak
      lastRecord = todayYmd
    }

    // total_records +1
    const { data: dummy, error: upProfErr } = await supabase
      .from('user_profile')
      .update({ current_streak: currentStreak, max_streak: maxStreak, last_record: lastRecord, total_records: (profile?.total_records || 0) + 1 })
      .eq('user_id', userId)
      .select('user_id')
    if (upProfErr) throw upProfErr

    // Update branch_daily (done/total)
    const { data: userRow, error: uErr } = await supabase
      .from('users')
      .select('branch_code')
      .eq('id', userId)
      .single()
    if (uErr) throw uErr

    if (userRow?.branch_code) {
      const branch = userRow.branch_code
      // Total users in branch
      const { data: branchUsers, error: totalErr } = await supabase
        .from('users')
        .select('id')
        .eq('branch_code', branch)
      if (totalErr) throw totalErr
      const total = (branchUsers || []).length

      // Done: distinct branch users who have >=1 record for that day
      const branchUserIds = new Set((branchUsers || []).map(u => u.id))
      const { data: recUsers, error: recErr } = await supabase
        .from('records')
        .select('user_id')
        .eq('ymd', recordYmd)
        .eq('is_voided', false)
      if (recErr) throw recErr
      const doneSet = new Set()
      for (const r of recUsers || []) {
        if (branchUserIds.has(r.user_id)) doneSet.add(r.user_id)
      }
      const done = doneSet.size

      const rate = total > 0 ? Math.round((done * 10000) / total) / 100 : 0

      const { error: upBD } = await supabase
        .from('branch_daily')
        .upsert({ branch_code: branch, ymd: recordYmd, done, total, rate })
      if (upBD) throw upBD
    }

    return res.status(200).json({ ok: true, record: inserted })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ error: 'Internal error', detail: String(e.message || e) })
  }
}

