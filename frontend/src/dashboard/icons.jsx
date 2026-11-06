// Ikon garis 24px (gaya lucide), warna ikut currentColor.
const base = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', viewBox: '0 0 24 24' }
const I = (d) =>
  function Icon({ className = 'h-5 w-5', ...p }) {
    return (
      <svg aria-hidden="true" className={className} {...base} {...p}>
        {d}
      </svg>
    )
  }

export const IconBus = I(<><path d="M8 6v6M15 6v6M2 12h19.6" /><path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3" /><circle cx="7" cy="18" r="2" /><path d="M9 18h5" /><circle cx="16" cy="18" r="2" /></>)
export const IconMap = I(<><path d="M14.1 4.4a2 2 0 0 0-1.8 0L8.6 6.2a2 2 0 0 1-1.8 0L3.4 4.5A1 1 0 0 0 2 5.4v12.4a1 1 0 0 0 .6.9l4.2 2.1a2 2 0 0 0 1.8 0l3.7-1.8a2 2 0 0 1 1.8 0l3.4 1.7a1 1 0 0 0 1.5-.9V7.4a1 1 0 0 0-.6-.9z" /><path d="M15 5.8v15M9 3.2v15" /></>)
export const IconRoute = I(<><circle cx="6" cy="19" r="3" /><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15" /><circle cx="18" cy="5" r="3" /></>)
export const IconSearch = I(<><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></>)
export const IconX = I(<path d="M18 6 6 18M6 6l12 12" />)
export const IconFilter = I(<path d="M22 3H2l8 9.5V19l4 2v-8.5z" />)
export const IconSliders = I(<><path d="M21 4h-7M10 4H3M21 12h-9M8 12H3M21 20h-5M12 20H3M14 2v4M8 10v4M16 18v4" /></>)
export const IconLayers = I(<><path d="m12.8 2.2a2 2 0 0 0-1.6 0L2.6 6.1a1 1 0 0 0 0 1.8l8.6 3.9a2 2 0 0 0 1.6 0l8.6-3.9a1 1 0 0 0 0-1.8z" /><path d="m2 12 9.2 4.2a2 2 0 0 0 1.6 0L22 12" /><path d="m2 17 9.2 4.2a2 2 0 0 0 1.6 0L22 17" /></>)
export const IconChevronRight = I(<path d="m9 18 6-6-6-6" />)
export const IconChevronDown = I(<path d="m6 9 6 6 6-6" />)
export const IconArrowRight = I(<path d="M5 12h14m-6-6 6 6-6 6" />)
export const IconPlus = I(<path d="M5 12h14M12 5v14" />)
export const IconMinus = I(<path d="M5 12h14" />)
export const IconLocate = I(<><path d="M2 12h3M19 12h3M12 2v3M12 19v3" /><circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="3" /></>)
export const IconEye = I(<><path d="M2.1 12.3a1 1 0 0 1 0-.7 10.8 10.8 0 0 1 19.8 0 1 1 0 0 1 0 .7 10.8 10.8 0 0 1-19.8 0" /><circle cx="12" cy="12" r="3" /></>)
export const IconEyeOff = I(<><path d="M10.7 5.1a10.7 10.7 0 0 1 11.2 6.6 1 1 0 0 1 0 .7 10.7 10.7 0 0 1-1.4 2.6M14.1 14.2a3 3 0 0 1-4.2-4.2M17.5 17.5a10.8 10.8 0 0 1-15.4-5.1 1 1 0 0 1 0-.7 10.8 10.8 0 0 1 4.4-5.2M2 2l20 20" /></>)
export const IconPin = I(<><path d="M20 10c0 5-5.5 10.2-7.4 11.8a1 1 0 0 1-1.2 0C9.5 20.2 4 15 4 10a8 8 0 0 1 16 0" /><circle cx="12" cy="10" r="3" /></>)
export const IconSignpost = I(<><path d="M12 3v3M12 16v5M18 6H6a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h12l3-2z" /><path d="M6 12h12a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H6l-3-2z" /></>)
export const IconSwap = I(<><path d="m3 16 4 4 4-4M7 20V4M21 8l-4-4-4 4M17 4v16" /></>)
export const IconChevronUp = I(<path d="m18 15-6-6-6 6" />)
export const IconNavigation = I(<path d="m3 11 19-9-9 19-2-8z" />)
