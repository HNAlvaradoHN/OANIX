export type OanixIconName =
  | 'search'
  | 'lock'
  | 'menu'
  | 'pin'
  | 'tag'
  | 'folder'
  | 'palette'
  | 'shield'
  | 'trash'
  | 'grid'
  | 'sun'
  | 'moon'
  | 'plus'
  | 'sliders'
  | 'star'
  | 'edit'
  | 'image'
  | 'imageOff'
  | 'back'
  | 'user'
  | 'backup'
  | 'history'
  | 'close'

interface OanixIconProps {
  name: OanixIconName
  className?: string
  size?: number
}

export function OanixIcon({ name, className, size = 18 }: OanixIconProps) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className,
    'aria-hidden': true,
  }

  switch (name) {
    case 'search':
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="6.5" />
          <path d="m16 16 4 4" />
        </svg>
      )
    case 'lock':
      return (
        <svg {...common}>
          <rect x="5" y="10" width="14" height="10" rx="3" />
          <path d="M8.5 10V7.5a3.5 3.5 0 0 1 7 0V10" />
          <path d="M12 14v2.5" />
        </svg>
      )
    case 'menu':
      return (
        <svg {...common}>
          <circle cx="12" cy="5" r="1" fill="currentColor" stroke="none" />
          <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
          <circle cx="12" cy="19" r="1" fill="currentColor" stroke="none" />
        </svg>
      )
    case 'pin':
      return (
        <svg {...common}>
          <path d="m9 3 6 6" />
          <path d="m7.5 8.5 8 8" />
          <path d="M14.5 4.5 19 9l-3.2 2.2-.8 4.6-3.3 3.3-6.8-6.8 3.3-3.3 4.6-.8Z" />
          <path d="m8.2 15.8-4.7 4.7" />
        </svg>
      )
    case 'tag':
      return (
        <svg {...common}>
          <path d="M20 13.2 13.2 20a2 2 0 0 1-2.8 0L4 13.6V4h9.6L20 10.4a2 2 0 0 1 0 2.8Z" />
          <circle cx="8.5" cy="8.5" r="1.25" />
        </svg>
      )
    case 'folder':
      return (
        <svg {...common}>
          <path d="M3.5 7.5h6l2-2H20a1.5 1.5 0 0 1 1.5 1.5v11A1.5 1.5 0 0 1 20 19.5H4A1.5 1.5 0 0 1 2.5 18V9A1.5 1.5 0 0 1 4 7.5Z" />
        </svg>
      )
    case 'palette':
      return (
        <svg {...common}>
          <path d="M12 3a9 9 0 0 0 0 18h1.1a1.9 1.9 0 0 0 1.3-3.3 1.9 1.9 0 0 1 1.3-3.3H18a3 3 0 0 0 3-3A8.5 8.5 0 0 0 12 3Z" />
          <circle cx="7.5" cy="10" r=".8" fill="currentColor" stroke="none" />
          <circle cx="10" cy="6.8" r=".8" fill="currentColor" stroke="none" />
          <circle cx="14.2" cy="6.7" r=".8" fill="currentColor" stroke="none" />
        </svg>
      )
    case 'shield':
    case 'backup':
      return (
        <svg {...common}>
          <path d="M12 3 19 6v5c0 4.8-2.9 8.3-7 10-4.1-1.7-7-5.2-7-10V6Z" />
          {name === 'backup' ? (
            <>
              <path d="M9 12h6" />
              <path d="m12 9 3 3-3 3" />
            </>
          ) : (
            <path d="m9.2 12 1.8 1.8 3.8-4" />
          )}
        </svg>
      )
    case 'trash':
      return (
        <svg {...common}>
          <path d="M4.5 7h15" />
          <path d="M9 7V4.5h6V7" />
          <path d="m6.5 7 .8 13h9.4l.8-13" />
          <path d="M10 11v5" />
          <path d="M14 11v5" />
        </svg>
      )
    case 'grid':
      return (
        <svg {...common}>
          <rect x="3.5" y="3.5" width="7" height="7" rx="2" />
          <rect x="13.5" y="3.5" width="7" height="7" rx="2" />
          <rect x="3.5" y="13.5" width="7" height="7" rx="2" />
          <rect x="13.5" y="13.5" width="7" height="7" rx="2" />
        </svg>
      )
    case 'sun':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4" />
        </svg>
      )
    case 'moon':
      return (
        <svg {...common}>
          <path d="M20 15.2A8.5 8.5 0 0 1 8.8 4a8.5 8.5 0 1 0 11.2 11.2Z" />
        </svg>
      )
    case 'plus':
      return (
        <svg {...common}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      )
    case 'sliders':
      return (
        <svg {...common}>
          <path d="M4 6h10M18 6h2M4 12h3M11 12h9M4 18h8M16 18h4" />
          <circle cx="16" cy="6" r="2" />
          <circle cx="9" cy="12" r="2" />
          <circle cx="14" cy="18" r="2" />
        </svg>
      )
    case 'star':
      return (
        <svg {...common}>
          <path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z" />
        </svg>
      )
    case 'edit':
      return (
        <svg {...common}>
          <path d="M4 20h4l11-11-4-4L4 16Z" />
          <path d="m13.5 6.5 4 4" />
        </svg>
      )
    case 'image':
      return (
        <svg {...common}>
          <rect x="3" y="4" width="18" height="16" rx="3" />
          <circle cx="8.5" cy="9" r="1.5" />
          <path d="m5 17 4.5-4.5 3.2 3.2 2.2-2.2L19 17" />
        </svg>
      )
    case 'imageOff':
      return (
        <svg {...common}>
          <path d="M4.5 4.5A3 3 0 0 0 3 7v10a3 3 0 0 0 3 3h12c.6 0 1.2-.2 1.7-.5" />
          <path d="M21 16.5V7a3 3 0 0 0-3-3H8.5" />
          <path d="m5 17 4.2-4.2 2 2" />
          <path d="m14.5 14.5.6-.6L19 17" />
          <path d="M3 3l18 18" />
        </svg>
      )
    case 'back':
      return (
        <svg {...common}>
          <path d="m10 5-7 7 7 7" />
          <path d="M3 12h18" />
        </svg>
      )
    case 'user':
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="4" />
          <path d="M4.5 21a7.5 7.5 0 0 1 15 0" />
        </svg>
      )
    case 'history':
      return (
        <svg {...common}>
          <path d="M4.4 8.5A8.5 8.5 0 1 1 3.5 14" />
          <path d="M4.4 4.5v4h4" />
          <path d="M12 7.5V12l3 1.8" />
        </svg>
      )
    case 'close':
      return (
        <svg {...common}>
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      )
    default:
      return null
  }
}
