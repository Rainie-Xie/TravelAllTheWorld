import { useEffect, useRef, useState } from 'react'
import { Download, Upload, Smartphone } from 'lucide-react'
import { useStore } from '../store'
import { Field, Seg, useToast, confirmDialog } from '../components/ui'
import { CURRENCY_NAMES, ALL_COUNTRIES } from '../data/countries'
import { MODES } from '../lib/trip'
import { download, readFileText } from '../lib/util'
import { todayStr } from '../lib/time'

export default function Settings() {
  const settings = useStore((s) => s.settings)
  const setSettings = useStore((s) => s.setSettings)
  const exportAll = useStore((s) => s.exportAll)
  const importAll = useStore((s) => s.importAll)
  const trips = useStore((s) => s.trips)
  const toast = useToast()
  const fileRef = useRef(null)
  const [persisted, setPersisted] = useState(null)
  const isStandalone = window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)

  useEffect(() => { navigator.storage?.persisted?.().then(setPersisted).catch(() => {}) }, [])

  const num = (k) => (
    <input className="input sm" type="number" inputMode="numeric" value={settings[k]} onChange={(e) => setSettings({ [k]: +e.target.value || 0 })} />
  )

  const onImport = async (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    try {
      const data = JSON.parse(await readFileText(f))
      const replace = trips.length > 0 && (await confirmDialog({ title: '怎么导入这个备份？', message: '「覆盖」：用备份替换现在的全部数据\n「合并」：保留现有行程，再加上备份里的', okText: '覆盖', cancelText: '合并', danger: true }))
      importAll(data, replace ? 'replace' : 'merge')
      toast(`已导入 ${data.trips?.length || 0} 个行程`)
    } catch (err) {
      toast(`导入失败：${err.message}`)
    }
    e.target.value = ''
  }

  return (
    <div className="page stack">
      <div className="hero-title mb-s">设置</div>

      {!isStandalone && (
        <div className="card sun">
          <div className="row bold mb-s"><Smartphone size={18} />添加到手机主屏幕</div>
          <div className="small muted">
            {isIOS
              ? '用 Safari 打开本页 → 点底部「分享」按钮 → 选「添加到主屏幕」。添加后像 App 一样全屏使用，离线也能看，并且 iPhone 不会自动清理你的数据。'
              : '在浏览器菜单（⋮）里选「添加到主屏幕 / 安装应用」，之后像 App 一样使用，离线也能看。'}
          </div>
        </div>
      )}

      <div className="section-title mt-s">常用</div>
      <div className="card stack">
        <div className="grid-2">
          <Field label="本国货币（记账折算）">
            <select className="select sm" value={settings.homeCurrency} onChange={(e) => setSettings({ homeCurrency: e.target.value })}>
              {Object.entries(CURRENCY_NAMES).map(([k, v]) => <option key={k} value={k}>{k} {v}</option>)}
            </select>
          </Field>
          <Field label="常住国家（插头/证件）">
            <select className="select sm" value={settings.homeCountry} onChange={(e) => setSettings({ homeCountry: e.target.value })}>
              {ALL_COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
            </select>
          </Field>
        </div>
        <div className="row-between wrap">
          <span className="label">默认出行方式</span>
          <Seg value={settings.mode} onChange={(v) => setSettings({ mode: v })} options={Object.entries(MODES).map(([k, v]) => ({ value: k, label: `${v.emoji} ${v.label}` }))} />
        </div>
        <div className="grid-2">
          <Field label="每天默认出发"><input className="input sm" type="time" value={settings.dayStart} onChange={(e) => setSettings({ dayStart: e.target.value })} /></Field>
          <Field label="每天最晚结束"><input className="input sm" type="time" value={settings.dayEnd} onChange={(e) => setSettings({ dayEnd: e.target.value })} /></Field>
        </div>
      </div>

      <div className="section-title mt-s">赶飞机提醒</div>
      <div className="card stack">
        <div className="grid-2">
          <Field label="国际航班提前（分钟）">{num('intlBuffer')}</Field>
          <Field label="国内航班提前（分钟）">{num('domBuffer')}</Field>
          <Field label="火车/大巴提前（分钟）">{num('trainBuffer')}</Field>
          <Field label="额外缓冲（分钟）">{num('extraBuffer')}</Field>
        </div>
        <div className="tiny faint">出发时间 = 起飞时间 − 提前到达 − 酒店到机场车程 − 额外缓冲</div>
      </div>

      <div className="section-title mt-s">数据</div>
      <div className="card stack-s">
        <div className="small muted">所有数据只保存在这台设备的浏览器里，不上传任何服务器。{persisted === false && !isStandalone ? '建议添加到主屏幕并定期导出备份。' : ''}</div>
        <button className="btn" onClick={() => { download(`途记备份-${todayStr()}.json`, JSON.stringify(exportAll(), null, 2)); toast('备份已导出') }}><Download size={16} />导出全部数据（备份）</button>
        <button className="btn" onClick={() => fileRef.current?.click()}><Upload size={16} />从备份恢复 / 导入</button>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={onImport} />
        <div className="tiny faint">换手机或在电脑和手机之间搬数据：在一台设备导出，另一台设备导入。</div>
      </div>

      <div className="tiny faint center mt">
        途记 v0.1 · 地图 © OpenStreetMap / CARTO · 天气 Open-Meteo · 汇率 ExchangeRate-API · 路线 OSRM
      </div>
    </div>
  )
}
