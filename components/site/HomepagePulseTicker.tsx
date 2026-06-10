// brand-voice:exempt
/**
 * HomepagePulseTicker — CSS-marquee ribbon of real market events.
 *
 * Server-renderable (no client hooks required). The hover-pause is applied
 * via a CSS pseudo-class only.
 *
 * Reduced-motion: the animation is disabled via @media prefers-reduced-motion
 * in globals.css; the chips render statically when motion is off.
 *
 * Props:
 *   chips — up to 20 activity chips with tag / price / location / timeAgo
 */

function fmtPrice(n: number | null): string {
  if (n == null) return ''
  const k = Math.round(n / 1000) * 1000
  return `$${k.toLocaleString()}`
}

const TAG_CLASS: Record<string, string> = {
  Sold: 'bg-white/10 text-white/90',
  New: 'bg-green-400/12 text-green-400',
  Pending: 'bg-white/10 text-white/82',
  'Price drop': 'bg-white/7 text-white/70',
}

export type PulseChip = {
  id?: string
  tag: 'Sold' | 'New' | 'Pending' | 'Price drop' | null
  price: number | null
  location: string
  timeAgo: string
}

function Chip({ chip }: { chip: PulseChip }) {
  const tagCls = (chip.tag != null ? TAG_CLASS[chip.tag] : null) ?? 'bg-white/10 text-white/80'
  return (
    <div
      className="inline-flex items-center gap-2 h-11 px-6 border-r border-white/8 flex-shrink-0"
      style={{ whiteSpace: 'nowrap' }}
    >
      <span
        className={`text-[10px] font-bold uppercase tracking-[0.10em] px-1.5 py-0.5 rounded-full ${tagCls}`}
      >
        {chip.tag}
      </span>
      {chip.price ? (
        <span className="text-white font-semibold text-[12px] tabular-nums">
          {fmtPrice(chip.price)}
        </span>
      ) : null}
      <span className="text-white/55 text-[12px]">{chip.location}</span>
      <span className="text-white/35 text-[11px]">{chip.timeAgo}</span>
    </div>
  )
}

type Props = {
  chips: PulseChip[]
}

export default function HomepagePulseTicker({ chips }: Props) {
  if (chips.length === 0) return null

  // Duplicate the chips so the CSS marquee loops seamlessly (translateX -50%)
  const doubled = [...chips, ...chips]

  return (
    <div
      className="bg-primary overflow-hidden h-11 flex items-center border-b border-white/6"
      aria-label="Recent market activity"
      role="marquee"
      aria-live="off"
      // Pause on hover via CSS class
      style={{ cursor: 'default' }}
    >
      <div
        className="rr-pulse-track flex items-center"
        style={{ animation: 'rr-ticker 38s linear infinite', whiteSpace: 'nowrap' }}
      >
        {doubled.map((chip, i) => (
          <Chip key={`${chip.id}-${i}`} chip={chip} />
        ))}
      </div>

      <style>{`
        @keyframes rr-ticker {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        div:hover .rr-pulse-track {
          animation-play-state: paused;
        }
        @media (prefers-reduced-motion: reduce) {
          .rr-pulse-track { animation: none !important; }
        }
      `}</style>
    </div>
  )
}
