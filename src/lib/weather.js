import { todayStr, addDays, daysBetween } from './time'

// WMO weather codes → emoji + text
export function wmo(code) {
  if (code == null) return { e: '🌤️', t: '—' }
  if (code === 0) return { e: '☀️', t: '晴' }
  if (code <= 2) return { e: '🌤️', t: '多云' }
  if (code === 3) return { e: '☁️', t: '阴' }
  if (code <= 48) return { e: '🌫️', t: '雾' }
  if (code <= 57) return { e: '🌦️', t: '毛毛雨' }
  if (code <= 65) return { e: '🌧️', t: code >= 63 ? '中到大雨' : '小雨' }
  if (code <= 67) return { e: '🌧️', t: '冻雨' }
  if (code <= 77) return { e: '🌨️', t: '雪' }
  if (code <= 82) return { e: '🌦️', t: '阵雨' }
  if (code <= 86) return { e: '🌨️', t: '阵雪' }
  return { e: '⛈️', t: '雷阵雨' }
}

const FORECAST_DAYS = 16

async function fetchJSON(url) {
  const r = await fetch(url)
  if (!r.ok) throw new Error('天气服务暂时不可用')
  return r.json()
}

async function forecast(lat, lng, start, end) {
  const qs = new URLSearchParams({
    latitude: lat, longitude: lng, timezone: 'auto', start_date: start, end_date: end,
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,uv_index_max,relative_humidity_2m_mean',
  })
  const d = await fetchJSON(`https://api.open-meteo.com/v1/forecast?${qs}`)
  return d.daily.time.map((date, i) => ({
    date,
    code: d.daily.weather_code[i],
    tmax: d.daily.temperature_2m_max[i],
    tmin: d.daily.temperature_2m_min[i],
    rain: d.daily.precipitation_probability_max?.[i],
    precip: d.daily.precipitation_sum?.[i],
    uv: d.daily.uv_index_max?.[i],
    hum: d.daily.relative_humidity_2m_mean?.[i],
    source: 'forecast',
  }))
}

// Climate normal: average of the same dates over the previous 3 years
async function climate(lat, lng, dates) {
  const years = [1, 2, 3]
  const first = dates[0], last = dates[dates.length - 1]
  const shift = (d, y) => `${+d.slice(0, 4) - y}${d.slice(4)}`.replace(/-02-29$/, '-02-28')
  const results = await Promise.all(
    years.map((y) => {
      const qs = new URLSearchParams({
        latitude: lat, longitude: lng, timezone: 'auto', start_date: shift(first, y), end_date: shift(last, y),
        daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum',
      })
      return fetchJSON(`https://archive-api.open-meteo.com/v1/archive?${qs}`).catch(() => null)
    }),
  )
  return dates.map((date, i) => {
    const vals = results.filter(Boolean).map((r) => ({
      tmax: r.daily.temperature_2m_max[i], tmin: r.daily.temperature_2m_min[i], p: r.daily.precipitation_sum[i], code: r.daily.weather_code[i],
    })).filter((v) => v.tmax != null)
    if (!vals.length) return { date, source: 'climate' }
    const avg = (k) => vals.reduce((s, v) => s + v[k], 0) / vals.length
    const rainy = vals.filter((v) => v.p >= 1).length
    const codes = vals.map((v) => v.code).sort((a, b) => a - b)
    return {
      date,
      tmax: avg('tmax'), tmin: avg('tmin'), precip: avg('p'),
      rain: Math.round((rainy / vals.length) * 100),
      code: codes[Math.floor(codes.length / 2)],
      source: 'climate',
    }
  })
}

