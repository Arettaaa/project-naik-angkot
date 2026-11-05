import { useEffect, useState } from 'react'

// Panggil fungsi API sekali (dan ulang saat deps berubah). fn = null -> tidak memanggil apa-apa.
export default function useApi(fn, deps = []) {
  const [state, setState] = useState({ data: null, loading: !!fn, error: null })

  useEffect(() => {
    if (!fn) {
      setState({ data: null, loading: false, error: null })
      return
    }
    let aktif = true
    setState((s) => ({ ...s, loading: true, error: null }))
    fn()
      .then((data) => aktif && setState({ data, loading: false, error: null }))
      .catch((error) => aktif && setState({ data: null, loading: false, error }))
    return () => {
      aktif = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return state
}
