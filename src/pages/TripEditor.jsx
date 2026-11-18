import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Plus, ArrowUp, ArrowDown, Trash2, Minus, Check } from 'lucide-react'
import { useStore, useTrip } from '../store'
import { TopBar, Field, useToast, confirmDialog } from '../components/ui'
import { CountryPicker, CityPicker } from '../components/pickers'
import { countryName, flag } from '../data/countries'
import { POPULAR_CITIES, TAGS } from '../data/cities'
import { uid } from '../lib/util'
import { addDays, todayStr, daysBetween, fmtDate } from '../lib/time'

const blankTrip = () => ({
  id: uid(), name: '', startDate: addDays(todayStr(), 14), endDate: addDays(todayStr(), 14),
  cover: Math.floor(Math.random() * 6), createdAt: Date.now(), cities: [], transports: [], packing: [], expenses: [], docs: {},
})

// Re-chain city dates from the trip start: each city starts where the previous one ends.
function rechain(trip) {
  let cur = trip.startDate
  const cities = trip.cities.map((c) => {
    const nights = Math.max(0, c.leave && c.arrive ? daysBetween(c.arrive, c.leave) : 2)
    const shift = c.arrive ? daysBetween(c.arrive, cur) : 0
    const city = { ...c, arrive: cur, leave: addDays(cur, nights) }
    if (shift) {
      // move the city's planned days and hotel dates along with it
      const mv = (d) => (d ? addDays(d, shift) : d)
      city.places = c.places.map((p) => ({ ...p, day: mv(p.day), hotelIn: mv(p.hotelIn), hotelOut: mv(p.hotelOut) }))
      city.dayPlans = Object.fromEntries(Object.entries(c.dayPlans || {}).map(([k, v]) => [mv(k), v]))
    }
    cur = city.leave
    return city
  })
  return { ...trip, cities, endDate: cities.length ? cur : trip.endDate < trip.startDate ? trip.startDate : trip.endDate }
}

