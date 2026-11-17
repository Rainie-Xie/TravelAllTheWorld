import { useMemo, useState } from 'react'
import { Search, Loader2, MapPin, Link2 } from 'lucide-react'
import { Sheet } from './ui'
import { ALL_COUNTRIES, POPULAR, countryName, flag } from '../data/countries'
import { POPULAR_CITIES } from '../data/cities'
import { searchCities, searchPlaces, parseMapLink, haversine } from '../lib/geo'
import { fmtDist } from '../lib/time'
import { PLACE_TYPES } from '../lib/trip'
import { sleep } from '../lib/util'

export function CountryPicker({ open, onClose, onPick }) {
  const [q, setQ] = useState('')
  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return null
    return ALL_COUNTRIES.filter((c) => c.name.includes(q.trim()) || c.en.toLowerCase().includes(s) || c.code.toLowerCase() === s)
  }, [q])
  const pick = (code) => { onPick(code); setQ(''); onClose() }
  return (
    <Sheet open={open} onClose={onClose} title="选择国家 / 地区">
      <div className="search-box mb">
        <Search size={18} />
        <input className="input" placeholder="搜索国家，如 越南 / Japan" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
      </div>
      {!list && (
        <>
          <div className="label mb-s">热门目的地</div>
          <div className="row wrap mb" style={{ gap: 8 }}>
            {POPULAR.map((c) => (
              <button key={c} className="chip btnlike" style={{ height: 34, fontSize: 14 }} onClick={() => pick(c)}>
                <span className="flag">{flag(c)}</span> {countryName(c)}
              </button>
            ))}
          </div>
          <div className="label mb-s">全部</div>
        </>
      )}
      <div className="list">
        {(list || ALL_COUNTRIES).map((c) => (
          <div key={c.code} className="list-item click" onClick={() => pick(c.code)}>
            <span className="flag" style={{ fontSize: 22 }}>{flag(c.code)}</span>
            <div className="grow">
              <div>{c.name}</div>
              <div className="tiny faint">{c.en}</div>
            </div>
          </div>
        ))}
        {list && !list.length && <div className="list-item faint">没有找到「{q}」</div>}
      </div>
    </Sheet>
  )
}

export function CityPicker({ open, onClose, countryCode, onPick }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const popular = POPULAR_CITIES[countryCode] || []
  const run = async () => {
    if (!q.trim()) return
    setLoading(true); setErr('')
    try { setResults(await searchCities(q.trim(), countryCode)) } catch (e) { setErr(e.message) }
    setLoading(false)
  }
  const pick = (c) => { onPick({ ...c, countryCode: c.countryCode || countryCode }); setQ(''); setResults(null); onClose() }
  return (
    <Sheet open={open} onClose={onClose} title={`添加城市 · ${flag(countryCode)} ${countryName(countryCode)}`}>
      <form className="row mb" onSubmit={(e) => { e.preventDefault(); run() }}>
        <div className="search-box grow">
          <Search size={18} />
          <input className="input" placeholder="搜索城市（中文/英文）" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <button className="btn btn-primary" type="submit" disabled={loading}>{loading ? <Loader2 size={18} className="spin" /> : '搜索'}</button>
      </form>
      {err && <div className="small" style={{ color: 'var(--red-500)' }}>{err}</div>}
      {results && (
        <div className="list mb">
          {results.map((r, i) => (
            <div key={i} className="list-item click" onClick={() => pick(r)}>
              <MapPin size={18} color="var(--green-600)" />
              <div className="grow">
                <div className="bold">{r.name}</div>
                <div className="tiny faint ellipsis">{r.address}</div>
              </div>
            </div>
          ))}
          {!results.length && <div className="list-item faint">没找到，换个写法试试（如英文名）</div>}
        </div>
      )}
      {popular.length > 0 && (
        <>
          <div className="label mb-s">热门城市</div>
          <div className="row wrap" style={{ gap: 8 }}>
            {popular.map((c) => (
              <button key={c.name} className="chip btnlike" style={{ height: 34, fontSize: 14 }} onClick={() => pick(c)}>{c.name}</button>
            ))}
          </div>
        </>
      )}
    </Sheet>
  )
}

