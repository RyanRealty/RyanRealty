'use client'
// CLIENT BOUNDARY, and the only one in the chrome. The menu is a modal
// disclosure: it opens, holds focus, closes on Escape, and closes on a route
// change. Every one of those is visitor-caused state, which a server component
// cannot hold. V3Footer and V3Breadcrumb stay pure server components.
//
// The BAR needs nothing from the client and would render as RSC if this unit
// owned a second file to put the menu in. It does not: the unit is
// V3Chrome.tsx, V3Footer.tsx, V3Breadcrumb.tsx and their three stylesheets. So
// the bar rides inside this boundary, where it is markup and links only. It
// server-renders to HTML like any client component, so every destination below
// is in the initial response for a crawler and for a visitor with no JS; only
// the menu's open state and the caret panels need hydration. Lifting the bar
// into its own server file later is a file move, not a rewrite.
/**
 * V3 CHROME. The public site's persistent header.
 *
 * Replaces a deleted KB component Visual language:
 * design_system/public/PUBLIC_UI.md (locked 2026-08-11). Tokens: ./tokens.css.
 *
 * DESTINATIONS COME FROM lib/site-nav.ts, NEVER FROM THIS FILE.
 * KB_TOP_NAV and KB_MENU_GROUPS are read at module load and projected into one
 * model. Not one href is typed here, so a link cannot drift out of the single
 * source of truth by being copied: the only two literal destinations in this
 * file are `/` on the wordmark and the tel: URI built from lib/brand/contact.
 * A development-time audit at the bottom of the model proves the projection
 * lost nothing: every href in either projection is reachable in the chrome, and
 * it warns by name if one is not.
 *
 * LABELS COME FROM THE IA LOCK (docs/plans/PUBLIC_PRODUCT/ia-lock.md).
 * The locked words are Homes, Places, Market, Sell, About, with Saved as an
 * account affordance rather than a nav word. Where a locked word lands on an
 * existing group the group is RENAMED, never rebuilt: Buy renders as Homes and
 * Areas renders as Places, each keeping its own href and its own children. A
 * group the lock has no word for is CARRIED under its own label and warned
 * about in development, because dropping it would delete destinations, which is
 * the one thing this rebuild may not do.
 *
 * ONE FILLED ASK, and only on Sell: the valuation label from VALUATION_FORM
 * (`/sell#get-value`). Buyer, place, market, about, and listing chrome do not
 * fill Value my home (Page Grade 2026-08-14 wrong-job-chrome). The door stays
 * in the Sell nav group. The footer never carries a second solid button
 * (PUBLIC_UI.md section 1, founding directive 3).
 *
 * WHAT THIS DELIBERATELY DOES NOT CARRY, versus KbNav:
 *  - The suggest-search field. It reached into components/search, which drags a
 *    second token layer onto every public page through the chrome, and search
 *    belongs to the Field pattern that owns Homes. No nav destination is lost:
 *    `/homes-for-sale` and the canonical map view both stay one tap away.
 *    Search returns to the chrome as a v3 primitive or not at all.
 *  - The transparent-over-hero bar with a scroll listener that flipped it to
 *    solid. One bar, one color contract, legible over whatever scrolls under
 *    it. AA on every text pair is a foundation, not a scroll position.
 *
 * MOUNTING: the header puts V3_ROOT_CLASS on its own outermost element, so
 * ./tokens.css resolves with no wrapper. It is `position: sticky`, so it holds
 * its own space in flow and a page needs no spacer under it.
 */
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { CONTACT } from '@/lib/brand/contact'
import {
  KB_MENU_GROUPS,
  KB_TOP_NAV,
  VALUATION_FORM,
  type NavLink,
} from '@/lib/site-nav'
import { valuationHref } from '@/lib/site/valuation-href'
import { chromeShowsSellerAsk } from '@/lib/site/chrome-seller-ask'
import { shouldHidePublicChrome } from '@/lib/site/public-chrome-hide'
import { V3Button, V3_ROOT_CLASS, v3Text, type V3Text } from './atoms'
import './tokens.css'
import './V3Chrome.css'

/* -------------------------------------------------------------------------- */
/* The model: site-nav.ts projected onto the locked IA words                    */
/* -------------------------------------------------------------------------- */

