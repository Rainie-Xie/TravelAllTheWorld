import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Download } from 'lucide-react'
import { useStore } from '../store'
import { TopBar, Empty, useToast } from '../components/ui'
import Overview from './trip/Overview'
import { decodeShare } from '../lib/extras'
import { uid } from '../lib/util'
import { TRANSPORT_TYPES, PLACE_TYPES, sortedTransports } from '../lib/trip'
import { splitDT, fmtDate } from '../lib/time'
import { gmPlaceUrl } from '../lib/geo'

export default function SharedTrip() {
  const { data } = useParams()
  const nav = useNavigate()
  const toast = useToast()
  const addTrip = useStore((s) => s.addTrip)
  const trips = useStore((s) => s.trips)
  const trip = useMemo(() => decodeShare(data), [data])
  if (!trip) return (<><TopBar title="分享的行程" onBack={() => nav('/')} /><Empty emoji="🔗" title="链接无效或不完整" sub="请让对方重新分享一次" /></>)

  const exists = trips.some((t) => t.id === trip.id)
  const save = () => {
    const copy = { ...trip, id: exists ? uid() : trip.id, packing: [], expenses: [], done: false }
    addTrip(copy)
    toast('已保存到我的行程')
    nav(`/trip/${copy.id}`, { replace: true })
  }

  return (
    <>
      <TopBar title={`${trip.name}（只读）`} onBack={() => nav('/')} />
      <div className="page no-tab stack" style={{ paddingTop: 8 }}>
        <div className="card tint row">
          <div className="grow small">这是朋友分享给你的行程，可以保存一份到自己手机上随时查看和修改。</div>
          <button className="btn btn-primary btn-sm" onClick={save}><Download size={14} />保存</button>
        </div>
        <Overview trip={trip} readOnly />
        {trip.transports.length > 0 && (
          <>
            <div className="section-title mt-s">交通</div>
            <div className="list">
              {sortedTransports(trip).map((t) => (
                <div key={t.id} className="list-item">
                  <span style={{ fontSize: 20 }}>{TRANSPORT_TYPES[t.type].emoji}</span>
                  <div className="grow small">
                    <div className="bold">{t.number} · {fmtDate(splitDT(t.dep).date)}</div>
                    <div className="muted">{splitDT(t.dep).time} {t.from?.name} → {splitDT(t.arr).time} {t.to?.name}</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
        {trip.cities.map((c) => (
          <div key={c.id}>
            <div className="section-title mt-s">{c.name}</div>
            <div className="list mt-s">
              {c.places.map((p) => (
                <a key={p.id} className="list-item" href={gmPlaceUrl(p, c.en || c.name)} target="_blank" rel="noreferrer">
                  <span>{PLACE_TYPES[p.type]?.emoji}</span>
                  <div className="grow small"><div className="bold">{p.name}</div>{p.note && <div className="muted">{p.note}</div>}</div>
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
