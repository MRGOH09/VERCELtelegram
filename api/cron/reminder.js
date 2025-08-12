import { todayYMD } from '../../lib/time.js'
import { usersWithoutRecordToday } from '../../lib/cron-utils.js'
import { sendBatchMessages } from '../../lib/telegram.js'
import { zh } from '../../lib/i18n.js'

export default async function handler(req, res) {
  try {
    const list = await usersWithoutRecordToday(new Date())
    const { sent, failed } = await sendBatchMessages(list.map(chat_id => ({ chat_id, text: zh.cron.reminder })))
    console.info('[cron:reminder]', { ymd: todayYMD(), sent, failed })
    return res.status(200).json({ ok: true })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ ok: false, error: String(e.message || e) })
  }
}

