/**
 * V3 FOOTER. The public site's closing chrome.
 *
 * Replaces a deleted KB component Visual language:
 * design_system/public/PUBLIC_UI.md (locked 2026-08-11). Tokens: ./tokens.css.
 *
 * DESTINATIONS COME FROM lib/site-nav.ts. Not one href is typed in this file.
 * The column set is a REQUIRED prop, and the value every public page passes is
 * V3_FOOTER_COLUMNS below, which is KB_FOOTER_COLUMNS itself rather than a copy
 * of it. The legal row defaults to LEGAL_LINKS, so a caller cannot drop the
 * privacy, terms, accessibility, fair-housing, DMCA, or site-index links by
 * forgetting a prop. A surface that legitimately needs a different set (a
 * tokenized service node, an off-graph annex) passes one and the difference is
 * visible in its own diff.
 *
 * WHY THE COLUMNS ARE A PROP AND NOT AN INTERNAL READ: the heading of each
 * column is the accessible name of the nav landmark it opens, and a landmark's
 * name is exactly the kind of thing that must be in the type. Requiring the set
 * also keeps this primitive from deciding IA on a page's behalf. The canonical
 * value sits one identifier away, so the honest call is the short one.
 *
 * NO PRIMARY ACTION HERE. The chrome carries exactly one primary CTA and it is
 * the valuation ask in V3Chrome on Sell (PUBLIC_UI.md section 1: one primary action per
 * viewport, earned by the content above it). Since the header is sticky, a
 * solid button in the footer would put two primaries in one viewport for the
 * whole length of the page. The same destination is a column link in Sell, so
 * nothing is unreachable. That is why KbFooter's "A broker writes back" band
 * does not survive: it was a second primary, plus a GSAP entrance that fired on
 * arrival rather than on anything the visitor did (PUBLIC_UI.md section 5 bans
 * exactly that), plus a listing-scoped variant that belongs to the listing
 * node's own content, not to global chrome.
 *
 * THE ODS SLOT IS NOT OPTIONAL. Oregon Data Share display rules put the source
 * identification and the reliability disclaimer on every IDX display, and the
 * IA lock names that as a chrome slot. It renders unconditionally, and the
 * license number comes from lib/brand/contact rather than being typed here.
 *
 * MOUNTING: puts V3_ROOT_CLASS on its own outermost element, so ./tokens.css
 * resolves with no wrapper.
 *
 * Server component. No state, no effects, no hooks, no fetch, and nothing here
 * formats a date, a price, or a count: the optional fine-print note arrives as
 * a string the caller already built beside its own source trace (CLAUDE.md
 * section 0).
 */
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { BRAND, BROKERS, CONTACT } from '@/lib/brand/contact'
import { KB_FOOTER_COLUMNS, LEGAL_LINKS } from '@/lib/site-nav'
import { V3_ROOT_CLASS } from './atoms'
import './tokens.css'
import './V3Footer.css'

export type V3FooterLink = {
  /** Where the row goes. Internal path or absolute URL. */
  href: string
  /** The visible text, and therefore the link's accessible name. */
  label: string
}

export type V3FooterColumn = {
  /** The column title AND the accessible name of the nav landmark it opens. */
  heading: string
  links: readonly V3FooterLink[]
}

/**
 * The locked destination words (docs/plans/PUBLIC_PRODUCT/ia-lock.md), keyed by
 * the site-nav heading they rename.
 *
 * THIS IS A SECOND COPY OF THE MAP IN V3Chrome.tsx, ON PURPOSE, AND THE TWO
 * MUST AGREE. They cannot share one: V3Chrome carries 'use client', so a server
 * component reading a value out of it gets a client reference rather than the
 * object, and importing this file from there would drag the whole footer into
 * the client bundle. Six string pairs duplicated across a boundary that cannot
 * be crossed is the cheaper defect than a header that says Places over a footer
 * that says Areas, which is what the chrome shipped before this map existed.
 */
const LOCKED_LABEL: Readonly<Record<string, string | undefined>> = {
  Buy: 'Homes',
  Areas: 'Places',
  Market: 'Market',
  Sell: 'Sell',
  About: 'About',
  'Your account': 'Saved',
}

/**
 * The canonical sitemap columns: lib/site-nav.ts for every destination, the IA
 * lock for every word. A column the lock has no word for keeps its own heading
 * rather than being dropped, because dropping it would delete destinations.
 */
export const V3_FOOTER_COLUMNS: readonly V3FooterColumn[] = KB_FOOTER_COLUMNS.map(
  (column) => ({
    heading: LOCKED_LABEL[column.heading] ?? column.heading,
    links: column.links,
  }),
)

/** The canonical legal row, straight off lib/site-nav.ts. */
export const V3_FOOTER_LEGAL: readonly V3FooterLink[] = LEGAL_LINKS

export type V3FooterProps = {
  /**
   * The sitemap. Required: a footer is the graph's outbound edge set, and a
   * nameless or empty one is a dead end at the bottom of every page. Pass
   * V3_FOOTER_COLUMNS unless the surface has a documented reason not to.
   */
  columns: readonly V3FooterColumn[]
  /** Defaults to V3_FOOTER_LEGAL. Pass only to override deliberately. */
  legal?: readonly V3FooterLink[]
  /**
   * One line of fine print under the attribution: a per-town inventory line, a
   * coverage note, a basis. Already formatted by the caller, with the caller's
   * source trace behind it.
   */
  note?: string
  /**
   * The copyright year, as the caller wants it read. Omitted by default rather
   * than derived here: a primitive that reads the clock is a primitive that
   * formats, and a year baked at build time goes quietly wrong in January.
   */
  copyrightYear?: string
  id?: string
  className?: string
}

