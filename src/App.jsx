import { useEffect, useState } from 'react'
import { HashRouter, Routes, Route, NavLink, Outlet, useLocation } from 'react-router-dom'
import { Plane, Globe2, Settings as Cog } from 'lucide-react'
import { useStore } from './store'
import { ToastProvider, ConfirmHost } from './components/ui'
import Home from './pages/Home'
import TripEditor from './pages/TripEditor'
import TripDetail from './pages/TripDetail'
import CityPage from './pages/CityPage'
import Footprint from './pages/Footprint'
import Settings from './pages/Settings'
import SharedTrip from './pages/SharedTrip'

function Shell() {
  return (
    <>
      <Outlet />
      <nav className="tabbar">
        <NavLink to="/" end><span className="tab-ico"><Plane size={20} /></span>我的行程</NavLink>
        <NavLink to="/footprint"><span className="tab-ico"><Globe2 size={20} /></span>足迹地图</NavLink>
        <NavLink to="/settings"><span className="tab-ico"><Cog size={20} /></span>设置</NavLink>
      </nav>
    </>
  )
}

function ScrollTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

function useHydrated() {
  const [h, setH] = useState(useStore.persist.hasHydrated())
  useEffect(() => {
    // after loading, write a fresh copy to both stores (migrates 1.0 data, repairs a stale copy)
    const unsub = useStore.persist.onFinishHydration(() => { setH(true); useStore.setState({}) })
    if (useStore.persist.hasHydrated()) useStore.setState({})
    setH(useStore.persist.hasHydrated())
    return unsub
  }, [])
  return h
}

export default function App() {
  const hydrated = useHydrated()
  if (!hydrated) return <div className="splash"><div style={{ fontSize: 48 }}>🧳</div><div className="bold">途记</div></div>
  return (
    <ToastProvider>
      <ConfirmHost />
      <HashRouter>
        <ScrollTop />
        <div className="app">
          <Routes>
            <Route element={<Shell />}>
              <Route path="/" element={<Home />} />
              <Route path="/footprint" element={<Footprint />} />
              <Route path="/settings" element={<Settings />} />
            </Route>
            <Route path="/trip/new" element={<TripEditor />} />
            <Route path="/trip/:tripId/edit" element={<TripEditor />} />
            <Route path="/trip/:tripId" element={<TripDetail />} />
            <Route path="/trip/:tripId/city/:cityId" element={<CityPage />} />
            <Route path="/share/:data" element={<SharedTrip />} />
            <Route path="*" element={<Home />} />
          </Routes>
        </div>
      </HashRouter>
    </ToastProvider>
  )
}
