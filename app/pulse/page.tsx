/**
 * /pulse - the Central Oregon market pulse, on the components/site/v3 barrel.
 *
 * VISUAL LANGUAGE: design_system/public/PUBLIC_UI.md, locked 2026-08-11. The IA lock
 * folds this route into the Market destination as its present-tense view, and Market
 * nodes open on Instrument. Four of the six patterns, no two adjacent alike:
 * Instrument level 1 (the region market answer) -> the feed island -> Instrument level 2
 * (the two event counts, beside the feed they count and open) -> Ledger (market by city)
 * -> Sheet (the ask) -> Quiet (the outbound edges).
 *
 * THE SECOND INSTRUMENT EXISTS BECAUSE THE FIRST ONE COULD NOT HOLD ITS OWN ASK AT 390,
 * AND THAT WAS MEASURED, NOT GUESSED. With all six figures in the opening block its
 * trace named six populations and ran 318px tall on a 390-wide viewport, putting the
 * section at 933px and its action at y=981: below an 844px fold, so the first viewport
 * shipped zero visible filled controls even after the ask was promoted to primary. The
 * two event counts are a different population from the four inventory figures anyway
 * (they count what CHANGED, not what is standing), and they are the doors into the feed
 * they now sit under. Nothing was cut: both figures, both filtered doors, and each of
 * the two traces now covers exactly the figures above it instead of one line carrying
 * six populations. Re-measured after the split: the opening ask lands inside the first
 * viewport at 390.
 *
 * THE PAGE CONTRACT, carried across: `export const metadata` verbatim (title,
 * description, canonical, OpenGraph, Twitter), `dynamic = 'force-dynamic'` and no
 * revalidate, the route, the BreadcrumbList JSON-LD built by the same
 * generateBreadcrumbSchema call with the same two rungs, a rendered KbSectionTracker
 * with pageType="feed", and the same three parallel reads (getPulseFeed offset 0
 * limit 12, getPulseRegionSnapshot, getPulseCitySnapshots over PULSE_DEFAULT_CITIES).
 * KbSectionTracker stays on the KB register deliberately: it is analytics wiring, not
 * visual language, and the barrel ships no equivalent. It is this page's only non-v3
 * register import, 6 down to 1.
 *
 * ONE ARGUMENT CHANGED, AND IT CLOSES A LIE THIS PAGE WOULD OTHERWISE SHIP.
 * getPulseFeed now receives the event types and cities named in the URL. The island
 * reads `?types=` and `?cities=` on mount to preselect its filter chips
 * (components/pulse/PulseFeed.tsx) but never refetches from them, so before this a
 * visitor landing on /pulse?types=status_closed saw the "Just sold" chip lit above an
 * unfiltered list of price drops and pendings. The two event-count figures below open
 * exactly those URLs, so the server has to answer them or the door is a lie by
 * construction. The read is the same function, the same offset, and the same limit;
 * it now carries the filter the visitor asked for.
 *
 * THE FEED ISLAND IS NOT MIGRATED, AND THAT IS DELIBERATE. <PulseFeed> keeps every
 * prop it had. It carries the like/save capture (lib/pulse-saves plus the saved-home
 * action), the in-feed signup capture, and the filter + infinite-scroll interaction
 * contract, and the brief that governs this migration holds every capture contract
 * fixed. It also lives in components/pulse, which this unit does not own. So the
 * events stay in the island and the page's own Ledger is the market by city, which
 * is a population the page already fetched and previously showed only inside the
 * feed's every-seventh-card interstitial. When components/pulse is migrated, the
 * events become the Ledger and this section head goes with them.
 *
 * SECTION 0 FIX, AND IT IS THE REASON THIS FILE READS DIFFERENTLY FROM THE KB PAGE.
 * The KB stats strip printed a cell labelled "Market" whose value was
 * `market_health_label ?? <verdict derived from months of supply>`. Those are two
 * different metrics under one label. market_health_label is a composite health-score
 * bucket written by refresh_market_pulse (Cold/Cool/Warm/Hot/Very Hot, scored from
 * median active days on market, median sale-to-list, 90-day closed volume, and price
 * spread - supabase/migrations/20260526140535_refresh_market_pulse_advisory_lock.sql
 * lines 253-274). Months of supply is inventory against absorption. Live on
 * 2026-08-12 the region row carried 'Warm' beside 5.83 months of supply, which
 * lib/market/classify.ts calls a balanced market: the page published a heat bucket in
 * the slot a reader reads as the verdict, with no source line saying which metric it
 * was. This page now prints ONE verdict, from marketVerdict() on the RAW months of
 * supply, in the headline, with MOS_METHODOLOGY_CLAUSE and MOS_THRESHOLD_CLAUSE in
 * its trace. Every other figure the KB strip showed is kept, with the same source
 * column, filter, window, and units.
 *
 * AND THE HEALTH BUCKET IS SUPPRESSED AT THE ISLAND'S PROP BOUNDARY, WHICH IS WHERE
 * THE FIRST PASS OF THAT FIX STOPPED SHORT. Deleting the KB strip did not stop the
 * bucket from publishing: MarketSnapshotCard renders `market_health_label` as a badge
 * on the region interstitial and on every city interstitial, so the page shipped the
 * headline "a balanced market" over a card reading "Central Oregon / Warm / Months of
 * supply 5.8 mo", two verdict-shaped labels from two different metrics, and the
 * un-sourced one was the composite bucket the fix set out to stop publishing.
 * pageVerdictSnapshot() replaces that field with this page's ONE verdict, taken
 * from marketVerdict() on the same raw months of supply the headline uses, and drops
 * a months-of-supply value that is not above 0 so the island cannot classify a stored
 * zero either. The island is untouched; the page decides what it publishes.
 *
 * ROUNDING ORDER, the trap that cost the hub a repair pass: marketVerdict classifies
 * the RAW value and the screen rounds only to display it. Rounding first walks the
 * verdict across a canonical threshold in both directions (4.02 rounds to 4.0 and
 * `4.0 <= 4` prints seller's; 5.97 rounds to 6.0 and `6.0 >= 6` prints buyer's).
 *
 * AND THE DIGITS GO THROUGH lib/format/months-of-supply.ts, WHICH IS THE OTHER HALF
 * OF THAT TRAP. Classifying the raw value fixes the verdict and does nothing for the
 * number printed beside it. This page used to round the raw value to one decimal at
 * the call site and print that (the two expressions are named in the gate, not here,
 * because this repo has twice shipped a gate that fired on its own explanation), so at
 * a stored 4.02 the Instrument read "4.0 months of supply" under the headline "a
 * balanced market" with MOS_THRESHOLD_CLAUSE in the source line one row down saying four
 * or less is a seller's market: three surfaces in one viewport, one of them refuting the
 * other two, on a licensed broker's page.
 * formatMonthsOfSupply is the single boundary-safe rule (4.02 prints 4.1, 5.97 prints
 * 5.9) and it now owns every digit this page publishes for the statistic. Both rounding
 * sites came off ci:market-formula's frozen ledger in the same change, which is how
 * that ledger is meant to be paid down.
 *
 * EVERY FIGURE IS NAMED WHERE IT IS PRINTED, NOT ONLY WHERE IT IS CONVENIENT.
 * V3Ledger renders no column header, so a bare `$750,000` in the value column is a
 * median sale, an average, or a list price depending on who is reading. The Ledger's
 * `note` names all four columns in reading order and its `source` carries the
 * population and window of each, at the same standard the two Instruments above it
 * hold. The populations are not interchangeable and the trace says so:
 * homes for sale counts Active and Coming Soon; median days on market covers those plus
 * Active Under Contract, so it is the age of inventory that has not sold; median list
 * price covers all of those plus Pending; and days to pending is measured on homes that
 * CLOSED in the last 90 days, published only where at least five of those closings
 * carry a recorded list-to-pending time, which is a different population entirely.
 *
 * TWO OF THOSE NAMES ARE NARROWER THAN THEIR LABELS, AND THE TRACES NOW CARRY THE
 * NARROWING. (a) `new_count_7d` is not "every home listed in the last 7 days": the
 * refresh counts homes whose OnMarketDate falls in the window AND whose status is
 * still Active or Coming Soon, so one listed five days ago that went pending yesterday
 * is not in it, and the figure understates true new-listing volume by whatever share
 * already went under contract. (b) the days-to-pending blank is not "fewer than five
 * closings": the refresh suppresses on fewer than five closings that carry a
 * COALESCE(days_to_pending, pending_timestamp - OnMarketDate) value, so a city with
 * twenty closings of which three record a pending date also shows a blank. Stating the
 * looser rule would publish a reason for an empty cell that is not the operative one.
 * All of the above verified against the live refresh_market_pulse() body
 * (supabase/migrations/20260526140535_refresh_market_pulse_advisory_lock.sql lines
 * 128-137, 162-170, 192-194, 212-223) on 2026-08-12.
 *
 * THE LEDGER'S `when` COLUMN IS TEMPORAL, PER ITS CONTRACT. V3Ledger documents that
 * slot as the row's date or duration ("closed Jun 12", "34 days on market") and its
 * data rules name it beside `updated`, so an inventory count there is a count marked
 * up as a date the moment that column becomes a <time> element. The count moved to
 * `detail`, where the contract puts a status or a second line, and `when` carries the
 * median days on market, which is the documented shape exactly.
 *
 * ABSENT IS NOT ZERO. getPulseCitySnapshots drops any city whose active_count is 0,
 * so a covered city missing from the Ledger is stated as "returned no active
 * single-family row in the latest sync" rather than printed as a zero under a
 * live-MLS source line. A city with live inventory but no /cities page earns no row
 * (a Ledger row is a door by definition) and is named with its real active count, and
 * so is a city the refresh left without a median or without a days-on-market figure.
 *
 * DATES RENDER IN PACIFIC. formatDate is pinned to America/Los_Angeles and
 * ci:date-format requires it, so the refresh stamp reads in the timezone of the
 * market this page covers.
 *
 * THE PAGE CARRIES ITS OWN VISIBLE PRIMARY, AND THE PREMISE THAT SAID OTHERWISE WAS
 * FALSE AND IS STRUCK, NOT REWORDED. The first pass demoted this Instrument's action
 * to a ghost on the ground that the sticky public header carries a filled valuation
 * CTA at every scroll position. It does not. The chrome on this route is KbNav
 * (components/site/PublicNav.client.tsx), whose `a.nav-cta` is `display:none` until
 * 880px (components/site/kb/kb.css) and whose only mobile copy sits inside the closed
 * Menu+ overlay, so at 390 the first viewport shipped no filled control at all.
 * PUBLIC_UI.md section 1 counts VISIBLE filled controls and says so explicitly: a
 * content page carries its own visible primary, and the chrome's CTA counts only where
 * the chrome actually shows it. The Instrument's action is therefore `primary`. It is
 * also a different job from the chrome's. The chrome asks for the seller's address.
 * This asks the reader who just read the region's four inventory figures to open the
 * report they are broken out in, which is the next step the content above it earned.
 * MEASURED AT SCROLLY 0, counting visible filled controls in the first viewport:
 * 390x844 gives 1 (this action, y 779 to 823, with both chrome copies measuring
 * display:none and visibility:hidden). 1280x900 gives 2 (the chrome's own CTA at y 18,
 * plus this one at y 601). The second is the chrome's, not the page's, and the rule's
 * own clause is that the chrome's CTA counts only where the chrome shows it - which is
 * why it cannot discharge the page's obligation at 390 and why the page carries its own
 * ask at every width rather than borrowing one that disappears.
 *
 * THE VALUATION DOOR IS BUILT BY ONE FUNCTION, AND ITS DESTINATION MOVED. Both
 * valuation links on this page, the Sheet's push and the crawlable edge in the closing
 * Quiet, are `valuationHref('/pulse')` (lib/site/valuation-href.ts), the one builder
 * for a valuation link on a content surface (migration-recipe.md addendum,
 * 2026-08-11). Two things follow. It stamps `?from=/pulse`, the parameter the
 * valuation intake reads to record which page produced a seller lead
 * (app/home-valuation/actions.ts). And it resolves to the locked intake spine
 * `/sell#get-value` rather than `/sell/valuation`, which ia-lock.md schedules for a
 * 301 into that spine, and a 301 drops the query string, so a link built at the old
 * destination loses the stamp on the day the redirect lands. Recorded for the spine's
 * owner rather than worked around here: the /sell hero form takes its `sourceUrl` from
 * a hardcoded `pagePath` prop (app/sell/page.tsx passes ROUTE_PATH) and never reads
 * `from`, so today the stamp is inert at that destination. The link is correct at this
 * end. The last mile is the intake's.
 *
 * THE ROUTE-LOCAL PURE CODE LIVES IN ./_v3/pulse-sections.ts, AND THAT SPLIT IS A GATE
 * DECISION, NOT A STYLE ONE. Writing the section-0 reasoning behind each trace into
 * this header pushed the file past 600 lines, which ci:file-size-budget fails. The
 * budget exists to stop exactly the growth that produced it, and re-baselining a gate
 * to fit your own diff makes every future number meaningless, so the constants, the
 * trace strings, and the figure/row/footnote builders moved out and the page kept the
 * reads, the one derivation, and the render. Every moved expression is byte-identical.
 *
 * DELETED HERE, each with where the information went: KbHero (its H1, lead, and live
 * sub-row are the Instrument's headline, trace, and figures), the hand-rolled KB
 * stats strip and its two local formatters formatPriceShort / formatHealthVerdict
 * (figures now format through lib/format/money and the verdict comes from
 * lib/market/classify), KbBreadcrumb, KbFooter, SmoothScrollProvider, the kb.css
 * import, and the HomeValuationCta card, whose capture contract is preserved by
 * ./_v3/PulseValuationAsk.client.tsx, the same server action with the same two
 * arguments in the same order, moved below the feed so the live feed starts in the
 * second viewport instead of the fourth. The one thing that did NOT carry across
 * verbatim is that card's destination, declared in the paragraph above.
 */

