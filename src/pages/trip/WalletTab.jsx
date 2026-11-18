import { useEffect, useMemo, useState } from 'react'
import { ArrowLeftRight, Plus, Loader2, Pencil, Wallet } from 'lucide-react'
import { useStore } from '../../store'
import { Sheet, Field, Empty, useToast, Progress } from '../../components/ui'
import { currencyOf, CURRENCY_NAMES } from '../../data/countries'
import { fetchRates, convert, fmtMoney } from '../../lib/extras'
import { fmtDate, todayStr, daysBetween } from '../../lib/time'
import { uid } from '../../lib/util'

const CATS = [
  ['food', '🍜', '餐饮'], ['transport', '🚕', '交通'], ['ticket', '🎟️', '门票'], ['shopping', '🛍️', '购物'],
  ['hotel', '🏨', '住宿'], ['other', '✨', '其他'],
]
const CAT = Object.fromEntries(CATS.map(([k, e, l]) => [k, { e, l }]))

function useRates() {
  const rates = useStore((s) => s.rates)
  const setRates = useStore((s) => s.setRates)
  const [err, setErr] = useState('')
  useEffect(() => {
    if (rates && Date.now() - rates.at < 12 * 3600 * 1000) return
    fetchRates().then(setRates).catch(() => setErr(rates ? '汇率暂时无法更新，使用上次的数据' : '汇率获取失败，请联网后重试'))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return { rates, err }
}

const num = (v) => v.replace(/[^\d.]/g, '')
const pretty = (v, cur) => fmtMoney(+v || 0, cur)

export default function WalletTab({ trip }) {
  const settings = useStore((s) => s.settings)
  const updateTrip = useStore((s) => s.updateTrip)
  const toast = useToast()
  const { rates, err } = useRates()
  const home = settings.homeCurrency
  const local = useMemo(() => [...new Set(trip.cities.map((c) => currencyOf(c.countryCode)))].filter((c) => c !== home), [trip.cities, home])
  const allCur = [...new Set([...local, home, 'USD', 'EUR', ...Object.keys(CURRENCY_NAMES)])]
  const today = todayStr()
  const inTrip = trip.startDate <= today && today <= trip.endDate

  const budget = trip.budget // { amount, currency }
  const bCur = budget?.currency || local[0] || home
  const [editBudget, setEditBudget] = useState(!budget)
  const [bAmt, setBAmt] = useState(budget ? String(budget.amount) : '')
  const [bCurSel, setBCurSel] = useState(bCur)

  // quick add
  const [qAmt, setQAmt] = useState('')
  const [qCur, setQCur] = useState(local[0] || home)
  const [qCat, setQCat] = useState('food')
  const [qNote, setQNote] = useState('')

  const [editing, setEditing] = useState(null)
  const [conv, setConv] = useState({ amt: '100000', from: local[0] || 'USD', to: home })

  const expenses = trip.expenses || []
  const toCur = (e, cur) => (e.currency === cur ? +e.amount : convert(+e.amount, e.currency, cur, rates))
  const spentIn = (cur) => expenses.reduce((s, e) => s + (toCur(e, cur) || 0), 0)
  const spentB = spentIn(bCur)
  const remain = budget ? budget.amount - spentB : null
  const daysLeft = trip.endDate ? Math.max(1, daysBetween(inTrip ? today : trip.startDate, trip.endDate) + 1) : null
  const totalHome = spentIn(home)
  const byCat = CATS.map(([k]) => [k, expenses.filter((e) => e.category === k).reduce((s, e) => s + (toCur(e, home) || 0), 0)]).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])
  const byDate = [...new Set(expenses.map((e) => e.date))].sort().reverse()

  const saveBudget = () => {
    if (!+bAmt) return
    updateTrip(trip.id, (d) => { d.budget = { amount: +bAmt, currency: bCurSel } })
    setEditBudget(false)
    toast('已设置，之后每记一笔都会自动扣除')
  }
  const quickAdd = () => {
    if (!+qAmt) return
    const e = { id: uid(), amount: +qAmt, currency: qCur, category: qCat, note: qNote.trim(), date: inTrip ? today : trip.startDate }
    updateTrip(trip.id, (d) => { d.expenses = [...(d.expenses || []), e] })
    setQAmt(''); setQNote('')
    toast(budget ? `已记账，还剩 ${pretty(remain - (toCur(e, bCur) || 0), bCur)} ${bCur}` : '已记一笔')
  }
  const saveExp = (e) => {
    updateTrip(trip.id, (d) => { d.expenses = (d.expenses || []).map((x) => (x.id === e.id ? { ...e, amount: +e.amount } : x)) })
    setEditing(null)
  }

  return (
    <div className="stack">
      {/* ---------- 我带的钱 ---------- */}
      <div className="card sun">
        {editBudget ? (
          <>
            <div className="row bold mb-s"><Wallet size={18} />这趟带了多少钱？</div>
            <div className="small muted mb-s">填一个总预算（现金+要刷卡的都算），之后记的每一笔都会自动扣掉。</div>
            <div className="row">
              <input className="input grow" inputMode="decimal" placeholder="例如 15000000" value={bAmt} onChange={(e) => setBAmt(num(e.target.value))} aria-label="预算金额" />
              <select className="select" style={{ width: 104, flex: 'none' }} value={bCurSel} onChange={(e) => setBCurSel(e.target.value)} aria-label="币种">
                {allCur.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            {+bAmt > 0 && bCurSel !== home && rates && <div className="tiny muted mt-s">≈ {pretty(convert(+bAmt, bCurSel, home, rates), home)} {home}</div>}
            <div className="row mt">
              {budget && <button className="btn grow" onClick={() => setEditBudget(false)}>取消</button>}
              <button className="btn btn-primary grow" disabled={!+bAmt} onClick={saveBudget}>确定</button>
            </div>
          </>
        ) : (
          <>
            <div className="row-between">
              <div className="small muted">还剩</div>
              <button className="btn btn-ghost btn-sm" style={{ height: 26 }} onClick={() => { setBAmt(String(budget.amount)); setBCurSel(bCur); setEditBudget(true) }}><Pencil size={13} />改预算</button>
            </div>
            <div className="temp" style={{ fontSize: 34, color: remain < 0 ? 'var(--red-500)' : 'var(--green-700)', lineHeight: 1.15 }}>
              {pretty(remain, bCur)} <span className="small muted">{bCur}</span>
            </div>
            {bCur !== home && rates && <div className="small muted">≈ {pretty(convert(remain, bCur, home, rates), home)} {home}</div>}
            <div className="mt-s"><Progress value={Math.max(0, Math.min(1, remain / budget.amount))} /></div>
            <div className="row-between tiny muted mt-s">
              <span>已花 {pretty(spentB, bCur)} / {pretty(budget.amount, bCur)}</span>
              {daysLeft && remain > 0 && <span>剩 {daysLeft} 天 · 每天约 <b>{pretty(remain / daysLeft, bCur)}</b></span>}
            </div>
            {remain < 0 && <div className="small mt-s" style={{ color: 'var(--red-500)' }}>⚠️ 已经超支 {pretty(-remain, bCur)} {bCur}</div>}
          </>
        )}
      </div>

      {/* ---------- 快速记账 ---------- */}
      <div className="card">
        <div className="bold mb-s">✍️ 记一笔</div>
        <form className="row" onSubmit={(e) => { e.preventDefault(); quickAdd() }}>
          <input className="input grow" inputMode="decimal" placeholder="金额" value={qAmt} onChange={(e) => setQAmt(num(e.target.value))} aria-label="金额" />
          <select className="select" style={{ width: 92, flex: 'none' }} value={qCur} onChange={(e) => setQCur(e.target.value)} aria-label="币种">
            {allCur.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <button className="btn btn-primary" style={{ flex: 'none' }} type="submit" disabled={!+qAmt} aria-label="记账"><Plus size={18} /></button>
        </form>
        <div className="chip-scroll mt-s">
          {CATS.map(([k, e, l]) => <button key={k} type="button" className={`chip btnlike ${qCat === k ? 'on' : ''}`} style={{ height: 32 }} onClick={() => setQCat(k)}>{e} {l}</button>)}
        </div>
        <input className="input sm mt-s" placeholder="备注（可不填），如：牛肉粉" value={qNote} onChange={(e) => setQNote(e.target.value)} />
        {+qAmt > 0 && qCur !== home && rates && <div className="tiny muted mt-s">≈ {pretty(convert(+qAmt, qCur, home, rates), home)} {home}</div>}
      </div>

      {/* ---------- 统计 + 明细 ---------- */}
      {expenses.length > 0 && (
        <div className="card flat">
          <div className="row-between mb-s">
            <span className="small muted">共花费（折合 {CURRENCY_NAMES[home] || home}）</span>
            <span className="temp" style={{ fontSize: 20 }}>{pretty(totalHome, home)}</span>
          </div>
          <div className="stack-s">
            {byCat.map(([k, v]) => (
              <div key={k} className="row small">
                <span style={{ width: 64, flex: 'none' }}>{CAT[k].e} {CAT[k].l}</span>
                <div className="grow progress" style={{ height: 8 }}><div style={{ width: `${(v / totalHome) * 100}%` }} /></div>
                <span style={{ width: 76, flex: 'none', textAlign: 'right' }} className="temp">{pretty(v, home)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {!expenses.length && <div className="small muted center">还没有记账，旅途中随手记，会自动按汇率折算。</div>}
      {byDate.map((date) => (
        <div key={date}>
          <div className="label mb-s">{fmtDate(date)}</div>
          <div className="list">
            {expenses.filter((e) => e.date === date).map((e) => (
              <div key={e.id} className="list-item click" onClick={() => setEditing({ ...e, amount: String(e.amount) })}>
                <div className="emoji-badge sm">{CAT[e.category]?.e}</div>
                <div className="grow" style={{ minWidth: 0 }}><div className="ellipsis">{e.note || CAT[e.category]?.l}</div></div>
                <div style={{ textAlign: 'right' }}>
                  <div className="temp">{pretty(e.amount, e.currency)} <span className="tiny faint">{e.currency}</span></div>
                  {e.currency !== home && <div className="tiny faint">≈ {pretty(toCur(e, home), home)} {home}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* ---------- 汇率换算 ---------- */}
      <div className="card flat">
        <div className="row-between mb-s">
          <div className="bold">💱 汇率换算</div>
          {rates ? <span className="tiny faint">更新于 {new Date(rates.at).toLocaleDateString('zh-CN')}</span> : <Loader2 size={14} className="spin" />}
        </div>
        <div className="row">
          <input className="input grow" inputMode="decimal" value={conv.amt} onChange={(e) => setConv({ ...conv, amt: num(e.target.value) })} aria-label="换算金额" />
          <select className="select" style={{ width: 92, flex: 'none' }} value={conv.from} onChange={(e) => setConv({ ...conv, from: e.target.value })} aria-label="从">
            {allCur.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="row mt-s">
          <button className="icon-btn" aria-label="交换" onClick={() => setConv({ ...conv, from: conv.to, to: conv.from })}><ArrowLeftRight size={16} /></button>
          <div className="grow temp" style={{ fontSize: 24, color: 'var(--green-700)' }}>{fmtMoney(convert(+conv.amt || 0, conv.from, conv.to, rates), conv.to)}</div>
          <select className="select" style={{ width: 92, flex: 'none' }} value={conv.to} onChange={(e) => setConv({ ...conv, to: e.target.value })} aria-label="到">
            {allCur.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        {err && <div className="tiny mt-s" style={{ color: 'var(--red-500)' }}>{err}</div>}
      </div>

      {editing && (
        <Sheet open onClose={() => setEditing(null)} title="编辑这笔" footer={<>
          <button className="btn btn-danger" onClick={() => { updateTrip(trip.id, (d) => { d.expenses = d.expenses.filter((x) => x.id !== editing.id) }); setEditing(null) }}>删除</button>
          <button className="btn btn-primary grow" disabled={!+editing.amount} onClick={() => saveExp(editing)}>保存</button>
        </>}>
          <div className="stack">
            <div className="row">
              <input className="input grow" inputMode="decimal" value={editing.amount} onChange={(e) => setEditing({ ...editing, amount: num(e.target.value) })} aria-label="金额" />
              <select className="select" style={{ width: 92, flex: 'none' }} value={editing.currency} onChange={(e) => setEditing({ ...editing, currency: e.target.value })} aria-label="币种">
                {allCur.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="row wrap" style={{ gap: 8 }}>
              {CATS.map(([k, e, l]) => <button key={k} className={`chip btnlike ${editing.category === k ? 'on' : ''}`} style={{ height: 34 }} onClick={() => setEditing({ ...editing, category: k })}>{e} {l}</button>)}
            </div>
            <Field label="日期"><input className="input" type="date" value={editing.date} onChange={(e) => setEditing({ ...editing, date: e.target.value })} /></Field>
            <Field label="备注"><input className="input" value={editing.note} onChange={(e) => setEditing({ ...editing, note: e.target.value })} /></Field>
          </div>
        </Sheet>
      )}
    </div>
  )
}
