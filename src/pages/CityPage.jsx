import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Plus, MapPinned, ExternalLink, Navigation, Loader2 } from 'lucide-react'
import { useStore, useTrip } from '../store'
import { TopBar, Empty, useToast, confirmDialog } from '../components/ui'
import MapView from '../components/MapView'
import { PlaceAdder } from '../components/pickers'
import PlaceEditor from '../components/PlaceEditor'
import Recommendations, { useRecommendations, isAdded } from '../components/Recommendations'
import { KINDS } from '../lib/recommend'
import DayPlanner from './DayPlanner'
import { flag } from '../data/countries'
import { fmtShort, weekday, todayStr, fmtDur } from '../lib/time'
import { PLACE_TYPES, getCity, cityDates, placesForDay, planDay, distributeDays, resolveRef, effectiveDay, hotelForNight } from '../lib/trip'
import { gmPlaceUrl, getRouteLine, reverseGeocode, haversine } from '../lib/geo'
import { uid } from '../lib/util'

const DEFAULT_STAY = { sight: 60, food: 60, cafe: 45, shop: 60, other: 45, transit: 15, hotel: 0 }

export default function CityPage() {
  const { tripId, cityId } = useParams()
  const trip = useTrip(tripId)
  const city = trip && getCity(trip, cityId)
  const nav = useNavigate()
  const toast = useToast()
  const settings = useStore((s) => s.settings)
  const updateTrip = useStore((s) => s.updateTrip)
  const [sp, setSp] = useSearchParams()
  const tab = sp.get('tab') || 'places'
  const dates = city ? cityDates(city) : []
  const today = todayStr()
  const date = sp.get('date') && dates.includes(sp.get('date')) ? sp.get('date') : dates.includes(today) ? today : dates[0]

  const [adder, setAdder] = useState(false)
  const [editing, setEditing] = useState(null)
  const [pinMode, setPinMode] = useState(false)
  const [pendingPin, setPendingPin] = useState(null) // { name, type } waiting for a map tap
  const [adderType, setAdderType] = useState('sight')
  const [filter, setFilter] = useState('all')
  const [plan, setPlan] = useState(null)
  const [planning, setPlanning] = useState(false)
  const [routeLine, setRouteLine] = useState(null)
  const [busy, setBusy] = useState('')
  const recs = useRecommendations(city)
  const [recOpen, setRecOpen] = useState(() => !city || city.places.filter((p) => p.type !== 'hotel').length < 5)

  const mutCity = (fn) => updateTrip(tripId, (d) => { fn(d.cities.find((c) => c.id === cityId), d) })
  const setQuery = (patch) => setSp({ tab, ...(date ? { date } : {}), ...patch }, { replace: true })

  // recompute the timeline for the current order whenever something relevant changes
  const planSig = useMemo(() => {
    if (!city || tab !== 'plan' || !date) return ''
    const eff = effectiveDay(trip, city, date, settings)
    const ps = placesForDay(city, date)
    return JSON.stringify([date, eff, ps.map((p) => [p.id, p.lat, p.lng, p.stay, p.open, p.close, p.priority]), city.dayPlans?.[date]?.locked, city.dayPlans?.[date]?.manual, trip.transports.map((t) => [t.dep, t.arr, t.fromCityId, t.toCityId, t.transferMin])])
  }, [trip, city, date, tab, settings])

  const reqId = useRef(0)
  useEffect(() => {
    if (!planSig) return
    const id = ++reqId.current
    setPlanning(true)
    setPlan((p) => (p && p.date === date ? p : null))
    setRouteLine(null)
    // auto mode: always show the best order (without dropping anything); manual mode: keep the user's order
    planDay(trip, city, date, settings, { optimize: !city.dayPlans?.[date]?.manual, drop: false }).then((r) => {
      if (id !== reqId.current) return
      setPlan({ ...r, date })
      setPlanning(false)
      const pts = [r.start, ...r.tl?.steps.map((s) => city.places.find((p) => p.id === s.id) || r.pseudo?.[s.id]) || [], r.end].filter(Boolean)
      const legTaxi = [...(r.tl?.steps.map((s) => s.taxi) || []), r.tl?.endTaxi]
      if (pts.length >= 2) getRouteLine(pts, r.eff.mode, legTaxi).then((line) => id === reqId.current && setRouteLine(line))
      else setRouteLine(null)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planSig])

  if (!trip || !city) return (<><TopBar title="找不到城市" /><Empty emoji="🤔" title="这个城市不存在" /></>)

  const addPlace = (r) => {
    const type = r.type || 'sight'
    const p = {
      id: uid(), name: r.name, lat: r.lat, lng: r.lng, type, address: r.address || '', fromLink: !!r.fromLink,
      priority: 'must', stay: DEFAULT_STAY[type] ?? 60, day: tab === 'plan' && type !== 'hotel' ? date : null,
      ...(type === 'hotel' ? { hotelIn: city.arrive, hotelOut: city.leave } : {}),
    }
    // don't add the same place twice
    const dup = city.places.find((x) => x.type === type && (x.name === p.name || haversine(x, p) < 40))
    if (dup) { toast(`「${dup.name}」已经在清单里了`); return }
    mutCity((c) => { c.places.push(p) })
    if (type !== 'hotel') { toast(`已添加「${p.name}」${p.day ? '到当天' : ''}`); return }
    afterHotelSaved(p)
  }

  // A new/edited hotel takes over its nights. Offer to remove older hotels it overlaps.
  const afterHotelSaved = async (h) => {
    const overlaps = city.places.filter((x) => x.type === 'hotel' && x.id !== h.id && x.hotelIn && h.hotelIn && x.hotelIn < h.hotelOut && h.hotelIn < x.hotelOut)
    const nights = `${fmtShort(h.hotelIn)}–${fmtShort(h.hotelOut)}`
    if (!overlaps.length) { toast(`🏨 已设为 ${nights} 的住处`); return }
    const names = overlaps.map((x) => `「${x.name}」`).join('、')
    const remove = await confirmDialog({
      title: `${nights} 改住「${h.name}」`,
      message: `这几晚原来住${names}。\n要把旧的酒店删掉吗？（不删也没关系，行程会按新酒店安排）`,
      okText: '删掉旧的', cancelText: '保留',
    })
    if (remove) mutCity((c) => { c.places = c.places.filter((x) => !overlaps.some((o) => o.id === x.id)) })
    toast(`🏨 ${nights} 住「${h.name}」，出发和回来都按它安排`)
  }

  const addRec = (r) => {
    if (isAdded(r, city.places)) return
    const k = KINDS[r.kind] || KINDS.sight
    const p = {
      id: uid(), name: r.name, lat: r.lat, lng: r.lng, type: k.type, recId: r.qid,
      priority: 'must', stay: k.stay, day: null, note: r.desc || '',
    }
    mutCity((c) => { c.places.push(p) })
    toast(`已添加「${r.name}」✨`)
  }

  const savePlace = (p) => {
    const saved = p.id ? p : { ...p, id: uid() }
    const old = city.places.find((x) => x.id === saved.id)
    mutCity((c) => {
      const i = c.places.findIndex((x) => x.id === saved.id)
      if (i >= 0) c.places[i] = saved
      else c.places.push(saved)
    })
    setEditing(null)
    const hotelChanged = saved.type === 'hotel' && (!old || old.type !== 'hotel' || old.hotelIn !== saved.hotelIn || old.hotelOut !== saved.hotelOut)
    if (hotelChanged) afterHotelSaved(saved)
  }

  // which nights each hotel is actually used for
  const hotelUse = (h) => {
    const nights = cityDates(city).filter((d) => d < city.leave && hotelForNight(city, d)?.id === h.id)
    if (nights.length) return { ok: true, text: `住 ${nights.length} 晚 · ${fmtShort(nights[0])} 入住 → ${fmtShort(h.hotelOut || city.leave)} 退房` }
    const other = h.hotelIn ? hotelForNight(city, h.hotelIn) : null
    return { ok: false, text: other ? `没在用：这几晚住「${other.name}」` : '没在用：入住日期不在这个城市的日期里' }
  }
  const deletePlace = (p) => {
    mutCity((c) => { c.places = c.places.filter((x) => x.id !== p.id) })
    setEditing(null)
  }

  const onMapClick = async (ll) => {
    if (!pinMode) return
    setPinMode(false)
    const named = pendingPin
    setPendingPin(null)
    const base = { lat: ll.lat, lng: ll.lng, priority: 'must', stay: 60, day: tab === 'plan' ? date : null, fromLink: true }
    if (named) {
      // name already known (search found nothing) → just confirm the spot
      const type = named.type || 'sight'
      setEditing({ ...base, name: named.name, type, stay: DEFAULT_STAY[type] ?? 60, day: type === 'hotel' ? null : base.day, ...(type === 'hotel' ? { hotelIn: city.arrive, hotelOut: city.leave } : {}) })
      return
    }
    setBusy('正在识别位置…')
    const info = await reverseGeocode(ll.lat, ll.lng)
    setBusy('')
    const type = info?.type || 'sight'
    setEditing({ ...base, name: info?.name || '', type, address: info?.address || '', ...(type === 'hotel' ? { hotelIn: city.arrive, hotelOut: city.leave } : {}) })
  }

  const optimize = async () => {
    setBusy('正在计算最顺路的路线…')
    const r = await planDay(trip, city, date, settings, { optimize: true })
    mutCity((c) => {
      c.dayPlans = c.dayPlans || {}
      c.dayPlans[date] = { ...(c.dayPlans[date] || {}), order: r.order, manual: false }
      for (const id of r.dropped) { const p = c.places.find((x) => x.id === id); if (p) p.day = null }
    })
    setBusy('')
    toast(r.dropped.length ? `已排好！时间不够，${r.dropped.length} 个「有空再去」移回了未安排` : `已排好！路上共 ${fmtDur(r.tl?.travelTotal)}`)
  }

  const distribute = async () => {
    const assigned = city.places.some((p) => p.day && p.type !== 'hotel' && !p.dayLocked)
    if (assigned && !(await confirmDialog({ title: '重新分配到每天？', message: '会打乱已经安排好的日期（勾选了「固定在这一天」的地点不动）', okText: '重新分配' }))) return
    const map = distributeDays(trip, city, settings)
    let draft
    updateTrip(tripId, (d) => {
      const c = d.cities.find((x) => x.id === cityId)
      for (const p of c.places) if (map[p.id]) p.day = map[p.id]
      c.dayPlans = Object.fromEntries(Object.entries(c.dayPlans || {}).map(([k, v]) => [k, { ...v, order: [] }]))
      draft = structuredClone(d)
    })
    // optimise each day in sequence
    const c2 = draft.cities.find((x) => x.id === cityId)
    for (let i = 0; i < dates.length; i++) {
      setBusy(`正在规划第 ${i + 1}/${dates.length} 天…`)
      const r = await planDay(draft, c2, dates[i], settings, { optimize: true })
      c2.dayPlans[dates[i]] = { ...(c2.dayPlans[dates[i]] || {}), order: r.order, manual: false }
      for (const id of r.dropped) { const p = c2.places.find((x) => x.id === id); if (p) p.day = null }
    }
    mutCity((c) => { c.places = c2.places; c.dayPlans = c2.dayPlans })
    setBusy('')
    toast('已按位置远近分配到每天，并排好了路线 🎉')
  }

  /* ---------- map markers ---------- */
  let markers = []
  let lines = []
  if (tab === 'plan' && plan) {
    const dayIds = new Set(placesForDay(city, date).map((p) => p.id))
    const stepOf = Object.fromEntries((plan.tl?.steps || []).map((s, i) => [s.id, { n: i + 1, late: s.late }]))
    for (const p of city.places) {
      if (dayIds.has(p.id)) {
        const s = stepOf[p.id]
        markers.push({ id: p.id, lat: p.lat, lng: p.lng, color: s?.late ? '#E5603F' : '#5DAA3C', label: String(s?.n ?? '·'), numbered: true, title: p.name, onClick: () => setEditing(p) })
      } else if (p.type === 'hotel') {
        markers.push({ id: p.id, lat: p.lat, lng: p.lng, color: '#F5C92A', label: '🏨', title: p.name, onClick: () => setEditing(p) })
      } else if (!p.day) {
        markers.push({ id: p.id, lat: p.lat, lng: p.lng, color: '#C9D1C0', label: '+', size: 24, title: `${p.name}（点击加入当天）`, onClick: () => { mutCity((c) => { c.places.find((x) => x.id === p.id).day = date }); toast(`「${p.name}」已加入当天`) } })
      }
    }
    for (const r of [plan.start, plan.end]) {
      if (r?.ref && !r.ref.startsWith('p:')) markers.push({ id: r.ref, lat: r.lat, lng: r.lng, color: '#4A8FD6', label: r.emoji, title: r.name })
    }
    if (routeLine) lines = routeLine.map((l) => ({ points: l.points, color: l.mode === 'drive' && plan.eff.mode === 'walk' ? '#E8B400' : '#5DAA3C', dashed: l.straight, weight: l.straight ? 3 : 5 }))
  } else {
    markers = city.places
      .filter((p) => filter === 'all' || p.type === filter)
      .map((p) => ({ id: p.id, lat: p.lat, lng: p.lng, color: PLACE_TYPES[p.type]?.color || '#5DAA3C', label: PLACE_TYPES[p.type]?.emoji || '📍', title: p.name, onClick: () => setEditing(p), size: p.type === 'hotel' ? 34 : 30 }))
    // not-yet-added recommendations as ★ (tap to add); only those near the city so the map doesn't zoom out
    if (recOpen && recs.items) {
      for (const r of recs.items.slice(0, 10)) {
        if (isAdded(r, city.places)) continue
        markers.push({ id: `rec-${r.qid}`, lat: r.lat, lng: r.lng, color: '#F5C92A', label: '★', size: 24, title: `${r.name}（点击添加）`, onClick: () => addRec(r) })
      }
    }
  }

  const groups = Object.keys(PLACE_TYPES).map((k) => [k, city.places.filter((p) => p.type === k)]).filter(([, l]) => l.length)

  return (
    <>
      <TopBar
        title={<span><span className="flag">{flag(city.countryCode)}</span> {city.name}</span>}
        onBack={() => nav(`/trip/${tripId}?tab=cities`)}
        right={<button className="btn btn-primary btn-sm" onClick={() => setAdder(true)}><Plus size={16} />地点</button>}
      />
      <div className="page no-tab" style={{ paddingTop: 4 }}>
        <div style={{ position: 'relative' }}>
          <MapView markers={markers} lines={lines} center={city} height="42vh" onMapClick={onMapClick} style={{ minHeight: 240, cursor: pinMode ? 'crosshair' : undefined }} />
          <button className={`btn btn-sm map-float ${pinMode ? 'btn-yellow' : ''}`} style={{ top: 10, right: 10, boxShadow: 'var(--shadow)' }} onClick={() => { setPinMode((v) => !v); setPendingPin(null) }}>
            <MapPinned size={15} />{pinMode ? (pendingPin ? `点地图标出「${pendingPin.name.slice(0, 8)}」` : '点地图任意位置…') : '地图选点'}
          </button>
          {(busy || planning) && (
            <div className="chip map-float" style={{ left: 10, bottom: 10, background: '#fff', height: 30 }}>
              <Loader2 size={14} className="spin" />{busy || '计算中…'}
            </div>
          )}
        </div>

        <div className="row mt mb" style={{ justifyContent: 'center' }}>
          <div className="seg">
            <button className={tab === 'places' ? 'on' : ''} onClick={() => setQuery({ tab: 'places' })}>📍 地点清单 ({city.places.length})</button>
            <button className={tab === 'plan' ? 'on' : ''} onClick={() => setQuery({ tab: 'plan' })}><Navigation size={14} />每日路线</button>
          </div>
        </div>

        {tab === 'places' && (
          <div className="stack">
            <Recommendations city={city} recs={recs} open={recOpen} onToggle={() => setRecOpen((v) => !v)} onAdd={addRec} />
            {city.places.length === 0 ? (
              <Empty emoji="📍" title="把想去的地方加进来" sub="点上面的热门景点直接添加，或者搜索、批量粘贴地名、粘贴 Google Maps 链接、在地图上点选。别忘了加上住的酒店！"
                action={<div className="row" style={{ justifyContent: 'center' }}><button className="btn btn-primary" onClick={() => setAdder(true)}><Plus size={16} />添加地点</button><button className="btn btn-yellow" onClick={() => { setAdderType('hotel'); setAdder(true) }}>🏨 添加住宿</button></div>} />
            ) : (
              <>
                <div className="chip-scroll">
                  <button className={`chip btnlike ${filter === 'all' ? 'on' : ''}`} onClick={() => setFilter('all')}>全部</button>
                  {groups.map(([k, l]) => (
                    <button key={k} className={`chip btnlike ${filter === k ? 'on' : ''}`} onClick={() => setFilter(k)}>{PLACE_TYPES[k].emoji} {PLACE_TYPES[k].label} {l.length}</button>
                  ))}
                </div>
                {!city.places.some((p) => p.type === 'hotel') && (
                  <div className="card warn small row">🏨 <span className="grow">还没添加住宿。加上酒店后，路线会自动从酒店出发、回到酒店。</span><button className="btn btn-sm btn-yellow" style={{ flex: 'none' }} onClick={() => { setAdderType('hotel'); setAdder(true) }}>添加住宿</button></div>
                )}
                {groups.filter(([k]) => filter === 'all' || filter === k).map(([k, list]) => (
                  <div key={k}>
                    <div className="label mb-s">{PLACE_TYPES[k].emoji} {PLACE_TYPES[k].label}</div>
                    <div className="list">
                      {list.map((p) => (
                        <div key={p.id} className="list-item click" onClick={() => setEditing(p)}>
                          <div className="emoji-badge sm" style={{ background: k === 'hotel' ? 'var(--yellow-100)' : undefined }}>{PLACE_TYPES[p.type]?.emoji}</div>
                          <div className="grow" style={{ minWidth: 0 }}>
                            <div className="bold ellipsis">{p.name}</div>
                            <div className="row wrap tiny muted" style={{ gap: 6, marginTop: 2 }}>
                              {k === 'hotel' ? (
                                <span style={{ color: hotelUse(p).ok ? 'var(--green-700)' : 'var(--red-500)' }}>{hotelUse(p).ok ? '✓ ' : '⚠️ '}{hotelUse(p).text}</span>
                              ) : (
                                <>
                                  {p.priority === 'optional' ? <span>有空再去</span> : <span style={{ color: 'var(--green-700)' }}>⭐ 必去</span>}
                                  <span>· {fmtDur(p.stay || 60)}</span>
                                  {p.open && <span>· {p.open}-{p.close}</span>}
                                  <span>· {p.day ? `D${dates.indexOf(p.day) + 1} ${fmtShort(p.day)}` : '未安排'}</span>
                                </>
                              )}
                            </div>
                          </div>
                          <a className="icon-btn sm" aria-label="在 Google Maps 打开" href={gmPlaceUrl(p, city.en || city.name)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                            <ExternalLink size={15} />
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {tab === 'plan' && (
          <>
            <div className="chip-scroll mb">
              {dates.map((d, i) => {
                const n = placesForDay(city, d).length
                return (
                  <button key={d} className={`chip btnlike ${d === date ? 'on' : ''}`} style={{ height: 44, flexDirection: 'column', gap: 0, padding: '0 12px', lineHeight: 1.15 }} onClick={() => setQuery({ date: d })}>
                    <span>D{i + 1} {fmtShort(d)}</span>
                    <span style={{ fontSize: 10, fontWeight: 500, opacity: 0.85 }}>{weekday(d)} · {n}处</span>
                  </button>
                )
              })}
            </div>
            <DayPlanner
              trip={trip} city={city} date={date} plan={plan} settings={settings}
              mutCity={mutCity} onOptimize={optimize} onDistribute={distribute} onEdit={setEditing} busy={!!busy}
              resolve={(ref) => resolveRef(trip, city, ref)}
            />
          </>
        )}
      </div>

      <PlaceAdder open={adder} onClose={() => { setAdder(false); setAdderType('sight') }} city={city} onAdd={addPlace} defaultType={adderType}
        onPinByName={(p) => { setPendingPin(p); setPinMode(true); window.scrollTo({ top: 0, behavior: 'smooth' }); toast('在地图上点一下它的位置') }} />
      <PlaceEditor open={!!editing} place={editing} city={city} onSave={savePlace} onDelete={deletePlace} onClose={() => setEditing(null)} />
    </>
  )
}
