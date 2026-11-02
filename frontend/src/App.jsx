import { Route, Routes } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import PetaPage from './pages/PetaPage'
import RutePage from './pages/RutePage'
import CariPage from './pages/CariPage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/peta" element={<PetaPage />} />
      <Route path="/rute" element={<RutePage />} />
      <Route path="/rute/:kode" element={<RutePage />} />
      <Route path="/cari" element={<CariPage />} />
      <Route path="*" element={<LandingPage />} />
    </Routes>
  )
}

export default App
