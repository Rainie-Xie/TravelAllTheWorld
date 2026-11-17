import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { fetchCityWeather, weatherKey } from './weather'

const TTL = 3 * 60 * 60 * 1000

// Returns { [cityId]: days[] } for all cities of a trip, cached in the store (works offline with last data)
export function useTripWeather(trip) {
  const cache = useStore((s) => s.weather)
  const setWeather = useStore((s) => s.setWeather)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const keys = trip.cities.map((c) => weatherKey(c)).join(';')

  useEffect(() => {
    let alive = true
    const stale = trip.cities.filter((c) => {
      const e = useStore.getState().weather[weatherKey(c)]
      return !e || Date.now() - e.at > TTL
    })
    if (!stale.length) return
    setLoading(true)
    Promise.all(
      stale.map((c) =>
        fetchCityWeather(c)
          .then((days) => setWeather(weatherKey(c), { at: Date.now(), days }))
          .catch(() => alive && setError('部分天气获取失败，显示的是上次缓存的数据')),
      ),
    ).finally(() => alive && setLoading(false))
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys])

  const byCity = Object.fromEntries(trip.cities.map((c) => [c.id, cache[weatherKey(c)]?.days || null]))
  return { byCity, loading, error }
}