import type { Metadata } from 'next'
import PulseFeed from '@/components/pulse/PulseFeed'
import { LIFESTYLE_CARDS } from '@/lib/pulse-lifestyle-cards.server'
import {
  getPulseFeed,
  getPulseCitySnapshots,
  getPulseRegionSnapshot,
  type PulseEventType,
} from '@/app/actions/pulse-feed'
import { PULSE_DEFAULT_CITIES } from '@/lib/pulse-config'
import { generateBreadcrumbSchema } from '@/lib/structured-data'
import { marketVerdict } from '@/lib/market/classify'
import { formatMonthsOfSupply } from '@/lib/format/months-of-supply'
import { formatDate } from '@/lib/format/date'
import { listingsBrowsePath } from '@/lib/slug'
import {
  V3_ROOT_CLASS,
  v3Text,
  V3Breadcrumb,
  V3Eyebrow,
  V3Heading,
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3Instrument,
  V3Ledger,
  V3Quiet,
  type V3QuietItem,
} from '@/components/site/v3'
import { KbSectionTracker } from '@/components/site/kb/KbSectionTracker.client'
import { PulseValuationAsk } from './_v3/PulseValuationAsk.client'
import {
  buildCityFootnotes,
  buildCityRows,
  buildActivityFigures,
  buildMarketFigures,
  cityRefreshStamp,
  csvParam,
  CITY_NOTE,
  CITY_TRACE,
  FEED_EVENT_TYPES,
  pageVerdictSnapshot,
  REGION_REPORT_PATH,
  ACTIVITY_TRACE,
  MARKET_TRACE,
  VALUATION_HREF,
  type PulseSearchParams,
} from './_v3/pulse-sections'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
const defaultOgImage = `${siteUrl}/api/og?type=default`

