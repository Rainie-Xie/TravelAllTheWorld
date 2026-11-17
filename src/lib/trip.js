import { dateRange, splitDT, toMin, todayStr, addDays, daysBetween } from './time'
import { haversine, getMatrix, LEG_OVERHEAD, estimateMatrix } from './geo'
import { solveOrder, timeline } from './tsp'

export const PLACE_TYPES = {
  hotel: { label: '住宿', emoji: '🏨', color: '#F5C92A' },
  sight: { label: '景点', emoji: '📍', color: '#5DAA3C' },
  food: { label: '餐厅', emoji: '🍜', color: '#E5873F' },
  cafe: { label: '咖啡', emoji: '☕', color: '#A0784C' },
  shop: { label: '购物', emoji: '🛍️', color: '#D46BA6' },
  transit: { label: '交通', emoji: '🚉', color: '#4A8FD6' },
  other: { label: '其他', emoji: '✨', color: '#8A9585' },
}

export const TRANSPORT_TYPES = {
  flight: { label: '飞机', emoji: '✈️' },
  train: { label: '火车', emoji: '🚄' },
  bus: { label: '大巴', emoji: '🚌' },
  ferry: { label: '轮渡', emoji: '⛴️' },
  car: { label: '包车/自驾', emoji: '🚗' },
}

export const MODES = {
  walk: { label: '步行', emoji: '🚶' },
  drive: { label: '打车', emoji: '🚕' },
  bike: { label: '骑行', emoji: '🚲' },
}

export function tripStatus(trip) {
  if (trip.done) return 'done'
  const today = todayStr()
  if (trip.startDate && today >= trip.startDate && today <= trip.endDate) return 'ongoing'
  if (trip.endDate && today > trip.endDate) return 'past'
  return 'planning'
}

export const countdown = (trip) => (trip.startDate ? daysBetween(todayStr(), trip.startDate) : null)

export const getCity = (trip, id) => trip.cities.find((c) => c.id === id)
export const cityDates = (city) => dateRange(city.arrive, city.leave)
export const hotelsOf = (city) => city.places.filter((p) => p.type === 'hotel')

// the hotel you sleep in on the night of `date`
export function hotelForNight(city, date) {
  const hs = hotelsOf(city)
  const exact = hs.find((h) => h.hotelIn && h.hotelOut && h.hotelIn <= date && date < h.hotelOut)
  if (exact) return exact
  if (date >= city.leave) return null
  return hs.find((h) => !h.hotelIn) || (hs.length === 1 ? hs[0] : null)
}

export function cityOnDate(trip, date) {
  // the city where you sleep that night (fallback: city you are in)
  return trip.cities.find((c) => c.arrive <= date && date < c.leave) || trip.cities.find((c) => c.arrive <= date && date <= c.leave)
}

export const sortedTransports = (trip) =>
  [...trip.transports].sort((a, b) => (a.dep || '').localeCompare(b.dep || ''))

export function transportsOn(trip, date) {
  return sortedTransports(trip).filter((t) => splitDT(t.dep).date === date || splitDT(t.arr).date === date)
}

export function nearestCity(trip, pt) {
  if (!pt?.lat) return null
  let best = null, bd = Infinity
  for (const c of trip.cities) {
    const d = haversine(c, pt)
    if (d < bd) { bd = d; best = c }
  }
  return bd < 150000 ? best : null
}

/* ---------- airport / station leave time ---------- */
export function bufferFor(t, settings) {
  if (t.bufferMin != null && t.bufferMin !== '') return +t.bufferMin
  if (t.type === 'flight') return t.intl ? settings.intlBuffer : settings.domBuffer
  return settings.trainBuffer
}

export function departureHotel(trip, t) {
  const city = getCity(trip, t.fromCityId)
  if (!city) return null
  const date = splitDT(t.dep).date
  return hotelForNight(city, addDays(date, -1)) || hotelForNight(city, date) || hotelsOf(city)[0] || null
}

