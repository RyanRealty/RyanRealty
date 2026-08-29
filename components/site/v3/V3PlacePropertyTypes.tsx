/**
 * PLACE SECTION — one section per property type that exists in a place, as
 * PATTERN 1: INSTRUMENT.
 *
 * WHY INSTRUMENT (design_system/public/PUBLIC_UI.md section 3, locked
 * 2026-08-11): "the answer, big. One verdict/number/range in Amboqia with its
 * supporting figures and source line beneath." A buyer looking for a townhome
 * in Redmond asks one question, and this section answers it: the type and the
 * place in the heading, what is on the market in one sentence, the measured
 * figures that support it under a hairline, the trace beneath them, and the one
 * door the answer earns. The facts already arrive as value-and-label pairs,
 * which is what a V3Figure is, and every one of them is a market figure with a
 * window — the shape Instrument exists for and the shape Quiet forbids.
 *
 * It is not a Ledger: nothing here is a list of rows, and the section has one
 * door, not one per row. It is not a Field: there is no inventory surface and
 * no map. It is not a Sheet: nothing is being filled in.
 *
 * THE ENUMERATION. A place with four property types renders four of these, in a
 * row. PUBLIC_UI.md section 3's rhythm rule permits that explicitly since the
 * 2026-08-26 amendment: an enumeration of one repeated thing, one section per
 * member of a set the place itself determines, is ONE logical section rendered
 * N times, not N adjacent sections. Every member here is the same question
 * asked of a different property type, and the set is whatever types the place
 * actually contains.
 *
 * ABSENCE IS THE POINT. A place with no condos gets no condo section — not an
 * empty one, not a "0 condos" line. `rows` already omits a segment the metric
 * layer withheld, so a missing type simply never reaches this component. That
 * matters twice over: an empty section is thin content on a page whose whole
 * purpose is depth, and "0 condos" read as a claim about the world is exactly
 * the false-absence D13 forbids — the metric layer withholding a figure is not
 * the same as there being none.
 *
 * A TYPE WITH NO SUPPORTING FIGURE IS NOT AN INSTRUMENT. Below neighbourhood
 * grain the registry publishes counts alone, so a plat can hold a type whose
 * pending and closed counts were both withheld. V3Instrument's own contract
 * refuses that case ("a verdict with nothing under it and a source line
 * explaining nothing is a different section") and names Quiet as the answer, so
 * that type renders as Quiet: the same heading and the same sentence, no figure
 * grid, and no trace under figures that are not there.
 *
 * WHY IT MOVED HERE. It used to live at components/site/PlacePropertyTypes.tsx
 * on `section`/`wrap`/`sec-head`/`sec-title`, none of which has an unscoped
 * definition in this repo: `.sec-title` exists only under `the deleted KB root class` and under
 * `.listing-detail`, and the other three only under `the deleted KB root class`. Each pattern
 * here mounts V3_ROOT_CLASS on its own outermost element, so a section carries
 * its own token scope and depends on no ancestor.
 *
 * Section 0: every number here comes from the row the metric layer published.
 * Nothing is computed, rounded or inferred in this file.
 */
import {
  publicSegmentBrowseHref,
  publicSegmentNoun,
} from '@/lib/data/market-truth/public-segments'
import { formatCount } from '@/lib/format/count'
import { formatPriceExact } from '@/lib/format/money'
import { formatMonthsOfSupply } from '@/lib/format/months-of-supply'
import { formatPaceShare } from '@/lib/data/market-truth/public-pace'
import { v3Text, type V3Text } from './atoms'
import { V3Instrument, type V3InstrumentFigure } from './V3Instrument'
import { V3Quiet, type V3QuietItem } from './V3Quiet'

/**
 * The narrowest shape this section can render. Deliberately looser than
 * PublicSegmentRow so the subdivision grain can use the same component: the
 * registry withholds price, months of supply and verdict below neighbourhood,
 * so a plat supplies counts alone. Everything optional simply does not render.
 */
export type PlaceSegmentInput = {
  segment: string
  activeCount: number | null
  pendingCount?: number | null
  closedCount?: number | null
  medianList?: number | null
  monthsOfSupply?: number | null
  daysToContract?: number | null
  saleToOriginal?: number | null
  priceCutShare?: number | null
}

interface Props {
  placeName: string
  citySlug: string | null
  postalCode?: string | null
  rows: readonly PlaceSegmentInput[]
}

