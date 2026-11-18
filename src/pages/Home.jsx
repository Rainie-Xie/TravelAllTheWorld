import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { Plus, CalendarDays, Sparkles, MoreHorizontal, Pencil, Trash2, Copy, PartyPopper } from 'lucide-react'
import { useStore } from '../store'
import { flag } from '../data/countries'
import { fmtDate, daysBetween } from '../lib/time'
import { tripStatus, countdown } from '../lib/trip'
import { makeSampleTrip } from '../data/sample'
import { Empty, Sheet, useToast, confirmDialog } from '../components/ui'
import { uid } from '../lib/util'

const DOODLE = { beach: '🏝️', mountain: '🏔️', temple: '🛕', city: '🏙️' }

export function tripDoodle(trip) {
  const tags = trip.cities.flatMap((c) => c.tags || [])
  for (const k of ['beach', 'mountain', 'temple', 'city']) if (tags.includes(k)) return DOODLE[k]
  return '🧳'
}

function StatusChip({ trip }) {
  const st = tripStatus(trip)
  if (st === 'done') return <span className="chip green">✓ 已完成</span>
  if (st === 'ongoing') return <span className="chip yellow">● 旅行中</span>
  if (st === 'past') return <span className="chip">已结束</span>
  const cd = countdown(trip)
  return <span className="chip green">{cd != null ? (cd === 0 ? '今天出发' : `还有 ${cd} 天`) : '规划中'}</span>
}

export function TripCard({ trip, onClick, onMore }) {
  const flags = [...new Set(trip.cities.map((c) => c.countryCode))]
  const days = trip.startDate && trip.endDate ? daysBetween(trip.startDate, trip.endDate) + 1 : null
  return (
    <div className="trip-card" onClick={onClick}>
      <div className={`trip-cover cover-${(trip.cover ?? 0) % 6}`}>
        <div className="flags flag">{flags.map(flag).join(' ')}</div>
        <div className="tape" />
        <div className="doodle">{tripDoodle(trip)}</div>
        {onMore && (
          <button className="icon-btn sm" aria-label="更多操作" style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(255,255,255,.85)', zIndex: 2 }}
            onClick={(e) => { e.stopPropagation(); onMore() }}>
            <MoreHorizontal size={17} />
          </button>
        )}
        <h3>{trip.name}</h3>
      </div>
      <div className="trip-body">
        <div className="row-between mb-s">
          <div className="row small muted"><CalendarDays size={14} />{trip.startDate ? `${fmtDate(trip.startDate, { week: false })} - ${fmtDate(trip.endDate, { week: false })}` : '日期未定'}{days ? ` · ${days}天` : ''}</div>
          <StatusChip trip={trip} />
        </div>
        <div className="route-line">
          {trip.cities.map((c, i) => (
            <span key={c.id} className="row" style={{ gap: 4 }}>
              {i > 0 && <span className="faint">→</span>}
              <span>{c.name}</span>
            </span>
          ))}
          {!trip.cities.length && <span className="faint">还没有添加城市</span>}
        </div>
      </div>
    </div>
  )
}

export default function Home() {
  const nav = useNavigate()
  const trips = useStore((s) => s.trips)
  const addTrip = useStore((s) => s.addTrip)
  const deleteTrip = useStore((s) => s.deleteTrip)
  const updateTrip = useStore((s) => s.updateTrip)
  const toast = useToast()
  const [menu, setMenu] = useState(null)
  const order = { ongoing: 0, planning: 1, past: 2, done: 3 }
  const sorted = [...trips].sort((a, b) => order[tripStatus(a)] - order[tripStatus(b)] || (a.startDate || '').localeCompare(b.startDate || ''))
  const hour = new Date().getHours()
  const hello = hour < 11 ? '早上好' : hour < 14 ? '中午好' : hour < 19 ? '下午好' : '晚上好'

  const loadSample = () => {
    const t = makeSampleTrip()
    addTrip(t)
    nav(`/trip/${t.id}`)
  }

  return (
    <div className="page">
      <div className="mb">
        <div className="small muted">{hello}，旅行家 👋</div>
        <div className="hero-title">下一站去哪儿？</div>
      </div>

      {sorted.length === 0 ? (
        <div className="card tint mt">
          <Empty
            emoji="🧳"
            title="还没有旅行计划"
            sub="新建一次旅行，选择国家和城市，开始做攻略吧"
            action={
              <div className="stack-s" style={{ maxWidth: 260, margin: '0 auto' }}>
                <button className="btn btn-primary" onClick={() => nav('/trip/new')}><Plus size={18} />新建旅行</button>
                <button className="btn btn-soft" onClick={loadSample}><Sparkles size={16} />看看示例：越南 13 天</button>
              </div>
            }
          />
        </div>
      ) : (
        <div className="stack" style={{ gap: 16 }}>
          {sorted.map((t) => <TripCard key={t.id} trip={t} onClick={() => nav(`/trip/${t.id}`)} onMore={() => setMenu(t)} />)}
          {!trips.some((t) => t.sample) && (
            <button className="btn btn-ghost btn-sm" onClick={loadSample}><Sparkles size={14} />添加一个示例行程看看</button>
          )}
        </div>
      )}

      <Sheet open={!!menu} onClose={() => setMenu(null)} title={menu?.name || ''}>
        {menu && (
          <div className="list">
            <div className="list-item click" onClick={() => { setMenu(null); nav(`/trip/${menu.id}/edit`) }}><Pencil size={18} />编辑城市和日期</div>
            <div className="list-item click" onClick={() => { updateTrip(menu.id, (d) => { d.done = !d.done }); toast(menu.done ? '已取消完成' : '🎉 已标记完成，足迹已点亮'); setMenu(null) }}><PartyPopper size={18} />{menu.done ? '取消「已完成」' : '标记为已完成（点亮足迹）'}</div>
            <div className="list-item click" onClick={() => { const c = { ...structuredClone(menu), id: uid(), name: `${menu.name}（副本）`, done: false, sample: false, createdAt: Date.now() }; addTrip(c); toast('已复制'); setMenu(null) }}><Copy size={18} />复制一份</div>
            <div className="list-item click" style={{ color: 'var(--red-500)' }} onClick={async () => { const t = menu; if (await confirmDialog({ title: `删除「${t.name}」？`, message: '删除后无法恢复。', okText: '删除', danger: true })) { deleteTrip(t.id); toast('已删除'); setMenu(null) } }}><Trash2 size={18} />删除这次旅行</div>
          </div>
        )}
      </Sheet>

      {sorted.length > 0 && (
        <button className="btn btn-primary fab" onClick={() => nav('/trip/new')}><Plus size={20} />新建旅行</button>
      )}
    </div>
  )
}
