import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Pencil } from 'lucide-react'
import { useTrip } from '../store'
import { TopBar, Empty } from '../components/ui'
import Overview from './trip/Overview'
import CitiesTab from './trip/CitiesTab'
import TransportTab from './trip/TransportTab'
import WeatherTab from './trip/WeatherTab'
import PackingTab from './trip/PackingTab'
import WalletTab from './trip/WalletTab'
import MoreTab from './trip/MoreTab'

export const TABS = [
  { key: 'overview', label: '概览', emoji: '🗓️', C: Overview },
  { key: 'cities', label: '城市', emoji: '📍', C: CitiesTab },
  { key: 'transport', label: '交通', emoji: '✈️', C: TransportTab },
  { key: 'weather', label: '天气穿衣', emoji: '🌤️', C: WeatherTab },
  { key: 'packing', label: '行李', emoji: '🧳', C: PackingTab },
  { key: 'wallet', label: '钱包', emoji: '💰', C: WalletTab },
  { key: 'more', label: '证件&更多', emoji: '📎', C: MoreTab },
]

export default function TripDetail() {
  const { tripId } = useParams()
  const trip = useTrip(tripId)
  const nav = useNavigate()
  const [sp, setSp] = useSearchParams()
  const tab = sp.get('tab') || 'overview'
  if (!trip) return (<><TopBar title="找不到旅行" onBack={() => nav('/')} /><Empty emoji="🤔" title="这个旅行不存在或已被删除" /></>)
  const T = TABS.find((t) => t.key === tab) || TABS[0]
  return (
    <>
      <TopBar
        title={trip.name}
        onBack={() => nav('/')}
        right={<button className="icon-btn" aria-label="编辑旅行" onClick={() => nav(`/trip/${trip.id}/edit`)}><Pencil size={17} /></button>}
      />
      <div className="page no-tab" style={{ paddingTop: 0 }}>
        <div className="seg-tabs">
          {TABS.map((t) => (
            <button key={t.key} className={t.key === T.key ? 'on' : ''} onClick={() => setSp({ tab: t.key }, { replace: true })}>
              <span>{t.emoji}</span>{t.label}
            </button>
          ))}
        </div>
        <div className="mt-s">
          <T.C trip={trip} />
        </div>
      </div>
    </>
  )
}
