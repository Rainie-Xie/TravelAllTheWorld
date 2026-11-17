import { useEffect, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Polyline, useMap, useMapEvents, Tooltip } from 'react-leaflet'
import L from 'leaflet'

const TILE = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'

const iconCache = new Map()
export function pinIcon(color, label, numbered = false, size = 30) {
  const key = `${color}|${label}|${numbered}|${size}`
  if (iconCache.has(key)) return iconCache.get(key)
  const icon = L.divIcon({
    className: '',
    html: `<div class="pin ${numbered ? 'num' : ''}" style="background:${color};width:${size}px;height:${size}px"><span>${label}</span></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size + 2],
    tooltipAnchor: [0, -size],
  })
  iconCache.set(key, icon)
  return icon
}

function FitBounds({ points, padding = 40, maxZoom = 15 }) {
  const map = useMap()
  const sig = points.map((p) => `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`).join('|')
  useEffect(() => {
    if (!points.length) return
    if (points.length === 1) map.setView([points[0].lat, points[0].lng], Math.min(maxZoom, 14))
    else map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng])), { padding: [padding, padding], maxZoom })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig])
  return null
}

function ClickCatcher({ onClick }) {
  useMapEvents({ click: (e) => onClick?.(e.latlng) })
  return null
}

function InvalidateOnResize() {
  const map = useMap()
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 150)
    const ro = new ResizeObserver(() => map.invalidateSize())
    ro.observe(map.getContainer())
    return () => { clearTimeout(t); ro.disconnect() }
  }, [map])
  return null
}

/**
 * markers: [{ id, lat, lng, color, label, numbered, title, onClick }]
 * lines: [{ points:[[lat,lng]], color, dashed }]
 */
export default function MapView({ markers = [], lines = [], center, height = 300, onMapClick, fitPadding = 40, children, style }) {
  const fitPts = useMemo(() => markers.filter((m) => m.lat != null), [markers])
  const c = center || fitPts[0] || { lat: 21.0285, lng: 105.8542 }
  return (
    <div className="map-wrap" style={{ height, ...style }}>
      <MapContainer center={[c.lat, c.lng]} zoom={13} zoomControl={false} attributionControl scrollWheelZoom style={{ height: '100%' }}>
        <TileLayer url={TILE} attribution={ATTR} maxZoom={19} className="soft-tiles" />
        <FitBounds points={fitPts.length ? fitPts : [c]} padding={fitPadding} />
        <InvalidateOnResize />
        {onMapClick && <ClickCatcher onClick={onMapClick} />}
        {lines.filter((l) => Array.isArray(l.points) && l.points.length >= 2).map((l, i) => (
          <Polyline key={i} positions={l.points} pathOptions={{ color: l.color || '#5DAA3C', weight: l.weight || 5, opacity: 0.85, dashArray: l.dashed ? '6 8' : null, lineCap: 'round' }} />
        ))}
        {markers.map((m) => (
          <Marker key={m.id} position={[m.lat, m.lng]} icon={pinIcon(m.color, m.label, m.numbered, m.size)} eventHandlers={m.onClick ? { click: m.onClick } : undefined}>
            {m.title && <Tooltip direction="top">{m.title}</Tooltip>}
          </Marker>
        ))}
        {children}
      </MapContainer>
    </div>
  )
}