export const metadata: Metadata = {
  title: 'Central Oregon market pulse',
  description:
    'New listings, sold homes, pending sales, and price cuts across Central Oregon as they hit the MLS. Filter by city.',
  alternates: { canonical: `${siteUrl}/pulse` },
  openGraph: {
    title: 'Central Oregon market pulse | Ryan Realty',
    description:
      'New listings, sold homes, price cuts, and pending sales across Bend, Redmond, Sisters, Sunriver, and the rest of Central Oregon. Updated as they land.',
    url: `${siteUrl}/pulse`,
    type: 'website',
    siteName: 'Ryan Realty',
    images: [{ url: defaultOgImage, width: 1200, height: 630, alt: 'Ryan Realty Market Pulse' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Central Oregon market pulse | Ryan Realty',
    description:
      'Live MLS activity from Central Oregon: new listings, sold homes, price cuts. Filter by city.',
    images: [defaultOgImage],
  },
}

export const dynamic = 'force-dynamic'

export default async function PulsePage({
  searchParams,
}: {
  searchParams: Promise<PulseSearchParams>
}) {
  const defaultCities = [...PULSE_DEFAULT_CITIES]
  const params = await searchParams

  // The filter the visitor asked for, validated here rather than trusted. Event types
  // are checked against the island's union; cities are resolved against the covered
  // set, which is also the rule getPulseFeed enforces on its own ("all cities" means
  // all Central Oregon cities, never a listing outside the region).
  const requestedTypes = csvParam(params.types).filter((value): value is PulseEventType =>
    (FEED_EVENT_TYPES as readonly string[]).includes(value)
  )
  const requestedCities = csvParam(params.cities).flatMap((value) => {
    const covered = defaultCities.find((city) => city.toLowerCase() === value.toLowerCase())
    return covered ? [covered] : []
  })

  // The same three reads. No catch-and-swallow: each one already answers a transient
  // failure with its own documented fallback (the pulse-feed actions wrap every query
  // in a 25s timeout that resolves to an empty result), so a catch here would only
  // hide a real outage behind a confident page.
  const [{ items, nextOffset }, regionSnapshot, citySnapshots] = await Promise.all([
    getPulseFeed({
      offset: 0,
      limit: 12,
      eventTypes: requestedTypes.length > 0 ? requestedTypes : null,
      cities: requestedCities.length > 0 ? requestedCities : null,
    }),
    getPulseRegionSnapshot(),
    getPulseCitySnapshots(defaultCities),
  ])

  // THE ONE DERIVATION. Classify the raw value, and render it through the ONE
  // boundary-safe formatter. The guard is "above 0" rather than "not null" so a stored
  // 0 cannot assert a verdict. formatMonthsOfSupply, not Math.round: see the header.
  const mosRaw =
    regionSnapshot?.months_of_supply != null && regionSnapshot.months_of_supply > 0
      ? regionSnapshot.months_of_supply
      : null
  const mosDisplay = mosRaw == null ? null : formatMonthsOfSupply(mosRaw)
  const verdict = marketVerdict(mosRaw)

  // Figures, rows, footnotes, and every trace string are built by ./_v3/pulse-sections.ts.
  // The page keeps the reads, the one derivation above, and the render.
  const [firstMarketFigure, ...restMarketFigures] = buildMarketFigures(regionSnapshot, mosDisplay)
  const [firstActivityFigure, ...restActivityFigures] = buildActivityFigures(regionSnapshot)
  // Both sections read the same market row, so they carry the same stamp rather than
  // two clocks for one query.
  const regionUpdated = regionSnapshot?.updated_at
    ? v3Text(formatDate(regionSnapshot.updated_at))
    : undefined

  const headline =
    verdict.kind === 'unknown'
      ? 'The Central Oregon market pulse'
      : `The Central Oregon market pulse: a ${verdict.label}`

  const { rows: cityRows, rowed } = buildCityRows(citySnapshots)
  const [firstCityRow, ...restCityRows] = cityRows
  const cityFootnotes = buildCityFootnotes(defaultCities, citySnapshots, rowed)
  const cityRefreshedAt = cityRefreshStamp(citySnapshots)

  // The closing edges: every market and inventory node this page sits beside, plus
  // the Oregon Data Share citation, plus the valuation destination as a real link so
  // the Sheet's submit is not its only route.
  const exploreItems: V3QuietItem[] = [
    { label: 'Central Oregon region report', href: REGION_REPORT_PATH },
    { label: 'Central Oregon housing market', href: '/housing-market' },
    { label: 'All Central Oregon cities', href: '/cities' },
    { label: 'Communities and neighborhoods', href: '/communities' },
    { label: 'Browse homes for sale', href: listingsBrowsePath() },
    { label: 'Open houses this week', href: '/open-houses' },
    { label: 'Recent price drops', href: '/price-drops' },
    { label: 'Months of supply, defined', href: '/months-of-supply' },
    { label: 'Get a free home valuation', href: VALUATION_HREF },
    { label: 'Sell your home', href: VALUATION_HREF },
    { label: 'Oregon Data Share', href: 'https://www.oregondatashare.com' },
  ]
  if (cityFootnotes.length > 0) {
    exploreItems.push({
      kind: 'prose',
      term: 'Cities not in the table above',
      body: `${cityFootnotes.join('. ')}.`,
    })
  }

  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <KbSectionTracker pageType="feed" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(
              generateBreadcrumbSchema([
                { name: 'Home', url: siteUrl },
                { name: 'Market pulse', url: `${siteUrl}/pulse` },
              ])
            ),
          }}
        />

        <V3Breadcrumb trail={[{ label: 'Home', href: '/' }, { label: 'Market pulse' }]} />

        {firstMarketFigure ? (
          <V3Instrument
            id="pulse-snapshot"
            level={1}
            eyebrow={v3Text('Central Oregon · live MLS')}
            headline={v3Text(headline)}
            figures={[firstMarketFigure, ...restMarketFigures]}
            source={v3Text(MARKET_TRACE)}
            updated={regionUpdated}
            // FILLED on purpose, and measured rather than assumed. This is the page's
            // own visible primary in the first viewport at 390, where the chrome's
            // valuation CTA is display:none and its overlay copy is hidden. See the
            // header paragraph on the premise this replaces.
            action={{
              label: v3Text('Read the Central Oregon market report'),
              href: REGION_REPORT_PATH,
              variant: 'primary',
            }}
          />
        ) : (
          <V3Quiet
            id="pulse-snapshot"
            heading="The Central Oregon market pulse"
            headingLevel={1}
            items={[
              {
                kind: 'prose',
                term: 'No live figures right now',
                body: 'The Central Oregon market row did not return on this refresh, so this page is not printing a median, an inventory count, a verdict, or the seven- and thirty-day activity counts that come from the same row. The feed below carries its own events and the city table carries its own rows.',
              },
            ]}
          />
        )}

        {/* The feed island. Every prop is the one PulseFeed already took, and the
            component itself is untouched: it owns the city and event-type filters
            with URL sync, infinite scroll, in-view video autoplay, like and save,
            the in-feed signup card, the snapshot / brand / lifestyle interstitials,
            and the post-mount personalized re-rank. The snapshots it renders as
            interstitial cards carry this page's verdict instead of the composite
            health bucket (pageVerdictSnapshot above). The head is authored from
            barrel atoms so the page's type and section rhythm hold up to the
            island's edge. Its id makes it observable by KbSectionTracker, which
            watches `.v3 section[id]`. */}
        <section id="pulse-feed" aria-labelledby="pulse-feed-heading">
          <div className="mx-auto w-full max-w-md px-3 pt-14 sm:px-0">
            <V3Eyebrow>Live MLS activity</V3Eyebrow>
            <V3Heading level={2} id="pulse-feed-heading">
              What just changed
            </V3Heading>
          </div>
          <PulseFeed
            initialItems={items}
            initialNextOffset={nextOffset}
            defaultCities={defaultCities}
            citySnapshots={citySnapshots.map(pageVerdictSnapshot)}
            regionSnapshot={regionSnapshot ? pageVerdictSnapshot(regionSnapshot) : null}
            lifestyleCards={LIFESTYLE_CARDS}
          />
        </section>

        {/* The two event counts, in a section of their own directly under the list they
            count and open. They used to sit inside the opening Instrument, which made
            that block six figures deep under a trace naming six populations - 933px tall
            at 390, so its ask landed at y=981 and the first viewport carried no filled
            control at all. Splitting them out is not a cut: both figures, both doors,
            and a trace that now covers exactly the two populations it sits over instead
            of six under one line. Level 2, because the page's answer is the market above
            and this is the activity beside the feed. No action of its own: the figures
            ARE the doors, and a second filled control here would put two primaries in
            one viewport.

            ITS ABSENT STATE IS DECLARED, NOT SILENT. `firstActivityFigure` is undefined
            on exactly one condition, a null region row, which is the same condition that
            turns the opening Instrument into the level-1 Quiet. That Quiet names these
            two counts among what did not return, so the page never drops a section
            without saying so - one failed read, one statement about it. */}
        {firstActivityFigure ? (
          <V3Instrument
            id="pulse-activity"
            level={2}
            eyebrow={v3Text('Central Oregon · live MLS')}
            headline={v3Text('What moved in the last week and month')}
            figures={[firstActivityFigure, ...restActivityFigures]}
            source={v3Text(ACTIVITY_TRACE)}
            updated={regionUpdated}
          />
        ) : null}

        {firstCityRow ? (
          <V3Ledger
            id="pulse-cities"
            eyebrow={v3Text('Central Oregon')}
            heading={v3Text('Market by city')}
            note={v3Text(CITY_NOTE)}
            rows={[firstCityRow, ...restCityRows]}
            source={v3Text(CITY_TRACE)}
            updated={cityRefreshedAt ? v3Text(formatDate(cityRefreshedAt)) : undefined}
            action={{ label: v3Text('All Central Oregon cities'), href: '/cities' }}
          />
        ) : (
          <V3Ledger
            id="pulse-cities"
            eyebrow={v3Text('Central Oregon')}
            heading={v3Text('Market by city')}
            rows={[]}
            emptyMessage={v3Text(
              'No city returned a live single-family market row on this refresh.'
            )}
          />
        )}

        <PulseValuationAsk href={VALUATION_HREF} />

        <V3Quiet
          id="pulse-explore"
          eyebrow="More resources"
          heading="Central Oregon market and homes"
          items={exploreItems}
        />
      </main>

      {/* Outside <main> on purpose. HTML-AAM maps <footer> to role=contentinfo only
          when it is NOT nested in sectioning content, and <main> is sectioning
          content, so inside it the element is a generic and the page ships no
          contentinfo landmark. The KB page nested KbFooter the same way, and
          ci:default-chrome-footer counts footers without checking placement. */}
      <V3Footer columns={V3_FOOTER_COLUMNS} />
    </>
  )
}