/* ---------------- Place search: single search / paste link / batch paste ---------------- */
export function PlaceAdder({ open, onClose, city, onAdd }) {
  const [tab, setTab] = useState('search')
  const [q, setQ] = useState('')
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [batch, setBatch] = useState('')
  const [batchRes, setBatchRes] = useState(null)
  const [type, setType] = useState('sight')

  const reset = () => { setQ(''); setResults(null); setErr(''); setBatch(''); setBatchRes(null) }
  const close = () => { reset(); onClose() }

  const run = async () => {
    const text = q.trim()
    if (!text) return
    const link = parseMapLink(text)
    if (link) {
      setResults([{ name: link.name || '地图标记', lat: link.lat, lng: link.lng, address: `${link.lat.toFixed(5)}, ${link.lng.toFixed(5)}`, type, fromLink: true, dist: haversine(city, link) }])
      return
    }
    setLoading(true); setErr('')
    try { setResults(await searchPlaces(text, city, city.countryCode)) } catch (e) { setErr(e.message) }
    setLoading(false)
  }

  const runBatch = async () => {
    const names = batch.split(/\n|、|，|,|；|;/).map((s) => s.replace(/^\s*[\d.、)）-]+\s*/, '').trim()).filter(Boolean)
    if (!names.length) return
    setLoading(true)
    const out = names.map((n) => ({ query: n, status: 'pending', options: [], pick: 0 }))
    setBatchRes([...out])
    for (let i = 0; i < names.length; i++) {
      try {
        const r = await searchPlaces(names[i], city, city.countryCode)
        const near = r.filter((x) => x.dist == null || x.dist < 80000)
        out[i] = { ...out[i], status: near.length ? 'ok' : 'none', options: near.slice(0, 4), pick: 0 }
      } catch {
        out[i] = { ...out[i], status: 'none' }
      }
      setBatchRes([...out])
      await sleep(50)
    }
    setLoading(false)
  }

  const addBatch = () => {
    const picks = batchRes.filter((b) => b.status === 'ok' && b.pick >= 0).map((b) => ({ ...b.options[b.pick], name: b.query.length <= 20 ? b.query : b.options[b.pick].name }))
    picks.forEach((p) => onAdd({ ...p, type: p.type === 'sight' ? type : p.type }))
    close()
  }

  return (
    <Sheet open={open} onClose={close} title={`添加地点 · ${city.name}`}>
      <div className="row mb">
        <div className="seg">
          <button className={tab === 'search' ? 'on' : ''} onClick={() => setTab('search')}><Search size={14} />搜索</button>
          <button className={tab === 'batch' ? 'on' : ''} onClick={() => setTab('batch')}>📋 批量粘贴</button>
        </div>
      </div>
      <div className="label mb-s">默认类型</div>
      <div className="chip-scroll mb">
        {Object.entries(PLACE_TYPES).filter(([k]) => k !== 'transit').map(([k, v]) => (
          <button key={k} className={`chip btnlike ${type === k ? 'on' : ''}`} onClick={() => setType(k)}>{v.emoji} {v.label}</button>
        ))}
      </div>

      {tab === 'search' && (
        <>
          <form className="row mb-s" onSubmit={(e) => { e.preventDefault(); run() }}>
            <div className="search-box grow">
              <Search size={18} />
              <input className="input" placeholder="地名，或粘贴 Google Maps 链接" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
            </div>
            <button className="btn btn-primary" type="submit" disabled={loading}>{loading ? <Loader2 size={18} className="spin" /> : '搜索'}</button>
          </form>
          <div className="tiny faint mb">
            <Link2 size={12} style={{ verticalAlign: -2 }} /> 中文搜不到时试试英文或当地名称（如 Hoan Kiem Lake）；也可以在地图上点一下直接落点。
          </div>
          {err && <div className="small mb" style={{ color: 'var(--red-500)' }}>{err}</div>}
          {results && (
            <div className="list">
              {results.map((r, i) => (
                <div key={i} className="list-item click" onClick={() => { onAdd({ ...r, type: r.type === 'sight' || r.fromLink ? type : r.type }); close() }}>
                  <div className="emoji-badge sm">{PLACE_TYPES[r.type === 'sight' ? type : r.type]?.emoji}</div>
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="bold ellipsis">{r.name}</div>
                    <div className="tiny faint ellipsis">{r.address}</div>
                  </div>
                  {r.dist != null && <span className={`chip ${r.dist > 60000 ? 'red' : ''}`}>{fmtDist(r.dist)}</span>}
                </div>
              ))}
              {!results.length && <div className="list-item faint small">没有结果。换个关键词，或在地图上直接点选位置。</div>}
            </div>
          )}
        </>
      )}

      {tab === 'batch' && (
        <>
          {!batchRes && (
            <>
              <textarea className="textarea" rows={7} placeholder={'每行一个地名，可直接从小红书/备忘录复制：\n还剑湖\n河内大教堂\nTrain Street\n36行街'} value={batch} onChange={(e) => setBatch(e.target.value)} />
              <button className="btn btn-primary btn-block mt" onClick={runBatch} disabled={!batch.trim()}>开始识别</button>
              <div className="tiny faint mt-s">免费搜索服务每秒只能查 1 个，10 个地名大约 10 秒。</div>
            </>
          )}
          {batchRes && (
            <>
              <div className="list">
                {batchRes.map((b, i) => (
                  <div key={i} className="list-item" style={{ alignItems: 'flex-start' }}>
                    <div style={{ width: 22, paddingTop: 2 }}>
                      {b.status === 'pending' ? <Loader2 size={16} className="spin" /> : b.status === 'ok' ? '✅' : '⚠️'}
                    </div>
                    <div className="grow" style={{ minWidth: 0 }}>
                      <div className="bold">{b.query}</div>
                      {b.status === 'ok' && (
                        <select className="select sm mt-s" value={b.pick} onChange={(e) => { const v = [...batchRes]; v[i] = { ...b, pick: +e.target.value }; setBatchRes(v) }}>
                          {b.options.map((o, k) => <option key={k} value={k}>{o.name} · {fmtDist(o.dist)} · {o.address.split(',').slice(1, 3).join(',')}</option>)}
                          <option value={-1}>不添加</option>
                        </select>
                      )}
                      {b.status === 'none' && <div className="tiny faint">没找到，稍后可用搜索或地图点选单独添加</div>}
                    </div>
                  </div>
                ))}
              </div>
              <div className="row mt">
                <button className="btn grow" onClick={() => setBatchRes(null)}>返回修改</button>
                <button className="btn btn-primary grow" disabled={loading} onClick={addBatch}>
                  添加 {batchRes.filter((b) => b.status === 'ok' && b.pick >= 0).length} 个地点
                </button>
              </div>
            </>
          )}
        </>
      )}
    </Sheet>
  )
}
