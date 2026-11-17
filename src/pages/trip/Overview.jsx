import { useNavigate } from 'react-router-dom'
import { ChevronRight, BedDouble, AlarmClock } from 'lucide-react'
import { useStore } from '../../store'
import MapView from '../../components/MapView'
import { flag } from '../../data/countries'
import { dateRange, fmtDate, todayStr, daysBetween, splitDT, fromMin } from '../../lib/time'
import { cityOnDate, hotelForNight, transportsOn, leaveInfo, TRANSPORT_TYPES, placesForDay, countdown, tripStatus, PLACE_TYPES } from '../../lib/trip'
import { Empty } from '../../components/ui'

export default function Overview({ trip, readOnly = false }) {
  const nav = useNavigate()
  const settings = useStore((s) => s.settings)
  const days = dateRange(trip.startDate, trip.endDate)
  const today = todayStr()
  const cd = countdown(trip)
  const st = tripStatus(trip)

  const markers = trip.cities.map((c, i) => ({ id: c.id, lat: c.lat, lng: c.lng, color: '#5DAA3C', label: String(i + 1), numbered: true, title: c.name }))
  const line = trip.cities.length > 1 ? [{ points: trip.cities.map((c) => [c.lat, c.lng]), dashed: true, weight: 3, color: '#5DAA3C' }] : []

  const goCity = (city, date) => !readOnly && nav(`/trip/${trip.id}/city/${city.id}?tab=plan${date ? `&date=${date}` : ''}`)

  return (
    <div className="stack">
      <div className="card sun">
        <div className="row-between">
          <div>
            <div className="small muted">{trip.startDate ? `${fmtDate(trip.startDate)} — ${fmtDate(trip.endDate)}` : '还没定日期'}</div>
            <div className="bold" style={{ fontSize: 18 }}>
              {st === 'ongoing' ? `旅行第 ${daysBetween(trip.startDate, today) + 1} 天 🎒` : st === 'done' ? '已完成的旅行 🎉' : cd != null && cd >= 0 ? (cd === 0 ? '今天出发！✈️' : `距离出发还有 ${cd} 天`) : '旅行已结束'}
            </div>
          </div>
          <div style={{ fontSize: 34 }}>{days.length ? `${days.length}` : ''}<span className="small muted">{days.length ? '天' : ''}</span></div>
        </div>
        <div className="route-line mt-s" style={{ gap: 6 }}>
          {trip.cities.map((c, i) => {
            const t = trip.transports.find((x) => x.toCityId === c.id)
            return (
              <span key={c.id} className="row" style={{ gap: 6 }}>
                {i > 0 && <span title={t ? TRANSPORT_TYPES[t.type].label : ''}>{t ? TRANSPORT_TYPES[t.type].emoji : '→'}</span>}
                <span className="chip" style={{ background: '#fff' }}><span className="flag">{flag(c.countryCode)}</span>{c.name}</span>
              </span>
            )
          })}
        </div>
      </div>

      {trip.cities.length > 0 && <MapView markers={markers} lines={line} height={210} fitPadding={30} />}

      {!trip.cities.length && (
        <Empty emoji="🗺️" title="还没有城市" sub="点右上角 ✏️ 添加目的地" action={!readOnly && <button className="btn btn-primary" onClick={() => nav(`/trip/${trip.id}/edit`)}>添加城市</button>} />
      )}

      {days.length > 0 && (
        <>
          <div className="section-title mt-s">每日行程</div>
          <div className="stack-s">
            {days.map((date, i) => {
              const city = cityOnDate(trip, date)
              const hotel = city && hotelForNight(city, date)
              const ts = transportsOn(trip, date)
              const planned = city ? placesForDay(city, date) : []
              // places planned in previous city for this date (departure day)
              const prevCity = trip.cities.find((c) => c.leave === date && c.id !== city?.id)
              const prevPlanned = prevCity ? placesForDay(prevCity, date) : []
              const isToday = date === today
              return (
                <div key={date} className={`card ${isToday ? 'tint' : ''}`} style={isToday ? { borderColor: 'var(--green-400)' } : {}}>
                  <div className="row-between">
                    <div className="row">
                      <div className="emoji-badge sm yellow bold" style={{ fontSize: 13 }}>D{i + 1}</div>
                      <div>
                        <div className="bold">{fmtDate(date)} {isToday && <span className="chip green" style={{ marginLeft: 4 }}>今天</span>}</div>
                        <div className="tiny muted">{prevCity && city ? `${prevCity.name} → ${city.name}` : city?.name || '—'}</div>
                      </div>
                    </div>
                  </div>

                  {ts.map((t) => {
                    const dep = splitDT(t.dep), arr = splitDT(t.arr)
                    const li = dep.date === date ? leaveInfo(trip, t, settings) : null
                    return (
                      <div key={t.id} className="mt-s">
                        <div className="row small" style={{ gap: 6 }}>
                          <span>{TRANSPORT_TYPES[t.type].emoji}</span>
                          <span className="bold">{t.number}</span>
                          <span className="muted ellipsis grow">{dep.date === date ? dep.time : ''} {t.from?.code || t.from?.name} → {t.to?.code || t.to?.name} {arr.date === date ? arr.time : ''}</span>
                        </div>
                        {li && (
                          <div className="row small mt-s" style={{ background: '#fff3d1', borderRadius: 10, padding: '6px 10px', color: '#7a5a00' }}>
                            <AlarmClock size={15} />
                            <span><b>{fromMin(li.leaveMin)}</b> 前出发去{t.type === 'flight' ? '机场' : '车站'}</span>
                          </div>
                        )}
                      </div>
                    )
                  })}

                  {[...(prevCity ? [[prevCity, prevPlanned]] : []), ...(city ? [[city, planned]] : [])].map(([c, list]) => list.length > 0 && (
                    <div key={c.id} className="row mt-s click" style={{ cursor: readOnly ? 'default' : 'pointer' }} onClick={() => goCity(c, date)}>
                      <div className="grow small" style={{ minWidth: 0 }}>
                        <span className="muted">{c.name} · </span>
                        {list.slice(0, 4).map((p) => `${PLACE_TYPES[p.type]?.emoji}${p.name}`).join('  ')}
                        {list.length > 4 && <span className="faint"> 等{list.length}处</span>}
                      </div>
                      {!readOnly && <ChevronRight size={16} color="var(--ink-3)" />}
                    </div>
                  ))}
                  {city && !planned.length && !prevPlanned.length && !readOnly && (
                    <button className="btn btn-ghost btn-sm mt-s" style={{ paddingLeft: 0 }} onClick={() => goCity(city, date)}>+ 安排这天去哪</button>
                  )}

                  {hotel && (
                    <div className="row tiny muted mt-s"><BedDouble size={14} /> 住 {hotel.name}</div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
