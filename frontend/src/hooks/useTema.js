import { useSyncExternalStore } from 'react'

// Tema terang/gelap: disimpan di localStorage ('naik-tema'), default mengikuti pengaturan sistem.
// Diterapkan sebagai atribut `data-theme` di <html>; gaya gelap ada di tema-gelap.css.
const KUNCI = 'naik-tema'
const pendengar = new Set()

function bacaAwal() {
  try {
    const s = localStorage.getItem(KUNCI)
    if (s === 'dark' || s === 'light') return s
  } catch {
    /* abaikan */
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function terapkan(t) {
  const el = document.documentElement
  el.dataset.theme = t // dipakai khusus dashboard; landing page selalu terang
}

let tema = typeof window === 'undefined' ? 'light' : document.documentElement.dataset.theme || bacaAwal()
if (typeof window !== 'undefined') terapkan(tema)

export function setTema(t) {
  const el = document.documentElement
  // transisi warna halus hanya sesaat saat berganti tema (bukan terus-menerus)
  el.classList.add('tema-ganti')
  window.setTimeout(() => el.classList.remove('tema-ganti'), 400)
  tema = t
  terapkan(t)
  try {
    localStorage.setItem(KUNCI, t)
  } catch {
    /* abaikan */
  }
  pendengar.forEach((fn) => fn())
}

export default function useTema() {
  const t = useSyncExternalStore(
    (fn) => {
      pendengar.add(fn)
      return () => pendengar.delete(fn)
    },
    () => tema,
    () => 'light',
  )
  return [t, () => setTema(t === 'dark' ? 'light' : 'dark')]
}

