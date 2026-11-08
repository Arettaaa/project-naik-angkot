import { menitAngkot, menitJalan } from '../../utils/format'

// Satu bentuk untuk semua opsi rute (1, 2, atau 3 angkot), dari respons /rekomendasi.
// Respons baru punya `legs` & `pindah`; bentuk lama (kode_1/kode_2) tetap didukung.
const garis = (s) => (s?.coordinates ?? []).map(([x, y]) => [y, x])
const titik = (p) => (p?.coordinates ? [p.coordinates[1], p.coordinates[0]] : null)

export function normalOpsi(o) {
  let legs
  let pindah
  if (o.legs) {
    legs = o.legs.map((l) => ({ kode: l.kode_trayek, arah: l.arah, jarakM: l.jarak_m, garis: garis(l.segmen) }))
    pindah = (o.pindah ?? []).map((p) => ({ titik: titik(p.titik), jalanM: p.jalan_m }))
  } else if ('kode_1' in o) {
    legs = [
      { kode: o.kode_1, arah: o.arah_1, jarakM: o.jarak_angkot_1_m, garis: garis(o.segmen_1) },
      { kode: o.kode_2, arah: o.arah_2, jarakM: o.jarak_angkot_2_m, garis: garis(o.segmen_2) },
    ]
    pindah = [{ titik: titik(o.titik_transfer), jalanM: o.jalan_pindah_m }]
  } else {
    legs = [{ kode: o.kode_trayek, arah: o.arah, jarakM: o.jarak_angkot_m, garis: garis(o.segmen) }]
    pindah = []
  }
  const jalanPindah = pindah.reduce((s, p) => s + (p.jalanM ?? 0), 0)
  const jarakAngkot = legs.reduce((s, l) => s + (l.jarakM ?? 0), 0)
  const jalan = o.jalan_ke_naik_m + o.jalan_dari_turun_m + jalanPindah
  return {
    legs,
    pindah,
    kode: legs.map((l) => l.kode),
    jalanKeNaik: o.jalan_ke_naik_m,
    jalanDariTurun: o.jalan_dari_turun_m,
    jalanPindah,
    jalan,
    jarakAngkot,
    tarif: o.tarif,
    menit: o.menit ?? menitJalan(jalan) + menitAngkot(jarakAngkot) + 5 * legs.length,
  }
}

// jenis hasil di respons, urut tampil
export const JENIS_OPSI = [
  ['langsung', 'Langsung · 1 angkot'],
  ['transfer', 'Pindah 1x · 2 angkot'],
  ['transfer2', 'Pindah 2x · 3 angkot'],
]