// returns { leaveMin, date, parts } — leaveMin is in minutes of departure date (may be negative)
export function leaveInfo(trip, t, settings) {
  if (!t.dep) return null
  const { date, min } = splitDT(t.dep)
  const buffer = bufferFor(t, settings)
  const hotel = departureHotel(trip, t)
  let transfer = t.transferMin
  if (transfer == null && hotel && t.from?.lat) {
    const m = estimateMatrix([hotel, t.from], 'drive')
    transfer = Math.round(m.dur[0][1] + LEG_OVERHEAD.drive)
  }
  transfer = transfer ?? 40
  const extra = settings.extraBuffer
  const leaveMin = min - buffer - transfer - extra
  return { date, leaveMin, buffer, transfer, extra, hotel }
}

/* ---------- point refs: 'p:<placeId>' | 'tf:<transportId>' (出发站) | 'tt:<transportId>' (到达站) ---------- */
export function resolveRef(trip, city, ref) {
  if (!ref) return null
  const [kind, id] = ref.split(':')
  if (kind === 'p') {
    const p = city.places.find((x) => x.id === id)
    return p ? { ref, name: p.name, lat: p.lat, lng: p.lng, emoji: PLACE_TYPES[p.type]?.emoji || '📍' } : null
  }
  const t = trip.transports.find((x) => x.id === id)
  if (!t) return null
  const end = kind === 'tf' ? t.from : t.to
  if (!end?.lat) return null
  return { ref, name: end.name || end.code, lat: end.lat, lng: end.lng, emoji: TRANSPORT_TYPES[t.type]?.emoji || '🚉' }
}

export function refOptions(trip, city) {
  const opts = city.places.filter((p) => p.type === 'hotel' || p.type === 'transit').map((p) => ({ ref: `p:${p.id}`, label: `${PLACE_TYPES[p.type].emoji} ${p.name}` }))
  for (const t of trip.transports) {
    if (t.fromCityId === city.id && t.from?.lat) opts.push({ ref: `tf:${t.id}`, label: `${TRANSPORT_TYPES[t.type].emoji} ${t.from.name || t.from.code}（出发）` })
    if (t.toCityId === city.id && t.to?.lat) opts.push({ ref: `tt:${t.id}`, label: `${TRANSPORT_TYPES[t.type].emoji} ${t.to.name || t.to.code}（到达）` })
  }
  return opts
}

