import { useState } from 'react'
import { Check, Sparkles, RotateCcw, Plus, MoreHorizontal, Save, Backpack } from 'lucide-react'
import { useStore } from '../../store'
import { Sheet, Field, Progress, Empty, useToast, confirmDialog } from '../../components/ui'
import { CATEGORIES, suggestPacking, mergePacking } from '../../lib/packing'
import { useTripWeather } from '../../lib/useWeather'
import { uid } from '../../lib/util'

const SOURCE = { weather: '🌤️ 天气', destination: '📍 目的地' }

function ItemEditor({ item, onSave, onDelete, onClose }) {
  const [it, setIt] = useState(item)
  const set = (p) => setIt((x) => ({ ...x, ...p }))
  return (
    <Sheet open onClose={onClose} title="编辑物品" footer={<>
      <button className="btn btn-danger" onClick={() => onDelete(it)}>删除</button>
      <button className="btn btn-primary grow" onClick={() => onSave(it)}>保存</button>
    </>}>
      <div className="stack">
        <Field label="名称"><input className="input" value={it.name} onChange={(e) => set({ name: e.target.value })} /></Field>
        <div className="grid-2">
          <Field label="数量"><input className="input sm" type="number" min={1} value={it.qty} onChange={(e) => set({ qty: +e.target.value || 1 })} /></Field>
          <Field label="分类">
            <select className="select sm" value={it.category} onChange={(e) => set({ category: e.target.value })}>
              {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.emoji} {c.label}</option>)}
            </select>
          </Field>
        </div>
        <label className="row small" style={{ cursor: 'pointer' }}>
          <input type="checkbox" checked={!!it.carryOn} onChange={(e) => set({ carryOn: e.target.checked })} /> 随身携带（不托运）
        </label>
      </div>
    </Sheet>
  )
}

