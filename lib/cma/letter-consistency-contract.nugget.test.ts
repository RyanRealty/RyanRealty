/**
 * Letter-consistency contract regressions from the cma-19815-nugget rebuild.
 * Both failures were check bugs: escaped hrefs looked untagged, and per-foot
 * "list at $X to $Y a foot" captions looked like a second list price.
 */
import { describe, expect, it } from 'vitest'
import { trackedDocLink } from '@/lib/cma/doc-links'
import { IDENTITY_LINK_PARAM } from '@/lib/identity/link-token'
import { evaluateLetterConsistencyContract, letterRecommendDollarsCheck } from '@/lib/cma/letter-consistency'
import {
  inspectLetterSiteLinks,
  letterLinkTrackingCheck,
} from '@/lib/cma/letter-link-contract'
import { escapeHtml } from '@/lib/cma/render-blocks'

const NUGGET = {
  recommended: 734_000,
  valueLow: 734_000,
  valueHigh: 878_000,
}

/** Real matrix-caption shapes from statusPpsfCaptionHtml (Nugget rebuild). */
const NUGGET_PER_FOOT_CAPTIONS = `
  <p class="small ppsf-status-caption">These four sales list at $372 to $511 a foot and sold at $319 to $480 a foot.</p>
  <p class="small ppsf-status-caption">These three listings list at $263 to $333 a foot.</p>
  <p class="small ppsf-status-caption">This one listing lists at $319 a foot.</p>
  <p>Closed sales ran $410/sf. Asking homes ran $388 per sq ft and $401 per square foot.</p>
`

function letterAnchor(href: string, label = 'comp'): string {
  return `<a href="${escapeHtml(href)}">${label}</a>`
}

describe('letter-links-tracked — Nugget escaped hrefs', () => {
  it('a fully tagged &amp; site link passes when the row has a contact', () => {
    const href = trackedDocLink(
      'listing',
      { listingKey: 'L1', city: 'Bend' },
      { brokerSlug: 'matthew-ryan', personId: 19815, cmaSlug: 'cma-19815-nugget' },
    )
    expect(href).toContain('utm_source=cma')
    expect(href).toContain(`${IDENTITY_LINK_PARAM}=`)
    const html = letterAnchor(href)
    expect(html).toContain('&amp;utm_medium=')
    expect(html).toContain(`&amp;${IDENTITY_LINK_PARAM}=`)
    expect(html).not.toMatch(/href="[^"]*&utm_/)
    const check = letterLinkTrackingCheck(html, { personId: 19815 })
    expect(check.pass).toBe(true)
    expect(inspectLetterSiteLinks(html)[0]).toMatchObject({ hasUtm: true, hasPid: true })
  })

  it('an &amp; link that is missing _pid still fails when a contact exists', () => {
    const utmOnly = trackedDocLink('search', 'Bend', {
      brokerSlug: 'matthew-ryan',
      personId: null,
      cmaSlug: 'cma-19815-nugget',
    })
    expect(utmOnly).toContain('utm_source=cma')
    expect(utmOnly).not.toContain(`${IDENTITY_LINK_PARAM}=`)
    const html = letterAnchor(utmOnly, 'homes')
    expect(html).toContain('&amp;utm_medium=')
    const check = letterLinkTrackingCheck(html, { personId: 19815 })
    expect(check.pass).toBe(false)
    expect(check.detail).toMatch(/missing _pid/)
  })

  it('an &amp; link that is missing utm still fails', () => {
    const bare = 'https://ryan-realty.com/homes-for-sale/bend?agent=matthew-ryan&_pid=token.example'
    const html = letterAnchor(bare, 'homes')
    expect(html).toContain('&amp;_pid=')
    const check = letterLinkTrackingCheck(html, { personId: 19815 })
    expect(check.pass).toBe(false)
    expect(check.detail).toMatch(/missing utm/)
  })
})

describe('letter-one-recommend-price — Nugget per-foot captions', () => {
  it("per-foot 'list at $X to $Y a foot' sentences pass next to the real rec", () => {
    const html = `
      <p>We recommend listing at $734,000.</p>
      ${NUGGET_PER_FOOT_CAPTIONS}
    `
    const check = letterRecommendDollarsCheck(html, NUGGET)
    expect(check.pass).toBe(true)
    expect(check.detail).not.toMatch(/\$372|\$263|\$319/)
  })

  it('a letter with two different whole-home list prices still fails', () => {
    const html = `
      <p>We recommend listing at $734,000.</p>
      <p>The sales alone would support listing at $912,000.</p>
      ${NUGGET_PER_FOOT_CAPTIONS}
    `
    const check = letterRecommendDollarsCheck(html, NUGGET)
    expect(check.pass).toBe(false)
    expect(check.detail).toMatch(/\$912,000/)
    expect(check.detail).not.toMatch(/\$372|\$263|\$319/)
  })

  it('Nugget letter shape: escaped tracked links plus per-foot captions pass the contract', () => {
    const href = trackedDocLink(
      'place',
      { city: 'Bend', subdivisionName: 'Nugget' },
      { brokerSlug: 'matthew-ryan', personId: 19815, cmaSlug: 'cma-19815-nugget' },
    )
    const html = `
      <p>We recommend listing at $734,000.</p>
      ${NUGGET_PER_FOOT_CAPTIONS}
      ${letterAnchor(href, 'homes in the plat')}
    `
    const out = evaluateLetterConsistencyContract({
      html,
      names: { clientName: 'Alex Rivera' },
      identity: { personId: 19815 },
      pricing: NUGGET,
    })
    expect(out.pass).toBe(true)
    expect(out.checks.find((c) => c.id === 'letter-links-tracked')?.pass).toBe(true)
    expect(out.checks.find((c) => c.id === 'letter-one-recommend-price')?.pass).toBe(true)
  })
})
