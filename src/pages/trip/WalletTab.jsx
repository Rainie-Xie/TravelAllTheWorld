import { useEffect, useMemo, useState } from 'react'
import { ArrowLeftRight, Plus, Loader2 } from 'lucide-react'
import { useStore } from '../../store'
import { Sheet, Field, Empty, useToast } from '../../components/ui'
import { currencyOf, CURRENCY_NAMES } from '../../data/countries'
import { fetchRates, convert, fmtMoney } from '../../lib/extras'
import { fmtDate, todayStr } from '../../lib/time'
import { uid } from '../../lib/util'

const CATS = [
  ['food', '🍜', '餐饮'], ['transport', '🚕', '交通'], ['hotel', '🏨', '住宿'], ['ticket', '🎟️', '门票'],
  ['shopping', '🛍️', '购物'], ['other', '✨', '其他'],
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

export default function WalletTab({ trip }) {
  const settings = useStore((s) => s.settings)
  const updateTrip = useStore((s) => s.updateTrip)
  const toast = useToast()
  const { rates, err } = useRates()
  const home = settings.homeCurrency
  const local = useMemo(() => [...new Set(trip.cities.map((c) => currencyOf(c.countryCode)))].filter((c) => c !== home), [trip.cities, home])
  const [from, setFrom] = useState(local[0] || 'USD')
  const [to, setTo] = useState(home)
  const [amt, setAmt] = useState('100000')
  const [adding, setAdding] = useState(null)

  const allCur = [...new Set([home, ...local, 'USD', 'EUR', ...Object.keys(CURRENCY_NAMES)])]
  const result = convert(+amt || 0, from, to, rates)
  const expenses = trip.expenses || []
  const toHome = (e) => (e.currency === home ? +e.amount : convert(+e.amount, e.currency, home, rates))
  const total = expenses.reduce((s, e) => s + (toHome(e) || 0), 0)
  const byCat = CATS.map(([k]) => [k, expenses.filter((e) => e.category === k).reduce((s, e) => s + (toHome(e) || 0), 0)]).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])
  const byDate = [...new Set(expenses.map((e) => e.date))].sort().reverse()

  const quick = local[0] && rates ? [1, 10, 50, 100, 500].map((n) => {
    const base = from === local[0] ? 1 : 1
    const unit = ['VND', 'IDR', 'KRW', 'LAK', 'KHR'].includes(local[0]) ? 1000 : ['JPY', 'THB', 'TWD', 'PHP', 'INR'].includes(local[0]) ? 10 : 1
    const v = n * unit * base
    return [v, convert(v, local[0], home, rates)]
  }) : []

  const saveExp = (e) => {
    updateTrip(trip.id, (d) => {
      d.expenses = d.expenses || []
      const i = d.expenses.findIndex((x) => x.id === e.id)
      if (i >= 0) d.expenses[i] = e
      else d.expenses.push({ ...e, id: uid() })
    })
    setAdding(null)
    toast('已记一笔')
  }

  return (
    <div className="stack">
      <div className="card">
        <div className="row-between mb-s">
          <div className="bold">💱 汇率换算</div>
          {rates ? <span className="tiny faint">更新于 {new Date(rates.at).toLocaleDateString('zh-CN')}</span> : <Loader2 size={14} className="spin" />}
        </div>
        <div className="row">
          <input className="input grow" inputMode="decimal" value={amt} onChange={(e) => setAmt(e.target.value.replace(/[^\d.]/g, ''))} aria-label="金额" />
          <select className="select" style={{ width: 110 }} value={from} onChange={(e) => setFrom(e.target.value)} aria-label="从">
            {allCur.map((c) => <option key={c} value={c}>{c} {CURRENCY_NAMES[c] || ''}</option>)}
          </select>
        </div>
        <div className="row mt-s">
          <button className="icon-btn" aria-label="交换" onClick={() => { setFrom(to); setTo(from) }}><ArrowLeftRight size={16} /></button>
          <div className="grow temp" style={{ fontSize: 26, color: 'var(--green-700)' }}>{fmtMoney(result, to)}</div>
          <select className="select" style={{ width: 110 }} value={to} onChange={(e) => setTo(e.target.value)} aria-label="到">
            {allCur.map((c) => <option key={c} value={c}>{c} {CURRENCY_NAMES[c] || ''}</option>)}
          </select>
        </div>
        {quick.length > 0 && (
          <div className="row wrap mt" style={{ gap: 6 }}>
            {quick.map(([v, h]) => <span key={v} className="chip">{fmtMoney(v, local[0])} {local[0]} ≈ {fmtMoney(h, home)} {home}</span>)}
          </div>
        )}
        {err && <div className="tiny mt-s" style={{ color: 'var(--red-500)' }}>{err}</div>}
      </div>

      <div className="card sun">
        <div className="row-between">
          <div>
            <div className="small muted">旅途总花费（折合 {CURRENCY_NAMES[home] || home}）</div>
            <div className="temp" style={{ fontSize: 30 }}>{fmtMoney(total, home)}</div>
          </div>
          <button className="btn btn-primary" onClick={() => setAdding({ amount: '', currency: local[0] || home, category: 'food', date: trip.startDate <= todayStr() && todayStr() <= trip.endDate ? todayStr() : trip.startDate, note: '' })}><Plus size={17} />记一笔</button>
        </div>
        {byCat.length > 0 && (
          <div className="stack-s mt">
            {byCat.map(([k, v]) => (
              <div key={k} className="row small">
                <span style={{ width: 64 }}>{CAT[k].e} {CAT[k].l}</span>
                <div className="grow progress" style={{ height: 8 }}><div style={{ width: `${(v / total) * 100}%` }} /></div>
                <span style={{ width: 80, textAlign: 'right' }} className="temp">{fmtMoney(v, home)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {!expenses.length && <Empty emoji="🧾" title="还没有记账" sub="旅途中随手记，自动按汇率折算成人民币" />}
      {byDate.map((date) => (
        <div key={date}>
          <div className="label mb-s">{fmtDate(date)}</div>
          <div className="list">
            {expenses.filter((e) => e.date === date).map((e) => (
              <div key={e.id} className="list-item click" onClick={() => setAdding(e)}>
                <div className="emoji-badge sm">{CAT[e.category]?.e}</div>
                <div className="grow" style={{ minWidth: 0 }}><div className="ellipsis">{e.note || CAT[e.category]?.l}</div></div>
                <div style={{ textAlign: 'right' }}>
                  <div className="temp">{fmtMoney(+e.amount, e.currency)} <span className="tiny faint">{e.currency}</span></div>
                  {e.currency !== home && <div className="tiny faint">≈ {fmtMoney(toHome(e), home)} {home}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {adding && (
        <Sheet open onClose={() => setAdding(null)} title={adding.id ? '编辑花费' : '记一笔'} footer={<>
          {adding.id && <button className="btn btn-danger" onClick={() => { updateTrip(trip.id, (d) => { d.expenses = d.expenses.filter((x) => x.id !== adding.id) }); setAdding(null) }}>删除</button>}
          <button className="btn btn-primary grow" disabled={!+adding.amount} onClick={() => saveExp(adding)}>保存</button>
        </>}>
          <div className="stack">
            <div className="row">
              <input className="input grow" inputMode="decimal" placeholder="金额" autoFocus value={adding.amount} onChange={(e) => setAdding({ ...adding, amount: e.target.value.replace(/[^\d.]/g, '') })} />
              <select className="select" style={{ width: 110 }} value={adding.currency} onChange={(e) => setAdding({ ...adding, currency: e.target.value })} aria-label="币种">
                {allCur.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            {adding.currency !== home && +adding.amount > 0 && <div className="small muted">≈ {fmtMoney(convert(+adding.amount, adding.currency, home, rates), home)} {home}</div>}
            <div className="row wrap" style={{ gap: 8 }}>
              {CATS.map(([k, e, l]) => <button key={k} className={`chip btnlike ${adding.category === k ? 'on' : ''}`} style={{ height: 34 }} onClick={() => setAdding({ ...adding, category: k })}>{e} {l}</button>)}
            </div>
            <Field label="日期"><input className="input" type="date" value={adding.date} onChange={(e) => setAdding({ ...adding, date: e.target.value })} /></Field>
            <Field label="备注"><input className="input" value={adding.note} onChange={(e) => setAdding({ ...adding, note: e.target.value })} placeholder="例如：牛肉粉" /></Field>
          </div>
        </Sheet>
      )}
    </div>
  )
}
