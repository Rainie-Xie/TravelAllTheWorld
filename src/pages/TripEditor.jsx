import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Plus, ArrowUp, ArrowDown, Trash2 } from 'lucide-react'
import { useStore, useTrip } from '../store'
import { TopBar, Field, useToast } from '../components/ui'
import { CountryPicker, CityPicker } from '../components/pickers'
import { countryName, flag } from '../data/countries'
import { POPULAR_CITIES, TAGS } from '../data/cities'
import { uid } from '../lib/util'
import { addDays, todayStr, daysBetween } from '../lib/time'

const blankTrip = () => ({
  id: uid(), name: '', startDate: addDays(todayStr(), 14), endDate: addDays(todayStr(), 20),
  cover: Math.floor(Math.random() * 6), createdAt: Date.now(), cities: [], transports: [], packing: [], expenses: [], docs: {},
})

export default function TripEditor() {
  const { tripId } = useParams()
  const existing = useTrip(tripId)
  const nav = useNavigate()
  const toast = useToast()
  const addTrip = useStore((s) => s.addTrip)
  const replaceTrip = useStore((s) => s.replaceTrip)
  const [trip, setTrip] = useState(() => (existing ? structuredClone(existing) : blankTrip()))
  const [countryOpen, setCountryOpen] = useState(false)
  const [cityCountry, setCityCountry] = useState(null)

  const patch = (p) => setTrip((t) => ({ ...t, ...p }))
  const setCity = (i, p) => setTrip((t) => ({ ...t, cities: t.cities.map((c, k) => (k === i ? { ...c, ...p } : c)) }))

  const addCity = (c) => {
    setTrip((t) => {
      const last = t.cities[t.cities.length - 1]
      const arrive = last ? last.leave : t.startDate
      const leave = arrive ? (addDays(arrive, 2) > t.endDate ? t.endDate : addDays(arrive, 2)) : ''
      const popular = (POPULAR_CITIES[c.countryCode] || []).find((p) => p.name === c.name)
      const city = {
        id: uid(), countryCode: c.countryCode, name: c.name, en: c.en || '', lat: c.lat, lng: c.lng,
        arrive, leave: leave < arrive ? arrive : leave, tags: c.tags || popular?.tags || ['city'], places: [], dayPlans: {},
      }
      return { ...t, cities: [...t.cities, city] }
    })
  }

  const move = (i, d) => setTrip((t) => {
    const cs = [...t.cities]
    const j = i + d
    if (j < 0 || j >= cs.length) return t
    ;[cs[i], cs[j]] = [cs[j], cs[i]]
    return { ...t, cities: cs }
  })

  const autoDates = () => {
    setTrip((t) => {
      const n = t.cities.length
      if (!n || !t.startDate || !t.endDate) return t
      const total = daysBetween(t.startDate, t.endDate)
      let cur = t.startDate
      const cities = t.cities.map((c, i) => {
        const len = i === n - 1 ? daysBetween(cur, t.endDate) : Math.max(1, Math.round(total / n))
        const arrive = cur
        const leave = addDays(cur, len)
        cur = leave
        return { ...c, arrive, leave: leave > t.endDate ? t.endDate : leave }
      })
      return { ...t, cities }
    })
  }

  const issues = []
  trip.cities.forEach((c, i) => {
    if (c.leave < c.arrive) issues.push(`${c.name}：离开日期早于到达日期`)
    const next = trip.cities[i + 1]
    if (next && next.arrive !== c.leave) issues.push(`${c.name} → ${next.name}：日期${next.arrive > c.leave ? '中间有空档' : '有重叠'}`)
  })
  if (trip.startDate > trip.endDate) issues.push('结束日期早于出发日期')

  const save = () => {
    if (!trip.name.trim()) {
      const countries = [...new Set(trip.cities.map((c) => countryName(c.countryCode)))]
      trip.name = countries.length ? `${countries.join('·')}之旅` : '我的旅行'
    }
    if (existing) replaceTrip(trip)
    else addTrip(trip)
    toast('已保存 ✨')
    nav(`/trip/${trip.id}`, { replace: true })
  }

  return (
    <>
      <TopBar title={existing ? '编辑旅行' : '新建旅行'} right={<button className="btn btn-primary btn-sm" onClick={save}>保存</button>} />
      <div className="page no-tab stack" style={{ paddingTop: 8 }}>
        <Field label="旅行名称">
          <input className="input" placeholder="例如：越南南北纵贯" value={trip.name} onChange={(e) => patch({ name: e.target.value })} />
        </Field>
        <div className="grid-2">
          <Field label="出发日期">
            <input className="input" type="date" value={trip.startDate} onChange={(e) => patch({ startDate: e.target.value })} />
          </Field>
          <Field label="返回日期">
            <input className="input" type="date" value={trip.endDate} min={trip.startDate} onChange={(e) => patch({ endDate: e.target.value })} />
          </Field>
        </div>

        <div className="row-between mt">
          <div>
            <div className="section-title">目的地路线</div>
            <div className="section-sub">按游玩顺序添加城市，可跨多个国家</div>
          </div>
          {trip.cities.length > 1 && <button className="btn btn-ghost btn-sm" onClick={autoDates}>平均分配日期</button>}
        </div>

        {trip.cities.map((c, i) => (
          <div key={c.id} className="card">
            <div className="row-between">
              <div className="row">
                <div className="emoji-badge"><span className="flag">{flag(c.countryCode)}</span></div>
                <div>
                  <div className="bold">{i + 1}. {c.name}</div>
                  <div className="tiny faint">{countryName(c.countryCode)}{c.en ? ` · ${c.en}` : ''}</div>
                </div>
              </div>
              <div className="row" style={{ gap: 4 }}>
                <button className="icon-btn sm" aria-label="上移" onClick={() => move(i, -1)} disabled={i === 0}><ArrowUp size={15} /></button>
                <button className="icon-btn sm" aria-label="下移" onClick={() => move(i, 1)} disabled={i === trip.cities.length - 1}><ArrowDown size={15} /></button>
                <button className="icon-btn sm" aria-label="删除" onClick={() => {
                  if (c.places?.length && !window.confirm(`删除${c.name}？里面的 ${c.places.length} 个地点也会一起删除`)) return
                  setTrip((t) => ({ ...t, cities: t.cities.filter((x) => x.id !== c.id) }))
                }}><Trash2 size={15} /></button>
              </div>
            </div>
            <div className="grid-2 mt-s">
              <Field label="到达">
                <input className="input sm" type="date" value={c.arrive} onChange={(e) => setCity(i, { arrive: e.target.value })} />
              </Field>
              <Field label="离开">
                <input className="input sm" type="date" value={c.leave} min={c.arrive} onChange={(e) => setCity(i, { leave: e.target.value })} />
              </Field>
            </div>
            <div className="row wrap mt-s" style={{ gap: 6 }}>
              {Object.entries(TAGS).map(([k, v]) => {
                const on = c.tags?.includes(k)
                return (
                  <button key={k} className={`chip btnlike ${on ? 'green' : ''}`} onClick={() => setCity(i, { tags: on ? c.tags.filter((x) => x !== k) : [...(c.tags || []), k] })}>
                    {v.emoji} {v.label}
                  </button>
                )
              })}
            </div>
          </div>
        ))}

        {issues.length > 0 && (
          <div className="card warn small">
            {issues.map((s) => <div key={s}>⚠️ {s}</div>)}
          </div>
        )}

        <div className="row">
          {trip.cities.length > 0 && (
            <button className="btn btn-soft grow" onClick={() => setCityCountry(trip.cities[trip.cities.length - 1].countryCode)}>
              <Plus size={16} />{flag(trip.cities[trip.cities.length - 1].countryCode)} 同一国家再加城市
            </button>
          )}
          <button className={`btn grow ${trip.cities.length ? '' : 'btn-primary'}`} onClick={() => setCountryOpen(true)}>
            <Plus size={16} />{trip.cities.length ? '其他国家' : '选择国家 → 添加城市'}
          </button>
        </div>
        <div className="tiny faint">城市标签会用来推荐穿衣和行李（比如海滩带泳衣、寺庙要遮肩膝）。</div>

        <button className="btn btn-primary btn-block mt" onClick={save}>保存旅行</button>
      </div>

      <CountryPicker open={countryOpen} onClose={() => setCountryOpen(false)} onPick={(code) => setTimeout(() => setCityCountry(code), 50)} />
      {cityCountry && <CityPicker open={!!cityCountry} onClose={() => setCityCountry(null)} countryCode={cityCountry} onPick={addCity} />}
    </>
  )
}
