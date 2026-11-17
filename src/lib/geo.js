import { sleep } from './util'

const R = 6371000
export function haversine(a, b) {
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

/* ---------------- Nominatim search (free, ≤1 req/s) ---------------- */
let lastCall = 0
async function nominatim(params) {
  const wait = lastCall + 1100 - Date.now()
  if (wait > 0) await sleep(wait)
  lastCall = Date.now()
  const qs = new URLSearchParams({ format: 'jsonv2', addressdetails: '1', namedetails: '1', 'accept-language': 'zh-CN,zh,en', ...params })
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${qs}`)
  if (!res.ok) throw new Error('搜索服务暂时不可用')
  return res.json()
}

const pickName = (r) => r.namedetails?.['name:zh'] || r.namedetails?.['name:zh-Hans'] || r.name || r.display_name.split(',')[0]

const TYPE_MAP = [
  [/hotel|hostel|guest_house|motel|apartment|resort/, 'hotel'],
  [/restaurant|fast_food|food_court|bar|pub/, 'food'],
  [/cafe|ice_cream|bakery/, 'cafe'],
  [/mall|marketplace|supermarket|department_store|shop|market/, 'shop'],
  [/aerodrome|station|terminal|bus_station|ferry/, 'transit'],
]
function guessType(r) {
  const t = `${r.category || r.class}:${r.type}`
  for (const [re, type] of TYPE_MAP) if (re.test(t)) return type
  return 'sight'
}

export async function searchPlaces(q, near, countryCode) {
  const params = { q, limit: '8' }
  if (near) {
    const d = 0.35
    params.viewbox = `${near.lng - d},${near.lat + d},${near.lng + d},${near.lat - d}`
    params.bounded = '0'
  }
  if (countryCode) params.countrycodes = countryCode.toLowerCase()
  let rows = await nominatim(params)
  if (!rows.length && countryCode) {
    delete params.countrycodes
    rows = await nominatim(params)
  }
  return rows.map((r) => ({
    name: pickName(r),
    address: r.display_name,
    lat: +r.lat,
    lng: +r.lon,
    type: guessType(r),
    dist: near ? haversine(near, { lat: +r.lat, lng: +r.lon }) : null,
  }))
}

export async function searchCities(q, countryCode) {
  const rows = await nominatim({ q, limit: '8', featureType: 'settlement', ...(countryCode ? { countrycodes: countryCode.toLowerCase() } : {}) })
  return rows.map((r) => ({
    name: pickName(r),
    en: r.namedetails?.['name:en'] || r.name,
    address: r.display_name,
    lat: +r.lat,
    lng: +r.lon,
    countryCode: (r.address?.country_code || countryCode || '').toUpperCase(),
  }))
}

// Accepts Google Maps links / "lat,lng" text and pulls out coordinates + name
export function parseMapLink(text) {
  const s = decodeURIComponent(text.trim()).replace(/\+/g, ' ')
  let m = s.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) || s.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) ||
    s.match(/[?&](?:q|query|ll|destination)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/) || s.match(/^(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)$/)
  if (!m) return null
  const nameM = s.match(/\/place\/([^/@]+)/)
  return { lat: +m[1], lng: +m[2], name: nameM ? nameM[1].trim() : '' }
}

/* ---------------- Routing (OSRM via routing.openstreetmap.de) ---------------- */
const PROFILE = { walk: 'routed-foot', drive: 'routed-car', bike: 'routed-bike' }
const SPEED = { walk: 4.6, drive: 24, bike: 13 } // km/h fallback (city traffic)
const DETOUR = 1.35
export const LEG_OVERHEAD = { walk: 0, drive: 5, bike: 2 } // 打车等车/停车等额外分钟

const matrixCache = new Map()

export function estimateMatrix(points, mode) {
  const n = points.length
  const dur = [], dist = []
  for (let i = 0; i < n; i++) {
    dur.push([]); dist.push([])
    for (let j = 0; j < n; j++) {
      const d = i === j ? 0 : haversine(points[i], points[j]) * DETOUR
      dist[i].push(d)
      dur[i].push(i === j ? 0 : (d / 1000 / SPEED[mode]) * 60)
    }
  }
  return { dur, dist, source: 'estimate' }
}

// Walking more than this is unrealistic → that leg is treated as a taxi ride
export const WALK_MAX = 2500
const TAXI_KMH = 22
const TAXI_EXTRA = 8 // 叫车 + 上下车

// After a server fails, skip it for a while so the UI never waits on it repeatedly
const down = {}
const isDown = (k) => down[k] && Date.now() - down[k] < 5 * 60 * 1000
async function fetchJSON(url, ms = 6000, key) {
  if (key && isDown(key)) throw new Error('down')
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ms)
  try {
    const r = await fetch(url, { signal: ctrl.signal })
    if (!r.ok) throw new Error(String(r.status))
    return await r.json()
  } catch (e) {
    if (key) down[key] = Date.now()
    throw e
  } finally {
    clearTimeout(timer)
  }
}

const VALHALLA = 'https://valhalla1.openstreetmap.de'
const COSTING = { walk: 'pedestrian', drive: 'auto', bike: 'bicycle' }

async function valhallaMatrix(points, mode) {
  const locs = points.map((p) => ({ lat: +p.lat.toFixed(6), lon: +p.lng.toFixed(6) }))
  const body = { sources: locs, targets: locs, costing: COSTING[mode] }
  const d = await fetchJSON(`${VALHALLA}/sources_to_targets?json=${encodeURIComponent(JSON.stringify(body))}`, 8000, 'valhalla')
  const rows = d.sources_to_targets
  return {
    dur: rows.map((r) => r.map((c) => (c.time == null ? null : c.time / 60))),
    dist: rows.map((r) => r.map((c) => (c.distance == null ? null : c.distance * 1000))),
  }
}

async function osrmMatrix(points, mode) {
  const coords = points.map((p) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(';')
  const d = await fetchJSON(`https://routing.openstreetmap.de/${PROFILE[mode]}/table/v1/driving/${coords}?annotations=duration,distance`, 6000, 'osrm')
  if (d.code !== 'Ok') throw new Error(d.code)
  return { dur: d.durations.map((r) => r.map((v) => (v == null ? null : v / 60))), dist: d.distances }
}

// In walk mode, long legs become taxi rides (marked in `taxi`)
function applyWalkLimit(m, mode) {
  const taxi = m.dist.map((r) => r.map(() => false))
  if (mode !== 'walk') return { ...m, taxi }
  const dur = m.dur.map((r, i) => r.map((v, j) => {
    if (m.dist[i][j] > WALK_MAX) {
      taxi[i][j] = true
      return (m.dist[i][j] / 1000 / TAXI_KMH) * 60 + TAXI_EXTRA
    }
    return v
  }))
  return { ...m, dur, taxi }
}

export async function getMatrix(points, mode = 'walk') {
  if (points.length < 2) return applyWalkLimit(estimateMatrix(points, mode), mode)
  const key = `${mode}|${points.map((p) => `${p.lng.toFixed(5)},${p.lat.toFixed(5)}`).join(';')}`
  if (matrixCache.has(key)) return matrixCache.get(key)
  const est = estimateMatrix(points, mode)
  let out = null
  for (const [src, fn] of [['valhalla', valhallaMatrix], ['osrm', osrmMatrix]]) {
    try {
      const m = await fn(points, mode)
      out = {
        dur: m.dur.map((r, i) => r.map((v, j) => (v == null ? est.dur[i][j] : v))),
        dist: m.dist.map((r, i) => r.map((v, j) => (v == null ? est.dist[i][j] : v))),
        source: src,
      }
      break
    } catch { /* try next */ }
  }
  out = applyWalkLimit(out || est, mode)
  if (out.source !== 'estimate') matrixCache.set(key, out)
  return out
}

// Valhalla encoded polyline (precision 6)
function decodePolyline(str, precision = 6) {
  let index = 0, lat = 0, lng = 0
  const coords = [], factor = 10 ** precision
  while (index < str.length) {
    for (const which of [0, 1]) {
      let result = 0, shift = 0, b
      do { b = str.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5 } while (b >= 0x20)
      const delta = result & 1 ? ~(result >> 1) : result >> 1
      if (which === 0) lat += delta
      else lng += delta
    }
    coords.push([lat / factor, lng / factor])
  }
  return coords
}

// legTaxi[i] = true when leg i (points[i] → points[i+1]) is a taxi ride in walk mode
export async function getRouteLine(points, mode = 'walk', legTaxi = []) {
  if (points.length < 2) return null
  const legs = []
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1]
    const legMode = mode === 'walk' && legTaxi[i] ? 'drive' : mode
    const last = legs[legs.length - 1]
    if (last && last.mode === legMode) last.pts.push(b)
    else legs.push({ mode: legMode, pts: [a, b] })
  }
  const out = []
  for (const leg of legs) {
    try {
      const body = { locations: leg.pts.map((p) => ({ lat: p.lat, lon: p.lng })), costing: COSTING[leg.mode] }
      const d = await fetchJSON(`${VALHALLA}/route?json=${encodeURIComponent(JSON.stringify(body))}`, 8000, 'valhalla')
      out.push({ mode: leg.mode, points: d.trip.legs.flatMap((l) => decodePolyline(l.shape)) })
    } catch {
      out.push({ mode: leg.mode, points: leg.pts.map((p) => [p.lat, p.lng]), straight: true })
    }
  }
  return out
}

