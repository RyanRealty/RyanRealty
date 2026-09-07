/**
 * V3 FOOTER. The public site's closing chrome.
 *
 * Replaces a deleted KB component Visual language:
 * design_system/public/PUBLIC_UI.md (locked 2026-08-11). Tokens: ./tokens.css.
 *
 * DESTINATIONS COME FROM lib/site-nav.ts. Not one href is typed in this file.
 * The column set is a REQUIRED prop, and the value every public page passes is
 * V3_FOOTER_COLUMNS below, which is KB_FOOTER_COLUMNS itself rather than a copy
 * of it: Markets town clusters, Buy · Sell · Join, Company, then Contact. The
 * legal row defaults to LEGAL_LINKS, so a
 * caller cannot drop the privacy, terms, accessibility, fair-housing, DMCA, or
 * site-index links by forgetting a prop. A surface that legitimately needs a
 * different set (a tokenized service node, an off-graph annex) passes one and
 * the difference is visible in its own diff.
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
import { V3FooterFold } from './V3FooterFold.client'
import './tokens.css'
import './V3Footer.css'

export type V3FooterLink = {
  /** Where the row goes. Internal path or absolute URL. */
  href: string
  /** The visible text, and therefore the link's accessible name. */
  label: string
}

export type V3FooterCluster = {
  /** Visible group label inside the column. Not a destination. */
  heading: string
  links: readonly V3FooterLink[]
  /** Place-grain step: 1 city, 2 neighborhood/community, 3 subdivision. */
  depth?: 1 | 2 | 3
}

export type V3FooterColumn = {
  /** The column title AND the accessible name of the nav landmark it opens. */
  heading: string
  links: readonly V3FooterLink[]
  /** When present, the column renders these labeled clusters instead of a flat list. */
  groups?: readonly V3FooterCluster[]
}

/**
 * The canonical sitemap columns: lib/site-nav.ts for every destination and
 * heading. Header chrome still remaps Buy/Areas to Homes/Places; the footer
 * keeps Markets town clusters plus Buy · Sell · Join, Company, and Contact.
 */
