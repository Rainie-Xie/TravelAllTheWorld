import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval'
import { produce } from './lib/util'

// IndexedDB storage with localStorage fallback (private mode etc.)
const storage = {
  async getItem(name) {
    try {
      const v = await idbGet(name)
      if (v != null) return v
    } catch { /* fall through */ }
    try { return localStorage.getItem(name) } catch { return null }
  },
  async setItem(name, value) {
    try { await idbSet(name, value); return } catch { /* fall through */ }
    try { localStorage.setItem(name, value) } catch { /* ignore */ }
  },
  async removeItem(name) {
    try { await idbDel(name) } catch { /* ignore */ }
    try { localStorage.removeItem(name) } catch { /* ignore */ }
  },
}

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
      addFootCity: (city) =>
        set((s) => ({ footprint: { ...s.footprint, cities: [...s.footprint.cities, city] } })),
      removeFootCity: (id) =>
        set((s) => ({ footprint: { ...s.footprint, cities: s.footprint.cities.filter((c) => c.id !== id) } })),

      saveTemplate: (tpl) => set((s) => ({ templates: [tpl, ...s.templates.filter((t) => t.id !== tpl.id)] })),
      deleteTemplate: (id) => set((s) => ({ templates: s.templates.filter((t) => t.id !== id) })),

      setWeather: (key, data) => set((s) => ({ weather: { ...s.weather, [key]: data } })),
      setRates: (rates) => set({ rates }),
      setRecs: (key, data) => set((s) => ({ recs: { ...s.recs, [key]: data } })),

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