export default function PackingTab({ trip }) {
  const settings = useStore((s) => s.settings)
  const updateTrip = useStore((s) => s.updateTrip)
  const templates = useStore((s) => s.templates)
  const saveTemplate = useStore((s) => s.saveTemplate)
  const toast = useToast()
  const { byCity, loading } = useTripWeather(trip)
  const [filter, setFilter] = useState('all')
  const [editing, setEditing] = useState(null)
  const [newName, setNewName] = useState('')
  const [newCat, setNewCat] = useState('custom')
  const [tplOpen, setTplOpen] = useState(false)

  const items = trip.packing || []
  const done = items.filter((i) => i.checked).length
  const mut = (fn) => updateTrip(trip.id, (d) => { d.packing = d.packing || []; fn(d) })

  const generate = () => {
    const sug = suggestPacking(trip, byCity, settings)
    const before = items.length
    mut((d) => { d.packing = mergePacking(d.packing, sug) })
    const added = mergePacking(items, sug).length - before
    toast(added ? `新增 ${added} 项建议 ✨` : '清单已经很全啦')
  }
  const toggle = (id) => mut((d) => { const i = d.packing.find((x) => x.id === id); i.checked = !i.checked })
  const addItem = () => {
    if (!newName.trim()) return
    mut((d) => { d.packing.push({ id: uid(), key: `c-${uid()}`, name: newName.trim(), category: newCat, qty: 1, checked: false, source: 'custom', carryOn: false }) })
    setNewName('')
  }
  const returnMode = async () => {
    const toReturn = trip.packingPhase !== 'return'
    if (!(await confirmDialog(toReturn ? { title: '开启返程模式？', message: '会清空所有勾选，回程收拾时再勾一遍，防止把东西落在酒店。', okText: '开启' } : { title: '切回出发模式？', message: '会清空所有勾选。', okText: '切换' }))) return
    mut((d) => { d.packing.forEach((i) => { i.checked = false }); d.packingPhase = d.packingPhase === 'return' ? 'go' : 'return' })
  }

  const shown = items.filter((i) => (filter === 'todo' ? !i.checked : filter === 'carry' ? i.carryOn : true))
  const groups = CATEGORIES.map((c) => [c, shown.filter((i) => i.category === c.key)]).filter(([, l]) => l.length)

  if (!items.length)
    return (
      <div className="stack">
        <div className="card tint">
          <Empty emoji="🧳" title="一键生成行李清单" sub="根据目的地天气、海滩/寺庙/山区、航班和插座类型，自动推荐要带的东西"
            action={<div className="stack-s" style={{ maxWidth: 260, margin: '0 auto' }}>
              <button className="btn btn-primary" onClick={generate} disabled={loading}><Sparkles size={16} />{loading ? '正在获取天气…' : '智能生成清单'}</button>
              {templates.length > 0 && <button className="btn" onClick={() => setTplOpen(true)}>使用我的模板</button>}
            </div>} />
        </div>
        {tplOpen && <TemplatePicker templates={templates} onPick={(t) => { mut((d) => { d.packing = t.items.map((i) => ({ ...i, id: uid(), checked: false })) }); setTplOpen(false) }} onClose={() => setTplOpen(false)} />}
      </div>
    )

  return (
    <div className="stack">
      <div className="card sun">
        <div className="row-between mb-s">
          <div>
            <div className="bold" style={{ fontSize: 17 }}>{trip.packingPhase === 'return' ? '🏠 返程收拾' : '🧳 出发收拾'}</div>
            <div className="small muted">已整理 {done} / {items.length}</div>
          </div>
          <div className="temp" style={{ fontSize: 28, color: 'var(--green-700)' }}>{items.length ? Math.round((done / items.length) * 100) : 0}%</div>
        </div>
        <Progress value={items.length ? done / items.length : 0} />
        {done === items.length && <div className="small mt-s bold" style={{ color: 'var(--green-700)' }}>🎉 全部整理完毕，出发吧！</div>}
      </div>

      <div className="chip-scroll">
        <button className="chip btnlike" style={{ height: 32 }} onClick={generate}><Sparkles size={13} />按天气/目的地补充</button>
        <button className="chip btnlike" style={{ height: 32 }} onClick={returnMode}><RotateCcw size={13} />{trip.packingPhase === 'return' ? '切回出发模式' : '返程模式'}</button>
        <button className="chip btnlike" style={{ height: 32 }} onClick={() => { saveTemplate({ id: uid(), name: `${trip.name} 的清单`, items: items.map(({ checked, ...r }) => r) }); toast('已存为模板，下次旅行可直接用') }}><Save size={13} />存为模板</button>
      </div>

      <div className="row">
        <div className="seg">
          {[['all', '全部'], ['todo', '未完成'], ['carry', '随身']].map(([k, l]) => (
            <button key={k} className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>{l}</button>
          ))}
        </div>
      </div>

      {groups.map(([c, list]) => (
        <div key={c.key}>
          <div className="row-between mb-s">
            <span className="label">{c.emoji} {c.label}</span>
            <span className="tiny faint">{list.filter((i) => i.checked).length}/{list.length}</span>
          </div>
          <div className="list">
            {list.map((i) => (
              <div key={i.id} className={`check-row ${i.checked ? 'done' : ''}`} onClick={() => toggle(i.id)}>
                <div className="check-box">{i.checked && <Check size={16} strokeWidth={3} />}</div>
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="check-name">{i.name}{i.qty > 1 && !/×/.test(i.name) ? <span className="faint"> ×{i.qty}</span> : ''}</div>
                  {(i.carryOn || SOURCE[i.source]) && (
                    <div className="row tiny faint" style={{ gap: 6 }}>
                      {i.carryOn && <span style={{ color: 'var(--yellow-700)' }}><Backpack size={11} style={{ verticalAlign: -1 }} /> 随身</span>}
                      {SOURCE[i.source] && <span>{SOURCE[i.source]}</span>}
                    </div>
                  )}
                </div>
                <button className="icon-btn sm plain" aria-label="编辑" onClick={(e) => { e.stopPropagation(); setEditing(i) }}><MoreHorizontal size={16} /></button>
              </div>
            ))}
          </div>
        </div>
      ))}
      {!groups.length && <div className="center small muted">这个筛选下没有物品 👍</div>}

      <div className="card flat">
        <div className="label mb-s">添加物品</div>
        <form className="row" onSubmit={(e) => { e.preventDefault(); addItem() }}>
          <input className="input grow" placeholder="例如：自拍杆" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <select className="select" style={{ width: 96 }} value={newCat} onChange={(e) => setNewCat(e.target.value)} aria-label="分类">
            {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.emoji} {c.label}</option>)}
          </select>
          <button className="btn btn-primary" type="submit" aria-label="添加"><Plus size={18} /></button>
        </form>
      </div>
      <button className="btn btn-ghost btn-sm" onClick={async () => (await confirmDialog({ title: '清空整个清单？', message: '清空后可以重新智能生成。', okText: '清空', danger: true })) && mut((d) => { d.packing = [] })}>清空清单重新生成</button>

      {editing && (
        <ItemEditor item={editing} onClose={() => setEditing(null)}
          onSave={(it) => { mut((d) => { const k = d.packing.findIndex((x) => x.id === it.id); d.packing[k] = it }); setEditing(null) }}
          onDelete={(it) => { mut((d) => { d.packing = d.packing.filter((x) => x.id !== it.id) }); setEditing(null) }} />
      )}
    </div>
  )
}

function TemplatePicker({ templates, onPick, onClose }) {
  const del = useStore((s) => s.deleteTemplate)
  return (
    <Sheet open onClose={onClose} title="我的清单模板">
      <div className="list">
        {templates.map((t) => (
          <div key={t.id} className="list-item click" onClick={() => onPick(t)}>
            <div className="grow"><div className="bold">{t.name}</div><div className="tiny faint">{t.items.length} 项</div></div>
            <button className="btn btn-ghost btn-sm" onClick={async (e) => { e.stopPropagation(); if (await confirmDialog({ title: '删除这个模板？', okText: '删除', danger: true })) del(t.id) }}>删除</button>
          </div>
        ))}
      </div>
    </Sheet>
  )
}