/**
 * The locked destination words (ia-lock.md), keyed by the site-nav group they
 * rename. Typed with `| undefined` on purpose: a group this map has no word for
 * is a real case (site-nav.ts may grow one), and the code below has to be able
 * to ask whether a key is missing.
 */
const LOCKED_LABEL: Readonly<Record<string, string | undefined>> = {
  Buy: 'Homes',
  Areas: 'Places',
  Market: 'Market',
  Sell: 'Sell',
  About: 'About',
  'Your account': 'Saved',
}

/** The site-nav group whose destination is the visitor's own saved work. */
const ACCOUNT_KEY = 'Your account'

/** A destination group as the chrome renders it. */
export type V3ChromeGroup = {
  /** The site-nav group key, kept so a rename in the lock cannot orphan it. */
  key: string
  /** The locked IA word, or the group's own label when the lock has none. */
  label: V3Text
  /** The group's own overview page. Absent for the account group. */
  href?: string
  /** The curated set the desktop panel shows (KB_TOP_NAV children). */
  featured: readonly NavLink[]
  /** Panel set plus menu set, deduped: what the overlay shows at every width. */
  links: readonly NavLink[]
}

/** A group that is also a destination, so it can head the bar. */
type V3ChromeTopGroup = V3ChromeGroup & { href: string }

/** One live figure with the words that make it true. */
export type V3ChromeLiveFact = { figure: string; label: string }

/**
 * What a group's menu says is true right now. Composed on the server
 * (lib/site/chrome-live.ts) from the DAL and the place atlas; the chrome only
 * prints it. Every figure arrives formatted, so the chrome never rounds.
 */
export type V3ChromeLiveGroup = {
  /** The scope the figures belong to: "Central Oregon right now". */
  eyebrow: string
  facts: readonly V3ChromeLiveFact[]
  /** A value beside a destination, keyed by its href: "/cities/bend" → "1,204". */
  values?: Readonly<Record<string, string>>
  /** A dot field: the listings as one path of zero-length strokes in a w×h box. */
  field?: { w: number; h: number; d: string }
  /** When the figures were read: "Read Sep 2, 2026, 12:07 AM". */
  note?: string
}

/** Live groups keyed by the site-nav group key (Buy, Areas, Market, Sell). */
export type V3ChromeLive = Readonly<Record<string, V3ChromeLiveGroup>>

/**
 * Trimmed, named, deduped. A link with no href is not a door and a link with no
 * label would ship an anchor with no accessible name (WCAG 2.4.4), so both are
 * dropped rather than rendered. The dedupe is by href and it matters: the
 * overlay merges two projections that overlap heavily, and two children with
 * the same key is a React error as well as an IA defect.
 */
function clean(links: readonly NavLink[]): NavLink[] {
  const seen = new Set<string>()
  const out: NavLink[] = []
  for (const link of links) {
    const href = link?.href?.trim()
    const label = link?.label?.trim()
    if (!href || !label || seen.has(href)) continue
    seen.add(href)
    out.push({ href, label })
  }
  return out
}

const MENU_LINKS_BY_TITLE = new Map(KB_MENU_GROUPS.map((g) => [g.title, g.links]))
const TOP_KEYS = new Set(KB_TOP_NAV.map((g) => g.label))

/**
 * The whole chrome model, built once at module load.
 *
 * The bar's five destinations are KB_TOP_NAV in its own order. The overlay adds
 * every group KB_MENU_GROUPS has that the top bar does not, which today is the
 * account group and is exactly why nothing is lost by the top bar being five
 * words wide.
 *
 * `links` merges both projections because they are NOT the same set: the top
 * bar knows `/sell/valuation` and `/homes-for-sale?status=Sold`, while the menu
 * knows eight communities the top bar trims to six. KbNav showed the top-bar
 * set only above 1000px, which left a handful of destinations unreachable on a
 * phone. Merging fixes that without adding a link anyone has to maintain.
 */
const NAV_GROUPS: readonly V3ChromeGroup[] = [
  ...KB_TOP_NAV.map((group) => ({
    key: group.label,
    label: v3Text(LOCKED_LABEL[group.label] ?? group.label),
    href: group.href,
    featured: clean(group.children),
    links: clean([...group.children, ...(MENU_LINKS_BY_TITLE.get(group.label) ?? [])]),
  })),
  ...KB_MENU_GROUPS.filter((group) => !TOP_KEYS.has(group.title)).map((group) => ({
    key: group.title,
    label: v3Text(LOCKED_LABEL[group.title] ?? group.title),
    featured: [] as readonly NavLink[],
    links: clean(group.links),
  })),
]

