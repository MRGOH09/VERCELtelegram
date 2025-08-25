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

export async function editMessageText(chatId, messageId, text, options = {}) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not set')
  const url = `${BOT_API}/bot${token}/editMessageText`
  const body = {
    chat_id: chatId,
    message_id: messageId,
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
    console.error('Telegram editMessageText failed', data)
  }
  return data
}

export async function answerCallbackQuery(callbackQueryId, text = '') {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token || !callbackQueryId) return
  try {
    const url = `${BOT_API}/bot${token}/answerCallbackQuery`
    const body = { callback_query_id: callbackQueryId }
    if (text) body.text = text
    await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    })
  } catch {}
}

export async function sendTelegramMessages(chatIds, textBuilder, options = {}) {
  // 已废弃：请使用 lib/telegram.js 中的 sendBatchMessages
  console.warn('sendTelegramMessages is deprecated, use sendBatchMessages from lib/telegram.js instead')
  
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

export function normalizePhoneE164(rawInput) {
  if (!rawInput) return null
  const defaultCc = (process.env.DEFAULT_COUNTRY_CODE || '60').replace(/\D/g, '')
  let digits = String(rawInput).replace(/\D/g, '')
  if (!digits) return null
  // If number starts with 00 (international), strip leading 00 and add +
  if (digits.startsWith('00')) {
    return `+${digits.slice(2)}`
  }
  // If already includes country code length >= 8
  if (digits.length >= 10 && !digits.startsWith('0')) {
    return `+${digits}`
  }
  // Local format starting with 0 → attach default country code
  if (digits.startsWith('0')) {
    return `+${defaultCc}${digits.slice(1)}`
  }
  // Fallback
  return `+${defaultCc}${digits}`
}

export function validateEmail(email) {
  if (!email) return null
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const trimmed = String(email).trim().toLowerCase()
  if (!emailRegex.test(trimmed)) return null
  if (trimmed.length > 254) return null // RFC 5321 limit
  return trimmed
}

export function formatTemplate(template, params = {}) {
  if (!template) return ''
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const v = params[key]
    return v == null ? '' : String(v)
  })
}

