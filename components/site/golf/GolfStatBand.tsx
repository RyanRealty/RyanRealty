import { Container, Section } from '@/components/site/primitives'
import type { GOLF_STAT_BAND } from '@/data/golf-landing'

/**
 * GolfStatBand — a navy Section row of large Amboqia stats.
 *
 * Renders GOLF_STAT_BAND values in tabular-nums Amboqia display face,
 * white text on the bg-primary navy surface. Labels in smaller Geist
 * below each value.
 *
 * Design-system rules:
 *   - tone="navy" → bg-primary text-white (no hex, no bg-black)
 *   - DisplayHeading (font-display = Amboqia Boriango) for values
 *   - tabular-nums on stats
 *   - No arbitrary bracket utilities
 */

type Stat = { value: string; label: string }

type Props = {
  stats: Stat[]
}

export function GolfStatBand({ stats }: Props) {
  if (!stats.length) return null

  return (
    <Section tone="navy" padding="default">
      <Container>
        <ul className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {stats.map((stat) => (
            <li key={stat.label} className="flex flex-col items-center text-center gap-1.5">
              <span
                className="font-display tabular-nums leading-none tracking-tight text-white"
                style={{ fontSize: 'clamp(2rem,5vw,3.5rem)' }}
              >
                {stat.value}
              </span>
              <span className="text-sm font-medium text-white/70 leading-snug">
                {stat.label}
              </span>
            </li>
          ))}
        </ul>
      </Container>
    </Section>
  )
}
