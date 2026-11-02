export const KEPADATAN = {
  Tinggi: { warna: '#E5484D', tebal: 4.5, label: 'Tinggi', ket: '≥ 4 trayek' },
  Sedang: { warna: '#FFB800', tebal: 3.2, label: 'Sedang', ket: '2–3 trayek' },
  Rendah: { warna: '#09B58D', tebal: 2, label: 'Rendah', ket: '1 trayek' },
}
export const URUTAN_KEPADATAN = ['Tinggi', 'Sedang', 'Rendah']

export const rupiah = (n) => (n == null ? '-' : 'Rp' + Number(n).toLocaleString('id-ID'))

export function jarak(m) {
  if (m == null) return '-'
  return m >= 1000 ? `${(m / 1000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} km` : `${Math.round(m)} m`
}

// "Trayek 08" -> "08"
export const nomor = (kode) => String(kode ?? '').replace(/^Trayek\s*/i, '')

// perkiraan waktu: jalan kaki 4,5 km/jam, angkot 15 km/jam (rata-rata kota, termasuk ngetem)
export const menitJalan = (m) => Math.max(1, Math.round(m / 75))
export const menitAngkot = (m) => Math.max(1, Math.round(m / 250))

// aman untuk teks di popup Leaflet (HTML string)
export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
