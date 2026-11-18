import { useEffect, useState } from 'react'
import { ExternalLink, Trash2, Car } from 'lucide-react'
import { Sheet, Field, Seg, confirmDialog } from './ui'
import { PLACE_TYPES, cityDates } from '../lib/trip'
import { fmtDate, fmtDur } from '../lib/time'
import { gmPlaceUrl } from '../lib/geo'

const STAYS = [15, 30, 45, 60, 90, 120, 150, 180, 240, 300, 360]

export function DriverCard({ text, sub, onClose }) {
  return (
    <div className="driver-card" onClick={onClose}>
      <div className="small muted mb">请带我去 / Please take me to</div>
      <div className="addr">{text}</div>
      {sub && <div className="mt muted" style={{ fontSize: 18 }}>{sub}</div>}
      <div className="tiny faint mt-l">点击任意处关闭</div>
    </div>
  )
}

export default function PlaceEditor({ open, place, city, onSave, onDelete, onClose }) {
  const [p, setP] = useState(place)
  const [driver, setDriver] = useState(false)
  const [more, setMore] = useState(false)
  useEffect(() => { setP(place); setMore(!!(place?.open || place?.close || place?.ticket || place?.dayLocked)) }, [place])
  if (!p) return null
  const set = (patch) => setP((x) => ({ ...x, ...patch }))
  const dates = cityDates(city)
  const isHotel = p.type === 'hotel'
  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        title={place?.id ? '编辑地点' : '新地点'}
        footer={
          <>
            {onDelete && place?.id && (
              <button className="btn btn-danger" aria-label="删除地点" onClick={async () => { if (await confirmDialog({ title: `删除「${p.name}」？`, okText: '删除', danger: true })) onDelete(p) }}><Trash2 size={16} /></button>
            )}
            <button className="btn btn-primary grow" onClick={() => onSave({ ...p, name: p.name.trim() || '未命名地点' })}>保存</button>
          </>
        }
      >
        <div className="stack">
          <Field label="名称">
            <input className="input" value={p.name} onChange={(e) => set({ name: e.target.value })} placeholder="地点名称" />
          </Field>
          <div className="chip-scroll">
            {Object.entries(PLACE_TYPES).map(([k, v]) => (
              <button key={k} className={`chip btnlike ${p.type === k ? 'on' : ''}`} onClick={() => set(k === 'hotel' && !p.hotelIn ? { type: k, hotelIn: city.arrive, hotelOut: city.leave } : { type: k })}>{v.emoji} {v.label}</button>
            ))}
          </div>

          {isHotel ? (
            <>
              <div className="grid-2">
                <Field label="入住">
                  <input className="input sm" type="date" value={p.hotelIn || ''} min={city.arrive} max={city.leave} onChange={(e) => set({ hotelIn: e.target.value })} />
                </Field>
                <Field label="退房">
                  <input className="input sm" type="date" value={p.hotelOut || ''} min={p.hotelIn || city.arrive} onChange={(e) => set({ hotelOut: e.target.value })} />
                </Field>
              </div>
              <Field label="预订确认号">
                <input className="input" value={p.confirm || ''} onChange={(e) => set({ confirm: e.target.value })} placeholder="Booking / Agoda 订单号" />
              </Field>
              <Field label="当地语言地址（给司机看）" hint="从预订邮件复制酒店的当地语言地址，打车时一键全屏展示">
                <textarea className="textarea" rows={2} value={p.localAddress || ''} onChange={(e) => set({ localAddress: e.target.value })} placeholder="例如：12 Hàng Bạc, Hoàn Kiếm, Hà Nội" />
              </Field>
            </>
          ) : (
            <>
              <div className="row-between wrap">
                <span className="label">优先级</span>
                <Seg value={p.priority || 'must'} onChange={(v) => set({ priority: v })} options={[{ value: 'must', label: '⭐ 必去' }, { value: 'optional', label: '有空再去' }]} />
              </div>
              <div className="grid-2">
                <Field label="安排在">
                  <select className="select sm" value={p.day || ''} onChange={(e) => set({ day: e.target.value || null })}>
                    <option value="">未安排</option>
                    {dates.map((d, i) => <option key={d} value={d}>D{i + 1} · {fmtDate(d)}</option>)}
                  </select>
                </Field>
                <Field label="预计停留">
                  <select className="select sm" value={p.stay || 60} onChange={(e) => set({ stay: +e.target.value })}>
                    {STAYS.map((s) => <option key={s} value={s}>{fmtDur(s)}</option>)}
                  </select>
                </Field>
              </div>
              <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start', paddingLeft: 0 }} onClick={() => setMore((v) => !v)}>{more ? '收起 ▲' : '更多：营业时间、门票… ▼'}</button>
              {more && (<>
              <div className="grid-2">
                <Field label="开门时间">
                  <input className="input sm" type="time" value={p.open || ''} onChange={(e) => set({ open: e.target.value })} />
                </Field>
                <Field label="关门时间">
                  <input className="input sm" type="time" value={p.close || ''} onChange={(e) => set({ close: e.target.value })} />
                </Field>
              </div>
              <label className="row small muted" style={{ cursor: 'pointer' }}>
                <input type="checkbox" checked={!!p.dayLocked} onChange={(e) => set({ dayLocked: e.target.checked })} />
                固定在这一天（一键分配时不移动）
              </label>
              <Field label="门票 / 费用">
                <input className="input" value={p.ticket || ''} onChange={(e) => set({ ticket: e.target.value })} placeholder="例如 30,000 VND" />
              </Field>
              </>)}
            </>
          )}
          <Field label="备注">
            <textarea className="textarea" rows={2} value={p.note || ''} onChange={(e) => set({ note: e.target.value })} placeholder="必点菜、拍照机位、注意事项…" />
          </Field>
          <div className="row">
            <a className="btn btn-soft grow" href={gmPlaceUrl(p, city.en || city.name)} target="_blank" rel="noreferrer"><ExternalLink size={16} />在 Google Maps 查看</a>
            <button className="btn grow" onClick={() => setDriver(true)}><Car size={16} />给司机看</button>
          </div>
          <div className="tiny faint">坐标 {p.lat?.toFixed(5)}, {p.lng?.toFixed(5)}</div>
        </div>
      </Sheet>
      {driver && <DriverCard text={p.localAddress || p.name} sub={p.localAddress ? p.name : `${city.en || ''}`} onClose={() => setDriver(false)} />}
    </>
  )
}