export async function travelMinutes(a, b, mode = 'drive') {
  const m = await getMatrix([a, b], mode)
  return { min: m.dur[0][1] + LEG_OVERHEAD[mode], dist: m.dist[0][1], source: m.source }
}

/* ---------------- Google Maps deep links ---------------- */
const GM_MODE = { walk: 'walking', drive: 'driving', bike: 'bicycling' }

export function gmPlaceUrl(p, cityName = '') {
  if (p.fromLink || !p.name) return `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}`
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${p.name} ${cityName}`.trim())}`
}

// Google Maps on phones accepts at most 3 waypoints per link → split into legs
export function gmDirectionLinks(points, mode = 'walk', perLink = 3) {
  if (points.length < 2) return []
  const links = []
  const ll = (p) => `${p.lat},${p.lng}`
  let i = 0
  while (i < points.length - 1) {
    const seg = points.slice(i, i + perLink + 2)
    const origin = seg[0]
    const dest = seg[seg.length - 1]
    const wps = seg.slice(1, -1)
    const qs = new URLSearchParams({ api: '1', origin: ll(origin), destination: ll(dest), travelmode: GM_MODE[mode] })
    if (wps.length) qs.set('waypoints', wps.map(ll).join('|'))
    links.push({ url: `https://www.google.com/maps/dir/?${qs}`, from: origin.name, to: dest.name, count: seg.length })
    i += seg.length - 1
  }
  return links
}

export async function reverseGeocode(lat, lng) {
  try {
    const wait = lastCall + 1100 - Date.now()
    if (wait > 0) await sleep(wait)
    lastCall = Date.now()
    const qs = new URLSearchParams({ format: 'jsonv2', lat, lon: lng, zoom: '18', namedetails: '1', 'accept-language': 'zh-CN,zh,en' })
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?${qs}`)
    const d = await r.json()
    return { name: pickName(d), address: d.display_name, type: guessType(d) }
  } catch {
    return null
  }
}
