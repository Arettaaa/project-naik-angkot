import { nomor } from './lib'

// Nomor yang masih dipakai warga & Moovit untuk trayek SK (nomor lama sebelum rerouting 2017).
// Contoh: angkot 03 (Cimahpar – BTM) oleh mahasiswa SV IPB masih disebut "05", angkot 30 disebut "08".
// Dasar: jalurnya sama dengan rekaman GPS rute lama 2016–2019 (bogor-angkot-gtfs) DAN urutan halte jalur
// bernomor itu di Moovit (Nov 2026). Hanya yang nomornya berbeda yang dicantumkan.
export const NOMOR_WARGA = {
  '02': '04', // Warung Nangka – BTM (Moovit juga memakai 02)
  '03': '05', // Cimahpar – BTM, lewat Jl. Kumbang / Lodaya (SV IPB)
  '05': '06', // Ciheuleut – BTM
  '08': '10', // Taman Pajajaran – Bantar Kemang – Terminal Merdeka
  '23': '20', // Taman Griya Kencana – Pasar Anyar
  '24': '22', // Pasar Anyar – Pondok Rumput
  '30': '08', // Warung Jambu – BTM, lewat Jl. Kumbang / Lodaya (SV IPB)
}

export const nomorWarga = (kode) => NOMOR_WARGA[nomor(kode)] ?? null

// Trayek lama di luar SK yang masih jalan (kode berakhiran AK, mis. 09AK = "09" Ciparigi – Sukasari/Ekalokasari).
export const trayekLama = (kode) => /AK$/i.test(nomor(kode))

// nomor untuk ditampilkan: "09AK" -> "09 lama", nomor SK apa adanya
export const nomorTampil = (kode) => (trayekLama(kode) ? `${nomor(kode).replace(/AK$/i, '')} lama` : nomor(kode))

/** "03 (dulu 05)" atau "03" */
export const nomorLengkap = (kode) => {
  if (trayekLama(kode)) return `${nomor(kode).replace(/AK$/i, '')} (lama)`
  const w = nomorWarga(kode)
  return w ? `${nomor(kode)} (dulu ${w})` : nomor(kode)
}

/** teks untuk pencarian: nomor warga ikut dicari */
export const teksCariWarga = (kode) => {
  const w = nomorWarga(kode)
  return w ? ` ${w} angkot ${w} dulu ${w}` : ''
}