/* -------------------------------------------------------------------------- */
/* Normalization                                                               */
/* -------------------------------------------------------------------------- */

/** Trimmed text, or nothing. An empty string is not a label and not a name. */
function text(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

/**
 * Drops what cannot be rendered honestly, the same discipline V3Quiet states:
 * a link with no label ships an anchor with no accessible name (WCAG 2.4.4), a
 * link with no href is not a door, and a column with no heading opens a nav
 * landmark a screen reader cannot name or skip to. A hole in the array is
 * dropped rather than dereferenced, because this repo's tsconfig has no
 * noUncheckedIndexedAccess and `[cols[0]]` type-checks against an empty array.
 */
function links(items: readonly V3FooterLink[] | undefined): V3FooterLink[] {
  const seen = new Set<string>()
  const out: V3FooterLink[] = []
  for (const item of items ?? []) {
    const href = text(item?.href)
    const label = text(item?.label)
    if (!href || !label || seen.has(href)) continue
    seen.add(href)
    out.push({ href, label })
  }
  return out
}

function columnsOf(input: readonly V3FooterColumn[]): V3FooterColumn[] {
  const out: V3FooterColumn[] = []
  for (const column of input) {
    const heading = text(column?.heading)
    const rows = links(column?.links)
    if (!heading || rows.length === 0) continue
    out.push({ heading, links: rows })
  }
  return out
}

/* -------------------------------------------------------------------------- */
/* V3Footer                                                                    */
/* -------------------------------------------------------------------------- */

export function V3Footer({
  columns,
  legal,
  note,
  copyrightYear,
  id,
  className,
}: V3FooterProps) {
  const sitemap = columnsOf(columns)
  const legalRow = links(legal ?? V3_FOOTER_LEGAL)
  const fine = text(note)
  const year = text(copyrightYear)

  if (process.env.NODE_ENV !== 'production') {
    if (sitemap.length === 0) {
      console.warn(
        'V3Footer: no renderable columns. Every page closes on the sitemap, so an empty ' +
          'footer is a dead end. Pass V3_FOOTER_COLUMNS.',
      )
    }
    const dropped = columns.length - sitemap.length
    if (dropped > 0) {
      console.warn(
        `V3Footer: dropped ${dropped} column(s) with no heading or no links. A nav landmark ` +
          'needs a name and at least one destination.',
      )
    }
  }

  return (
    <footer id={id} className={cn(V3_ROOT_CLASS, 'v3-footer', className)}>
      <div className="v3-footer__inner">
        <div className="v3-footer__brand">
          <Link href="/" className="v3-footer__mark" aria-label="Ryan Realty home">
            {/* Plain img, not next/image, for the reason V3Stage states for its
                poster and V3Chrome states for the same asset: an owned brand
                file that must render on any path without depending on
                image-host configuration, and a wordmark that brand law renders
                pre-rendered rather than re-typeset. Intrinsic dimensions are on
                the element so the block reserves its space. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/brand/logo-horizontal-navy-transparent.png"
              alt="Ryan Realty"
              width={2271}
              height={454}
              decoding="async"
            />
          </Link>
          <ul className="v3-footer__contact">
            <li>
              <a href={`tel:${CONTACT.phoneDirectTel}`}>{CONTACT.phoneDirect}</a>
            </li>
            <li>
              <a href={`mailto:${CONTACT.email.primary}`}>{CONTACT.email.primary}</a>
            </li>
            <li>
              {/* The place line points at the Google Business Profile, the
                  entity Google resolves the brand against. */}
              <a
                href={BRAND.social.googleBusinessProfile}
                target="_blank"
                rel="noopener noreferrer"
              >
                {BRAND.address.city}, {BRAND.address.regionFull}
              </a>
            </li>
          </ul>
          <ul className="v3-footer__social">
            <li>
              <a href={BRAND.social.instagram} target="_blank" rel="noopener noreferrer">
                Instagram
              </a>
            </li>
            <li>
              <a href={BRAND.social.facebook} target="_blank" rel="noopener noreferrer">
                Facebook
              </a>
            </li>
            <li>
              <a href={BRAND.social.youtube} target="_blank" rel="noopener noreferrer">
                YouTube
              </a>
            </li>
          </ul>
        </div>

        <div className="v3-footer__columns">
          {sitemap.map((column) => (
            <nav className="v3-footer__column" aria-label={column.heading} key={column.heading}>
              <p className="v3-footer__column-title">{column.heading}</p>
              <ul className="v3-footer__column-list">
                {column.links.map((link) => (
                  <li key={`${column.heading}-${link.href}`}>
                    <Link href={link.href}>{link.label}</Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="v3-footer__base">
          {legalRow.length > 0 ? (
            <nav className="v3-footer__legal" aria-label="Legal">
              <ul>
                {legalRow.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href}>{link.label}</Link>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}

          <p className="v3-footer__line">
            © {year ? `${year} ` : ''}
            {BRAND.legalName}. Principal Broker {BROKERS.matt.name}. Licensed in Oregon. Equal
            Housing Opportunity.
          </p>

          {/* Oregon Data Share display rules, section 5-3 S and T: source
              identification plus the reliability disclaimer on every IDX
              display. The license number comes from the broker record. */}
          <p className="v3-footer__fine">
            Listing data comes from Oregon Data Share and Morgan Data Shuttle. Information
            deemed reliable but not guaranteed. Principal Broker license{' '}
            <span className="v3-footer__num">{BROKERS.matt.license}</span>.
          </p>

          {fine ? <p className="v3-footer__fine">{fine}</p> : null}
        </div>
      </div>
    </footer>
  )
}
