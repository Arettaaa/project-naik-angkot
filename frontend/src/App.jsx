import Navbar from './components/Navbar'
import Hero from './components/Hero'
import Tentang from './components/Tentang'
import Fitur from './components/Fitur'

function App() {
  return (
    <main className="min-h-screen bg-[#E8F6FF] text-hero-brown">
      <Navbar />
      <div className="mx-auto w-full max-w-[1920px] [container-type:inline-size]">
        <Hero />
        <Tentang />
        <Fitur />
      </div>
    </main>
  )
}

export default App
