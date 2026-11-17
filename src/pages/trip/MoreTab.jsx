import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Share2, Download, Trash2, Car, PartyPopper } from 'lucide-react'
import { useStore } from '../../store'
import { Field, useToast } from '../../components/ui'
import { DriverCard } from '../../components/PlaceEditor'
import { shareLink } from '../../lib/extras'
import { copyText, download } from '../../lib/util'
import { daysBetween, fmtShort } from '../../lib/time'
import { hotelsOf } from '../../lib/trip'

export default function MoreTab({ trip }) {
  const nav = useNavigate()
  const toast = useToast()
  const updateTrip = useStore((s) => s.updateTrip)
  const deleteTrip = useStore((s) => s.deleteTrip)
  const [driver, setDriver] = useState(null)
  const docs = trip.docs || {}
  const setDoc = (p) => updateTrip(trip.id, (d) => { d.docs = { ...(d.docs || {}), ...p } })

  const passportWarn = docs.passportExpiry && trip.endDate && daysBetween(trip.endDate, docs.passportExpiry) < 183
  const hotels = trip.cities.flatMap((c) => hotelsOf(c).map((h) => ({ ...h, city: c })))

  const share = async () => {
    const url = shareLink(trip)
    if (navigator.share) {
      try { await navigator.share({ title: trip.name, text: `我的旅行计划：${trip.name}`, url }); return } catch { /* cancelled */ }
    }
    await copyText(url)
    toast('分享链接已复制，发给同伴即可查看')
  }

  return (
    <div className="stack">
      <div className="section-title">🛂 证件</div>
      <div className="card stack">
        <Field label="护照有效期至" hint="多数国家要求护照在离境时还有 6 个月以上有效期">
          <input className="input" type="date" value={docs.passportExpiry || ''} onChange={(e) => setDoc({ passportExpiry: e.target.value })} />
        </Field>
        {passportWarn && <div className="card warn small">⚠️ 护照在旅行结束后不足 6 个月就过期了，可能被拒绝入境，建议尽快换发。</div>}
        <Field label="签证 / 入境要求">
          <input className="input" value={docs.visa || ''} onChange={(e) => setDoc({ visa: e.target.value })} placeholder="例如：越南电子签 E-visa，已获批" />
        </Field>
        <Field label="紧急联系方式">
          <textarea className="textarea" rows={2} value={docs.emergency || ''} onChange={(e) => setDoc({ emergency: e.target.value })} placeholder="大使馆电话、保险公司救援电话、家人电话" />
        </Field>
        <Field label="备忘">
          <textarea className="textarea" rows={3} value={docs.notes || ''} onChange={(e) => setDoc({ notes: e.target.value })} placeholder="随便记点什么…" />
        </Field>
      </div>

      <div className="section-title mt-s">🏨 酒店预订</div>
      {hotels.length === 0 ? (
        <div className="small muted">在各城市的地点清单里添加「住宿」类型的地点，这里会汇总显示。</div>
      ) : (
        <div className="list">
          {hotels.map((h) => (
            <div key={h.id} className="list-item">
              <div className="emoji-badge sm yellow">🏨</div>
              <div className="grow" style={{ minWidth: 0 }}>
                <div className="bold ellipsis">{h.name}</div>
                <div className="tiny muted">{h.city.name} · {h.hotelIn ? `${fmtShort(h.hotelIn)}–${fmtShort(h.hotelOut)}` : '日期未设'}{h.confirm ? ` · 订单 ${h.confirm}` : ''}</div>
              </div>
              <button className="btn btn-sm" onClick={() => setDriver(h)}><Car size={14} />给司机看</button>
            </div>
          ))}
        </div>
      )}

      <div className="section-title mt-s">📤 分享与备份</div>
      <div className="card stack-s">
        <button className="btn btn-soft" onClick={share}><Share2 size={16} />生成只读分享链接</button>
        <div className="tiny faint">同伴打开链接即可查看完整行程，也能一键保存到自己手机上。（数据都在链接里，不经过任何服务器）</div>
        <button className="btn" onClick={() => download(`${trip.name}.json`, JSON.stringify({ app: 'tripnote', version: 1, trips: [trip] }, null, 2))}><Download size={16} />导出这次旅行（备份文件）</button>
      </div>

      <div className="section-title mt-s">🌍 足迹</div>
      <div className="card tint stack-s">
        {trip.done ? (
          <>
            <div className="small">这次旅行已完成，去过的国家和城市已在足迹地图上点亮 ✨</div>
            <button className="btn btn-sm" onClick={() => updateTrip(trip.id, (d) => { d.done = false })}>撤销完成</button>
          </>
        ) : (
          <>
            <div className="small">旅行结束后标记完成，会自动在足迹地图上点亮 {[...new Set(trip.cities.map((c) => c.countryCode))].length} 个国家、{trip.cities.length} 座城市。</div>
            <button className="btn btn-primary" onClick={() => { updateTrip(trip.id, (d) => { d.done = true }); toast('🎉 已点亮足迹！') }}><PartyPopper size={16} />标记为已完成</button>
          </>
        )}
      </div>

      <button className="btn btn-danger mt" onClick={() => { if (window.confirm(`确定删除「${trip.name}」？删除后无法恢复（建议先导出备份）。`)) { deleteTrip(trip.id); nav('/', { replace: true }) } }}>
        <Trash2 size={16} />删除这次旅行
      </button>
      {driver && <DriverCard text={driver.localAddress || driver.name} sub={driver.localAddress ? driver.name : driver.city.en} onClose={() => setDriver(null)} />}
    </div>
  )
}
