import LZ from 'lz-string'
import { localToUtc, splitDT, toMin } from './time'
import { leaveInfo, TRANSPORT_TYPES, sortedTransports } from './trip'

/* ---------------- 汇率 ---------------- */
export async function fetchRates() {
  const r = await fetch('https://open.er-api.com/v6/latest/USD')
  const d = await r.json()
  if (d.result !== 'success') throw new Error('汇率服务暂时不可用')
  return { at: Date.now(), base: 'USD', rates: d.rates }
}

export function convert(amount, from, to, rates) {
  if (!rates?.rates?.[from] || !rates.rates[to]) return null
  return (amount / rates.rates[from]) * rates.rates[to]
}

export function fmtMoney(v, cur) {
  if (v == null || !isFinite(v)) return '-'
  const digits = ['VND', 'KRW', 'JPY', 'IDR', 'KHR', 'LAK'].includes(cur) ? 0 : 2
  return v.toLocaleString('zh-CN', { maximumFractionDigits: digits, minimumFractionDigits: 0 })
}

/* ---------------- 日历 (.ics) ---------------- */
const icsDate = (ms) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
const floating = (dt) => dt.replace(/[-:]/g, '').slice(0, 13) + '00'
const esc = (s = '') => String(s).replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n')

export function buildIcs(trip, settings) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//TripNote//CN', 'CALSCALE:GREGORIAN', `X-WR-CALNAME:${esc(trip.name)}`]
  const stamp = icsDate(Date.now())
  const when = (dt, tz, offsetMin = 0) => {
    const utc = localToUtc(dt, tz)
    if (utc != null) return `:${icsDate(utc + offsetMin * 60000)}`
    // floating local time
    const { date, min } = splitDT(dt)
    const m = min + offsetMin
    const d = new Date(`${date}T00:00:00`)
    d.setMinutes(m)
    const p = (n) => String(n).padStart(2, '0')
    return `:${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}T${p(d.getHours())}${p(d.getMinutes())}00`
  }
  for (const t of sortedTransports(trip)) {
    if (!t.dep) continue
    const tt = TRANSPORT_TYPES[t.type]
    const title = `${tt.emoji} ${t.number || tt.label} ${t.from?.name || ''} → ${t.to?.name || ''}`
    lines.push('BEGIN:VEVENT', `UID:${t.id}@tripnote`, `DTSTAMP:${stamp}`, `DTSTART${when(t.dep, t.from?.tz)}`,
      `DTEND${t.arr ? when(t.arr, t.to?.tz) : when(t.dep, t.from?.tz, 120)}`, `SUMMARY:${esc(title)}`,
      `DESCRIPTION:${esc([t.terminal && `航站楼 ${t.terminal}`, t.bookingRef && `订单号 ${t.bookingRef}`, t.baggage && `行李 ${t.baggage}`].filter(Boolean).join('\n'))}`,
      'END:VEVENT')
    const li = leaveInfo(trip, t, settings)
    if (li) {
      const offset = li.leaveMin - toMin(splitDT(t.dep).time)
      lines.push('BEGIN:VEVENT', `UID:${t.id}-leave@tripnote`, `DTSTAMP:${stamp}`,
        `DTSTART${when(t.dep, t.from?.tz, offset)}`, `DTEND${when(t.dep, t.from?.tz, offset + 15)}`,
        `SUMMARY:${esc(`⏰ 出发去${t.type === 'flight' ? '机场' : '车站'}（${t.number || tt.label}）`)}`,
        `DESCRIPTION:${esc(`${li.hotel ? `从 ${li.hotel.name} 出发\n` : ''}路上约 ${li.transfer} 分钟，提前 ${li.buffer} 分钟到达`)}`,
        'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:该出发了', 'TRIGGER:-PT30M', 'END:VALARM',
        'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:该出发了', 'TRIGGER:PT0M', 'END:VALARM',
        'END:VEVENT')
    }
  }
  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}
export { floating }

/* ---------------- 分享链接 ---------------- */
export function shareLink(trip) {
  const slim = { ...trip, expenses: [], packing: [] }
  const data = LZ.compressToEncodedURIComponent(JSON.stringify(slim))
  return `${location.origin}${location.pathname}#/share/${data}`
}

export function decodeShare(data) {
  try {
    return JSON.parse(LZ.decompressFromEncodedURIComponent(data))
  } catch {
    return null
  }
}
