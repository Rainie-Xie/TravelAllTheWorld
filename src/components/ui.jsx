import { useEffect, useState, createContext, useContext, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, X } from 'lucide-react'

export function TopBar({ title, back = true, right, onBack }) {
  const nav = useNavigate()
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 4)
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [])
  return (
    <div className={`topbar ${scrolled ? 'scrolled' : ''}`}>
      {back && (
        <button className="icon-btn" aria-label="返回" onClick={() => (onBack ? onBack() : window.history.length > 1 ? nav(-1) : nav('/'))}>
          <ChevronLeft size={20} />
        </button>
      )}
      <h1>{title}</h1>
      {right}
    </div>
  )
}

export function Sheet({ open, onClose, title, children, footer }) {
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])
  if (!open) return null
  return createPortal(
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet" role="dialog" aria-label={title}>
        <div className="sheet-handle" />
        <div className="sheet-head">
          <h3>{title}</h3>
          <button className="icon-btn sm plain" aria-label="关闭" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-foot">{footer}</div>}
      </div>
    </>,
    document.body,
  )
}

const ToastCtx = createContext(() => {})
export function ToastProvider({ children }) {
  const [msg, setMsg] = useState(null)
  const show = useCallback((m) => {
    setMsg(m)
    clearTimeout(window.__toastT)
    window.__toastT = setTimeout(() => setMsg(null), 2400)
  }, [])
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {msg && createPortal(<div className="toast" role="status">{msg}</div>, document.body)}
    </ToastCtx.Provider>
  )
}
export const useToast = () => useContext(ToastCtx)

export function Empty({ emoji = '🗺️', title, sub, action }) {
  return (
    <div className="empty">
      <div className="big">{emoji}</div>
      <div className="bold">{title}</div>
      {sub && <div className="small muted mt-s">{sub}</div>}
      {action && <div className="mt">{action}</div>}
    </div>
  )
}

export function Field({ label, children, hint }) {
  return (
    <div className="field">
      {label && <label>{label}</label>}
      {children}
      {hint && <div className="tiny faint">{hint}</div>}
    </div>
  )
}

export function Seg({ value, onChange, options }) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button key={o.value} type="button" className={value === o.value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Progress({ value }) {
  return (
    <div className="progress" role="progressbar" aria-valuenow={Math.round(value * 100)}>
      <div style={{ width: `${Math.round(value * 100)}%` }} />
    </div>
  )
}

export function confirmAsk(msg) {
  return window.confirm(msg)
}
