// Ambil lokasi GPS yang paling akurat dalam beberapa detik.
// Fix pertama dari browser sering meleset ratusan meter (apalagi di laptop), jadi kita tunggu
// sebentar sambil mengambil yang akurasinya paling kecil.
export const AKURAT_M = 60 // di bawah ini dianggap cukup tepat untuk naik angkot

export function ambilLokasi({ cukup = 25, maksMs = 8000 } = {}) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Browser tidak mendukung lokasi.'))
    let terbaik = null
    let selesai = false
    const akhiri = (hasil, err) => {
      if (selesai) return
      selesai = true
      navigator.geolocation.clearWatch(id)
      clearTimeout(t)
      if (hasil) resolve(hasil)
      else reject(err)
    }
    const id = navigator.geolocation.watchPosition(
      (p) => {
        const g = { lat: +p.coords.latitude.toFixed(6), lng: +p.coords.longitude.toFixed(6), akurasi: Math.round(p.coords.accuracy) }
        if (!terbaik || g.akurasi < terbaik.akurasi) terbaik = g
        if (g.akurasi <= cukup) akhiri(terbaik)
      },
      (e) => {
        if (terbaik) return akhiri(terbaik)
        akhiri(null, new Error(e.code === 1 ? 'Izin lokasi ditolak. Izinkan lokasi di browser, atau pilih lewat peta.' : 'Lokasi tidak tersedia. Coba lagi atau pilih lewat peta.'))
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: maksMs },
    )
    const t = setTimeout(() => akhiri(terbaik, new Error('Lokasi tidak ketemu. Coba lagi atau pilih lewat peta.')), maksMs)
  })
}

// zoom yang pas supaya lingkaran akurasi kelihatan
export const zoomUntuk = (akurasi) => (akurasi <= 40 ? 18 : akurasi <= 150 ? 17 : akurasi <= 600 ? 16 : 15)
