import { useEffect, useState } from 'react'
import { Plus, CalendarPlus, AlarmClock, Loader2, Search, RefreshCw } from 'lucide-react'
import { useStore } from '../../store'
import { Sheet, Field, Empty, useToast } from '../../components/ui'
import { searchAirports, COMMON_TZ, AIRPORTS } from '../../data/airports'
import { searchPlaces, travelMinutes, haversine } from '../../lib/geo'
import { TRANSPORT_TYPES, sortedTransports, leaveInfo, nearestCity, departureHotel, getCity } from '../../lib/trip'
import { splitDT, fromMin, fmtDate, fmtDur, deviceTz, localToUtc } from '../../lib/time'
import { buildIcs } from '../../lib/extras'
import { download, uid } from '../../lib/util'

function guessTz(pt) {
  let best = null, bd = Infinity
  for (const a of AIRPORTS) {
    const d = haversine(a, pt)
    if (d < bd) { bd = d; best = a }
  }
  return bd < 1200000 ? best.tz : deviceTz()
}

function StopInput({ label, value, onChange, near }) {
  const [q, setQ] = useState('')
  const [focus, setFocus] = useState(false)
  const [remote, setRemote] = useState(null)
  const [loading, setLoading] = useState(false)
  const local = searchAirports(q)
  const pick = (v) => { onChange(v); setQ(''); setRemote(null); setFocus(false) }
  const searchRemote = async () => {
    setLoading(true)
    try { setRemote(await searchPlaces(q, near)) } catch { setRemote([]) }
    setLoading(false)
  }
  return (
    <Field label={label}>
      {value?.lat && !focus ? (
        <div className="row card flat" style={{ padding: '8px 12px' }}>
          <div className="grow" style={{ minWidth: 0 }}>
            <div className="bold ellipsis">{value.code ? `${value.code} · ` : ''}{value.name}</div>
            <div className="tiny faint">时区 {value.tz}</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => setFocus(true)}>更换</button>
        </div>
      ) : (
        <div className="stack-s">
          <div className="search-box">
            <Search size={18} />
            <input className="input" placeholder="机场代码/名称，如 HAN、内排；或火车站名" value={q} onChange={(e) => { setQ(e.target.value); setRemote(null) }} onFocus={() => setFocus(true)} />
          </div>
          {q && (
            <div className="list">
              {local.map((a) => (
                <div key={a.code} className="list-item click" onClick={() => pick({ name: a.name, code: a.code, lat: a.lat, lng: a.lng, tz: a.tz })}>
                  <span className="chip green">{a.code}</span><span className="grow">{a.name}</span>
                </div>
              ))}
              {remote?.map((r, i) => (
                <div key={i} className="list-item click" onClick={() => pick({ name: r.name, lat: r.lat, lng: r.lng, tz: guessTz(r) })}>
                  <span>📍</span><div className="grow" style={{ minWidth: 0 }}><div className="ellipsis">{r.name}</div><div className="tiny faint ellipsis">{r.address}</div></div>
                </div>
              ))}
              {!remote && (
                <div className="list-item click" onClick={searchRemote}>
                  {loading ? <Loader2 size={16} className="spin" /> : <Search size={16} />}<span className="small">在地图里搜索「{q}」（火车站、码头、其他机场）</span>
                </div>
              )}
              {remote && !remote.length && <div className="list-item small faint">没找到，换个写法（英文名）试试</div>}
            </div>
          )}
          {value?.lat && <button className="btn btn-ghost btn-sm" onClick={() => setFocus(false)}>取消更换</button>}
        </div>
      )}
      {value?.lat && (
        <select className="select sm" value={value.tz || ''} onChange={(e) => onChange({ ...value, tz: e.target.value })} aria-label="时区">
          {[...new Set([value.tz, ...COMMON_TZ].filter(Boolean))].map((tz) => <option key={tz} value={tz}>{tz}</option>)}
        </select>
      )}
    </Field>
  )
}

