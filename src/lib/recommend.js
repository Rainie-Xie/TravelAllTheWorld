/*
 * 热门景点推荐 — free, no key: Wikidata Query Service.
 * 1) popular items (by number of Wikipedia language editions) around the city centre, with their direct types
 * 2) classify those types upward (P279*) into attraction / not-attraction
 */

const ENDPOINT = 'https://query.wikidata.org/sparql?format=json&query='

// attraction classes → [kind]
const GOOD = {
  Q570116: 'sight', // tourist attraction
  Q33506: 'museum',
  Q24398318: 'temple', // religious building
  Q4989906: 'monument',
  Q1107656: 'park', // garden
  Q22698: 'park',
  Q23397: 'lake',
  Q12280: 'bridge',
  Q839954: 'heritage', // archaeological site
  Q23413: 'heritage', // castle
  Q16560: 'heritage', // palace
  Q174782: 'square',
  Q37654: 'market',
  Q12518: 'monument', // tower
  Q2319498: 'sight', // landmark
  Q358: 'heritage', // heritage site
  Q40080: 'beach',
  Q8502: 'mountain',
  Q43501: 'fun', // zoo
  Q194195: 'fun', // amusement park
  Q1081138: 'heritage', // historic site
  Q24354: 'sight', // theatre building
  Q46831: 'mountain', // mountain range
  Q199451: 'temple', // pagoda
  Q44539: 'temple', // temple
  Q16970: 'temple', // church building
  Q32815: 'temple', // mosque
  Q845945: 'temple', // Shinto shrine
  Q1370598: 'temple', // structure of worship
  Q23442: 'beach', // island
  Q34038: 'sight', // waterfall
  Q35509: 'sight', // cave
}
// strong attraction classes win over any exclusion
const STRONG = new Set(['Q570116', 'Q33506', 'Q24398318', 'Q4989906', 'Q22698', 'Q1107656', 'Q23397', 'Q16560', 'Q839954', 'Q23413', 'Q358', 'Q40080', 'Q8502', 'Q43501', 'Q194195', 'Q37654', 'Q46831', 'Q199451', 'Q44539', 'Q16970', 'Q32815', 'Q845945', 'Q1370598'])
// administrative areas, settlements, schools, transport hubs, events, hotels, organisations…
const HARD = ['Q56061', 'Q3918', 'Q1248784', 'Q55488', 'Q483110', 'Q1190554', 'Q27686', 'Q16917', 'Q3914', 'Q178561', 'Q11303', 'Q515', 'Q486972', 'Q43229', 'Q44782', 'Q39594', 'Q4022', 'Q34442', 'Q79007', 'Q695850']

// industrial / tech parks, ports, offices… that sneak in through broad classes
const NOT_FOR_TOURISTS = /科技园|科技園|高科技|工业区|工業區|工业园|工業園|产业园|產業園|经济区|經濟區|港口|码头|碼頭|tech(nology)? park|industrial|business park|economic zone|\bport\b|headquarters|office building|证券交易所|證券交易所|stock exchange/i

const KIND_ORDER = ['beach', 'mountain', 'fun', 'museum', 'temple', 'heritage', 'park', 'lake', 'market', 'monument', 'bridge', 'square', 'sight']
export const KINDS = {
  museum: { emoji: '🏛️', label: '博物馆', stay: 90, type: 'sight' },
  temple: { emoji: '🛕', label: '寺庙/教堂', stay: 45, type: 'sight' },
  heritage: { emoji: '🏯', label: '古迹', stay: 75, type: 'sight' },
  monument: { emoji: '🗿', label: '地标', stay: 30, type: 'sight' },
  park: { emoji: '🌳', label: '公园', stay: 60, type: 'sight' },
  lake: { emoji: '🌊', label: '湖泊', stay: 45, type: 'sight' },
  beach: { emoji: '🏖️', label: '海滩/海岛', stay: 120, type: 'sight' },
  mountain: { emoji: '⛰️', label: '山', stay: 180, type: 'sight' },
  fun: { emoji: '🎡', label: '乐园', stay: 240, type: 'sight' },
  market: { emoji: '🛍️', label: '市场', stay: 60, type: 'shop' },
  bridge: { emoji: '🌉', label: '桥', stay: 20, type: 'sight' },
  square: { emoji: '📍', label: '广场', stay: 30, type: 'sight' },
  sight: { emoji: '📍', label: '景点', stay: 60, type: 'sight' },
}

