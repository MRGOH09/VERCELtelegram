import supabase from '../lib/supabase.js'
import { formatYMD } from '../lib/helpers.js'
import { format } from 'date-fns'

async function recomputeDailySummary(userId, ymd) {
  const { data: sums, error: sumErr } = await supabase
    .from('records')
    .select('category_group, amount')
    .eq('user_id', userId)
    .eq('ymd', ymd)
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
    .upsert({ user_id: userId, ymd, sum_a: sumA, sum_b: sumB, sum_c: sumC, total_count: totalCount })
  if (upsertDailyErr) throw upsertDailyErr
}

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const userId = String(req.query.userId || '')
      const range = String(req.query.range || 'month')
      const page = parseInt(String(req.query.page || '1'), 10) || 1
      const pageSize = Math.min(10, Math.max(1, parseInt(String(req.query.pageSize || '5'), 10) || 5))
      if (!userId) return res.status(400).json({ error: 'userId required' })

      const today = new Date()
      const ymd = format(today, 'yyyy-MM-dd')
      let startDate, endDate
      if (range === 'today') { startDate = ymd; endDate = ymd }
      else if (range === 'lastmonth') {
        const firstPrev = new Date(today); firstPrev.setDate(1); firstPrev.setMonth(firstPrev.getMonth() - 1)
        const lastPrev = new Date(firstPrev); lastPrev.setMonth(firstPrev.getMonth() + 1); lastPrev.setDate(0)
        startDate = format(firstPrev, 'yyyy-MM-dd')
        endDate = format(lastPrev, 'yyyy-MM-dd')
      } else {
        const d = new Date(today); d.setDate(1)
        startDate = format(d, 'yyyy-MM-dd')
        endDate = ymd
      }

      const from = (page - 1) * pageSize
      const to = from + pageSize - 1
      const query = supabase
        .from('records')
        .select('id,ymd,category_group,category_code,amount,note,is_voided', { count: 'exact' })
        .eq('user_id', userId)
        .eq('is_voided', false)
        .gte('ymd', startDate)
        .lte('ymd', endDate)
        .order('ymd', { ascending: false })
        .order('id', { ascending: false })
        .range(from, to)
      const { data: rows, error, count } = await query
      if (error) throw error
      const pages = Math.max(1, Math.ceil((count || 0) / pageSize))
      return res.status(200).json({ ok: true, rows: rows || [], page, pages, count: count || 0 })
    }

    if (req.method === 'PATCH') {
      const { userId, recordId, amount, note } = req.body || {}
      if (!userId || !recordId) return res.status(400).json({ error: 'Invalid payload' })
      const updates = {}
      if (typeof amount === 'number') updates.amount = amount
      if (typeof note === 'string') updates.note = note
      if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No updates' })
      const { data: before, error: selErr } = await supabase
        .from('records')
        .select('id,ymd')
        .eq('id', recordId)
        .eq('user_id', userId)
        .eq('is_voided', false)
        .maybeSingle()
      if (selErr) throw selErr
      if (!before) return res.status(404).json({ error: 'Not found' })
      const { data: updated, error: upErr } = await supabase
        .from('records')
        .update(updates)
        .eq('id', recordId)
        .eq('user_id', userId)
        .select('id,ymd,category_group,category_code,amount,note')
        .maybeSingle()
      if (upErr) throw upErr
      await recomputeDailySummary(userId, before.ymd)
      return res.status(200).json({ ok: true, record: updated })
    }

    if (req.method === 'DELETE') {
      const { userId, recordId } = req.query
      if (!userId || !recordId) return res.status(400).json({ error: 'Invalid payload' })
      const { data: before, error: selErr } = await supabase
        .from('records')
        .select('id,ymd')
        .eq('id', recordId)
        .eq('user_id', userId)
        .eq('is_voided', false)
        .maybeSingle()
      if (selErr) throw selErr
      if (!before) return res.status(404).json({ error: 'Not found' })
      const { error: delErr } = await supabase
        .from('records')
        .update({ is_voided: true })
        .eq('id', recordId)
        .eq('user_id', userId)
      if (delErr) throw delErr
      await recomputeDailySummary(userId, before.ymd)
      return res.status(200).json({ ok: true })
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' })
    }

    // POST create
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
    await recomputeDailySummary(userId, recordYmd)

    // Update streaks and totals
    const todayYmd = formatYMD(new Date())
    const { data: profile, error: profErr } = await supabase
      .from('user_profile')
      .select('current_streak, max_streak, last_record, total_records')
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

