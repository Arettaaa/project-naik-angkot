import latarTentangHijauMuda from '../assets/tentang/latar-tentang-hijaumuda.svg'
import latarTentangHijauTua from '../assets/tentang/latar-tentang-hijautua.svg'
import sungai from '../assets/tentang/sungai.svg'
import latarFitur from '../assets/fitur/latar-fitur.svg'
import petaBogor from '../assets/tentang/peta-bogor.svg'
import petaBogorCropped from '../assets/tentang/peta-bogor-cropped.svg'
import KartuTumpuk from './KartuTumpuk'

export default function Tentang() {
  return (
    <section
      id="tentang"
      className="relative z-10 w-full overflow-x-clip bg-transparent scroll-mt-20 sm:scroll-mt-24 lg:scroll-mt-[10cqw]"
    >
      <div className="relative mx-auto w-full max-w-[1920px] [container-type:inline-size]">
        {/* ===== LATAR GELOMBANG, SUNGAI, DAN FITUR ===== */}
        <div className="pointer-events-none absolute inset-x-0 top-0 bottom-0 z-0 overflow-x-clip overflow-y-visible" aria-hidden="true">
          <img
            src={latarTentangHijauMuda}
            alt=""
            className="absolute -left-[0.3472cqw] top-0 z-0 w-[100.6944cqw] max-w-none select-none"
          />
          <img
            src={latarTentangHijauTua}
            alt=""
            className="absolute -left-[0.3472cqw] top-[9.72cqw] z-10 w-[100.6944cqw] max-w-none select-none"
          />
          <div
            className="absolute inset-x-0 top-[159.6474cqw] bottom-[calc(11.625rem_-_24.1144cqw)] z-10 bg-[#BAE59E] md:max-lg:bottom-[calc(14.625rem_-_24.1144cqw)] lg:hidden"
          />
          <img
            src={latarFitur}
            alt=""
            className="absolute -left-[0.4167cqw] max-lg:left-0 max-lg:w-full top-[calc(100%-6rem-8.5cqw+28.94cqw-6.125rem)] md:max-lg:top-[calc(100%-9rem-8.5cqw+28.94cqw-6.125rem)] lg:top-[52.3cqw] z-40 w-[100.6944cqw] max-w-none select-none"
          />
          <img
            src={sungai}
            alt=""
            className="absolute -left-[0.4167cqw] w-[100.6944cqw] max-w-none select-none max-lg:left-0 max-lg:w-full top-[calc(100%-6rem-8.5cqw-6.125rem)] md:max-lg:top-[calc(100%-9rem-8.5cqw-6.125rem)] lg:top-[45.2cqw] z-30"
          />
        </div>

        {/*
          Responsif:
          1. Jarak atas dinamis `pt-[max(7rem,calc(22cqw+2rem))]`:
             Memastikan teks selalu berada di bawah lembah gelombang terendah (y≈22cqw)
             dengan jarak aman ~40px di semua ukuran layar saat tab dikecilkan.
          2. Layar sedang/tablet (md): Grid 2-kolom (Tulisan di atas, lalu di bawahnya Card & Peta berdampingan).
          3. Layar kecil/mobile (< md): 1 kolom vertikal (Tulisan -> Card -> Peta).
          4. Lebar Card dan Peta dibuat persis sama (280px) saat tab dikecilkan agar presisi & seimbang.
        */}
        <div className="relative z-10 flex flex-col items-center gap-3 px-5 pb-20 pt-[max(7rem,calc(22cqw+2rem))] sm:gap-4 sm:px-8 sm:pt-[calc(22cqw+2.5rem)] md:grid md:grid-cols-2 md:items-center md:gap-x-8 md:gap-y-6 md:px-10 md:pt-[calc(22cqw+3rem)] md:pb-28 md:max-w-4xl md:mx-auto lg:block lg:h-[86.1111cqw] lg:max-w-none lg:px-0 lg:pb-0 lg:pt-0">
          {/* Judul */}
          <h2 className="w-full max-w-[560px] self-start font-display text-[clamp(2rem,7vw,3.25rem)] font-bold leading-[0.93] text-tentang-dark md:col-span-2 md:max-w-none md:text-[clamp(2.25rem,4vw,3.25rem)] lg:absolute lg:left-[8.2639cqw] lg:top-[23.5cqw] lg:w-[31.5278cqw] lg:max-w-none lg:text-[4.1667cqw] lg:leading-[3.8417cqw] lg:whitespace-nowrap">
            <span className="block whitespace-nowrap">Rute Angkot</span>
            <span className="block whitespace-nowrap">dalam Satu Layar.</span>
          </h2>

          {/* Paragraf */}
          <p className="w-full max-w-[560px] self-start font-sans text-[clamp(0.8125rem,3.8vw,1.75rem)] font-semibold leading-[1.45] text-tentang-dark md:col-span-2 md:max-w-none md:text-xl lg:absolute lg:left-[8.2639cqw] lg:top-[32.3cqw] lg:w-[51.3cqw] lg:max-w-none lg:text-[2.5cqw] lg:leading-[3.8417cqw]">
            <span className="whitespace-nowrap">Tak perlu lagi bingung warna atau jurusan.</span>
            <br />
            Semua info rute angkot Kota Bogor ada di genggamanmu.
          </p>

          {/* Kartu Tumpuk (lebar sama persis dengan peta saat tab dikecilkan: 280px) */}
          <div className="mt-4 flex w-full justify-center sm:mt-5 md:col-span-1 md:mt-0 md:justify-center lg:absolute lg:left-[13.4259cqw] lg:top-[50.5cqw] lg:mt-0 lg:block z-20">
            <KartuTumpuk />
          </div>

          {/* Peta Bogor untuk Tablet & Mobile (viewBox presisi tanpa ruang kosong, lebar 280px sama dengan kartu) */}
          <div className="mt-4 flex w-full justify-center sm:mt-5 md:col-span-1 md:mt-0 md:justify-center lg:hidden z-20">
            <img
              src={petaBogorCropped}
              role="img"
              alt="Peta wilayah Kota Bogor per kecamatan"
              className="w-[min(80vw,270px)] sm:w-[280px] md:w-[280px] h-auto select-none drop-shadow-md"
            />
          </div>

          {/* Peta Bogor untuk Desktop (mempertahankan rasio dan koordinat asli Figma) */}
          <div className="hidden lg:block lg:absolute lg:left-[47.9cqw] lg:top-[9.72cqw] lg:w-[52.2cqw] lg:max-w-none z-20">
            <img
              src={petaBogor}
              role="img"
              alt="Peta wilayah Kota Bogor per kecamatan"
              className="h-auto w-full select-none drop-shadow-[0_0.2778cqw_0.7639cqw_rgba(0,0,0,0.25)]"
            />
          </div>
        </div>
      </div>
    </section>
  )
}
