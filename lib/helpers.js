import { format, startOfDay, subDays } from 'date-fns'

const BOT_API = 'https://api.telegram.org'

export function formatYMD(date = new Date()) {
  return format(date, 'yyyy-MM-dd')
}

export function getYYYYMM(date = new Date()) {
  return format(date, 'yyyy-MM')
}

export function yesterdayYMD(date = new Date()) {
  return format(subDays(startOfDay(date), 1), 'yyyy-MM-dd')
}

export function parsePercentageInput(input) {
  if (input == null) return null
  const raw = String(input).trim()
  if (raw === '') return null
  let m = raw.match(/^([0-9]+(?:\.[0-9]+)?)%?$/)
  if (!m) return null
  let value = parseFloat(m[1])
  if (value <= 1) value = value * 100
  if (value < 0 || value > 100) return null
  return Number(value.toFixed(2))
}

export function parseAmountInput(input) {
  if (input == null) return null
  const raw = String(input).replace(/,/g, '').trim()
  if (!/^[-+]?[0-9]+(?:\.[0-9]{1,2})?$/.test(raw)) return null
  const value = Number(parseFloat(raw).toFixed(2))
  if (Math.abs(value) > 1000000) return null
  return value
}

export async function sendTelegramMessage(chatId, text, options = {}) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not set')
  const url = `${BOT_API}/bot${token}/sendMessage`
  const body = {
    chat_id: chatId,
    text,
    parse_mode: options.parse_mode || 'HTML',
    disable_web_page_preview: true,
    reply_markup: options.reply_markup
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  })
  const data = await res.json()
  if (!data.ok) {
    console.error('Telegram sendMessage failed', data)
  }
  return data
}

export async function sendTelegramMessages(chatIds, textBuilder, options = {}) {
  const limit = parseInt(process.env.MAX_SEND_PER_RUN || '120', 10)
  let sent = 0
  for (const chatId of chatIds) {
    if (sent >= limit) break
    const text = typeof textBuilder === 'function' ? textBuilder(chatId, sent) : String(textBuilder)
    try { // best-effort
      await sendTelegramMessage(chatId, text, options)
    } catch {}
    sent += 1
  }
  return sent
}

export function assertTelegramSecret(headers) {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET
  if (!expected) return true
  const actual = headers['x-telegram-bot-api-secret-token'] || headers['X-Telegram-Bot-Api-Secret-Token']
  return actual === expected
}

