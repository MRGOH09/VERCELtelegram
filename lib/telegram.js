import { sendTelegramMessage } from './helpers.js'

const DEFAULT_BATCH = parseInt(process.env.BATCH_SIZE || '25', 10)
const DEFAULT_SLEEP = parseInt(process.env.BATCH_SLEEP_MS || '1100', 10)

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

export async function sendBatchMessages(messages) {
  const maxSend = process.env.MAX_SEND_PER_RUN ? parseInt(process.env.MAX_SEND_PER_RUN, 10) : null
  const slice = maxSend ? messages.slice(0, maxSend) : messages
  let sent = 0, failed = 0
  for (let i = 0; i < slice.length; i += DEFAULT_BATCH) {
    const batch = slice.slice(i, i + DEFAULT_BATCH)
    // 小并发（<=5）
    const chunks = []
    for (let j = 0; j < batch.length; j += 5) chunks.push(batch.slice(j, j + 5))
    for (const chunk of chunks) {
      await Promise.all(chunk.map(async m => {
        try { await sendTelegramMessage(m.chat_id, m.text, { parse_mode: m.parse_mode }) ; sent += 1 }
        catch (e) { failed += 1; console.warn('send failed', { chat_id: m.chat_id, error: String(e?.message || e) }) }
      }))
    }
    if (i + DEFAULT_BATCH < slice.length) await sleep(DEFAULT_SLEEP)
  }
  return { sent, failed }
}

