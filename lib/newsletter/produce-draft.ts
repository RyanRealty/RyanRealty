import 'server-only'

/**
 * produce-draft — the newsletter CURATION producer (manual-run).
 *
 * Matt clicks a button in the admin; this pulls LIVE data through the DAL,
 * assembles the newsletter SECTION body (the middle of the shell, between the
 * Old Mill hero and the per-broker close), builds a plain-text alternative, and
 * writes a DRAFT into `newsletters` for review + approval. Nothing sends here.
 *
 * CLAUDE.md §0 — ABSOLUTE. Every number that appears in the body comes straight
 * from a DAL function's return value. Nothing here computes, estimates, rounds
 * to invent, or hardcodes a market number. The buyer/balanced/seller verdict is
 * `MarketReportAreaBlock.marketVerdict` verbatim (already §0-thresholded in the
 * DAL). When a figure is null the figure is OMITTED, never filled. Every stat
 * token gets a `citations` entry so a reviewer can audit the trace.
 *
 * Brand voice: no em-dashes, no semicolons, no banned words, sentence case,
 * currency rounded to the nearest thousand. The evergreen For Sellers / For
 * Buyers prose carries NO market number (a section with no verifiable figure
 * carries no figure), adapted from the approved email.html copy.
 *
 * DAL functions called (all live):
 *   - getMarketReportData(citySlugs)   → per-city median / active / sold / MoS / verdict
 *   - getRecentBlogPosts({ limit })     → recent published /blog posts
 *   - getCommunityBySlug(slug)          → one community + authoritative active count
 *   - getEventsForMonth(year, month)    → confirmed events this month
 *   - createNewsletterDraft + updateNewsletter → the draft writer + citations set
 */

import { getMarketReportData } from '@/lib/data/crm/getMarketReportData'
import { getRecentBlogPosts } from '@/lib/data/blog/getRecentBlogPosts'
import { getEventsForMonth } from '@/lib/data/events/getEvents'
import { getCommunityBySlug } from '@/app/actions/communities'
import { createNewsletterDraft, listNewsletters, setNewsletterCitations, type NewsletterCitationEntry } from '@/lib/data'
import { htmlToPlainText } from '@/lib/email/prepare'

const SITE = 'https://ryan-realty.com'

/** The primary cities the newsletter Market section covers (all resolve as cities). */
const NEWSLETTER_CITY_SLUGS = ['bend', 'redmond', 'sisters', 'sunriver', 'la-pine', 'tumalo']

/** The featured community for the Community section (curated hero lives on its page). */
const FEATURED_COMMUNITY_SLUG = 'tetherow'

/** One traced figure. Alias of the DAL citation row. */
export type NewsletterCitation = NewsletterCitationEntry

const NAVY = '#102742'
const CREAM = '#faf8f4'
const INK = '#26303c'
const GREEN = '#2e6f4e'
const GOLD = '#a5842c'
const RED = '#b4533a'
const SERIF = 'Georgia,serif'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * Decode the HTML entities this producer emits into real characters for the
 * PLAIN-TEXT alternative. htmlToPlainText strips tags but leaves entities, so
 * without this the text/plain part ships literal "&bull;" strings (and the
 * entity semicolons false-fail the R-1 punctuation check).
 */