async function sparql(q, ms = 30000) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  try {
    const r = await fetch(ENDPOINT + encodeURIComponent(q), { signal: ctrl.signal, headers: { Accept: 'application/sparql-results+json' } })
    if (!r.ok) throw new Error(`推荐服务繁忙（${r.status}），稍后再试`)
    return (await r.json()).results.bindings
  } catch (e) {
    throw new Error(e.name === 'AbortError' ? '推荐服务响应太慢，稍后再试' : e.message)
  } finally {
    clearTimeout(t)
  }
}

const qid = (uri) => uri.slice(uri.lastIndexOf('/') + 1)

async function fetchAround(city, radiusKm) {
  const q1 = `SELECT ?item ?itemLabel ?itemDescription ?links ?coord (SAMPLE(?h) AS ?heritage)
    (GROUP_CONCAT(DISTINCT STRAFTER(STR(?t), "entity/"); separator=",") AS ?types) WHERE {
    { SELECT ?item ?links ?coord WHERE {
        SERVICE wikibase:around { ?item wdt:P625 ?coord .
          bd:serviceParam wikibase:center "Point(${city.lng} ${city.lat})"^^geo:wktLiteral .
          bd:serviceParam wikibase:radius "${radiusKm}" . }
        ?item wikibase:sitelinks ?links . FILTER(?links > 2)
      } ORDER BY DESC(?links) LIMIT 160 }
    OPTIONAL { ?item wdt:P31 ?t }
    OPTIONAL { ?item wdt:P1435 ?h }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "zh-hans,zh-cn,zh,en". }
  } GROUP BY ?item ?itemLabel ?itemDescription ?links ?coord ORDER BY DESC(?links)`
  const items = await sparql(q1)
  const types = [...new Set(items.flatMap((b) => (b.types?.value || '').split(',').filter(Boolean)))]
  if (!types.length) return []
  const all = [...Object.keys(GOOD), ...HARD].map((c) => `wd:${c}`).join(' ')
  const q2 = `SELECT ?t ?c WHERE { VALUES ?t { ${types.map((t) => `wd:${t}`).join(' ')} } ?t wdt:P279* ?c . VALUES ?c { ${all} } }`
  const cls = await sparql(q2)
  const up = {}
  for (const b of cls) (up[qid(b.t.value)] ||= new Set()).add(qid(b.c.value))

  const seen = new Set()
  const out = []
  for (const b of items) {
    const id = qid(b.item.value)
    if (seen.has(id)) continue
    seen.add(id)
    const name = b.itemLabel?.value
    if (!name || /^Q\d+$/.test(name)) continue
    const desc = b.itemDescription?.value || ''
    if (NOT_FOR_TOURISTS.test(name) || NOT_FOR_TOURISTS.test(desc)) continue
    const cs = new Set((b.types?.value || '').split(',').flatMap((t) => [...(up[t] || [])]))
    const heritage = !!b.heritage
    const good = heritage || [...cs].some((c) => GOOD[c])
    const strong = heritage || [...cs].some((c) => STRONG.has(c))
    const hard = HARD.some((c) => cs.has(c))
    if (!good || (hard && !strong)) continue
    const m = b.coord.value.match(/Point\(([-\d.]+) ([-\d.]+)\)/)
    if (!m) continue
    const kinds = new Set([...cs].map((c) => GOOD[c]).filter(Boolean))
    if (heritage) kinds.add('heritage')
    const kind = KIND_ORDER.find((k) => kinds.has(k)) || 'sight'
    out.push({ qid: id, name, desc, lat: +m[2], lng: +m[1], links: +b.links.value, kind })
    if (out.length >= 45) break
  }
  // keep the list varied: at most 2 bridges/squares and 4 of any other kind up front, the rest further down
  const cap = { bridge: 2, square: 2 }
  const count = {}, front = [], rest = []
  for (const r of out) {
    count[r.kind] = (count[r.kind] || 0) + 1
    ;(count[r.kind] <= (cap[r.kind] ?? 4) ? front : rest).push(r)
  }
  return [...front, ...rest].slice(0, 30)
}

// small cities have few Wikidata entries nearby → widen the circle once
export async function fetchRecommendations(city) {
  const near = await fetchAround(city, 15)
  if (near.length >= 10) return near
  const wide = await fetchAround(city, 35)
  const ids = new Set(near.map((r) => r.qid))
  return [...near, ...wide.filter((r) => !ids.has(r.qid))].slice(0, 30)
}

export const recKey = (city) => `${city.lat.toFixed(2)},${city.lng.toFixed(2)}`