export async function fetchCityWeather(city) {
  const dates = []
  for (let d = city.arrive; d <= city.leave && dates.length < 60; d = addDays(d, 1)) dates.push(d)
  const today = todayStr()
  const lastForecast = addDays(today, FORECAST_DAYS - 1)
  const fDates = dates.filter((d) => d >= today && d <= lastForecast)
  const cDates = dates.filter((d) => !fDates.includes(d))
  const out = {}
  if (fDates.length) {
    try {
      for (const r of await forecast(city.lat, city.lng, fDates[0], fDates[fDates.length - 1])) out[r.date] = r
    } catch { /* ignore */ }
  }
  // climate for dates beyond forecast (contiguous blocks) / past dates
  if (cDates.length) {
    try {
      const rows = await climate(city.lat, city.lng, cDates.length > 1 && daysBetween(cDates[0], cDates[cDates.length - 1]) === cDates.length - 1 ? cDates : rangeOf(cDates))
      for (const r of rows) if (cDates.includes(r.date)) out[r.date] = r
    } catch { /* ignore */ }
  }
  return dates.map((d) => out[d] || { date: d, source: 'none' })
}
function rangeOf(ds) {
  const out = []
  for (let d = ds[0]; d <= ds[ds.length - 1]; d = addDays(d, 1)) out.push(d)
  return out
}

/* ---------------- 穿衣推荐 ---------------- */
export function clothing(day, tags = []) {
  const items = []
  const tips = []
  if (day?.tmax == null) return { summary: '暂无天气数据', items, tips }
  const hi = day.tmax, lo = day.tmin, feel = (hi + lo) / 2
  let summary
  if (hi >= 32) { summary = '炎热'; items.push(['👕', '短袖 / 背心（速干透气）'], ['🩳', '短裤 / 薄长裙'], ['🩴', '凉鞋或透气运动鞋']) }
  else if (hi >= 27) { summary = '温暖偏热'; items.push(['👕', '短袖'], ['👖', '薄长裤 / 短裤'], ['👟', '透气运动鞋']) }
  else if (hi >= 22) { summary = '舒适'; items.push(['👕', '短袖 + 薄衬衫'], ['👖', '长裤'], ['👟', '运动鞋']) }
  else if (hi >= 16) { summary = '微凉'; items.push(['🧥', '长袖 + 薄外套'], ['👖', '长裤'], ['👟', '运动鞋']) }
  else if (hi >= 9) { summary = '凉'; items.push(['🧥', '毛衣 / 卫衣 + 风衣或夹克'], ['👖', '长裤'], ['🥾', '包脚鞋']) }
  else if (hi >= 0) { summary = '冷'; items.push(['🧥', '羽绒服 / 厚大衣'], ['🧣', '围巾、帽子、手套'], ['🧦', '保暖内衣 + 厚袜']) }
  else { summary = '严寒'; items.push(['🧥', '厚羽绒服'], ['🧣', '围巾、毛线帽、手套、口罩'], ['🧦', '保暖内衣裤 + 防滑雪地靴']) }
  if (hi - lo >= 9) tips.push(`早晚温差 ${Math.round(hi - lo)}°，带一件能随时穿脱的外套`)
  else if (lo < 20 && hi >= 22) items.push(['🧥', '早晚加件薄外套'])
  if ((day.rain ?? 0) >= 50 || (day.precip ?? 0) >= 5) { items.push(['☂️', '雨伞 / 轻便雨衣']); tips.push('降雨概率高，鞋子选防水或速干的') }
  else if ((day.rain ?? 0) >= 30) items.push(['🌂', '折叠伞（可能有阵雨）'])
  const uv = day.uv ?? (hi >= 28 ? 8 : null)
  if (uv != null && uv >= 6) { items.push(['🧴', '防晒霜 SPF50+'], ['🕶️', '墨镜、遮阳帽']); if (uv >= 8) tips.push('紫外线很强，中午尽量避开暴晒，备防晒衣') }
  if ((day.hum ?? 0) >= 80 && hi >= 26) tips.push('湿度大很闷热，选速干面料，多带一套替换')
  if (tags.includes('temple')) tips.push('参观寺庙/宫殿需遮住肩膀和膝盖，备一条长裙/长裤或披肩')
  if (tags.includes('beach') && hi >= 24) items.push(['👙', '泳衣、沙滩拖鞋'])
  if (tags.includes('mountain')) tips.push('山区比市区凉，带抓绒或冲锋衣，穿防滑鞋')
  if (feel < 5) tips.push('注意保暖，手机低温掉电快，充电宝放内兜')
  return { summary, items, tips }
}

export function weatherKey(city) {
  return `${city.lat.toFixed(2)},${city.lng.toFixed(2)}|${city.arrive}|${city.leave}`
}
