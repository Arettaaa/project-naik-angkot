import { KEPADATAN, tingkatDari } from './warna'

// Hitungan info kepadatan dari GeoJSON ruas (/api/kepadatan) — sama persis dengan yang tergambar di peta.

const NAMA_UMUM = /^(jalan (lingkungan|akses|lokal|penghubung)|sekitar\b|\(tanpa nama\))/i
const daftarKode = (p) => String(p.trayek ?? '').split(',').map((s) => s.trim()).filter(Boolean)
const kosong = () => Object.fromEntries(KEPADATAN.map((k) => [k.key, 0]))

function persen(km) {
  const total = Object.values(km).reduce((a, b) => a + b, 0)
  return { km, total, pct: Object.fromEntries(Object.entries(km).map(([k, v]) => [k, total ? (v / total) * 100 : 0])) }
}

// Ringkasan kota: km per kelas + jalan bernama yang paling banyak dilewati trayek.
export function ringkasKota(fc) {
  const km = kosong()
  const jalan = new Map()
  for (const { properties: p } of fc.features) {
    const m = Number(p.panjang_m) || 0
    km[p.tingkat] = (km[p.tingkat] ?? 0) + m / 1000
    if (!p.nama_jalan || NAMA_UMUM.test(p.nama_jalan)) continue
    const j = jalan.get(p.nama_jalan) ?? { nama: p.nama_jalan, maks: 0, mOverlap: 0, kode: new Set() }
    j.maks = Math.max(j.maks, p.jumlah_trayek)
    if (p.jumlah_trayek >= 2) j.mOverlap += m
    daftarKode(p).forEach((k) => j.kode.add(k))
    jalan.set(p.nama_jalan, j)
  }
  const terpadat = [...jalan.values()]
    .filter((j) => j.maks >= 2 && j.mOverlap >= 100)
    .sort((a, b) => b.maks - a.maks || b.mOverlap - a.mOverlap)
    .slice(0, 5)
    .map((j) => ({ ...j, tingkat: tingkatDari(j.maks), kode: [...j.kode].sort() }))
  return { ...persen(km), terpadat }
}

// Kepadatan sepanjang satu trayek: km per kelas + kepadatan tiap jalan (untuk diagram jalur).
export function ringkasRute(fc, kode) {
  const km = kosong()
  const perJalan = new Map()
  for (const { properties: p } of fc.features) {
    if (!daftarKode(p).includes(kode)) continue
    const m = Number(p.panjang_m) || 0
    km[p.tingkat] = (km[p.tingkat] ?? 0) + m / 1000
    if (!p.nama_jalan) continue
    const j = perJalan.get(p.nama_jalan) ?? { maks: 0, m: 0, kode: new Set() }
    j.maks = Math.max(j.maks, p.jumlah_trayek)
    j.m += m
    daftarKode(p).forEach((k) => j.kode.add(k))
    perJalan.set(p.nama_jalan, j)
  }
  return { ...persen(km), perJalan }
}

// Urutan jalan satu arah (dari /api/trayek/{kode}) → baris diagram dengan kelas kepadatannya.
export function barisJalur(urutan, perJalan, kode) {
  return (urutan ?? [])
    .map((nama) => {
      const j = perJalan.get(nama)
      if (!j || /^\(tanpa nama\)$/i.test(nama)) return null
      return { nama, maks: j.maks, tingkat: tingkatDari(j.maks), lain: [...j.kode].filter((k) => k !== kode).sort() }
    })
    .filter(Boolean)
}

// Semua jalan bernama di data kepadatan (untuk tampilan "Lihat seluruh ruas jalan").
// Kelas per jalan memakai jumlah trayek terbanyak di ruas-ruasnya, sama dengan daftar jalan terpadat.
export function daftarJalan(fc) {
  const jalan = new Map()
  for (const { properties: p } of fc.features) {
    const nama = p.nama_jalan
    if (!nama || /^\(tanpa nama\)$/i.test(nama)) continue
    const m = Number(p.panjang_m) || 0
    const j = jalan.get(nama) ?? { nama, maks: 0, m: 0, kode: new Set() }
    j.maks = Math.max(j.maks, p.jumlah_trayek)
    j.m += m
    daftarKode(p).forEach((k) => j.kode.add(k))
    jalan.set(nama, j)
  }
  const list = [...jalan.values()]
    .map((j) => ({ nama: j.nama, maks: j.maks, km: j.m / 1000, tingkat: tingkatDari(j.maks), kode: [...j.kode].sort() }))
    .sort((a, b) => b.maks - a.maks || b.km - a.km || a.nama.localeCompare(b.nama, 'id'))
  const jumlah = Object.fromEntries(KEPADATAN.map((k) => [k.key, 0]))
  for (const j of list) jumlah[j.tingkat]++
  return { list, jumlah, total: list.length }
}

// Satu jalan dari daftar (dipakai saat ruas dipilih lewat peta, belum tentu ada di daftar tersaring).
export const cariJalan = (daftar, nama) => daftar.list.find((j) => j.nama === nama) ?? null

export const fmtKm = (x) => `${x.toLocaleString('id-ID', { maximumFractionDigits: x < 10 ? 1 : 0 })} km`
