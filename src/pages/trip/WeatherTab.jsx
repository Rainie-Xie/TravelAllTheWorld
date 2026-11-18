import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useTripWeather } from '../../lib/useWeather'
import { wmo, clothing } from '../../lib/weather'
import { fmtShort, weekday, todayStr } from '../../lib/time'
import { flag } from '../../data/countries'
import { TAGS } from '../../data/cities'
import { Empty } from '../../components/ui'

function DayCard({ d, on, onClick }) {
  const w = wmo(d.code)
  return (
    <div className={`card weather-day ${on ? 'tint' : 'flat'}`} style={{ cursor: 'pointer', borderColor: on ? 'var(--green-400)' : undefined, borderWidth: on ? 2 : 1 }} onClick={onClick}>
      <div className="tiny muted">{fmtShort(d.date)} {weekday(d.date)}</div>
      <div className="wx">{d.tmax != null ? w.e : '❔'}</div>
      <div className="small">{d.tmax != null ? w.t : '暂无'}</div>
      {d.tmax != null && <div className="temp"><span>{Math.round(d.tmax)}°</span><span className="faint"> / {Math.round(d.tmin)}°</span></div>}
      {d.rain != null && <div className="tiny" style={{ color: d.rain >= 50 ? 'var(--blue-500)' : 'var(--ink-3)' }}>💧 {d.rain}%</div>}
      {d.source === 'climate' && <div className="tiny faint">往年均值</div>}
    </div>
  )
}

function CityWeather({ city, days }) {
  const today = todayStr()
  const [sel, setSel] = useState(() => days?.find((d) => d.date >= today)?.date || days?.[0]?.date)
  const day = days?.find((d) => d.date === sel) || days?.[0]
  const rec = day ? clothing(day, city.tags) : null
  return (
    <div className="card">
      <div className="row-between mb-s">
        <div className="bold" style={{ fontSize: 17 }}><span className="flag">{flag(city.countryCode)}</span> {city.name}</div>
        <div className="row" style={{ gap: 4 }}>{(city.tags || []).map((t) => TAGS[t] && <span key={t} title={TAGS[t].label}>{TAGS[t].emoji}</span>)}</div>
      </div>
      {!days ? (
        <div className="row small muted"><Loader2 size={14} className="spin" />获取天气中…</div>
      ) : (
        <>
          <div className="chip-scroll" style={{ gap: 10, paddingBottom: 6 }}>
            {days.map((d) => <DayCard key={d.date} d={d} on={d.date === day?.date} onClick={() => setSel(d.date)} />)}
          </div>
          {rec && (
            <div className="mt-s">
              <div className="row wrap mb-s" style={{ gap: 6 }}>
                <span className="chip yellow">👗 {fmtShort(day.date)} 穿衣：{rec.summary}</span>
                {day.uv != null && <span className="chip">☀️ 紫外线 {Math.round(day.uv)}</span>}
                {day.hum != null && <span className="chip">💦 湿度 {Math.round(day.hum)}%</span>}
              </div>
              <div className="grid-2" style={{ gap: 8 }}>
                {rec.items.map(([e, t]) => (
                  <div key={t} className="row small" style={{ background: 'var(--surface-2)', borderRadius: 10, padding: '8px 10px' }}>
                    <span style={{ fontSize: 18 }}>{e}</span><span>{t}</span>
                  </div>
                ))}
              </div>
              {rec.tips.map((t) => <div key={t} className="small mt-s" style={{ color: 'var(--green-700)' }}>💡 {t}</div>)}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default function WeatherTab({ trip }) {
  const { byCity, loading, error } = useTripWeather(trip)
  if (!trip.cities.length) return <Empty emoji="🌤️" title="添加城市后就能看到天气" />
  return (
    <div className="stack">
      <div className="kbd-note">
        16 天内显示<b>实时预报</b>，更远的日期显示<b>近 3 年同期平均</b>，可以提前规划带什么衣服。临近出发会自动更新。
        {loading && <span className="row mt-s"><Loader2 size={13} className="spin" /> 更新中…</span>}
      </div>
      {error && <div className="small" style={{ color: 'var(--red-500)' }}>{error}</div>}
      {trip.cities.map((c) => <CityWeather key={c.id + (byCity[c.id] ? 'y' : 'n')} city={c} days={byCity[c.id]} />)}
    </div>
  )
}
