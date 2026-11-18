import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { createStore, getMany, setMany, delMany } from 'idb-keyval'
import { produce } from './lib/util'

/*
 * Belt-and-braces storage.
 * iOS home-screen apps lose their IndexedDB connection after being backgrounded
 * ("Connection to Indexed Database server lost"), so every save goes to BOTH
 * localStorage (synchronous, survives the app being killed) and IndexedDB, each
 * stamped with a time. On load the newer copy wins. A dead IndexedDB connection
 * is reopened and retried once.
 */
let idbStore = null
const getIdb = () => (idbStore ||= createStore('tripnote-db', 'kv'))
async function idb(fn) {
  try {
    return await fn(getIdb())
  } catch {
    idbStore = null // reconnect and retry once
    return await fn(getIdb())
  }
}
const T = (name) => `${name}:savedAt`
export const saveStatus = { lastSave: 0, lastError: '' }

const storage = {
  async getItem(name) {
    let ls = null, lsT = 0, db = null, dbT = 0
    try { ls = localStorage.getItem(name); lsT = +localStorage.getItem(T(name)) || 0 } catch { /* ignore */ }
    try { [db, dbT] = await idb((s) => getMany([name, T(name)], s)); dbT = +dbT || 0 } catch { /* ignore */ }
    if (db == null) {
      // migrate from the 1.0 database (idb-keyval default store)
      try {
        const { get } = await import('idb-keyval')
        const old = await get(name)
        if (old != null && ls == null) return old
      } catch { /* ignore */ }
    }
    if (ls != null && (db == null || lsT >= dbT)) return ls
    return db ?? ls
  },
  async setItem(name, value) {
    const now = Date.now()
    let ok = false
    try { localStorage.setItem(name, value); localStorage.setItem(T(name), String(now)); ok = true } catch (e) { saveStatus.lastError = `本地存储：${e.message}` }
    try { await idb((s) => setMany([[name, value], [T(name), now]], s)); ok = true } catch (e) { saveStatus.lastError = `数据库：${e.message}` }
    if (ok) saveStatus.lastSave = now
  },
  async removeItem(name) {
    try { localStorage.removeItem(name); localStorage.removeItem(T(name)) } catch { /* ignore */ }
    try { await idb((s) => delMany([name, T(name)], s)) } catch { /* ignore */ }
  },
}

// keep caches small: only the most recent N entries (by .at)
const prune = (obj, n) => Object.fromEntries(Object.entries(obj).sort((a, b) => (b[1]?.at || 0) - (a[1]?.at || 0)).slice(0, n))

export const DEFAULT_SETTINGS = {
  homeCurrency: 'CNY',
  homeCountry: 'CN',
  intlBuffer: 180, // 国际航班提前到达机场（分钟）
  domBuffer: 120, // 国内航班
  trainBuffer: 30, // 火车 / 大巴 / 轮渡
  extraBuffer: 20, // 额外缓冲
  dayStart: '09:00',
  dayEnd: '21:00',
  mode: 'walk',
}

export const useStore = create(
  persist(
    (set, get) => ({
      trips: [],
      footprint: { countries: [], cities: [] }, // 手动点亮
      settings: DEFAULT_SETTINGS,
      templates: [], // 自定义行李模板 [{id,name,items:[]}]
      weather: {}, // cache: key -> { at, days }
      rates: null, // { at, base, rates }
      recs: {}, // 热门景点缓存: key -> { at, items }

      addTrip: (trip) => set((s) => ({ trips: [trip, ...s.trips] })),
      updateTrip: (id, fn) =>
        set((s) => ({ trips: s.trips.map((t) => (t.id === id ? produce(t, fn) : t)) })),
      replaceTrip: (trip) => set((s) => ({ trips: s.trips.map((t) => (t.id === trip.id ? trip : t)) })),
      deleteTrip: (id) => set((s) => ({ trips: s.trips.filter((t) => t.id !== id) })),

      setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

      toggleCountry: (code) =>
        set((s) => {
          const has = s.footprint.countries.includes(code)
          return {
            footprint: {
              ...s.footprint,
              countries: has ? s.footprint.countries.filter((c) => c !== code) : [...s.footprint.countries, code],
            },
          }
        }),
      lightCountry: (code) =>
        set((s) => (s.footprint.countries.includes(code) ? {} : { footprint: { ...s.footprint, countries: [...s.footprint.countries, code] } })),
      addFootCity: (city) =>
        set((s) => ({ footprint: { ...s.footprint, cities: [...s.footprint.cities, city] } })),
      removeFootCity: (id) =>
        set((s) => ({ footprint: { ...s.footprint, cities: s.footprint.cities.filter((c) => c.id !== id) } })),

      saveTemplate: (tpl) => set((s) => ({ templates: [tpl, ...s.templates.filter((t) => t.id !== tpl.id)] })),
      deleteTemplate: (id) => set((s) => ({ templates: s.templates.filter((t) => t.id !== id) })),

      setWeather: (key, data) => set((s) => ({ weather: prune({ ...s.weather, [key]: data }, 24) })),
      setRates: (rates) => set({ rates }),
      setRecs: (key, data) => set((s) => ({ recs: prune({ ...s.recs, [key]: data }, 24) })),

      exportAll: () => {
        const { trips, footprint, settings, templates } = get()
        return { app: 'tripnote', version: 1, exportedAt: new Date().toISOString(), trips, footprint, settings, templates }
      },
      importAll: (data, mode = 'merge') =>
        set((s) => {
          if (!data || data.app !== 'tripnote') throw new Error('不是途记的备份文件')
          if (mode === 'replace') {
            return {
              trips: data.trips || [],
              footprint: data.footprint || { countries: [], cities: [] },
              settings: { ...DEFAULT_SETTINGS, ...(data.settings || {}) },
              templates: data.templates || [],
            }
          }
          const ids = new Set(s.trips.map((t) => t.id))
          return {
            trips: [...s.trips.map((t) => data.trips?.find((x) => x.id === t.id) || t), ...(data.trips || []).filter((t) => !ids.has(t.id))],
            footprint: {
              countries: [...new Set([...s.footprint.countries, ...(data.footprint?.countries || [])])],
              cities: [...s.footprint.cities, ...(data.footprint?.cities || []).filter((c) => !s.footprint.cities.some((x) => x.id === c.id))],
            },
            templates: [...s.templates, ...(data.templates || []).filter((t) => !s.templates.some((x) => x.id === t.id))],
          }
        }),
    }),
    {
      name: 'tripnote',
      version: 1,
      storage: createJSONStorage(() => storage),
      partialize: (s) => ({
        trips: s.trips, footprint: s.footprint, settings: s.settings, templates: s.templates, weather: s.weather, rates: s.rates, recs: s.recs,
      }),
      merge: (persisted, current) => ({
        ...current,
        ...(persisted || {}),
        settings: { ...DEFAULT_SETTINGS, ...((persisted && persisted.settings) || {}) },
      }),
    },
  ),
)

export const useTrip = (id) => useStore((s) => s.trips.find((t) => t.id === id))