// Default start/end/time window of a day in a city, derived from hotels + transports
export function dayDefaults(trip, city, date, settings) {
  const notes = []
  let startMin = toMin(settings.dayStart)
  let endMin = toMin(settings.dayEnd)
  let startRef = null, endRef = null

  const prevHotel = hotelForNight(city, addDays(date, -1))
  const tonight = hotelForNight(city, date)
  if (prevHotel && date > city.arrive) startRef = `p:${prevHotel.id}`
  if (tonight) endRef = `p:${tonight.id}`

  const arriving = trip.transports.find((t) => t.toCityId === city.id && splitDT(t.arr).date === date)
  if (arriving && arriving.to?.lat) {
    const arrMin = splitDT(arriving.arr).min
    startRef = `tt:${arriving.id}`
    startMin = Math.max(startMin, arrMin + (arriving.type === 'flight' ? 45 : 15))
    notes.push(`${TRANSPORT_TYPES[arriving.type].emoji} ${arriving.number || ''} ${splitDT(arriving.arr).time} 到达`)
  }
  if (!startRef) startRef = tonight ? `p:${tonight.id}` : null

  const departing = trip.transports.find((t) => t.fromCityId === city.id && splitDT(t.dep).date === date)
  let deadlineLabel = null
  if (departing) {
    const li = leaveInfo(trip, departing, settings)
    if (li) {
      endMin = Math.min(endMin, li.leaveMin)
      const hotel = li.hotel
      endRef = hotel ? `p:${hotel.id}` : departing.from?.lat ? `tf:${departing.id}` : endRef
      deadlineLabel = `${TRANSPORT_TYPES[departing.type].emoji} ${departing.number || ''} 需在 ${fmt(li.leaveMin)} 前出发去${departing.type === 'flight' ? '机场' : '车站'}`
      notes.push(deadlineLabel)
    }
  }
  return { startMin, endMin, startRef, endRef, notes, departing, arriving }
}
const fmt = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(Math.round(m % 60)).padStart(2, '0')}`

export function getDayPlan(city, date) {
  return city.dayPlans?.[date] || {}
}

export function placesForDay(city, date) {
  const plan = getDayPlan(city, date)
  const list = city.places.filter((p) => p.day === date && p.type !== 'hotel')
  const order = plan.order || []
  return list.sort((a, b) => {
    const ia = order.indexOf(a.id), ib = order.indexOf(b.id)
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib)
  })
}

export function effectiveDay(trip, city, date, settings) {
  const def = dayDefaults(trip, city, date, settings)
  const plan = getDayPlan(city, date)
  return {
    def,
    startMin: plan.startTime ? toMin(plan.startTime) : def.startMin,
    endMin: plan.endTime ? toMin(plan.endTime) : def.endMin,
    startRef: plan.startRef !== undefined ? plan.startRef : def.startRef,
    endRef: plan.endRef !== undefined ? plan.endRef : def.endRef,
    mode: plan.mode || settings.mode || 'walk',
  }
}

/* ---------- plan one day ---------- */
export async function planDay(trip, city, date, settings, { optimize = true } = {}) {
  const eff = effectiveDay(trip, city, date, settings)
  const start = resolveRef(trip, city, eff.startRef)
  const end = resolveRef(trip, city, eff.endRef)
  let list = placesForDay(city, date)
  const startPt = start || (list[0] ? { ...list[0], name: list[0].name } : null)
  if (!startPt) return { order: [], dropped: [], tl: null, warnings: [], eff }

  const allPts = [startPt, ...list, ...(end ? [end] : [])]
  const M = await getMatrix(allPts, eff.mode)
  const overhead = LEG_OVERHEAD[eff.mode]
  const lockedIds = getDayPlan(city, date).locked || {}

  const build = (subset) => {
    // sub-matrix for subset of list (by index into list)
    const idx = [0, ...subset.map((i) => i + 1), ...(end ? [list.length + 1] : [])]
    const T = idx.map((a) => idx.map((b) => M.dur[a][b] + (a === b ? 0 : overhead)))
    const D = idx.map((a) => idx.map((b) => M.dist[a][b]))
    const places = subset.map((i, pos) => ({
      stay: +list[i].stay || 60,
      open: list[i].open ? toMin(list[i].open) : null,
      close: list[i].close ? toMin(list[i].close) : null,
      lock: lockedIds[list[i].id] ? pos + 1 : null,
    }))
    return { T, D, places, idx }
  }

  let subset = list.map((_, i) => i)
  let warnings = []
  let result
  const run = () => {
    const { T, D, places, idx } = build(subset)
    const sol = optimize ? solveOrder(places, T, eff.startMin, !!end) : { order: places.map((_, i) => i), relaxed: false }
    // T already includes overhead → pass overhead 0
    const tl = timeline(sol.order, places, T, D, eff.startMin, !!end, 0)
    // mark legs that are taxi rides (walk mode, too far to walk)
    let prev = 0
    tl.steps = tl.steps.map((s) => {
      const taxi = !!M.taxi?.[idx[prev]]?.[idx[s.index + 1]]
      prev = s.index + 1
      return { ...s, taxi }
    })
    if (end) tl.endTaxi = !!M.taxi?.[idx[prev]]?.[idx[idx.length - 1]]
    return { sol, tl }
  }
  result = run()
  const dropped = []
  if (optimize) {
    const deadline = eff.endMin
    // drop optional places (biggest time saving first) until we meet the deadline
    let guard = 0
    while (result.tl.endArrive > deadline && guard++ < 10) {
      const opt = subset.filter((i) => list[i].priority === 'optional' && !lockedIds[list[i].id])
      if (!opt.length) break
      let best = null
      for (const i of opt) {
        const prev = subset
        subset = prev.filter((x) => x !== i)
        const r = run()
        subset = prev
        if (!best || r.tl.endArrive < best.r.tl.endArrive) best = { i, r }
      }
      subset = subset.filter((x) => x !== best.i)
      dropped.push(list[best.i].id)
      result = best.r
    }
  }
  const { sol, tl } = result
  if (sol.relaxed) warnings.push('有地点的营业时间排不开，已尽量安排，请留意标红的地点')
  if (tl.endArrive > eff.endMin + 1) warnings.push(`行程预计 ${fmt(tl.endArrive)} 结束，晚于计划的 ${fmt(eff.endMin)}，可以删减或把地点挪到别的日子`)
  if (dropped.length) warnings.push(`时间不够，已暂时移出 ${dropped.length} 个「有空再去」的地点`)
  const orderIds = sol.order.map((k) => list[subset[k]].id)
  const steps = tl.steps.map((s) => ({ ...s, id: list[subset[s.index]].id }))
  return {
    order: orderIds,
    dropped,
    tl: { ...tl, steps },
    warnings,
    eff,
    start: startPt,
    end,
    source: M.source,
  }
}

/* ---------- distribute places across days (balanced geographic clustering) ---------- */
export function distributeDays(trip, city, settings) {
  const days = cityDates(city)
  if (!days.length) return {}
  const caps = days.map((d) => {
    const def = dayDefaults(trip, city, d, settings)
    return Math.max(60, def.endMin - def.startMin)
  })
  const pts = city.places.filter((p) => p.type !== 'hotel' && p.type !== 'transit' && !p.dayLocked)
  if (!pts.length) return {}
  const k = days.length
  const cost = (p) => (+p.stay || 60) + 25
  // init centroids: farthest-point
  const cents = [{ lat: pts[0].lat, lng: pts[0].lng }]
  while (cents.length < Math.min(k, pts.length)) {
    let best = null, bd = -1
    for (const p of pts) {
      const d = Math.min(...cents.map((c) => haversine(c, p)))
      if (d > bd) { bd = d; best = p }
    }
    cents.push({ lat: best.lat, lng: best.lng })
  }
  while (cents.length < k) cents.push({ ...cents[cents.length - 1] })
  // capacity of each day relative to total demand
  const demand = pts.reduce((s, p) => s + cost(p), 0)
  const capSum = caps.reduce((a, b) => a + b, 0)
  // each day gets a share of the total proportional to its free time (+20% slack)
  const limit = caps.map((c) => ((demand * c) / capSum) * 1.2)
  let assign = new Map()
  for (let iter = 0; iter < 12; iter++) {
    const load = new Array(k).fill(0)
    const pairs = []
    for (const p of pts) for (let c = 0; c < k; c++) pairs.push([haversine(cents[c], p), p, c])
    pairs.sort((a, b) => a[0] - b[0])
    assign = new Map()
    for (const [, p, c] of pairs) {
      if (assign.has(p.id)) continue
      if (load[c] + cost(p) <= limit[c]) {
        assign.set(p.id, c)
        load[c] += cost(p)
      }
    }
    // leftovers (didn't fit anywhere): give to the day with the most spare time
    for (const p of pts) {
      if (assign.has(p.id)) continue
      let best = 0
      for (let c = 1; c < k; c++) if (caps[c] - load[c] > caps[best] - load[best]) best = c
      assign.set(p.id, best)
      load[best] += cost(p)
    }
    for (let c = 0; c < k; c++) {
      const mine = pts.filter((p) => assign.get(p.id) === c)
      if (mine.length) cents[c] = { lat: mine.reduce((s, p) => s + p.lat, 0) / mine.length, lng: mine.reduce((s, p) => s + p.lng, 0) / mine.length }
    }
  }
  // map cluster index to day: order clusters to follow a sensible path starting near the first hotel
  const out = {}
  for (const p of pts) out[p.id] = days[assign.get(p.id)]
  return out
}
