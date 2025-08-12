export const APP_TZ = process.env.APP_TZ || 'Asia/Kuala_Lumpur'

function parts(date = new Date(), tz = APP_TZ) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false
  })
  const map = {}
  for (const p of fmt.formatToParts(date)) map[p.type] = p.value
  return map
}

export function todayYMD(tz = APP_TZ) {
  const p = parts(new Date(), tz)
  return `${p.year}-${p.month}-${p.day}`
}

export function nowHHMM(tz = APP_TZ) {
  const p = parts(new Date(), tz)
  return `${p.hour}:${p.minute}`
}

