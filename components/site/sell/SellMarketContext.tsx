/**
 * SellMarketContext — live Bend market context strip for the /sell page.
 *
 * Renders only when real getMarketPulse data is available. Falls back to
 * a factual non-numeric trust line when the data is unavailable or empty.
 * No invented numbers.
 *
 * Design-token colors only. Server-renderable.
 */

import type { MarketPulse } from '@/lib/data'
import {
  Body,
  Container,
  Eyebrow,
  Section,
  Stack,
  TextLink,
} from '@/components/site/primitives'

function mosVerdict(mos: number): string {
  if (mos <= 4) return "a seller's market"
  if (mos < 6) return 'a balanced market'
  return "a buyer's market"
}

type Props = {
  pulse: MarketPulse | null
}

export function SellMarketContext({ pulse }: Props) {
  const activeCount = pulse?.activeCount ?? 0
  const mosRaw =
    typeof pulse?.monthsOfSupply === 'number' ? pulse.monthsOfSupply : null
  const mosRounded = mosRaw === null ? null : Math.round(mosRaw * 10) / 10
  const hasData = Boolean(pulse) && (activeCount > 0 || mosRaw !== null)

  const marketLine = hasData
    ? (activeCount > 0
        ? `${activeCount} single-family homes are for sale in Bend`
        : 'The Bend single-family market') +
      (mosRaw === null
        ? '.'
        : `, with ${mosRounded} months of supply, which is ${mosVerdict(mosRaw)}.`)
    : null

  return (
    <Section padding="tight" tone="default" divider>
      <Container>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-10">
          <Stack gap="tight" className="max-w-[60ch]">
            <Eyebrow>The Bend market right now</Eyebrow>
            {marketLine ? (
              <Body size="default" tone="muted" className="leading-[1.6]">
                {marketLine} Knowing the market before you list is how you price correctly from day one.
              </Body>
            ) : (
              <Body size="default" tone="muted" className="leading-[1.6]">
                We track the Central Oregon market in real time so your list price is based on what buyers are actually paying today, not what sold six months ago.
              </Body>
            )}
          </Stack>
          <div className="shrink-0">
            <TextLink href="/housing-market" tone="primary">
              View Central Oregon market data
            </TextLink>
          </div>
        </div>
      </Container>
    </Section>
  )
}
