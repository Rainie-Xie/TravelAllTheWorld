import { useState } from 'react'
import { ArrowUp, ArrowDown, Lock, Unlock, X, Wand2, Sparkles, Navigation, RotateCcw, AlertTriangle, Settings2, Loader2, ExternalLink, Plus } from 'lucide-react'
import { Seg, Empty } from '../components/ui'
import { MODES, PLACE_TYPES, placesForDay, refOptions, effectiveDay, getDayPlan } from '../lib/trip'
import { fromMin, fmtDur, fmtDist, toMin } from '../lib/time'
import { gmDirectionLinks, haversine, searchNearbyFood, gmNearbyFoodUrl } from '../lib/geo'
import { uid } from '../lib/util'

const hhmm = (m) => fromMin(Math.max(0, Math.min(m, 1439))).slice(0, 5)

const MEALS = [
  { key: 'lunch', label: '午饭', emoji: '🍜', target: 12 * 60 + 15, from: 11 * 60, to: 14 * 60 + 30, open: '11:30', close: '15:00' },
  { key: 'dinner', label: '晚饭', emoji: '🍲', target: 18 * 60 + 30, from: 17 * 60, to: 20 * 60 + 30, open: '17:30', close: '21:30' },
]

// Where in the day do lunch / dinner fall, and is a meal already planned there?
function mealSlots(ordered, stepOf) {
  const slots = []
  const timed = ordered.map((p, i) => ({ p, i, s: stepOf[p.id] })).filter((x) => x.s)
  if (!timed.length) return slots
  const first = timed[0].s.arrive, last = timed[timed.length - 1].s.depart
  for (const m of MEALS) {
    if (first > m.to || last < m.from) continue
    // a meal is covered if something was added from this meal card, or a restaurant falls in the window
    const hasMeal = ordered.some((p) => p.mealKey === m.key) || timed.some((x) => x.p.type === 'food' && x.s.arrive < m.to && x.s.depart > m.from)
    if (hasMeal) continue
    // anchor = the stop you're at (or just left) around meal time
    let best = timed[0], bd = Infinity
    for (const x of timed) {
      const d = m.target < x.s.arrive ? x.s.arrive - m.target : m.target > x.s.depart ? m.target - x.s.depart : 0
      if (d < bd) { bd = d; best = x }
    }
    const at = Math.min(Math.max(m.target, best.s.arrive), best.s.depart)
    slots.push({ ...m, after: best.i, anchor: best.p, at: Math.max(m.from, Math.min(at, m.to)) })
  }
  return slots
}

function MealCard({ meal, city, date, onAddExisting, onAddNew }) {
  const [list, setList] = useState(null)
  const [loading, setLoading] = useState(false)
  const anchor = meal.anchor
  const saved = city.places
    .filter((p) => (p.type === 'food' || p.type === 'cafe') && p.day !== date)
    .map((p) => ({ p, d: haversine(p, anchor) }))
    .filter((x) => x.d < 1500)
    .sort((a, b) => a.d - b.d)
    .slice(0, 4)
  const load = async () => {
    setLoading(true)
    try { setList(await searchNearbyFood(anchor)) } catch { setList([]) }
    setLoading(false)
  }
  return (
    <div className="card sun" style={{ padding: '10px 12px', margin: '2px 0 12px' }}>
      <div className="bold small">{meal.emoji} {meal.label}时间 · 约 {fromMin(meal.at)} 在「{anchor.name}」附近</div>
      {saved.length > 0 && (
        <div className="mt-s">
          <div className="tiny muted mb-s">你收藏的附近美食：</div>
          <div className="row wrap" style={{ gap: 6 }}>
            {saved.map(({ p, d }) => (
              <button key={p.id} className="chip btnlike green" style={{ height: 30 }} onClick={() => onAddExisting(p, meal)}>
                + {PLACE_TYPES[p.type]?.emoji} {p.name} · {fmtDist(d)}
              </button>
            ))}
          </div>
        </div>
      )}
      {list && (
        <div className="list mt-s" style={{ borderColor: 'var(--yellow-100)' }}>
          {list.map((r) => (
            <div key={r.name} className="list-item" style={{ padding: '8px 10px', gap: 8 }}>
              <div className="grow" style={{ minWidth: 0 }}>
                <div className="small bold ellipsis">{r.name}</div>
                <div className="tiny faint">{[r.cuisine, fmtDist(r.dist)].filter(Boolean).join(' · ')}</div>
              </div>
              <button className="btn btn-primary btn-sm" style={{ flex: 'none', padding: '0 10px' }} aria-label={`加入${r.name}`} onClick={() => onAddNew(r, meal)}><Plus size={14} /></button>
            </div>
          ))}
          {!list.length && <div className="list-item tiny muted">地图数据里附近没有收录餐厅，看看 Google Maps 吧</div>}
        </div>
      )}
      <div className="row wrap mt-s" style={{ gap: 6 }}>
        {!list && (
          <button className="btn btn-sm" onClick={load} disabled={loading}>{loading ? <Loader2 size={14} className="spin" /> : '🔎'} 附近有什么吃的</button>
        )}
        <a className="btn btn-sm btn-ghost" href={gmNearbyFoodUrl(anchor)} target="_blank" rel="noreferrer"><ExternalLink size={13} />Google Maps 看评分</a>
      </div>
    </div>
  )
}

