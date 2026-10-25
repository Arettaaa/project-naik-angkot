import latarTentang from '../assets/tentang/latar-tentang.svg'
import latarFitur from '../assets/fitur/latar-fitur.svg'
import petaBogor from '../assets/tentang/peta-bogor.svg'
import KartuTumpuk from './KartuTumpuk'

export default function Tentang() {
  return (
    <section
      id="tentang"
      className="relative z-10 -mt-[4.4444cqw] w-full overflow-hidden bg-transparent scroll-mt-24 lg:-mt-[25.625cqw] lg:scroll-mt-[10cqw]"
    >
      <div className="relative mx-auto w-full max-w-[1920px] [container-type:inline-size]">
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <img
            src={latarTentang}
            alt=""
            className="absolute -left-[0.3472cqw] top-0 w-[100.6944cqw] max-w-none select-none"
          />
          <img
            src={latarFitur}
            alt=""
            className="absolute -left-[0.4167cqw] top-[43.2639cqw] w-[100cqw] max-w-none select-none"
          />
        </div>

        <div className="relative flex flex-col items-center gap-8 px-5 pb-20 pt-40 sm:px-8 lg:block lg:h-[81.25cqw] lg:px-0 lg:pb-0 lg:pt-0">
          <h2 className="w-full max-w-[560px] self-start font-display text-[clamp(2rem,8vw,3.25rem)] font-bold leading-[0.93] text-tentang-dark lg:absolute lg:left-[8.2639cqw] lg:top-[21.7361cqw] lg:w-[31.5278cqw] lg:max-w-none lg:text-[4.1667cqw] lg:leading-[3.8417cqw] lg:whitespace-nowrap">
            <span className="block whitespace-nowrap">Rute Angkot</span>
            <span className="block whitespace-nowrap">dalam Satu Layar.</span>
          </h2>

          <p className="w-full max-w-[560px] self-start font-sans text-[clamp(0.875rem,4vw,1.75rem)] font-medium leading-[1.45] text-tentang-dark lg:absolute lg:left-[8.2639cqw] lg:top-[30.6944cqw] lg:w-[50.7833cqw] lg:max-w-none lg:text-[2.5cqw] lg:leading-[3.8417cqw]">
            Tak perlu lagi bingung warna atau jurusan.
            <br />
            Semua info trayek Kota Bogor ada di
            <br />
            genggamanmu.
          </p>

          <div className="w-full max-w-[320px] lg:absolute lg:left-[47.9cqw] lg:top-[9.72cqw] lg:w-[52.2cqw] lg:max-w-none">
            <img
              src={petaBogor}
              role="img"
              alt="Peta wilayah Kota Bogor per kecamatan"
              className="mx-auto h-auto w-full select-none drop-shadow-[0_0.2778cqw_0.7639cqw_rgba(0,0,0,0.25)] lg:mx-0"
            />
          </div>

          <div className="flex w-full justify-center lg:absolute lg:left-[13.4259cqw] lg:top-[47.2917cqw] lg:block">
            <KartuTumpuk />
          </div>
        </div>
      </div>
    </section>
  )
}
