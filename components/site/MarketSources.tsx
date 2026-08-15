import { Body, Container, Eyebrow, Section, Stack, TextLink } from '@/components/site/primitives'

/**
 * MarketSources: the ONE outbound-citation block for every market-data
 * surface (housing-market, cities, communities, zip). Renders a short
 * "Sources" line with real anchor tags to the authority behind each figure
 * actually shown on the page.
 *
 * Why this exists. A site-wide audit found ONE editorial outbound link on
 * the entire domain and named that as a reason nothing cites Ryan Realty
 * back (documents that cite sources read as more reference-like to a search
 * or AI-answer engine). The fix is not link padding, CLAUDE.md's receipt
 * test still applies. Only pass a source key whose data genuinely backs
 * something rendered on that page. See SOURCE_DEFS for what each key means
 * and when it is appropriate.
 *
 * Single shared component so every page cites the same way, with the same
 * URLs and the same wording. Do not hand-roll an anchor tag for a source on
 * a market page. Add a key here instead.
 */

export type MarketSourceKey = 'ods' | 'census'

type SourceDef = {
  /** Anchor text. */
  name: string
  href: string
  /**
   * One clause (sentence case, no leading capital) describing what this
   * source backs on the page it appears. Follows "<name>, " in the render.
   */
  note: string
}

/**
 * Only add a key here when the source is a real, checkable authority for a
 * figure this codebase actually renders somewhere in `app/housing-market`,
 * `app/cities`, `app/communities`, or `app/zip`.
 *
 * ods: every live listing count, median price, days-on-market, and
 *      months-of-supply figure on these surfaces traces to Oregon Data
 *      Share (the ORMLS/MLSCO/KCAR/SOMLS cooperative), the same MLS feed
 *      already attributed on every listing detail page
 *      (components/listing/ListingAttribution.tsx). Cite on every page in
 *      scope, since every one of them renders MLS-sourced numbers.
 * census: population figures on the city pages (CITY_QUICK_FACTS in
 *      lib/cities.ts) trace to Census Bureau estimates. Cite ONLY on pages
 *      that actually render a population figure.
 *
 * NOT included: Oregon Housing and Community Services, the Bureau of Labor
 * Statistics, and FRED all publish real Oregon housing/economic series, but
 * as of this pass no page in scope renders a figure sourced from any of the
 * three (no employment stat, no mortgage-rate figure, no state housing-needs
 * stat). Attaching one of those links here would be link padding, not a
 * citation, so they stay out until a page actually carries that data.
 */
const SOURCE_DEFS: Record<MarketSourceKey, SourceDef> = {
  ods: {
    name: 'Oregon Data Share',
    href: 'https://www.oregondatashare.com',
    note: 'the regional MLS cooperative behind the live listing and market data on this page',
  },
  census: {
    name: 'U.S. Census Bureau',
    href: 'https://www.census.gov',
    note: 'population estimate',
  },
}

type Props = {
  /** Which sources to cite on this page. Order controls render order. */
  sources: ReadonlyArray<MarketSourceKey>
  className?: string
}

export function MarketSources({ sources, className }: Props) {
  if (sources.length === 0) return null
  return (
    <Section as="div" padding="tight" divider className={className}>
      <Container>
        <Stack gap="tight" className="max-w-[70ch]">
          <Eyebrow>Sources</Eyebrow>
          <Body size="small" tone="muted">
            {sources.map((key, i) => {
              const source = SOURCE_DEFS[key]
              return (
                <span key={key}>
                  <TextLink href={source.href} external tone="muted" weight="normal" underline="always">
                    {source.name}
                  </TextLink>
                  {`, ${source.note}`}
                  {i < sources.length - 1 ? '. ' : '.'}
                </span>
              )
            })}
          </Body>
        </Stack>
      </Container>
    </Section>
  )
}
