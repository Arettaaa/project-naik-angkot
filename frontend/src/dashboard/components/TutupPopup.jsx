import { useMap } from 'react-leaflet'
import { IconX } from '../icons'

export default function TutupPopup() {
  const map = useMap()
  return (
    <button onClick={() => map.closePopup()} aria-label="Tutup" className="text-dark/40 hover:text-dark">
      <IconX className="h-4 w-4" />
    </button>
  )
}