const autoName = (trip) => {
  const countries = [...new Set(trip.cities.map((c) => countryName(c.countryCode)))]
  return countries.length ? `${countries.join('·')}之旅` : '我的旅行'
}

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
  const created = useRef(!!existing)

  // autosave: every change is written straight away (a new trip is created as soon as it has a city or a name)
  useEffect(() => {
    if (!created.current) {
      if (!trip.cities.length && !trip.name.trim()) return
      addTrip(trip)
      created.current = true
      return
    }
    const t = setTimeout(() => replaceTrip(trip), 250)
    return () => clearTimeout(t)
  }, [trip]) // eslint-disable-line react-hooks/exhaustive-deps

  const update = (fn) => setTrip((t) => rechain(fn(t)))
  const patch = (p) => update((t) => ({ ...t, ...p }))
  const setCity = (i, p) => update((t) => ({ ...t, cities: t.cities.map((c, k) => (k === i ? { ...c, ...p } : c)) }))
  const setNights = (i, n) => setCity(i, { leave: addDays(trip.cities[i].arrive, Math.max(0, Math.min(60, n))) })

  const addCity = (c) => {
    update((t) => {
      const popular = (POPULAR_CITIES[c.countryCode] || []).find((p) => p.name === c.name)
      const city = {
        id: uid(), countryCode: c.countryCode, name: c.name, en: c.en || '', lat: c.lat, lng: c.lng,
        arrive: t.startDate, leave: addDays(t.startDate, 2), tags: c.tags || popular?.tags || ['city'], places: [], dayPlans: {},
      }
      return { ...t, cities: [...t.cities, city] }
    })
    toast(`已添加 ${c.name}`)
  }

  const move = (i, d) => update((t) => {
    const cs = [...t.cities]
    const j = i + d
    if (j < 0 || j >= cs.length) return t
    ;[cs[i], cs[j]] = [cs[j], cs[i]]
    return { ...t, cities: cs }
  })

  const finish = () => {
    const final = rechain({ ...trip, name: trip.name.trim() || autoName(trip) })
    if (created.current) replaceTrip(final)
    else addTrip(final)
    created.current = true
    nav(`/trip/${final.id}`, { replace: true })
  }

  const leave = () => {
    if (created.current && !trip.name.trim()) replaceTrip({ ...trip, name: autoName(trip) })
    if (created.current) toast('已自动保存 ✓')
    if (existing) nav(-1)
    else if (created.current) nav(`/trip/${trip.id}`, { replace: true })
    else nav('/')
  }

  const totalNights = trip.cities.length ? daysBetween(trip.startDate, trip.endDate) : 0

  return (
    <>
      <TopBar title={existing ? '编辑旅行' : '新建旅行'} onBack={leave} right={<button className="btn btn-primary btn-sm" onClick={finish}><Check size={16} />完成</button>} />
      <div className="page no-tab stack" style={{ paddingTop: 8 }}>
        <Field label="旅行名称（可不填，自动生成）">
          <input className="input" placeholder={autoName(trip)} value={trip.name} onChange={(e) => patch({ name: e.target.value })} />
        </Field>
        <Field label="出发日期" hint={trip.cities.length ? `共 ${totalNights + 1} 天 ${totalNights} 晚，${fmtDate(trip.endDate)} 返回（按每个城市住几晚自动算）` : null}>
          <input className="input" type="date" value={trip.startDate} onChange={(e) => e.target.value && patch({ startDate: e.target.value })} />
        </Field>
        {!trip.cities.length && (
          <Field label="返回日期">
            <input className="input" type="date" value={trip.endDate} min={trip.startDate} onChange={(e) => e.target.value && patch({ endDate: e.target.value })} />
          </Field>
        )}

        <div className="mt-s">
          <div className="section-title">目的地路线</div>
          <div className="section-sub">按游玩顺序添加城市，设置每个城市住几晚就行</div>
        </div>

        {trip.cities.map((c, i) => {
          const nights = daysBetween(c.arrive, c.leave)
          return (
            <div key={c.id} className="card">
              <div className="row">
                <div className="emoji-badge"><span className="flag">{flag(c.countryCode)}</span></div>
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="bold ellipsis">{i + 1}. {c.name}</div>
                  <div className="tiny faint">{fmtDate(c.arrive, { week: false })} → {fmtDate(c.leave, { week: false })}</div>
                </div>
                <div className="row" style={{ gap: 2, flex: 'none' }}>
                  <button className="icon-btn sm plain" aria-label="上移" onClick={() => move(i, -1)} disabled={i === 0}><ArrowUp size={16} /></button>
                  <button className="icon-btn sm plain" aria-label="下移" onClick={() => move(i, 1)} disabled={i === trip.cities.length - 1}><ArrowDown size={16} /></button>
                  <button className="icon-btn sm plain" aria-label="删除" onClick={async () => {
                    if (c.places?.length && !(await confirmDialog({ title: `删除${c.name}？`, message: `里面的 ${c.places.length} 个地点也会一起删除`, okText: '删除', danger: true }))) return
                    update((t) => ({ ...t, cities: t.cities.filter((x) => x.id !== c.id) }))
                  }}><Trash2 size={16} /></button>
                </div>
              </div>
              <div className="row-between mt-s">
                <span className="label">住几晚</span>
                <div className="row stepper">
                  <button className="icon-btn sm" aria-label="少一晚" onClick={() => setNights(i, nights - 1)} disabled={nights <= 0}><Minus size={15} /></button>
                  <span className="bold center" style={{ minWidth: 56 }}>{nights === 0 ? '当天走' : `${nights} 晚`}</span>
                  <button className="icon-btn sm" aria-label="多一晚" onClick={() => setNights(i, nights + 1)}><Plus size={15} /></button>
                </div>
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
          )
        })}

        <div className="stack-s">
          {trip.cities.length > 0 && (
            <button className="btn btn-soft" onClick={() => setCityCountry(trip.cities[trip.cities.length - 1].countryCode)}>
              <Plus size={16} /><span className="flag">{flag(trip.cities[trip.cities.length - 1].countryCode)}</span> 再加一个{countryName(trip.cities[trip.cities.length - 1].countryCode)}城市
            </button>
          )}
          <button className={`btn ${trip.cities.length ? '' : 'btn-primary'}`} onClick={() => setCountryOpen(true)}>
            <Plus size={16} />{trip.cities.length ? '添加其他国家的城市' : '选择国家 → 添加城市'}
          </button>
        </div>
        <div className="tiny faint">城市标签用来推荐穿衣和行李（海滩带泳衣、寺庙要遮肩膝）。所有修改自动保存。</div>

        <button className="btn btn-primary btn-block mt" onClick={finish}><Check size={17} />完成</button>
      </div>

      <CountryPicker open={countryOpen} onClose={() => setCountryOpen(false)} onPick={(code) => setTimeout(() => setCityCountry(code), 50)} />
      {cityCountry && <CityPicker open onClose={() => setCityCountry(null)} countryCode={cityCountry} onPick={addCity} multi picked={trip.cities.filter((c) => c.countryCode === cityCountry).map((c) => c.name)} />}
    </>
  )
}