const TOP_GROUPS: readonly V3ChromeTopGroup[] = NAV_GROUPS.filter(
  (group): group is V3ChromeTopGroup => typeof group.href === 'string',
)

const ACCOUNT_GROUP = NAV_GROUPS.find((group) => group.key === ACCOUNT_KEY)

/**
 * The account affordance. The lock puts Saved in the chrome and out of the nav
 * row, so it renders as its own control beside the ask, and its destination is
 * the account group's first link rather than a path typed here. No fallback: if
 * site-nav ever drops the group, the affordance disappears and the development
 * audit says so, which is honest. Inventing `/account` here would be the drift
 * this file exists to prevent.
 */
const SAVED =
  ACCOUNT_GROUP && ACCOUNT_GROUP.links.length > 0
    ? { href: ACCOUNT_GROUP.links[0].href, label: ACCOUNT_GROUP.label }
    : null

/**
 * The filled seller ask. Only the LABEL is fixed at module scope: the href is
 * built per render by valuationHref(path) so the ask carries
 * `?from=<originating path>` into the seller action's sourceUrl. Rendered only
 * when chromeShowsSellerAsk(path) is true (Sell). KPI attribution still keys
 * off body valuation links on other routes.
 */
const CTA = { label: v3Text(VALUATION_FORM.label) }

/**
 * Fixed accessible names. Built through v3Text so a blank one throws at import
 * rather than shipping a nameless landmark or a nameless control.
 */
const NAME = {
  home: v3Text('Ryan Realty home'),
  primary: v3Text('Primary'),
  menu: v3Text('Site menu'),
  sections: v3Text('Site sections'),
  openMenu: v3Text('Menu'),
  closeMenu: v3Text('Close menu'),
}

if (process.env.NODE_ENV !== 'production') {
  const reachable = new Set<string>()
  for (const group of NAV_GROUPS) {
    if (group.href) reachable.add(group.href)
    for (const link of group.links) reachable.add(link.href)
  }
  const required = new Set<string>([
    ...KB_TOP_NAV.flatMap((g) => [g.href, ...g.children.map((c) => c.href)]),
    ...KB_MENU_GROUPS.flatMap((g) => g.links.map((l) => l.href)),
    VALUATION_FORM.href,
  ])
  const missing = [...required].filter((href) => !reachable.has(href))
  if (missing.length > 0) {
    console.warn(
      `V3Chrome: ${missing.length} site-nav destination(s) are not reachable in the chrome: ${missing.join(', ')}`,
    )
  }
  const carried = NAV_GROUPS.filter((group) => LOCKED_LABEL[group.key] === undefined)
  if (carried.length > 0) {
    console.warn(
      `V3Chrome: carrying ${carried.length} site-nav group(s) the IA lock has no word for, under their own labels: ` +
        `${carried.map((g) => g.key).join(', ')}. Give each one a locked word or accept the carry.`,
    )
  }
}

/* -------------------------------------------------------------------------- */
/* The wordmark and the icons                                                  */
/* -------------------------------------------------------------------------- */

/**
 * The brand asset. One definition for the two places it renders (the bar and
 * the open menu's own bar), so they cannot drift into two different logos.
 *
 * Plain img, not next/image, for the reason V3Stage states for its poster: this
 * is an owned asset that must render on any path without depending on
 * image-host configuration. It is also the WORDMARK, which brand law renders
 * from the pre-rendered file and never re-typesets, so re-encoding a
 * transparent PNG down to a 20px display height buys nothing and risks the
 * alpha edge. The intrinsic dimensions are on the element, so the row reserves
 * its space and the bar does not jump when the file lands.
 */
function Wordmark() {
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src="/images/brand/logo-horizontal-navy-transparent.png"
      alt="Ryan Realty"
      width={2271}
      height={454}
      decoding="async"
    />
  )
}

/* Icons. Stroke is currentColor, so every one inherits the token beside it. */

