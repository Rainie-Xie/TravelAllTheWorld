import { useNavigate } from 'react-router-dom'
import { ChevronRight, Plus } from 'lucide-react'
import { flag, countryName } from '../../data/countries'
import { TAGS } from '../../data/cities'
import { fmtDate, daysBetween } from '../../lib/time'
import { hotelsOf } from '../../lib/trip'
import { Empty } from '../../components/ui'

export default function CitiesTab({ trip }) {
  const nav = useNavigate()
  if (!trip.cities.length)
    return <Empty emoji="📍" title="还没有城市" action={<button className="btn btn-primary" onClick={() => nav(`/trip/${trip.id}/edit`)}><Plus size={16} />添加城市</button>} />
  return (
    <div className="stack">
      {trip.cities.map((c, i) => {
        const nights = daysBetween(c.arrive, c.leave)
        const places = c.places.filter((p) => p.type !== 'hotel')
        const hotels = hotelsOf(c)
        const unassigned = places.filter((p) => !p.day).length
        return (
          <div key={c.id} className="card click" onClick={() => nav(`/trip/${trip.id}/city/${c.id}`)}>
            <div className="row">
              <div className="emoji-badge" style={{ fontSize: 24 }}><span className="flag">{flag(c.countryCode)}</span></div>
              <div className="grow" style={{ minWidth: 0 }}>
                <div className="row" style={{ gap: 6 }}>
                  <span className="faint small">{i + 1}</span>
                  <span className="bold" style={{ fontSize: 17 }}>{c.name}</span>
                  <span className="tiny faint">{countryName(c.countryCode)}</span>
                </div>
                <div className="small muted">{fmtDate(c.arrive, { week: false })} - {fmtDate(c.leave, { week: false })} · {nights}晚</div>
              </div>
              <ChevronRight size={18} color="var(--ink-3)" />
            </div>
            <div className="row wrap mt-s" style={{ gap: 6 }}>
              <span className="chip green">📍 {places.length} 个地点</span>
              <span className={`chip ${hotels.length ? 'yellow' : 'red'}`}>🏨 {hotels.length ? hotels.map((h) => h.name).join('、').slice(0, 16) : '还没加住宿'}</span>
              {unassigned > 0 && <span className="chip">{unassigned} 个未排日期</span>}
              {(c.tags || []).map((t) => TAGS[t] && <span key={t} className="chip">{TAGS[t].emoji} {TAGS[t].label}</span>)}
            </div>
          </div>
        )
      })}
      <button className="btn btn-soft" onClick={() => nav(`/trip/${trip.id}/edit`)}><Plus size={16} />添加 / 调整城市</button>
    </div>
  )
}