function decodeEntitiesForText(s: string): string {
  return s
    .replace(/&bull;/g, '•')
    .replace(/&middot;/g, '·')
    .replace(/&rarr;/g, '→')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#9650;/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

/** Absolute HTTPS URL for email (a relative /path can't load in an inbox). Null → null. */
function absolutize(url: string | null | undefined): string | null {
  if (!url) return null
  if (/^https?:\/\//i.test(url)) return url
  return `${SITE}${url.startsWith('/') ? '' : '/'}${url}`
}

/** Round a whole-dollar figure to the nearest thousand and format as $895,000. */
function currencyRounded(n: number): string {
  const k = Math.round(n / 1000) * 1000
  return `$${k.toLocaleString('en-US')}`
}

/** Verdict → { label, color } for the meter pill (mockup colors, brand voice). */
function verdictStyle(verdict: 'sellers' | 'balanced' | 'buyers'): { label: string; color: string } {
  if (verdict === 'sellers') return { label: "SELLER'S", color: RED }
  if (verdict === 'buyers') return { label: "BUYER'S", color: GREEN }
  return { label: 'BALANCED', color: GOLD }
}

/**
 * Arrow horizontal position (0..100) encoding months of supply, clamped 0..12.
 * The meter reads left = buyer's (green), right = seller's (red), matching the
 * mockup. Low MoS (seller's) pushes the arrow right, high MoS (buyer's) left.
 * The arrow only ever encodes a REAL MoS; callers must not render a meter when
 * MoS is null.
 */
function arrowPositionPct(mos: number): number {
  const clamped = Math.min(12, Math.max(0, mos))
  // Invert: MoS 0 → 100% (far right / strong seller), MoS 12 → 0% (far left / strong buyer).
  return Math.round((1 - clamped / 12) * 100)
}

type MarketCity = {
  slug: string
  areaLabel: string
  monthsOfSupply: number
  verdict: 'sellers' | 'balanced' | 'buyers'
  medianPrice: number | null
}

/** One clickable per-city meter row → that city's market report. */
function cityMeterRow(c: MarketCity): string {
  const { label, color } = verdictStyle(c.verdict)
  const pos = arrowPositionPct(c.monthsOfSupply)
  // The arrow sits in a 3-cell row: [pos%][arrow][remainder]. A tiny fixed arrow
  // cell keeps it a point, not a bar.
  const leftPct = Math.min(94, Math.max(0, pos))
  const rightPct = 100 - leftPct
  return `<a href="${SITE}/cities/${c.slug}/market-report" style="text-decoration:none;"><table width="100%" cellpadding="0" cellspacing="0"><tr><td style="border-top:1px solid rgba(16,39,66,.14);padding:15px 0;"><table width="100%"><tr>
    <td valign="middle" style="font-family:${SERIF};font-size:26px;color:${NAVY};">${escapeHtml(c.areaLabel)}</td>
    <td align="right" width="176" valign="middle">
      <table cellpadding="0" cellspacing="0" align="right" style="width:150px;"><tr>
        <td width="40%" style="background:${GREEN};font-size:0;line-height:8px;height:8px;border-radius:4px 0 0 4px;">&nbsp;</td>
        <td width="30%" style="background:#c8a23a;font-size:0;line-height:8px;height:8px;">&nbsp;</td>
        <td width="30%" style="background:${RED};font-size:0;line-height:8px;height:8px;border-radius:0 4px 4px 0;">&nbsp;</td>
      </tr></table>
      <table cellpadding="0" cellspacing="0" align="right" style="width:150px;"><tr>
        <td width="${leftPct}%"></td><td width="6%" style="text-align:center;font-size:10px;color:${NAVY};line-height:1;">&#9650;</td><td width="${Math.max(0, rightPct - 6)}%"></td>
      </tr></table>
      <div style="font-size:11px;font-weight:800;letter-spacing:.08em;color:${color};text-align:right;">${label}</div>
    </td>
  </tr></table></td></tr></table></a>`
}

function marketSection(cities: MarketCity[], intro: string): string {
  return `<!-- ============ THE MARKET ============ -->
  <tr><td style="padding:34px 34px 0;">
    <table width="100%"><tr>
      <td valign="bottom" style="font-size:12px;letter-spacing:.18em;color:#8a8a8a;font-weight:700;">&bull; THE MARKET</td>
      <td align="right" style="font-family:${SERIF};font-size:38px;color:#eae6de;font-weight:700;line-height:.9;">MARKET</td>
    </tr></table>
    <div style="border-bottom:1px solid rgba(16,39,66,.22);margin-top:8px;"></div>
    <div style="font-family:${SERIF};font-size:31px;line-height:1.15;color:${NAVY};font-weight:700;margin:22px 0 14px;">Where each city sits today, buyer to seller.</div>
    <p style="margin:0;color:${INK};font-size:17px;line-height:1.6;">${intro} Tap a city for its full report.</p>
  </td></tr>
  <tr><td style="padding:22px 34px 0;">
    ${cities.map(cityMeterRow).join('\n    ')}
    <a href="${SITE}/housing-market" style="display:inline-block;background:${NAVY};color:${CREAM};font-size:13px;font-weight:700;letter-spacing:.08em;text-decoration:none;padding:13px 22px;margin-top:20px;">SEE THE FULL MARKET &rarr;</a>
    <a href="${SITE}/reports" style="color:${NAVY};font-size:13px;font-weight:600;margin-left:8px;">or get it monthly</a>
  </td></tr>`
}

/** Evergreen For Sellers copy. No market number (adapted from approved email.html). */
function sellersSection(): string {
  return `<!-- ============ FOR SELLERS ============ -->
  <tr><td style="padding:38px 34px 0;">
    <table width="100%"><tr>
      <td valign="bottom" style="font-size:12px;letter-spacing:.18em;color:#8a8a8a;font-weight:700;">&bull; FOR SELLERS</td>
      <td align="right" style="font-family:${SERIF};font-size:38px;color:#eae6de;font-weight:700;line-height:.9;">SELL</td>
    </tr></table>
    <div style="border-bottom:1px solid rgba(16,39,66,.22);margin-top:8px;"></div>
    <div style="font-family:${SERIF};font-size:24px;line-height:1.2;color:${NAVY};margin:18px 0 10px;">The first week sets your price.</div>
    <p style="margin:0 0 16px;color:${INK};font-size:16px;line-height:1.6;">Every serious buyer sees your listing the day it goes live. Price it five percent high and they scroll past. The homes that sit almost always launched high and spent months chasing the market down. A pricing opinion built from the actual comps takes an afternoon and costs nothing.</p>
    <a href="${SITE}/lp/seller-home-value" style="display:inline-block;background:${NAVY};color:${CREAM};font-size:13px;font-weight:700;letter-spacing:.08em;text-decoration:none;padding:13px 22px;">GET YOUR HOME'S VALUE &rarr;</a>
  </td></tr>`
}

/** Evergreen For Buyers copy. No market number. */
function buyersSection(): string {
  return `<!-- ============ FOR BUYERS ============ -->
  <tr><td style="padding:38px 34px 0;">
    <table width="100%"><tr>
      <td valign="bottom" style="font-size:12px;letter-spacing:.18em;color:#8a8a8a;font-weight:700;">&bull; FOR BUYERS</td>
      <td align="right" style="font-family:${SERIF};font-size:38px;color:#eae6de;font-weight:700;line-height:.9;">BUY</td>
    </tr></table>
    <div style="border-bottom:1px solid rgba(16,39,66,.22);margin-top:8px;"></div>
    <div style="font-family:${SERIF};font-size:24px;line-height:1.2;color:${NAVY};margin:18px 0 10px;">You can write contingencies again.</div>
    <p style="margin:0 0 16px;color:${INK};font-size:16px;line-height:1.6;">You no longer have to waive the inspection or the appraisal to get an offer accepted. Sellers are covering repairs and buying down rates. Come in with a budget and three things you won't compromise on, and the list of real candidates gets short fast.</p>
    <a href="${SITE}/buy" style="display:inline-block;background:${NAVY};color:${CREAM};font-size:13px;font-weight:700;letter-spacing:.08em;text-decoration:none;padding:13px 22px;">BROWSE HOMES &rarr;</a>
  </td></tr>`
}

type BlogItem = { slug: string; title: string; excerpt: string | null; heroImageUrl: string | null; category: string | null }

/** Worth Reading — recent published /blog posts. Titles/excerpts are content, not stats. */
function worthReadingSection(posts: BlogItem[]): string {
  const rows = posts.map((p, i) => {
    const last = i === posts.length - 1
    const border = last ? '' : 'border-bottom:1px solid rgba(16,39,66,.12);'
    const imgUrl = absolutize(p.heroImageUrl)
    const img = imgUrl
      ? `<img src="${escapeHtml(imgUrl)}" alt="" width="84" style="width:84px;height:72px;object-fit:cover;display:block;">`
      : ''
    const excerpt = p.excerpt ? escapeHtml(p.excerpt.slice(0, 120)) : ''
    const cat = p.category ? escapeHtml(p.category.toUpperCase()) : 'READ'
    // data-nl-quote: the excerpt (and title) quote an ALREADY-PUBLISHED post
    // verbatim — its figures were verified at publish time, so the R-2 citation
    // gate excludes this block (quoted editorial content, not authored stats).
    return `<a href="${SITE}/blog/${escapeHtml(p.slug)}" style="text-decoration:none;"><table width="100%"><tr>
      <td width="96" style="padding:12px 14px 12px 0;">${img}</td>
      <td valign="middle" style="${border}padding:12px 0;">
        <div style="font-size:11px;letter-spacing:.1em;color:${GREEN};font-weight:700;">${cat}</div>
        <div data-nl-quote="blog" style="font-family:${SERIF};font-size:18px;color:${NAVY};margin:2px 0;">${escapeHtml(p.title)}</div>
        <div data-nl-quote="blog" style="font-size:13px;color:#6b7280;line-height:1.4;">${excerpt} &rarr;</div>
      </td>
    </tr></table></a>`
  })
  return `<!-- ============ WORTH READING ============ -->
  <tr><td style="padding:38px 34px 0;">
    <table width="100%"><tr>
      <td valign="bottom" style="font-size:12px;letter-spacing:.18em;color:#8a8a8a;font-weight:700;">&bull; WORTH READING</td>
      <td align="right" style="font-family:${SERIF};font-size:34px;color:#eae6de;font-weight:700;line-height:.9;">HOUSING</td>
    </tr></table>
    <div style="border-bottom:1px solid rgba(16,39,66,.22);margin:8px 0 6px;"></div>
  </td></tr>
  <tr><td style="padding:8px 34px 0;">
    ${rows.join('\n    ')}
  </td></tr>`
}

type CommunityItem = { slug: string; name: string; activeCount: number | null; heroImageUrl: string | null; city: string | null }

/** Community — one featured community. The count is authoritative (getCommunityBySlug). */
function communitySection(c: CommunityItem): string {
  const heroUrl = absolutize(c.heroImageUrl)
  const hero = heroUrl
    ? `<img src="${escapeHtml(heroUrl)}" alt="${escapeHtml(c.name)}" width="640" style="display:block;width:100%;height:230px;object-fit:cover;">`
    : ''
  // Only render the count when it is a real, positive figure (§0: omit, never fill).
  const hasCount = c.activeCount != null && c.activeCount > 0
  const countPill = hasCount
    ? `<td align="right" valign="bottom" style="font-size:12px;letter-spacing:.1em;color:#6b7280;"><b style="color:${NAVY};font-size:16px;">${c.activeCount}</b> FOR SALE${c.city ? ` &middot; ${escapeHtml(c.city.toUpperCase())}` : ''}</td>`
    : ''
  const blurb = hasCount
    ? `${c.activeCount} homes for sale inside the gates. See what is on the market and what it takes to live here. <b style="color:${NAVY};">See ${escapeHtml(c.name)} &rarr;</b>`
    : `See what is on the market and what it takes to live here. <b style="color:${NAVY};">See ${escapeHtml(c.name)} &rarr;</b>`
  return `<!-- ============ COMMUNITY ============ -->
  <tr><td style="padding:38px 34px 0;">
    <table width="100%"><tr>
      <td valign="bottom" style="font-size:12px;letter-spacing:.18em;color:#8a8a8a;font-weight:700;">&bull; COMMUNITY</td>
      <td align="right" style="font-family:${SERIF};font-size:30px;color:#eae6de;font-weight:700;line-height:.9;">COMMUNITIES</td>
    </tr></table>
    <div style="border-bottom:1px solid rgba(16,39,66,.22);margin:8px 0 18px;"></div>
    <a href="${SITE}/communities/${escapeHtml(c.slug)}" style="text-decoration:none;">
    ${hero}
    <table width="100%" style="margin-top:14px;"><tr>
      <td style="font-family:${SERIF};font-size:30px;color:${NAVY};">${escapeHtml(c.name)}</td>
      ${countPill}
    </tr></table>
    <div style="padding:8px 0 0;color:${INK};font-size:16px;line-height:1.55;">${blurb}</div>
    </a>
  </td></tr>`
}

type EventItem = { slug: string; name: string; city: string; nextConfirmedDate: string | null; endDate: string | null }

/** Format an event date range as "JUN 4-8" from ISO dates (dates come from the registry). */
function eventDateLabel(startIso: string, endIso: string | null): string {
  const start = new Date(`${startIso}T00:00:00`)
  const mon = MONTHS[start.getMonth()]!.slice(0, 3).toUpperCase()
  const d1 = start.getDate()
  if (!endIso || endIso === startIso) return `${mon} ${d1}`
  const end = new Date(`${endIso}T00:00:00`)
  if (end.getMonth() === start.getMonth()) return `${mon} ${d1}-${end.getDate()}`
  const mon2 = MONTHS[end.getMonth()]!.slice(0, 3).toUpperCase()
  return `${mon} ${d1} - ${mon2} ${end.getDate()}`
}

/** This Month — confirmed events. Links to /central-oregon/events/<slug>. */
function thisMonthSection(events: EventItem[]): string {
  const rows = events.map((e, i) => {
    const last = i === events.length - 1
    const border = last ? '' : 'border-bottom:1px solid rgba(16,39,66,.12);'
    const date = e.nextConfirmedDate ? eventDateLabel(e.nextConfirmedDate, e.endDate) : ''
    // Escape the PARTS, then join with the raw middle-dot entity — escaping the whole
    // joined string would turn `&middot;` into a literal `&amp;middot;` in the inbox.
    const meta = [date, e.city.toUpperCase()].filter(Boolean).map(escapeHtml).join(' &middot; ')
    return `<a href="${SITE}/central-oregon/events/${escapeHtml(e.slug)}" style="text-decoration:none;"><table width="100%"><tr>
      <td valign="middle" style="${border}padding:12px 0;">
        <div style="font-size:11px;letter-spacing:.1em;color:${RED};font-weight:700;">${meta}</div>
        <div style="font-family:${SERIF};font-size:20px;color:${NAVY};margin-top:2px;">${escapeHtml(e.name)}</div>
      </td>
    </tr></table></a>`
  })
  return `<!-- ============ THIS MONTH ============ -->
  <tr><td style="padding:40px 34px 0;">
    <table width="100%"><tr>
      <td valign="bottom" style="font-size:12px;letter-spacing:.18em;color:#8a8a8a;font-weight:700;">&bull; THIS MONTH</td>
      <td align="right" style="font-family:${SERIF};font-size:30px;color:#eae6de;font-weight:700;line-height:.9;">CENTRAL OREGON</td>
    </tr></table>
    <div style="border-bottom:1px solid rgba(16,39,66,.22);margin:8px 0 6px;"></div>
  </td></tr>
  <tr><td style="padding:8px 34px 0;">
    ${rows.join('\n    ')}
  </td></tr>`
}

export type ProduceDraftResult = { ok: boolean; id?: string; error?: string }

/**
 * The canonical subject for a month's issue — shared with the monthly auto-draft
 * cron, whose idempotency check is "does a newsletter with this month's subject
 * already exist in ANY status".
 */
export function monthlyNewsletterSubject(now: Date): string {
  return `The Bend Brief · ${MONTHS[now.getMonth()]!}`
}

/**
 * Pull live data, assemble the section body + plain text + citations, write a
 * DRAFT. Never sends. `createdBy` is the admin email for the audit trail.
 */
export async function produceNewsletterDraft(createdBy: string | null): Promise<ProduceDraftResult> {
  const now = new Date()
  const fetchedAt = now.toISOString()
  const year = now.getFullYear()
  const month = now.getMonth() + 1 // 1-based

  const citations: NewsletterCitation[] = []

  // ── Market (per-city meters) ────────────────────────────────────────────────
  const blocks = await getMarketReportData(NEWSLETTER_CITY_SLUGS)
  // Keep only cities with a REAL MoS + verdict — a meter with no MoS can't be drawn.
  const marketCities: MarketCity[] = []
  for (const b of blocks) {
    if (b.monthsOfSupply == null || b.marketVerdict == null) continue
    marketCities.push({
      slug: b.slug,
      areaLabel: b.areaLabel,
      monthsOfSupply: b.monthsOfSupply,
      verdict: b.marketVerdict,
      medianPrice: b.medianPrice,
    })
    citations.push({
      figure: `${b.areaLabel} months of supply`,
      source: 'getMarketReportData',
      filter: `${b.slug} · ${b.source}`,
      value: b.monthsOfSupply,
      fetched_at: fetchedAt,
    })
    citations.push({
      figure: `${b.areaLabel} market verdict`,
      source: 'getMarketReportData',
      filter: `${b.slug} · derived from monthsOfSupply`,
      value: b.marketVerdict,
      fetched_at: fetchedAt,
    })
    if (b.medianPrice != null) {
      citations.push({
        figure: `${b.areaLabel} median sale price`,
        source: 'getMarketReportData',
        filter: `${b.slug} · trailing 12mo closed`,
        value: b.medianPrice,
        fetched_at: fetchedAt,
      })
    }
  }

  if (marketCities.length === 0) {
    return { ok: false, error: 'no_market_data' }
  }

  // Intro built ONLY from live figures. Lead with Bend's median when present,
  // else a plain count-of-cities sentence. No invented number.
  const bend = marketCities.find((c) => c.slug === 'bend')
  let intro: string
  if (bend && bend.medianPrice != null) {
    intro = `Across the ${marketCities.length} cities we cover, the median home in Bend closed at ${currencyRounded(bend.medianPrice)}. They are not one market.`
  } else {
    intro = `Across the ${marketCities.length} cities we cover, no two are the same market.`
  }

  // ── Worth Reading (blog) ────────────────────────────────────────────────────
  const rawPosts = await getRecentBlogPosts({ limit: 3 })
  const blogItems: BlogItem[] = rawPosts.map((p) => ({
    slug: p.slug,
    title: p.title,
    excerpt: p.excerpt,
    heroImageUrl: p.heroImageUrl,
    category: p.category,
  }))
  for (const p of blogItems) {
    citations.push({
      figure: `Worth Reading post`,
      source: 'getRecentBlogPosts',
      filter: `published · /blog/${p.slug}`,
      value: p.title,
      fetched_at: fetchedAt,
    })
  }

  // ── Community (one featured) ────────────────────────────────────────────────
  const community = await getCommunityBySlug(FEATURED_COMMUNITY_SLUG)
  let communityItem: CommunityItem | null = null
  if (community) {
    communityItem = {
      slug: community.slug,
      name: community.name,
      activeCount: community.activeCount ?? null,
      heroImageUrl: community.heroImageUrl ?? null,
      city: community.city ?? null,
    }
    if (communityItem.activeCount != null && communityItem.activeCount > 0) {
      citations.push({
        figure: `${community.name} active listings`,
        source: 'getCommunityBySlug',
        filter: `${community.slug} · live active count`,
        value: communityItem.activeCount,
        fetched_at: fetchedAt,
      })
    }
  }

  // ── This Month (events) ─────────────────────────────────────────────────────
  const rawEvents = getEventsForMonth(year, month)
  const eventItems: EventItem[] = rawEvents.slice(0, 4).map((e) => ({
    slug: e.slug,
    name: e.name,
    city: e.city,
    nextConfirmedDate: e.nextConfirmedDate,
    endDate: e.endDate,
  }))
  for (const e of eventItems) {
    citations.push({
      figure: `This Month event`,
      source: 'getEventsForMonth',
      filter: `${year}-${String(month).padStart(2, '0')} · ${e.slug}`,
      value: e.nextConfirmedDate ?? e.name,
      fetched_at: fetchedAt,
    })
  }

  // ── Assemble the section body (mockup order, LOCKED) ────────────────────────
  const parts: string[] = [
    marketSection(marketCities, intro),
    sellersSection(),
    buyersSection(),
  ]
  if (blogItems.length > 0) parts.push(worthReadingSection(blogItems))
  if (communityItem) parts.push(communitySection(communityItem))
  if (eventItems.length > 0) parts.push(thisMonthSection(eventItems))

  const bodyHtml = parts.join('\n\n')
  const bodyText = decodeEntitiesForText(htmlToPlainText(bodyHtml))

  // ── Subject + preview (from live data) ──────────────────────────────────────
  const subject = monthlyNewsletterSubject(now)
  const previewText = bend && bend.medianPrice != null
    ? `The median home in Bend closed at ${currencyRounded(bend.medianPrice)}. Where every city sits, buyer to seller.`
    : `Where each Central Oregon city sits this month, buyer to seller.`

  // M7: don't silently create a duplicate. If a draft for this exact subject (same
  // month) already exists, return it instead of a second identical row.
  const existing = await listNewsletters(50)
  const dup = existing.find((n) => n.status === 'draft' && n.subject === subject)
  if (dup) return { ok: false, error: 'draft_exists', id: dup.id }

  // ── Write the draft, then attach citations ──────────────────────────────────
  const created = await createNewsletterDraft({
    subject,
    preview_text: previewText,
    body_html: bodyHtml,
    body_text: bodyText,
    audience: 'all',
    created_by: createdBy,
  })
  if (!created.ok || !created.id) {
    return { ok: false, error: created.error ?? 'persist_failed' }
  }

  // citations is a jsonb column on `newsletters` (added in migration 20260703100200).
  await setNewsletterCitations(created.id, citations)

  return { ok: true, id: created.id }
}