export const V3_FOOTER_COLUMNS: readonly V3FooterColumn[] = KB_FOOTER_COLUMNS.map(
  (column) => ({
    heading: column.heading,
    links: column.links,
    groups: column.groups,
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
function collectLinks(
  items: readonly V3FooterLink[] | undefined,
  seen: Set<string>,
): V3FooterLink[] {
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

function links(items: readonly V3FooterLink[] | undefined): V3FooterLink[] {
  return collectLinks(items, new Set())
}

function clustersOf(
  groups: readonly V3FooterCluster[] | undefined,
  seen: Set<string>,
): V3FooterCluster[] {
  const out: V3FooterCluster[] = []
  for (const group of groups ?? []) {
    const heading = text(group?.heading)
    const rows = collectLinks(group?.links, seen)
    if (!heading || rows.length === 0) continue
    out.push(group.depth ? { heading, links: rows, depth: group.depth } : { heading, links: rows })
  }
  return out
}

function columnsOf(input: readonly V3FooterColumn[]): V3FooterColumn[] {
  const out: V3FooterColumn[] = []
  for (const column of input) {
    const heading = text(column?.heading)
    if (!heading) continue
    const seen = new Set<string>()
    const groups = clustersOf(column?.groups, seen)
    const rows = groups.length > 0 ? groups.flatMap((g) => g.links) : collectLinks(column?.links, seen)
    if (rows.length === 0) continue
    out.push(groups.length > 0 ? { heading, links: rows, groups } : { heading, links: rows })
  }
  return out
}

function clusterDomId(column: string, group: string): string {
  const slug = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
  return `v3-footer-${slug(column)}-${slug(group)}`
}

function LinkList({
  heading,
  items,
}: {
  heading: string
  items: readonly V3FooterLink[]
}) {
  return (
    <ul className="v3-footer__column-list">
      {items.map((link) => (
        <li key={`${heading}-${link.href}`}>
          <Link href={link.href}>{link.label}</Link>
        </li>
      ))}
    </ul>
  )
}

function ColumnLinks({ column }: { column: V3FooterColumn }) {
  if (column.groups && column.groups.length > 0) {
    return (
      <div className="v3-footer__clusters">
        {column.groups.map((group) => {
          const id = clusterDomId(column.heading, group.heading)
          return (
            <div
              className="v3-footer__cluster"
              data-depth={group.depth}
              role="group"
              aria-labelledby={id}
              key={id}
            >
              <p id={id} className="v3-footer__cluster-title">
                {group.heading}
              </p>
              <LinkList heading={`${column.heading}-${group.heading}`} items={group.links} />
            </div>
          )
        })}
      </div>
    )
  }
  return <LinkList heading={column.heading} items={column.links} />
}


/* -------------------------------------------------------------------------- */
/* Social icons                                                                */
/* -------------------------------------------------------------------------- */

function SocialGlyph({
  path,
  stroke = false,
}: {
  path: string
  stroke?: boolean
}) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      {stroke ? (
        <path
          d={path}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      ) : (
        <path fill="currentColor" d={path} />
      )}
    </svg>
  )
}

const SOCIAL_LINKS = [
  {
    label: 'Instagram',
    href: BRAND.social.instagram,
    path: 'M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z',
  },
  {
    label: 'Facebook',
    href: BRAND.social.facebook,
    path: 'M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z',
  },
  {
    label: 'YouTube',
    href: BRAND.social.youtube,
    path: 'M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z',
  },
  {
    label: 'TikTok',
    href: BRAND.social.tiktok,
    path: 'M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z',
  },
  {
    label: 'X',
    href: BRAND.social.x,
    path: 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z',
  },
  {
    label: 'LinkedIn',
    href: BRAND.social.linkedin,
    path: 'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z',
  },
  {
    label: 'Pinterest',
    href: BRAND.social.pinterest,
    path: 'M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.099.12.112.225.085.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.401.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.354-.629-2.758-1.379l-.749 2.848c-.269 1.045-1.004 2.352-1.498 3.146 1.123.345 2.306.535 3.55.535 6.607 0 11.985-5.365 11.985-11.987C23.97 5.39 18.592.026 11.985.026L12.017 0z',
  },
  {
    label: 'Threads',
    href: BRAND.social.threads,
    stroke: true,
    path: 'M19.25 8.50488C17.6729 2.63804 12.25 3.00452 12.25 3.00452C12.25 3.00452 4.75 2.50512 4.75 12C4.75 21.4949 12.25 20.9955 12.25 20.9955C12.25 20.9955 16.7077 21.2924 18.75 17.0782C19.4167 15.2204 19.25 11.5049 12.75 11.5049C12.75 11.5049 9.75 11.5049 9.75 14.0049C9.75 14.9812 10.75 16.0049 12.25 16.0049C13.75 16.0049 15.4212 14.9777 15.75 13.0049C16.75 7.00488 11.25 6.50488 9.75 9.00488',
  },
] as const

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
            {/* Plain img, not next/image: owned brand file, pre-rendered wordmark. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/brand/logo-horizontal-navy-transparent.png"
              alt="Ryan Realty"
              width={2271}
              height={454}
              decoding="async"
            />
          </Link>
          <p className="v3-footer__place">Central Oregon</p>
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
                {BRAND.mailingAddress}
              </a>
            </li>
          </ul>
          <ul className="v3-footer__social">
            {SOCIAL_LINKS.map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={item.label}
                  className="v3-footer__social-btn"
                >
                  <SocialGlyph path={item.path} stroke={'stroke' in item && item.stroke === true} />
                </a>
              </li>
            ))}
          </ul>
        </div>

        <V3FooterFold />

        <div className="v3-footer__columns">
          {sitemap.map((column) => (
            <nav className="v3-footer__column" aria-label={column.heading} key={column.heading}>
              {/*
                A native disclosure, and the only interactive element this footer
                has ever had. On a phone the city columns stacked past 2,000px —
                destinations nobody scrolls to. Folded, the reader sees the city
                names with their counts and opens the one they want.

                It SHIPS OPEN and V3FooterFold closes it on a phone. Inverted,
                a reader without JavaScript — and a crawler that does not run it
                — would meet 52 hidden footer destinations on every page, which
                is a crawl surface traded for a phone convenience. This way the
                no-JS case is the whole sitemap, which is the safe failure.

                Forcing the list visible in CSS above 40rem was the first
                attempt and it lied: the element stayed closed, so the control
                announced itself COLLAPSED over thirteen visible links and did
                nothing when activated. CSS can show a disclosure's content; it
                cannot set `open`, which is what the accessibility tree reads.

                The count is not decoration: it tells the reader whether a group
                is worth opening, which is the whole reason a fold is honest
                here rather than a place to hide destinations.
              */}
              <details className="v3-footer__fold" open>
                <summary className="v3-footer__column-title">
                  {column.heading}
                  <span className="v3-footer__count">{column.links.length}</span>
                </summary>
                <ColumnLinks column={column} />
              </details>
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

      {/* Cityscape closes the page under columns and legal. Cream ground only
          from CSS — never baked into the transparent navy PNG. */}
      <div className="v3-footer__cityscape">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/footer/bend-cityscape.png"
          alt=""
          width={2100}
          height={900}
          decoding="async"
        />
      </div>
    </footer>
  )
}