function IconChevron() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
      <path
        d="M4 6l4 4 4-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconBookmark() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
      <path
        d="M4 2.75h8v10.5L8 10.4l-4 2.85z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconPhone() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
      <path
        d="M3.2 2.2h2.4l1.2 3-1.5 1.2a9.5 9.5 0 0 0 4.3 4.3l1.2-1.5 3 1.2v2.4a1.2 1.2 0 0 1-1.3 1.2A11.8 11.8 0 0 1 2 3.5a1.2 1.2 0 0 1 1.2-1.3z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconMenu() {
  return (
    <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true" focusable="false">
      <path
        d="M3 6h14M3 10h14M3 14h14"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

function IconClose() {
  return (
    <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true" focusable="false">
      <path
        d="M5 5l10 10M15 5L5 15"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

/* -------------------------------------------------------------------------- */
/* Current destination                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Whether a bar destination owns the page the visitor is on. Compared against
 * the path only: a group href may carry a query (`?view=map`), and a query does
 * not change which section of the graph the visitor is standing in.
 */
function isCurrentPath(pathname: string | null, href: string): boolean {
  if (!pathname || !href.startsWith('/')) return false
  const path = href.split('?')[0]
  if (path === '/') return pathname === '/'
  return pathname === path || pathname.startsWith(`${path}/`)
}

/* -------------------------------------------------------------------------- */
/* One bar destination: a link, plus a disclosure for its children              */
/* -------------------------------------------------------------------------- */

/**
 * The live column of a panel: the scope, the dot field when the group has
 * one, then the figures. Reads top to bottom as one sentence the visitor did
 * not have to ask for. Only what the server could read is printed; a group
 * with no live model renders no column at all.
 */
function V3ChromeLivePanel({ live }: { live: V3ChromeLiveGroup }) {
  return (
    <div className="v3-chrome__live" aria-label={live.eyebrow}>
      <p className="v3-chrome__live-eyebrow">{live.eyebrow}</p>
      {live.field ? (
        <svg
          className="v3-chrome__field"
          viewBox={`0 0 ${live.field.w} ${live.field.h}`}
          aria-hidden="true"
          focusable="false"
        >
          <path d={live.field.d} className="v3-chrome__field-dots" />
        </svg>
      ) : null}
      {live.facts.length > 0 ? (
        <dl className="v3-chrome__live-facts">
          {live.facts.map((f) => (
            <div key={`${f.figure} ${f.label}`} className="v3-chrome__live-fact">
              <dt className="v3-chrome__live-figure">{f.figure}</dt>
              <dd className="v3-chrome__live-label">{f.label}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {live.note ? <p className="v3-chrome__live-note">{live.note}</p> : null}
    </div>
  )
}

/**
 * WAI-ARIA APG "disclosure navigation menu with top-level links": a real link
 * to the group's own page, plus an adjacent caret button that owns the expanded
 * state. Pointer users get hover; keyboard users tab across five link and caret
 * pairs and expand only what they want, because auto-expanding on focus would
 * drop every child link into the tab sequence. Escape closes and returns focus
 * to the caret. Below 900px the whole row is display:none and the overlay
 * carries navigation.
 *
 * The panel's links are removed from the tab order when closed by
 * `visibility: hidden`, not by opacity: an invisible-but-focusable link is a
 * keyboard trap in slow motion.
 */
function V3ChromeDestination({
  group,
  currentPath,
  live,
}: {
  group: V3ChromeTopGroup
  currentPath: string
  live?: V3ChromeLiveGroup
}) {
  // The open state is stored as the path it was opened ON, and read back by
  // comparing. A panel left open across a navigation would hang over the page
  // the visitor just asked for, and this closes it BY DERIVATION: the moment
  // the path changes, `open` is false. No effect, no cascading render, and no
  // teardown anyone can forget to write.
  const [openPath, setOpenPath] = useState<string | null>(null)
  const open = openPath === currentPath
  const rootRef = useRef<HTMLDivElement>(null)
  const caretRef = useRef<HTMLButtonElement>(null)
  const panelId = `${useId()}-panel`
  const current = isCurrentPath(currentPath, group.href)
  // A live model with figures or a field earns the second column; one that
  // only carries values beside the links (Places) captions the list instead.
  const column = live != null && (live.facts.length > 0 || live.field != null)

  // Native focusout rather than React's onBlur: collapse once focus leaves the
  // group entirely, so tabbing out of the last child closes the panel behind it.
  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const onFocusOut = (event: FocusEvent) => {
      if (!el.contains(event.relatedTarget as Node | null)) setOpenPath(null)
    }
    el.addEventListener('focusout', onFocusOut)
    return () => el.removeEventListener('focusout', onFocusOut)
  }, [])

  return (
    <div
      ref={rootRef}
      className={cn('v3-chrome__group', open && 'is-open')}
      onMouseEnter={() => setOpenPath(currentPath)}
      onMouseLeave={() => {
        // Never yank a panel out from under a keyboard user whose focus is
        // still inside it because the pointer drifted away.
        if (!rootRef.current?.contains(document.activeElement)) setOpenPath(null)
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || !open) return
        event.stopPropagation()
        setOpenPath(null)
        caretRef.current?.focus()
      }}
    >
      <Link
        href={group.href}
        className="v3-chrome__group-link"
        aria-current={current ? 'page' : undefined}
      >
        {group.label}
      </Link>
      <button
        ref={caretRef}
        type="button"
        className="v3-chrome__caret"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`${group.label} pages`}
        onClick={() => setOpenPath(open ? null : currentPath)}
      >
        <IconChevron />
      </button>
      <div className={cn('v3-chrome__panel', column && 'v3-chrome__panel--live')} id={panelId}>
        {live && !column ? <p className="v3-chrome__panel-caption">{live.eyebrow}</p> : null}
        <ul className="v3-chrome__panel-list">
          {group.featured.map((link) => {
            const value = live?.values?.[link.href]
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="v3-chrome__panel-link"
                  onClick={() => setOpenPath(null)}
                >
                  <span>{link.label}</span>
                  {value ? <span className="v3-chrome__panel-value">{value}</span> : null}
                </Link>
              </li>
            )
          })}
        </ul>
        {column ? <V3ChromeLivePanel live={live} /> : null}
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/* V3Chrome                                                                    */
/* -------------------------------------------------------------------------- */

export type V3ChromeProps = {
  /**
   * Overrides the path the bar marks as current. Only for a surface that
   * renders the chrome outside a router context; the default reads
   * usePathname(), which is what every real page wants.
   */
  currentPath?: string
  id?: string
  className?: string
  /** What each group's menu says is true right now; absent groups print links only. */
  live?: V3ChromeLive | null
}

export function V3Chrome({ currentPath, id, className, live }: V3ChromeProps) {
  const pathname = usePathname()
  const path = currentPath ?? pathname ?? ''
  // The menu remembers the path it was opened ON, so a route change closes it
  // BY DERIVATION rather than by an effect that sets state: `open` is simply
  // false the moment the visitor lands somewhere else. That also means the
  // teardown below (scroll lock, key handler, focus return) runs on a
  // navigation exactly as it does on Escape, through one code path.
  const [openPath, setOpenPath] = useState<string | null>(null)
  const open = openPath === path
  const menuId = `${useId()}-menu`
  const triggerRef = useRef<HTMLButtonElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  // Closes on a same-path click too, which derivation alone cannot see: a link
  // to the page the visitor is already on changes nothing to compare against.
  const close = useCallback(() => setOpenPath(null), [])
  const menuHidden = open === false
  const hidden = currentPath == null && shouldHidePublicChrome(pathname)

  // Everything the open menu owns, in one effect so the teardown cannot drift
  // from the setup: the scroll lock, the focus trap, Escape, and returning
  // focus to the control that opened it.
  useEffect(() => {
    if (!open) return
    const overlay = overlayRef.current
    if (!overlay) return

    const opener = triggerRef.current
    const body = document.body
    const priorOverflow = body.style.overflow
    body.style.overflow = 'hidden'
    closeRef.current?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        setOpenPath(null)
        return
      }
      if (event.key !== 'Tab') return
      const focusable = overlay.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled])',
      )
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      body.style.overflow = priorOverflow
      opener?.focus()
    }
  }, [open])

  if (hidden) return null

  return (
    <header id={id} className={cn(V3_ROOT_CLASS, 'v3-chrome', className)}>
      <div className="v3-chrome__bar">
        <Link href="/" className="v3-chrome__mark" aria-label={NAME.home}>
          <Wordmark />
        </Link>

        <nav className="v3-chrome__nav" aria-label={NAME.primary}>
          {TOP_GROUPS.map((group) => (
            <V3ChromeDestination key={group.key} group={group} currentPath={path} live={live?.[group.key]} />
          ))}
        </nav>

        <div className="v3-chrome__actions">
          {/* The broker's number, always visible (Matt 2026-09-01: a visitor
              could not find how to contact the brokerage — chrome failure on a
              lead-gen site). Icon-only at 390, the number itself from 40rem.
              tel: from lib/brand/contact is one of the two sanctioned literal
              destinations in this file (see the header comment). */}
          <a
            href={`tel:${CONTACT.phoneDirectTel}`}
            className="v3-chrome__phone"
            aria-label={`Call Ryan Realty, ${CONTACT.phoneDirect}`}
          >
            <IconPhone />
            <span className="v3-chrome__phone-num">{CONTACT.phoneDirect}</span>
          </a>

          {SAVED ? (
            <Link
              href={SAVED.href}
              className="v3-chrome__saved"
              aria-current={isCurrentPath(path, SAVED.href) ? 'page' : undefined}
            >
              <IconBookmark />
              <span>{SAVED.label}</span>
            </Link>
          ) : null}

          {chromeShowsSellerAsk(path) ? (
            <V3Button href={valuationHref(path)} className="v3-chrome__cta">
              {CTA.label}
            </V3Button>
          ) : null}

          <button
            ref={triggerRef}
            type="button"
            className="v3-chrome__menu-btn"
            aria-expanded={open}
            aria-controls={menuId}
            onClick={() => setOpenPath(path)}
          >
            <IconMenu />
            <span className="v3-chrome__menu-word">{NAME.openMenu}</span>
          </button>
        </div>
      </div>

      {/* ALWAYS MOUNTED, closed with the `hidden` attribute rather than by
          conditional rendering, and that is an SEO decision as much as an
          accessibility one. This index is the only place a handful of
          destinations appear (the account pages, the communities the top bar
          trims), so rendering it only while the menu is open would drop them
          out of the HTML of every page on the site. `hidden` resolves to
          display:none, which takes the whole subtree out of the accessibility
          tree AND out of the tab order at once, so there is no
          invisible-but-focusable link and no aria-hidden wrapper around
          reachable controls. Going from display:none to display:flex is also
          what starts the entrance, so the animation still runs on open. */}
      <div
        id={menuId}
        ref={overlayRef}
        hidden={menuHidden}
        className="v3-chrome__overlay"
        role="dialog"
        aria-modal="true"
        aria-label={NAME.menu}
      >
        <div className="v3-chrome__overlay-bar">
          <Link href="/" className="v3-chrome__mark" aria-label={NAME.home} onClick={close}>
            <Wordmark />
          </Link>
          <button ref={closeRef} type="button" className="v3-chrome__close" onClick={close}>
            <IconClose />
            <span className="v3-chrome__menu-word">{NAME.closeMenu}</span>
          </button>
        </div>

        <nav className="v3-chrome__menu-nav" aria-label={NAME.sections}>
          {NAV_GROUPS.map((group, index) => {
            const headingId = `${menuId}-group-${index}`
            const lg = live?.[group.key]
            return (
              <div className="v3-chrome__menu-group" key={group.key}>
                <h2 className="v3-chrome__menu-title" id={headingId}>
                  {group.href ? (
                    <Link href={group.href} onClick={close}>
                      {group.label}
                    </Link>
                  ) : (
                    group.label
                  )}
                </h2>
                {lg && lg.facts.length > 0 ? (
                  <p className="v3-chrome__menu-live">
                    {lg.facts.map((f, i) => (
                      <span key={`${f.figure} ${f.label}`}>
                        {i > 0 ? ' · ' : ''}
                        <strong>{f.figure}</strong> {f.label}
                      </span>
                    ))}
                  </p>
                ) : null}
                <ul className="v3-chrome__menu-list" aria-labelledby={headingId}>
                  {group.links.map((link) => {
                    const value = lg?.values?.[link.href]
                    return (
                      <li key={link.href}>
                        <Link href={link.href} onClick={close}>
                          <span>{link.label}</span>
                          {value ? <span className="v3-chrome__menu-value">{value}</span> : null}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          })}
        </nav>

        <p className="v3-chrome__menu-foot">
          <span>Bend, Oregon</span>
          <a href={`tel:${CONTACT.phoneDirectTel}`}>{CONTACT.phoneDirect}</a>
        </p>
      </div>
    </header>
  )
}