export default function DayPlanner({ trip, city, date, plan, settings, mutCity, onOptimize, onDistribute, onEdit, busy }) {
  const [showSettings, setShowSettings] = useState(false)
  if (!date) return <Empty emoji="📅" title="这个城市还没有日期" sub="先在编辑旅行里设置住几晚" />
  const list = placesForDay(city, date)
  const unassigned = city.places.filter((p) => !p.day && p.type !== 'hotel' && p.type !== 'transit')
  const dp = getDayPlan(city, date)
  const eff = effectiveDay(trip, city, date, settings)
  const opts = refOptions(trip, city)
  const locked = dp.locked || {}

  // show places in the computed order (auto mode re-sorts them)
  const fresh = plan && plan.date === date
  const ordered = fresh && plan.order?.length
    ? [...plan.order.map((id) => list.find((p) => p.id === id) || plan.pseudo?.[id]).filter(Boolean), ...list.filter((p) => !plan.order.includes(p.id))]
    : list

  const setDP = (patch) => mutCity((c) => {
    c.dayPlans = c.dayPlans || {}
    c.dayPlans[date] = { ...(c.dayPlans[date] || {}), ...patch }
  })
  const move = (i, d) => {
    const ids = ordered.filter((p) => !p.bags).map((p) => p.id)
    i -= ordered.findIndex((p) => !p.bags) // pseudo stop sits in front
    const j = i + d
    if (j < 0 || j >= ids.length) return
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
    setDP({ order: ids, manual: true })
  }
  // lock = keep at its current (displayed) position
  const toggleLock = (id) => setDP({ locked: { ...locked, [id]: !locked[id] }, order: ordered.map((p) => p.id) })
  const removeFromDay = (id) => mutCity((c) => { c.places.find((p) => p.id === id).day = null })
  const addToDay = (id) => mutCity((c) => { c.places.find((p) => p.id === id).day = date })

  const addMealExisting = (p, meal) => mutCity((c) => {
    const x = c.places.find((y) => y.id === p.id)
    x.day = date
    x.mealKey = meal.key
    if (!x.open && !x.close) { x.open = meal.open; x.close = meal.close }
  })
  const addMealNew = (r, meal) => mutCity((c) => {
    c.places.push({ id: uid(), name: r.name, lat: r.lat, lng: r.lng, type: 'food', priority: 'must', stay: 60, day: date, mealKey: meal.key, open: meal.open, close: meal.close, note: r.cuisine || '', address: r.address || '' })
  })

  const steps = fresh ? plan?.tl?.steps || [] : []
  const stepOf = Object.fromEntries(steps.map((s) => [s.id, s]))
  const start = fresh ? plan?.start : null
  const end = fresh ? plan?.end : null
  const navPoints = [start, ...steps.map((s) => list.find((p) => p.id === s.id) || plan?.pseudo?.[s.id]), end].filter(Boolean)
  const links = gmDirectionLinks(navPoints, eff.mode)
  const mode = MODES[eff.mode]
  const custom = dp.startTime || dp.endTime || dp.startRef !== undefined || dp.endRef !== undefined || dp.mode || dp.dropBags === false
  const meals = fresh ? mealSlots(ordered, stepOf) : []
  const label = (ref) => opts.find((o) => o.ref === ref)?.label || null

  return (
    <div className="stack">
      {eff.def.notes.length > 0 && (
        <div className="card warn small stack-s">
          {eff.def.notes.map((n) => <div key={n} className="row"><AlertTriangle size={14} />{n}</div>)}
        </div>
      )}

      {/* one-line summary of the day's settings; tap to change */}
      <div className="card" style={{ padding: '10px 12px' }}>
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <div className="grow small" style={{ lineHeight: 1.7 }}>
            <b className="time-tag">{fromMin(eff.startMin)}</b> 从 {label(eff.startRef) || '第一个地点'} 出发{eff.dropBags ? ' → 先去酒店放行李' : ''} · {mode.emoji}{mode.label}
            <br />
            <span className="muted">{eff.endRef ? `回到 ${label(eff.endRef)}` : '自由结束'}，最晚 {fromMin(eff.endMin)}</span>
          </div>
          <button className="btn btn-sm" style={{ flex: 'none' }} onClick={() => setShowSettings((v) => !v)}><Settings2 size={14} />{showSettings ? '收起' : '调整'}</button>
        </div>
        {showSettings && (
          <div className="stack-s mt">
            <div className="grid-2">
              <div className="field">
                <label>出发时间</label>
                <input className="input sm" type="time" value={hhmm(eff.startMin)} onChange={(e) => e.target.value && setDP({ startTime: e.target.value })} />
              </div>
              <div className="field">
                <label>最晚结束</label>
                <input className="input sm" type="time" value={hhmm(eff.endMin)} onChange={(e) => e.target.value && setDP({ endTime: e.target.value })} />
              </div>
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
            <div className="field">
              <label>怎么走</label>
              <Seg value={eff.mode} onChange={(v) => setDP({ mode: v })} options={Object.entries(MODES).map(([k, v]) => ({ value: k, label: `${v.emoji} ${v.label}` }))} />
              <div className="tiny faint">步行模式下，超过 2.5 公里的路段会自动按打车计算。</div>
            </div>
            {eff.def.dropBags && (
              <label className="row small" style={{ cursor: 'pointer' }}>
                <input type="checkbox" checked={!!eff.dropBags} onChange={(e) => setDP({ dropBags: e.target.checked ? undefined : false })} />
                到达后先去「{eff.def.dropBags.name}」放行李
              </label>
            )}
            {custom && <button className="btn btn-ghost btn-sm" onClick={() => setDP({ startTime: undefined, endTime: undefined, startRef: undefined, endRef: undefined, mode: undefined, dropBags: undefined })}><RotateCcw size={13} />恢复默认</button>}
            {!opts.length && <div className="tiny faint">💡 在「地点清单」里添加酒店后，就能从酒店出发、回到酒店。</div>}
          </div>
        )}
      </div>

      {/* timeline */}
      {list.length === 0 ? (
        <div className="card flat">
          <Empty emoji="🧭" title="这天还没有安排地点" sub={unassigned.length ? '从下面「未安排」里点选，或在地图上点灰色的 + 标记' : '先到「地点清单」里添加想去的地方'}
            action={unassigned.length > 1 && <button className="btn btn-soft btn-sm" disabled={busy} onClick={onDistribute}><Sparkles size={14} />一键把所有地点分到每天</button>} />
        </div>
      ) : (
        <div className="card">
          <div className="row-between mb-s">
            {dp.manual ? (
              <>
                <span className="tiny muted">✋ 手动顺序</span>
                <button className="btn btn-soft btn-sm" disabled={busy} onClick={onOptimize}><Wand2 size={14} />恢复智能排序</button>
              </>
            ) : (
              <span className="tiny" style={{ color: 'var(--green-700)' }}>✓ 已自动排成最顺的路线（不走回头路）</span>
            )}
          </div>
          <div className="tl">
            <div className="tl-item">
              <div className="tl-dot home">🏠</div>
              <div className="row-between">
                <div className="bold ellipsis grow">{start?.name || '起点'}</div>
                <span className="time-tag">{fromMin(eff.startMin)} 出发</span>
              </div>
            </div>
            {ordered.map((p, i) => {
              const s = stepOf[p.id]
              const mealsHere = meals.filter((m) => m.after === i)
              return (
                <div key={p.id}>
                  {s && (
                    <div className="tl-leg">{s.taxi ? '🚕 打车' : mode.emoji} {fmtDur(s.travel)}{s.dist ? ` · ${fmtDist(s.dist)}` : ''}{s.wait > 1 ? ` · 等开门 ${fmtDur(s.wait)}` : ''}</div>
                  )}
                  {p.bags ? (
                  <div className="tl-item">
                    <div className="tl-dot home">🧳</div>
                    <div className="row-between">
                      <div className="grow" style={{ minWidth: 0 }}>
                        <div className="bold ellipsis">🏨 {p.name}</div>
                        <div className="tiny muted">先去酒店放行李 / 办入住{s ? ` · ${fromMin(s.arrive)}–${fromMin(s.depart)}` : ''}</div>
                      </div>
                    </div>
                  </div>
                  ) : (
                  <div className="tl-item">
                    <div className={`tl-dot ${s?.late ? 'warn' : ''}`}>{i + 1 - (ordered[0]?.bags ? 1 : 0)}</div>
                    <div className="row" style={{ gap: 4, alignItems: 'flex-start' }}>
                      <div className="grow" style={{ minWidth: 0, cursor: 'pointer' }} onClick={() => onEdit(p)}>
                        <div className="bold ellipsis">{PLACE_TYPES[p.type]?.emoji} {p.name}</div>
                        <div className="row wrap tiny muted" style={{ gap: 6 }}>
                          {s && <span className="time-tag" style={{ fontSize: 12 }}>{fromMin(s.arrive)}–{fromMin(s.depart)}</span>}
                          <span>停留 {fmtDur(p.stay || 60)}</span>
                          {p.priority === 'optional' && <span>· 有空再去</span>}
                          {s?.late && <span className="chip red" style={{ height: 20 }}>可能已关门（{p.close}）</span>}
                        </div>
                      </div>
                      <div className="row" style={{ gap: 0, flex: 'none' }}>
                        <button className="icon-btn sm plain" aria-label="上移" disabled={i === 0 || ordered[i - 1]?.bags} onClick={() => move(i, -1)}><ArrowUp size={15} /></button>
                        <button className="icon-btn sm plain" aria-label="下移" disabled={i === ordered.length - 1} onClick={() => move(i, 1)}><ArrowDown size={15} /></button>
                        <button className="icon-btn sm plain" aria-label={locked[p.id] ? '解锁位置' : '锁定位置'} onClick={() => toggleLock(p.id)} title="锁定后排序不会移动它">
                          {locked[p.id] ? <Lock size={15} color="var(--yellow-700)" /> : <Unlock size={15} color="var(--ink-3)" />}
                        </button>
                        <button className="icon-btn sm plain" aria-label="移出这天" onClick={() => removeFromDay(p.id)}><X size={15} /></button>
                      </div>
                    </div>
                  </div>
                  )}
                  {mealsHere.map((m) => <MealCard key={m.key} meal={m} city={city} date={date} onAddExisting={addMealExisting} onAddNew={addMealNew} />)}
                </div>
              )
            })}
            {end && fresh && plan?.tl && (
              <>
                <div className="tl-leg">{plan.tl.endTaxi ? '🚕 打车' : mode.emoji} {fmtDur(plan.tl.endTravel)}{plan.tl.endDist ? ` · ${fmtDist(plan.tl.endDist)}` : ''}</div>
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
          {fresh && plan?.tl && (
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
          <div className="row-between mb-s">
            <span className="label">未安排的地点（点击加入这天）</span>
            {list.length > 0 && unassigned.length > 1 && <button className="btn btn-ghost btn-sm" disabled={busy} onClick={onDistribute}><Sparkles size={13} />全部分到每天</button>}
          </div>
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