function TransportEditor({ trip, value, onSave, onDelete, onClose }) {
  const [t, setT] = useState(value)
  const set = (p) => setT((x) => ({ ...x, ...p }))
  const setStop = (key, v) => {
    const patch = { [key]: v }
    const c = nearestCity(trip, v)
    if (key === 'from' && c && !t.fromCityId) patch.fromCityId = c.id
    if (key === 'to' && c && !t.toCityId) patch.toCityId = c.id
    if (t.type === 'flight' && (key === 'from' ? t.to : t.from)?.tz && v.tz) {
      const other = key === 'from' ? t.to : t.from
      const ca = AIRPORTS.find((a) => a.code === v.code)?.country, cb = AIRPORTS.find((a) => a.code === other.code)?.country
      if (ca && cb) patch.intl = ca !== cb
    }
    set(patch)
  }
  const dur = (() => {
    const a = localToUtc(t.dep, t.from?.tz), b = localToUtc(t.arr, t.to?.tz)
    return a && b ? (b - a) / 60000 : null
  })()
  return (
    <Sheet open onClose={onClose} title={value.id ? '编辑交通' : '添加交通'}
      footer={<>
        {value.id && <button className="btn btn-danger" onClick={() => window.confirm('删除这段交通？') && onDelete(t)}>删除</button>}
        <button className="btn btn-primary grow" onClick={() => onSave(t)} disabled={!t.dep}>保存</button>
      </>}>
      <div className="stack">
        <div className="chip-scroll">
          {Object.entries(TRANSPORT_TYPES).map(([k, v]) => (
            <button key={k} className={`chip btnlike ${t.type === k ? 'on' : ''}`} style={{ height: 34 }} onClick={() => set({ type: k })}>{v.emoji} {v.label}</button>
          ))}
        </div>
        <Field label={t.type === 'flight' ? '航班号' : '车次 / 班次'}>
          <input className="input" value={t.number || ''} onChange={(e) => set({ number: e.target.value.toUpperCase() })} placeholder={t.type === 'flight' ? 'VN523' : 'SE4'} />
        </Field>
        <StopInput label="出发" value={t.from} onChange={(v) => setStop('from', v)} near={getCity(trip, t.fromCityId)} />
        <Field label="出发时间（当地时间）">
          <input className="input" type="datetime-local" value={t.dep || ''} onChange={(e) => set({ dep: e.target.value, arr: t.arr || e.target.value })} />
        </Field>
        <StopInput label="到达" value={t.to} onChange={(v) => setStop('to', v)} near={getCity(trip, t.toCityId)} />
        <Field label="到达时间（当地时间）" hint={dur != null ? `飞行/行驶约 ${fmtDur(dur)}（已按时区换算）` : null}>
          <input className="input" type="datetime-local" value={t.arr || ''} min={t.dep} onChange={(e) => set({ arr: e.target.value })} />
        </Field>
        <div className="grid-2">
          <Field label="从哪个城市出发">
            <select className="select sm" value={t.fromCityId || ''} onChange={(e) => set({ fromCityId: e.target.value || null })}>
              <option value="">（国内/行程外）</option>
              {trip.cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="到达哪个城市">
            <select className="select sm" value={t.toCityId || ''} onChange={(e) => set({ toCityId: e.target.value || null })}>
              <option value="">（回国/行程外）</option>
              {trip.cities.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
        </div>
        {t.type === 'flight' && (
          <label className="row small" style={{ cursor: 'pointer' }}>
            <input type="checkbox" checked={!!t.intl} onChange={(e) => set({ intl: e.target.checked })} />
            国际航班（建议提前 3 小时到机场）
          </label>
        )}
        <div className="grid-2">
          <Field label={t.type === 'flight' ? '航站楼' : '站台/车厢'}>
            <input className="input sm" value={t.terminal || ''} onChange={(e) => set({ terminal: e.target.value })} />
          </Field>
          <Field label="行李额">
            <input className="input sm" value={t.baggage || ''} onChange={(e) => set({ baggage: e.target.value })} placeholder="23kg 托运" />
          </Field>
        </div>
        <Field label="订单号 / 座位">
          <input className="input" value={t.bookingRef || ''} onChange={(e) => set({ bookingRef: e.target.value })} />
        </Field>
        <div className="grid-2">
          <Field label="提前到达（分钟）" hint="留空用设置里的默认值">
            <input className="input sm" type="number" inputMode="numeric" value={t.bufferMin ?? ''} onChange={(e) => set({ bufferMin: e.target.value === '' ? null : +e.target.value })} />
          </Field>
          <Field label="酒店→站点车程（分钟）" hint="留空自动估算">
            <input className="input sm" type="number" inputMode="numeric" value={t.transferMin ?? ''} onChange={(e) => set({ transferMin: e.target.value === '' ? null : +e.target.value, transferAuto: false })} />
          </Field>
        </div>
      </div>
    </Sheet>
  )
}

export default function TransportTab({ trip }) {
  const settings = useStore((s) => s.settings)
  const updateTrip = useStore((s) => s.updateTrip)
  const toast = useToast()
  const [editing, setEditing] = useState(null)
  const [estimating, setEstimating] = useState(null)
  const list = sortedTransports(trip)

  const estimate = async (t, draftTrip = trip) => {
    const hotel = departureHotel(draftTrip, t)
    if (!hotel || !t.from?.lat) return
    setEstimating(t.id)
    const r = await travelMinutes(hotel, t.from, 'drive')
    updateTrip(trip.id, (d) => {
      const x = d.transports.find((y) => y.id === t.id)
      if (x) { x.transferMin = Math.round(r.min); x.transferAuto = true }
    })
    setEstimating(null)
  }

  // auto-estimate real transfer times for legs that don't have one yet
  const pendingSig = list.filter((t) => t.transferMin == null && t.from?.lat && departureHotel(trip, t)).map((t) => t.id).join(',')
  useEffect(() => {
    if (!pendingSig) return
    let alive = true
    ;(async () => {
      for (const id of pendingSig.split(',')) {
        if (!alive) return
        const t = useStore.getState().trips.find((x) => x.id === trip.id)?.transports.find((x) => x.id === id)
        if (t) await estimate(t)
      }
    })()
    return () => { alive = false }
  }, [pendingSig]) // eslint-disable-line react-hooks/exhaustive-deps

  const save = (t) => {
    const isNew = !t.id
    const item = { ...t, id: t.id || uid() }
    if (item.transferAuto !== false && isNew) item.transferMin = null
    updateTrip(trip.id, (d) => {
      const i = d.transports.findIndex((x) => x.id === item.id)
      if (i >= 0) d.transports[i] = item
      else d.transports.push(item)
    })
    setEditing(null)
    if (item.transferMin == null || item.transferAuto) estimate(item, { ...trip, transports: [...trip.transports.filter((x) => x.id !== item.id), item] })
    toast('已保存')
  }
  const del = (t) => {
    updateTrip(trip.id, (d) => { d.transports = d.transports.filter((x) => x.id !== t.id) })
    setEditing(null)
  }

  const exportIcs = () => {
    download(`${trip.name}-行程提醒.ics`, buildIcs(trip, settings), 'text/calendar')
    toast('已导出，打开文件即可添加到手机日历')
  }

  const blank = () => {
    const last = list[list.length - 1]
    return { type: 'flight', number: '', from: last?.to || null, to: null, dep: '', arr: '', fromCityId: last?.toCityId || null, toCityId: null, intl: false }
  }

  return (
    <div className="stack">
      <div className="row">
        <button className="btn btn-primary grow" onClick={() => setEditing(blank())}><Plus size={17} />添加机票 / 车票</button>
        {list.length > 0 && <button className="btn" onClick={exportIcs}><CalendarPlus size={17} />加到日历</button>}
      </div>
      {list.length === 0 && <Empty emoji="✈️" title="还没有交通信息" sub="录入机票后，会自动算出几点要出发去机场，并安排进每日路线" />}
      {list.map((t) => {
        const dep = splitDT(t.dep), arr = splitDT(t.arr)
        const li = leaveInfo(trip, t, settings)
        const tt = TRANSPORT_TYPES[t.type]
        return (
          <div key={t.id} className="card click" onClick={() => setEditing(t)}>
            <div className="row-between small muted">
              <span>{tt.emoji} {tt.label} · <b style={{ color: 'var(--ink)' }}>{t.number || '—'}</b>{t.intl ? ' · 国际' : ''}</span>
              <span>{fmtDate(dep.date)}</span>
            </div>
            <div className="row mt-s" style={{ alignItems: 'flex-end' }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="temp" style={{ fontSize: 24 }}>{dep.time}</div>
                <div className="small ellipsis">{t.from?.code || ''} {t.from?.name}</div>
              </div>
              <div className="center faint tiny" style={{ flex: 'none', padding: '0 6px 18px' }}>━━ {tt.emoji} ━━</div>
              <div style={{ minWidth: 0, flex: 1, textAlign: 'right' }}>
                <div className="temp" style={{ fontSize: 24 }}>{arr.time}{arr.date && arr.date !== dep.date ? <sup className="tiny">+1</sup> : ''}</div>
                <div className="small ellipsis">{t.to?.code || ''} {t.to?.name}</div>
              </div>
            </div>
            {(t.terminal || t.bookingRef || t.baggage) && (
              <div className="row wrap mt-s" style={{ gap: 6 }}>
                {t.terminal && <span className="chip">🏢 {t.terminal}</span>}
                {t.baggage && <span className="chip">🧳 {t.baggage}</span>}
                {t.bookingRef && <span className="chip">🎫 {t.bookingRef}</span>}
              </div>
            )}
            {li && t.fromCityId && (
              <div className="card sun mt-s" style={{ padding: '10px 12px' }} onClick={(e) => e.stopPropagation()}>
                <div className="row bold" style={{ color: '#6b5200' }}><AlarmClock size={16} />建议 {fromMin(li.leaveMin)} 出发去{t.type === 'flight' ? '机场' : '车站'}</div>
                <div className="tiny muted mt-s">
                  {li.hotel ? `从「${li.hotel.name}」` : '从市区'}打车约 {li.transfer} 分钟{t.transferAuto ? '' : t.transferMin != null ? '（手动）' : '（粗估）'} + 提前 {li.buffer} 分钟到 + 缓冲 {li.extra} 分钟
                </div>
                {li.hotel && (
                  <button className="btn btn-ghost btn-sm" style={{ paddingLeft: 0, height: 28 }} onClick={() => estimate(t)} disabled={estimating === t.id}>
                    {estimating === t.id ? <Loader2 size={13} className="spin" /> : <RefreshCw size={13} />} 按实际路线重新估算车程
                  </button>
                )}
              </div>
            )}
          </div>
        )
      })}
      {list.length > 0 && (
        <div className="kbd-note">📅 「加到日历」会导出一个 .ics 文件，包含每段交通和「该出发了」提醒（提前 30 分钟 + 准点各响一次）。在手机上打开它即可添加到系统日历。</div>
      )}
      {editing && <TransportEditor trip={trip} value={editing} onSave={save} onDelete={del} onClose={() => setEditing(null)} />}
    </div>
  )
}
