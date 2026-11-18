import { useEffect, useMemo, useRef, useState } from 'react'
import { geoNaturalEarth1, geoPath } from 'd3-geo'
import { zoom as d3zoom, zoomIdentity } from 'd3-zoom'
import { select } from 'd3-selection'
import { feature } from 'topojson-client'
import { ImageDown, Plus, Minus, Maximize, MapPin, Loader2 } from 'lucide-react'
import { useStore } from '../store'
import { Sheet, useToast } from '../components/ui'
import { CountryPicker, CityPicker } from '../components/pickers'
import { numericToAlpha2, countryName, flag, continentOf, CONTINENTS } from '../data/countries'
import { uid } from '../lib/util'
import { tripStatus } from '../lib/trip'

const W = 1000, H = 560
const C_VISITED = '#8FD16A'
const C_PLANNED = '#FFE27A'
const C_NONE = '#E4EADB'

export default function Footprint() {
  const trips = useStore((s) => s.trips)
  const footprint = useStore((s) => s.footprint)
  const toggleCountry = useStore((s) => s.toggleCountry)
  const lightCountry = useStore((s) => s.lightCountry)
  const addFootCity = useStore((s) => s.addFootCity)
  const removeFootCity = useStore((s) => s.removeFootCity)
  const toast = useToast()
  const [features, setFeatures] = useState(null)
  const [sel, setSel] = useState(null)
  const [pickCountry, setPickCountry] = useState(false)
  const [cityCountry, setCityCountry] = useState(null)
  const svgRef = useRef(null)
  const gRef = useRef(null)
  const zoomRef = useRef(null)
  const [k, setK] = useState(1)

  useEffect(() => {
    import('world-atlas/countries-50m.json').then((m) => {
      const topo = m.default
      setFeatures(feature(topo, topo.objects.countries).features.map((f) => ({ ...f, code: f.id ? numericToAlpha2(f.id) : null })))
    })
  }, [])

  const projection = useMemo(() => {
    const p = geoNaturalEarth1()
    if (!features) return p.fitExtent([[8, 8], [W - 8, H - 8]], { type: 'Sphere' })
    // crop Antarctica so the inhabited continents get more room on a phone
    return p.fitExtent([[6, 6], [W - 6, H - 6]], { type: 'FeatureCollection', features: features.filter((f) => f.code !== 'AQ') })
  }, [features])
  const path = useMemo(() => geoPath(projection), [projection])
  const paths = useMemo(() => features?.filter((f) => f.code !== 'AQ').map((f) => ({ code: f.code, name: f.properties?.name, d: path(f) })) || [], [features, path])

  const doneTrips = trips.filter((t) => t.done || tripStatus(t) === 'past')
  const tripCountries = new Set(trips.filter((t) => t.done).flatMap((t) => t.cities.map((c) => c.countryCode)))
  const visited = new Set([...tripCountries, ...footprint.countries])
  const planned = new Set(trips.filter((t) => !t.done && tripStatus(t) !== 'past').flatMap((t) => t.cities.map((c) => c.countryCode)))
  const cities = [
    ...trips.filter((t) => t.done).flatMap((t) => t.cities.map((c) => ({ id: c.id, name: c.name, lat: c.lat, lng: c.lng, countryCode: c.countryCode, trip: t.name }))),
    ...footprint.cities,
  ]
  const continents = CONTINENTS.filter((ct) => [...visited].some((c) => continentOf(c) === ct))

  useEffect(() => {
    if (!svgRef.current) return
    const z = d3zoom().scaleExtent([1, 24]).translateExtent([[0, 0], [W, H]]).on('zoom', (e) => {
      select(gRef.current).attr('transform', e.transform)
      setK(e.transform.k)
    })
    zoomRef.current = z
    select(svgRef.current).call(z)
  }, [features])

  const zoomBy = (f) => select(svgRef.current).transition().duration(250).call(zoomRef.current.scaleBy, f)
  const reset = () => select(svgRef.current).transition().duration(300).call(zoomRef.current.transform, zoomIdentity)

  const fill = (code) => (visited.has(code) ? C_VISITED : planned.has(code) ? C_PLANNED : C_NONE)

  const exportImage = async () => {
    const svg = svgRef.current.cloneNode(true)
    svg.querySelector('g').removeAttribute('transform')
    svg.setAttribute('width', W * 2)
    svg.setAttribute('height', H * 2)
    const xml = new XMLSerializer().serializeToString(svg)
    const img = new Image()
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml)
    await new Promise((r, j) => { img.onload = r; img.onerror = j })
    const cv = document.createElement('canvas')
    cv.width = 2000; cv.height = 1400
    const ctx = cv.getContext('2d')
    ctx.fillStyle = '#FBFCF5'; ctx.fillRect(0, 0, cv.width, cv.height)
    ctx.fillStyle = '#FFF4C2'; ctx.fillRect(0, 0, cv.width, 240)
    ctx.fillStyle = '#1E2A1A'
    ctx.font = 'bold 72px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif'
    ctx.fillText('我的旅行足迹', 80, 130)
    ctx.font = '40px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif'
    ctx.fillStyle = '#3F7F29'
    ctx.fillText(`${visited.size} 个国家 · ${cities.length} 座城市 · ${continents.length} 个大洲`, 80, 200)
    ctx.drawImage(img, 0, 260, 2000, 1040)
    ctx.font = '28px sans-serif'; ctx.fillStyle = '#8A9585'
    ctx.fillText('途记 · TripNote', 80, 1360)
    cv.toBlob(async (blob) => {
      const file = new File([blob], '我的足迹.png', { type: 'image/png' })
      if (navigator.canShare?.({ files: [file] })) {
        try { await navigator.share({ files: [file], title: '我的旅行足迹' }); return } catch { /* cancelled */ }
      }
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = '我的足迹.png'
      a.click()
      toast('图片已保存')
    }, 'image/png')
  }

  const selTrips = sel ? trips.filter((t) => t.cities.some((c) => c.countryCode === sel)) : []
  const selCities = sel ? cities.filter((c) => c.countryCode === sel) : []

  return (
    <div className="page">
      <div className="row-between mb">
        <div>
          <div className="small muted">点亮世界的每一个角落</div>
          <div className="hero-title">足迹地图</div>
        </div>
        <button className="btn btn-sm" onClick={exportImage} disabled={!features}><ImageDown size={15} />存图分享</button>
      </div>

      <div className="stats-3 mb">
        <div className="stat"><div className="num">{visited.size}</div><div className="lbl">个国家/地区 · {Math.round((visited.size / 195) * 1000) / 10}%</div></div>
        <div className="stat"><div className="num">{cities.length}</div><div className="lbl">座城市</div></div>
        <div className="stat"><div className="num">{continents.length}</div><div className="lbl">个大洲</div></div>
      </div>

      <div className="map-wrap" style={{ height: 'auto', aspectRatio: `${W} / ${H}`, background: '#F2F7FA', position: 'relative' }}>
        {!features ? (
          <div className="splash" style={{ minHeight: 200 }}><Loader2 className="spin" /></div>
        ) : (
          <svg ref={svgRef} className="world-svg" viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg">
            <rect width={W} height={H} fill="#F2F7FA" />
            <g ref={gRef}>
              
              {paths.map((p, i) => (
                <path key={i} className="country" d={p.d} fill={p.code === sel ? '#5DAA3C' : fill(p.code)} stroke="#FFFFFF" strokeWidth={0.4 / k}
                  onClick={() => p.code && setSel(p.code)} />
              ))}
              {cities.map((c) => {
                const [x, y] = projection([c.lng, c.lat]) || []
                if (x == null) return null
                return (
                  <g key={c.id}>
                    <circle cx={x} cy={y} r={4.2 / k} fill="#FFE066" stroke="#3F7F29" strokeWidth={1.2 / k} />
                  </g>
                )
              })}
            </g>
          </svg>
        )}
        <div className="map-float" style={{ right: 8, bottom: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button className="icon-btn sm" aria-label="放大" onClick={() => zoomBy(1.8)}><Plus size={15} /></button>
          <button className="icon-btn sm" aria-label="缩小" onClick={() => zoomBy(1 / 1.8)}><Minus size={15} /></button>
          <button className="icon-btn sm" aria-label="复位" onClick={reset}><Maximize size={14} /></button>
        </div>
      </div>
      <div className="row tiny muted mt-s" style={{ gap: 12 }}>
        <span className="row" style={{ gap: 4 }}><i className="legend-dot" style={{ background: C_VISITED }} />去过</span>
        <span className="row" style={{ gap: 4 }}><i className="legend-dot" style={{ background: C_PLANNED }} />计划中</span>
        <span className="row" style={{ gap: 4 }}><i className="legend-dot" style={{ background: '#FFE066', border: '1px solid #3F7F29', borderRadius: 6 }} />城市</span>
        <span className="grow" style={{ textAlign: 'right' }}>点击国家可手动点亮</span>
      </div>

      <div className="row mt">
        <button className="btn btn-soft grow" onClick={() => setPickCountry(true)}><MapPin size={16} />补录以前去过的城市</button>
      </div>

      {visited.size > 0 && (
        <div className="mt">
          <div className="section-title mb-s">去过的国家</div>
          {continents.map((ct) => (
            <div key={ct} className="mb">
              <div className="label mb-s">{ct}</div>
              <div className="row wrap" style={{ gap: 8 }}>
                {[...visited].filter((c) => continentOf(c) === ct).map((c) => (
                  <button key={c} className="chip btnlike green" style={{ height: 32 }} onClick={() => setSel(c)}>
                    <span className="flag">{flag(c)}</span> {countryName(c)} {cities.filter((x) => x.countryCode === c).length > 0 && <span className="faint">· {cities.filter((x) => x.countryCode === c).length}城</span>}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      {visited.size === 0 && (
        <div className="card tint mt center small muted">
          旅行结束后在行程的「证件&更多」里标记完成，足迹会自动点亮；也可以直接点地图上的国家补录 🌏
          {doneTrips.length > 0 && <div className="mt-s">你有 {doneTrips.length} 次已结束的旅行还没标记完成哦。</div>}
        </div>
      )}

      <Sheet open={!!sel} onClose={() => setSel(null)} title={sel ? `${flag(sel)} ${countryName(sel)}` : ''}>
        {sel && (
          <div className="stack">
            {tripCountries.has(sel) ? (
              <div className="card tint small">✅ 通过行程点亮</div>
            ) : (
              <button className={`btn ${footprint.countries.includes(sel) ? '' : 'btn-primary'}`} onClick={() => toggleCountry(sel)}>
                {footprint.countries.includes(sel) ? '取消点亮' : '✨ 我去过这里，点亮！'}
              </button>
            )}
            {selTrips.length > 0 && (
              <div>
                <div className="label mb-s">相关行程</div>
                {selTrips.map((t) => <div key={t.id} className="small">· {t.name} {t.done ? '✅' : '（计划中）'}</div>)}
              </div>
            )}
            <div>
              <div className="row-between mb-s">
                <span className="label">去过的城市</span>
                <button className="btn btn-ghost btn-sm" onClick={() => setCityCountry(sel)}><Plus size={14} />添加城市</button>
              </div>
              {selCities.length === 0 && <div className="small faint">还没有记录城市</div>}
              <div className="row wrap" style={{ gap: 8 }}>
                {selCities.map((c) => (
                  <span key={c.id} className="chip yellow" style={{ height: 30 }}>
                    📍 {c.name}
                    {footprint.cities.some((x) => x.id === c.id) && <button aria-label="移除" style={{ border: 0, background: 'none', cursor: 'pointer', padding: 0, marginLeft: 2 }} onClick={() => removeFootCity(c.id)}>✕</button>}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      </Sheet>

      <CountryPicker open={pickCountry} onClose={() => setPickCountry(false)} onPick={(c) => setTimeout(() => setCityCountry(c), 50)} />
      {cityCountry && (
        <CityPicker open multi onClose={() => setCityCountry(null)} countryCode={cityCountry}
          picked={cities.filter((x) => x.countryCode === cityCountry).map((x) => x.name)}
          onPick={(c) => {
            const cc = c.countryCode || cityCountry
            addFootCity({ id: uid(), name: c.name, lat: c.lat, lng: c.lng, countryCode: cc })
            if (!tripCountries.has(cc)) lightCountry(cc)
            toast(`已点亮 ${c.name} ✨`)
          }} />
      )}
    </div>
  )
}
