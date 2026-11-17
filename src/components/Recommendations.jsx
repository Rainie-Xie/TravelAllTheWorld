import { useEffect, useState } from 'react'
import { Flame, Plus, Check, ChevronDown, ChevronUp, RefreshCw, Loader2, ExternalLink } from 'lucide-react'
import { useStore } from '../store'
import { fetchRecommendations, recKey, KINDS } from '../lib/recommend'
import { haversine, gmPlaceUrl } from '../lib/geo'

const TTL = 30 * 24 * 3600 * 1000

export function useRecommendations(city) {
  const key = city ? recKey(city) : null
  const cached = useStore((s) => (key ? s.recs?.[key] : null))
  const setRecs = useStore((s) => s.setRecs)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = async (force = false) => {
    if (!city || (!force && cached && Date.now() - cached.at < TTL)) return
    setLoading(true)
    setError('')
    try {
      const items = await fetchRecommendations(city)
      setRecs(key, { at: Date.now(), items })
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }
  useEffect(() => { load() }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  return { items: cached?.items || null, loading, error, reload: () => load(true) }
}

// a recommendation is "added" if a place with the same name or nearby exists
export function isAdded(rec, places) {
  // beaches, mountains, lakes and parks are big: match within a wider radius
  const r = ['beach', 'mountain'].includes(rec.kind) ? 2000 : ['lake', 'park', 'fun'].includes(rec.kind) ? 800 : 120
  return places.some((p) => p.recId === rec.qid || p.name === rec.name || haversine(p, rec) < r)
}

export default function Recommendations({ city, recs, open, onToggle, onAdd }) {
  const { items, loading, error, reload } = recs
  const [count, setCount] = useState(10)
  const list = items?.slice(0, count) || []
  const added = list.filter((r) => isAdded(r, city.places)).length

  return (
    <div className="card sun" style={{ padding: 0, overflow: 'hidden' }}>
      <button className="row-between" onClick={onToggle}
        style={{ width: '100%', padding: '12px 14px', border: 0, background: 'transparent', cursor: 'pointer', textAlign: 'left' }}>
        <div className="row">
          <Flame size={18} color="#E5873F" />
          <div>
            <div className="bold">{city.name}热门景点</div>
            <div className="tiny muted">
              {loading && !items ? '正在获取…' : items ? `${items.length ? `前 ${Math.min(count, items.length)} 名 · 已添加 ${added} 个` : '没找到推荐'}` : '点开看看'}
            </div>
          </div>
        </div>
        {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>

      {open && (
        <div style={{ padding: '0 10px 12px' }}>
          {loading && !items && (
            <div className="row small muted" style={{ padding: '8px 4px' }}>
              <Loader2 size={15} className="spin" />正在从维基百科数据里找最热门的景点，第一次大约需要 10 秒…
            </div>
          )}
          {error && !items && (
            <div className="small" style={{ padding: '4px', color: 'var(--red-500)' }}>
              {error} <button className="btn btn-ghost btn-sm" onClick={reload}>重试</button>
            </div>
          )}
          {list.length > 0 && (
            <div className="list" style={{ borderColor: 'var(--yellow-100)' }}>
              {list.map((r, i) => {
                const done = isAdded(r, city.places)
                const k = KINDS[r.kind] || KINDS.sight
                return (
                  <div key={r.qid} className={`list-item ${done ? '' : 'click'}`} style={{ padding: '10px 12px', gap: 10 }} onClick={() => !done && onAdd(r)}>
                    <div className="bold" style={{ width: 18, textAlign: 'center', color: i < 3 ? '#E5873F' : 'var(--ink-3)', fontSize: 14 }}>{i + 1}</div>
                    <div className="emoji-badge sm yellow">{k.emoji}</div>
                    <div className="grow" style={{ minWidth: 0 }}>
                      <div className="bold ellipsis">{r.name}</div>
                      <div className="tiny faint ellipsis">{k.label}{r.desc ? ` · ${r.desc}` : ''}</div>
                    </div>
                    <a className="icon-btn sm plain" aria-label="在 Google Maps 查看" href={gmPlaceUrl(r, city.en || city.name)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                      <ExternalLink size={14} color="var(--ink-3)" />
                    </a>
                    {done ? (
                      <span className="chip green" style={{ flex: 'none' }}><Check size={12} />已加</span>
                    ) : (
                      <button className="btn btn-primary btn-sm" style={{ flex: 'none', padding: '0 10px' }} aria-label={`添加${r.name}`}
                        onClick={(e) => { e.stopPropagation(); onAdd(r) }}>
                        <Plus size={15} />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
          {items && items.length < 10 && (
            <div className="tiny muted mt-s" style={{ padding: '0 4px' }}>这座城市的公开资料收录不多，可以用右上角「+ 地点」搜索或批量粘贴补充。</div>
          )}
          {items && (
            <div className="row-between mt-s" style={{ padding: '0 4px' }}>
              <span className="tiny faint">按维基百科收录热度排序 · 地图上的 ★ 也可以点</span>
              <div className="row" style={{ gap: 4 }}>
                {items.length > count && <button className="btn btn-ghost btn-sm" onClick={() => setCount((c) => c + 10)}>再看 10 个</button>}
                <button className="icon-btn sm plain" aria-label="刷新推荐" onClick={reload} disabled={loading}>
                  {loading ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
