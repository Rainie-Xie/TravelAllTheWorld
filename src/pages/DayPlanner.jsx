import { ArrowUp, ArrowDown, Lock, Unlock, X, Wand2, Sparkles, Navigation, RotateCcw, AlertTriangle } from 'lucide-react'
import { Seg, Empty } from '../components/ui'
import { MODES, PLACE_TYPES, placesForDay, refOptions, effectiveDay, getDayPlan } from '../lib/trip'
import { fromMin, fmtDur, fmtDist, toMin, fmtDate } from '../lib/time'
import { gmDirectionLinks } from '../lib/geo'

const hhmm = (m) => fromMin(Math.max(0, Math.min(m, 1439))).slice(0, 5)

export default function DayPlanner({ trip, city, date, plan, settings, mutCity, onOptimize, onDistribute, onEdit, busy, resolve }) {
  if (!date) return <Empty emoji="📅" title="这个城市还没有日期" sub="先在编辑旅行里设置到达和离开日期" />
  const list = placesForDay(city, date)
  const unassigned = city.places.filter((p) => !p.day && p.type !== 'hotel' && p.type !== 'transit')
  const dp = getDayPlan(city, date)
  const eff = effectiveDay(trip, city, date, settings)
  const opts = refOptions(trip, city)
  const locked = dp.locked || {}

  const setDP = (patch) => mutCity((c) => {
    c.dayPlans = c.dayPlans || {}
    c.dayPlans[date] = { ...(c.dayPlans[date] || {}), ...patch }
  })
  const move = (i, d) => {
    const ids = list.map((p) => p.id)
    const j = i + d
    if (j < 0 || j >= ids.length) return
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
    setDP({ order: ids })
  }
  const toggleLock = (id) => setDP({ locked: { ...locked, [id]: !locked[id] } })
  const removeFromDay = (id) => mutCity((c) => { c.places.find((p) => p.id === id).day = null })
  const addToDay = (id) => mutCity((c) => { c.places.find((p) => p.id === id).day = date })

  const steps = plan?.tl?.steps || []
  const stepOf = Object.fromEntries(steps.map((s) => [s.id, s]))
  const start = plan?.start
  const end = plan?.end
  const navPoints = [start, ...steps.map((s) => list.find((p) => p.id === s.id)), end].filter(Boolean)
  const links = gmDirectionLinks(navPoints, eff.mode)
  const mode = MODES[eff.mode]
  const custom = dp.startTime || dp.endTime || dp.startRef !== undefined || dp.endRef !== undefined || dp.mode

  return (
    <div className="stack">
      {eff.def.notes.length > 0 && (
        <div className="card warn small stack-s">
          {eff.def.notes.map((n) => <div key={n} className="row"><AlertTriangle size={14} />{n}</div>)}
        </div>
      )}

      {/* day settings */}
      <div className="card">
        <div className="row-between mb-s">
          <div className="bold">{fmtDate(date)} 的安排</div>
          {custom && <button className="btn btn-ghost btn-sm" onClick={() => setDP({ startTime: undefined, endTime: undefined, startRef: undefined, endRef: undefined, mode: undefined })}><RotateCcw size={13} />恢复默认</button>}
        </div>
        <div className="grid-2">
          <div className="field">
            <label>出发时间</label>
            <input className="input sm" type="time" value={hhmm(eff.startMin)} onChange={(e) => setDP({ startTime: e.target.value })} />
          </div>
          <div className="field">
            <label>最晚结束</label>
            <input className="input sm" type="time" value={hhmm(eff.endMin)} onChange={(e) => setDP({ endTime: e.target.value })} />
          </div>
          <div className="field">
            <label>起点</label>
            <select className="select sm" value={eff.startRef || ''} onChange={(e) => setDP({ startRef: e.target.value || null })}>
              <option value="">从第一个地点开始</option>
              {opts.map((o) => <option key={o.ref} value={o.ref}>{o.label}</option>)}
            </select>
          </div>
          <div className="field">
            <label>终点</label>
            <select className="select sm" value={eff.endRef || ''} onChange={(e) => setDP({ endRef: e.target.value || null })}>
              <option value="">不用回去（自由结束）</option>
              {opts.map((o) => <option key={o.ref} value={o.ref}>{o.label}</option>)}
            </select>
          </div>
        </div>
        <div className="row-between mt-s">
          <span className="label">怎么走</span>
          <Seg value={eff.mode} onChange={(v) => setDP({ mode: v })} options={Object.entries(MODES).map(([k, v]) => ({ value: k, label: `${v.emoji} ${v.label}` }))} />
        </div>
        {!opts.length && <div className="tiny faint mt-s">💡 在「地点清单」里添加酒店后，就能从酒店出发、回到酒店。</div>}
      </div>

      <div className="row">
        <button className="btn btn-primary grow" disabled={busy || list.length < 1} onClick={onOptimize}><Wand2 size={17} />智能排序（不走回头路）</button>
      </div>
      <button className="btn btn-soft btn-sm" disabled={busy} onClick={onDistribute}><Sparkles size={14} />把这个城市的所有地点一键分配到每天</button>

      {/* timeline */}
      {list.length === 0 ? (
        <div className="card flat">
          <Empty emoji="🧭" title="这天还没有安排地点" sub={unassigned.length ? '从下面「未安排」里点选，或在地图上点灰色的 + 标记' : '先到「地点清单」里添加想去的地方'} />
        </div>
      ) : (
        <div className="card">
          <div className="tl">
            <div className="tl-item">
              <div className="tl-dot home">🏠</div>
              <div className="row-between">
                <div className="bold ellipsis grow">{start?.name || '起点'}</div>
                <span className="time-tag">{fromMin(eff.startMin)} 出发</span>
              </div>
            </div>
            {list.map((p, i) => {
              const s = stepOf[p.id]
              return (
                <div key={p.id}>
                  {s && (
                    <div className="tl-leg">{s.taxi ? "🚕 打车" : mode.emoji} {fmtDur(s.travel)}{s.dist ? ` · ${fmtDist(s.dist)}` : ''}{s.wait > 1 ? ` · 等开门 ${fmtDur(s.wait)}` : ''}</div>
                  )}
                  <div className="tl-item">
                    <div className={`tl-dot ${s?.late ? 'warn' : ''}`}>{i + 1}</div>
                    <div className="row" style={{ gap: 6, alignItems: 'flex-start' }}>
                      <div className="grow" style={{ minWidth: 0, cursor: 'pointer' }} onClick={() => onEdit(p)}>
                        <div className="bold ellipsis">{PLACE_TYPES[p.type]?.emoji} {p.name}</div>
                        <div className="row wrap tiny muted" style={{ gap: 6 }}>
                          {s && <span className="time-tag" style={{ fontSize: 12 }}>{fromMin(s.arrive)}–{fromMin(s.depart)}</span>}
                          <span>停留 {fmtDur(p.stay || 60)}</span>
                          {p.priority === 'optional' && <span>· 有空再去</span>}
                          {s?.late && <span className="chip red" style={{ height: 20 }}>可能已关门（{p.close}）</span>}
                        </div>
                      </div>
                      <div className="row" style={{ gap: 2, flex: 'none' }}>
                        <button className="icon-btn sm plain" aria-label="上移" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp size={15} /></button>
                        <button className="icon-btn sm plain" aria-label="下移" disabled={i === list.length - 1} onClick={() => move(i, 1)}><ArrowDown size={15} /></button>
                        <button className="icon-btn sm plain" aria-label={locked[p.id] ? '解锁位置' : '锁定位置'} onClick={() => toggleLock(p.id)} title="锁定后智能排序不会移动它">
                          {locked[p.id] ? <Lock size={15} color="var(--yellow-700)" /> : <Unlock size={15} color="var(--ink-3)" />}
                        </button>
                        <button className="icon-btn sm plain" aria-label="移出这天" onClick={() => removeFromDay(p.id)}><X size={15} /></button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
            {end && plan?.tl && (
              <>
                <div className="tl-leg">{plan.tl.endTaxi ? "🚕 打车" : mode.emoji} {fmtDur(plan.tl.endTravel)}{plan.tl.endDist ? ` · ${fmtDist(plan.tl.endDist)}` : ''}</div>
                <div className="tl-item" style={{ paddingBottom: 0 }}>
                  <div className="tl-dot home">🏁</div>
                  <div className="row-between">
                    <div className="bold ellipsis grow">{end.name}</div>
                    <span className="time-tag" style={plan.tl.endArrive > eff.endMin ? { color: 'var(--red-500)' } : {}}>{fromMin(plan.tl.endArrive)} 到达</span>
                  </div>
                </div>
              </>
            )}
          </div>
          {plan?.tl && (
            <>
              <div className="hr" />
              <div className="row wrap small muted" style={{ gap: 12 }}>
                <span>🛣️ 总路程 <b>{fmtDist(plan.tl.distTotal)}</b></span>
                <span>⏱️ 路上 <b>{fmtDur(plan.tl.travelTotal)}</b></span>
                {!end && steps.length > 0 && <span>🏁 约 <b>{fromMin(steps[steps.length - 1].depart)}</b> 结束</span>}
              </div>
              {plan.warnings.filter((w) => !w.includes('移出')).map((w) => <div key={w} className="small mt-s" style={{ color: '#9a6b00' }}>⚠️ {w}</div>)}
              {plan.source === 'estimate' && <div className="tiny faint mt-s">路线服务暂时连不上，时间按直线距离估算。</div>}
            </>
          )}
        </div>
      )}

      {links.length > 0 && (
        <div className="card tint">
          <div className="bold mb-s"><Navigation size={15} style={{ verticalAlign: -2 }} /> 按这个顺序在 Google Maps 导航</div>
          <div className="stack-s">
            {links.map((l, i) => (
              <a key={i} className="btn btn-primary btn-block" href={l.url} target="_blank" rel="noreferrer" style={{ justifyContent: 'space-between' }}>
                <span className="ellipsis" style={{ maxWidth: '78%' }}>{links.length > 1 ? `第 ${i + 1} 段：` : ''}{l.from} → {l.to}</span>
                <span className="tiny" style={{ opacity: 0.9 }}>{l.count} 站</span>
              </a>
            ))}
          </div>
          {links.length > 1 && <div className="tiny muted mt-s">手机版 Google Maps 每条路线最多 3 个途经点，所以分成了 {links.length} 段，走完一段再点下一段。</div>}
        </div>
      )}

      {unassigned.length > 0 && (
        <div>
          <div className="label mb-s">未安排的地点（点击加入这天）</div>
          <div className="row wrap" style={{ gap: 8 }}>
            {unassigned.map((p) => (
              <button key={p.id} className="chip btnlike" style={{ height: 32 }} onClick={() => addToDay(p.id)}>+ {PLACE_TYPES[p.type]?.emoji} {p.name}</button>
            ))}
          </div>
        </div>
      )}
      {eff.endMin < toMin('12:00') && <div className="tiny faint">这天需要较早出发去机场/车站，可安排的时间比较少。</div>}
    </div>
  )
}