/**
 * The lead sentence. Built only from figures that are actually present, so a
 * thin segment gets a short sentence rather than a padded one.
 */
function leadSentence(row: PlaceSegmentInput, placeName: string): string {
  const active = row.activeCount ?? 0
  const parts: string[] = []

  if (active >= 1) {
    parts.push(`${formatCount(active)} ${publicSegmentNoun(row.segment, active)} for sale in ${placeName}`)
  } else if (row.closedCount != null && row.closedCount >= 1) {
    // Nothing listed today, but the type demonstrably exists here.
    parts.push(`No ${publicSegmentNoun(row.segment, 2)} for sale in ${placeName} right now`)
  } else {
    parts.push(`${publicSegmentNoun(row.segment, 2)} in ${placeName}`)
  }

  if (row.medianList != null) parts.push(`asking a median ${formatPriceExact(row.medianList)}`)
  return `${parts.join(', ')}.`
}

function factLine(row: PlaceSegmentInput): V3InstrumentFigure[] {
  const out: V3InstrumentFigure[] = []
  if (row.pendingCount != null && row.pendingCount >= 1) {
    out.push({ label: v3Text('Pending now'), value: v3Text(formatCount(row.pendingCount)) })
  }
  if (row.closedCount != null && row.closedCount >= 1) {
    out.push({ label: v3Text('Closed · 12 months'), value: v3Text(formatCount(row.closedCount)) })
  }
  // 0.0 months is not a figure — see public-segments.
  if (row.monthsOfSupply != null && row.monthsOfSupply > 0) {
    out.push({
      label: v3Text('Months of supply'),
      value: v3Text(formatMonthsOfSupply(row.monthsOfSupply)),
    })
  }
  if (row.daysToContract != null && row.daysToContract > 0) {
    out.push({
      label: v3Text('Days to contract · 12 months'),
      value: v3Text(formatCount(row.daysToContract)),
    })
  }
  if (row.saleToOriginal != null) {
    out.push({
      label: v3Text('Sale to original list · 12 months'),
      value: v3Text(formatPaceShare(row.saleToOriginal)),
    })
  }
  if (row.priceCutShare != null) {
    out.push({
      label: v3Text('Took a price cut · 12 months'),
      value: v3Text(formatPaceShare(row.priceCutShare)),
    })
  }
  return out
}

/**
 * The section 0 trace for the figure grid. It names the read path, the place,
 * and the property type the whole section is scoped to. It does not restate the
 * windows, because each figure carries its own on its label.
 */
function trace(placeName: string, nounPlural: string): V3Text {
  return v3Text(
    `regional MLS through Oregon Data Share, ${placeName} ${nounPlural}. ` +
      'Every figure names its own window. A figure the feed withheld is absent, not estimated.',
  )
}

export function V3PlacePropertyTypes({ placeName, citySlug, postalCode, rows }: Props) {
  if (rows.length === 0) return null

  return (
    <>
      {rows.map((row) => {
        const figures = factLine(row)
        const nounPlural = publicSegmentNoun(row.segment, 2)
        const heading = `${nounPlural.charAt(0).toUpperCase()}${nounPlural.slice(1)} in ${placeName}`
        const href = publicSegmentBrowseHref(citySlug, row.segment, { postalCode })
        const active = row.activeCount ?? 0
        const lead = leadSentence(row, placeName)
        const eyebrow = `${placeName} · Property types`
        const doorLabel = `See ${nounPlural} for sale`

        const [firstFigure, ...restFigures] = figures
        if (!firstFigure) {
          const items: V3QuietItem[] = [{ kind: 'prose', body: lead }]
          if (active >= 1) items.push({ label: doorLabel, href })
          return (
            <V3Quiet
              key={row.segment}
              id={`type-${row.segment}`}
              eyebrow={eyebrow}
              heading={heading}
              items={items}
            />
          )
        }

        return (
          <V3Instrument
            key={row.segment}
            id={`type-${row.segment}`}
            level={2}
            eyebrow={v3Text(eyebrow)}
            headline={v3Text(heading)}
            note={v3Text(lead)}
            figures={[firstFigure, ...restFigures]}
            source={trace(placeName, nounPlural)}
            action={active >= 1 ? { label: v3Text(doorLabel), href, variant: 'text' } : undefined}
          />
        )
      })}
    </>
  )
}
