import { Route, Routes } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import DashboardLayout from './dashboard/DashboardLayout'
import BerandaPanel from './dashboard/beranda/BerandaPanel'
import RutePanel from './dashboard/rute/RutePanel'
import CariPanel from './dashboard/cari/CariPanel'

function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      {/* dashboard peta: satu peta, panel berganti sesuai menu */}
      <Route element={<DashboardLayout />}>
        <Route path="/peta" element={<BerandaPanel />} />
        <Route path="/rute" element={<RutePanel />} />
        <Route path="/rute/:kode" element={<RutePanel />} />
        <Route path="/cari" element={<CariPanel />} />
      </Route>
      <Route path="*" element={<LandingPage />} />
    </Routes>
  )
}

export default App