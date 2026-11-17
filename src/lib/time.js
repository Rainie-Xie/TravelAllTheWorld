const WEEK = ['日', '一', '二', '三', '四', '五', '六']

export const pad = (n) => String(n).padStart(2, '0')

export function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export const parseDate = (s) => new Date(s + 'T00:00:00')

export function addDays(s, n) {
  const d = parseDate(s)
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function daysBetween(a, b) {
  return Math.round((parseDate(b) - parseDate(a)) / 86400000)
}

export function dateRange(a, b) {
  if (!a || !b) return []
  const out = []
  const n = daysBetween(a, b)
  for (let i = 0; i <= Math.min(n, 120); i++) out.push(addDays(a, i))
  return out
}

export function fmtDate(s, opts = {}) {
  if (!s) return ''
  const d = parseDate(s)
  const base = `${d.getMonth() + 1}月${d.getDate()}日`
  return opts.week === false ? base : `${base} 周${WEEK[d.getDay()]}`
}

export const fmtShort = (s) => {
  if (!s) return ''
  const d = parseDate(s)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

export const weekday = (s) => '周' + WEEK[parseDate(s).getDay()]

export function toMin(hhmm) {
  if (!hhmm) return null
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + (m || 0)
}

export function fromMin(min) {
  if (min == null || !isFinite(min)) return '--:--'
  const m = Math.round(min)
  const day = Math.floor(m / 1440)
  const r = ((m % 1440) + 1440) % 1440
  const s = `${pad(Math.floor(r / 60))}:${pad(r % 60)}`
  if (day > 0) return `${s}(+${day})`
  if (day < 0) return `前一天 ${s}`
  return s
}

export function fmtDur(min) {
  if (min == null || !isFinite(min)) return '-'
  const m = Math.round(min)
  if (m < 60) return `${m}分钟`
  const h = Math.floor(m / 60)
  const r = m % 60
  return r ? `${h}小时${r}分` : `${h}小时`
}

export const fmtDist = (m) => (m == null ? '-' : m < 1000 ? `${Math.round(m)}米` : `${(m / 1000).toFixed(m < 10000 ? 1 : 0)}公里`)

// '2026-11-20T14:30' -> { date, time, min }
export function splitDT(dt) {
  if (!dt) return { date: '', time: '', min: null }
  const [date, time = '00:00'] = dt.split('T')
  return { date, time: time.slice(0, 5), min: toMin(time.slice(0, 5)) }
}

// Minutes offset of timezone tz from UTC at given UTC ms
export function tzOffsetMin(tz, utcMs) {
  try {
    const f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    })
    const p = Object.fromEntries(f.formatToParts(new Date(utcMs)).map((x) => [x.type, x.value]))
    const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second)
    return Math.round((asUTC - utcMs) / 60000)
  } catch {
    return null
  }
}

// local wall time in tz -> UTC ms (null when tz unknown)
export function localToUtc(dt, tz) {
  if (!dt || !tz) return null
  const { date, time } = splitDT(dt)
  const [y, mo, d] = date.split('-').map(Number)
  const [h, mi] = time.split(':').map(Number)
  const guess = Date.UTC(y, mo - 1, d, h, mi)
  const off1 = tzOffsetMin(tz, guess)
  if (off1 == null) return null
  const off2 = tzOffsetMin(tz, guess - off1 * 60000)
  return guess - off2 * 60000
}

export const deviceTz = () => Intl.DateTimeFormat().resolvedOptions().timeZone
