import Navbar from '../components/Navbar'
import Hero from '../components/Hero'
import Tentang from '../components/Tentang'
import Fitur from '../components/Fitur'
import CaraKerja from '../components/CaraKerja'
import CTASection from '../components/CTASection'
import Footer from '../components/Footer'

// Landing page (dibuat tim) — isinya sama persis dengan App.jsx lama.
export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[#E8F6FF] text-hero-brown">
      <Navbar />
      <div className="mx-auto w-full max-w-[1920px] [container-type:inline-size]">
        <Hero />
        <Tentang />
        <Fitur />
        <CaraKerja />
        <CTASection />
      </div>
      <Footer />
    </main>
  )
}
