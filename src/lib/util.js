export const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4)

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v))

export function produce(obj, fn) {
  const draft = structuredClone(obj)
  const r = fn(draft)
  return r === undefined ? draft : r
}

export function download(filename, text, mime = 'application/json') {
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export function readFileText(file) {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(r.result)
    r.onerror = rej
    r.readAsText(file)
  })
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    return ok
  }
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
