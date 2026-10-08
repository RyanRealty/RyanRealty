import { describe, expect, it } from 'vitest'
import { composeCmaFirstContact } from '@/lib/cma/first-contact'
import { buildCmaFirstContactForRow } from '@/lib/cma/first-contact-for-send'
import type { FirstContactPlace } from '@/lib/cma/first-contact-place'
import { attributeOutbound } from '@/lib/crm/attributed-links'
import { verifyEmailToken } from '@/lib/email-tracking'
import { verifyPersonLinkToken } from '@/lib/identity/link-token'
import { buildLeadBody, type CmaSendContext } from '@/lib/cma/send'

const SLUG = 'cma-62017-nate-s'
const PLACE: FirstContactPlace = {
  subdivision: {
    label: 'Clarendon Place',
    href: 'https://ryan-realty.com/subdivisions/clarendon-place',
    closed12mo: 6,
    active: 2,
    unsold12mo: 3,
    pending: null,
    history: null,
  },
  wider: { label: 'Bend', href: 'https://ryan-realty.com/cities/bend' },
}

const FACTS = {
  address: "62017 Nate's, Bend, OR 97702",
  firstName: null,
  valueLow: 346000,
  valueHigh: 372000,
  recommendedList: 358000,
  lastListPrice: 405000,
  brokerName: 'Matt Ryan',
  brokerSlug: 'matt',
  city: 'Bend',
  subdivision: 'Clarendon Place',
  closedSalesCount: 4,
  salesScope: 'subdivision' as const,
  cmaSlug: SLUG,
  place: PLACE,
}

function ctx(): CmaSendContext {
  return {
    slug: SLUG,
    subjectAddress: FACTS.address,
    clientName: 'Nate Someone',
    clientEmail: 'nate@example.com',
    brokerRow: {
      slug: 'matthew-ryan',
      displayName: 'Matt Ryan',
      title: 'Owner & Principal Broker',
      email: 'matt@ryan-realty.com',
      phone: null,
      photoUrl: null,
    },
    valueLow: 346000,
    valueHigh: 372000,
    recommendedList: 358000,
    lastListPrice: 405000,
    origin: 'expired',
    facts: FACTS,
    // Cast, not an annotation: main may add context fields (for example the
    // subject listing key) that this body builder does not read.
  } as CmaSendContext
}

const SIGNATURE = {
  html: '<div data-sig>Matt Ryan <a href="https://ryan-realty.com/docs/oregon-initial-agency-disclosure-pamphlet.pdf">Oregon Initial Agency Disclosure Pamphlet</a></div>',
  plain:
    '\n--\nMatt Ryan\nOregon Initial Agency Disclosure Pamphlet (ORS 696.820): https://ryan-realty.com/docs/oregon-initial-agency-disclosure-pamphlet.pdf\n',
}

function letterHtml(html: string): string {
  const m = html.match(/<div data-cma-letter>([\s\S]*?)<\/div>/)
  if (!m) throw new Error('letter block missing')
  return m[1]!
}

function decodeVisible(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&rarr;/g, '→')
    .replace(/&nbsp;/g, ' ')
}

function anchors(html: string): Array<{ href: string; text: string }> {
  return [...html.matchAll(/<a\b[^>]*\bhref="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)].map((m) => ({
    href: m[1]!,
    text: decodeVisible(m[2]!).trim(),
  }))
}

function track(html: string): string {
  return attributeOutbound(html, {
    brokerSlug: 'matt',
    personId: 4242,
    emailKey: `cma:${SLUG}`,
    label: 'A market analysis for 62017 Nate\'s',
    broker: 'matt',
  })
}

function mailedPlain(text: string): string {
  return (text.split('\n--\n')[0] ?? '').trim()
}

describe('CMA first-contact send body', () => {
  const copy = composeCmaFirstContact('expired', FACTS)

  it('leads with the broker, then the findings, then the report button', () => {
    const sent = buildLeadBody(ctx(), undefined, SIGNATURE)
    const letter = letterHtml(sent.html)
    const visible = decodeVisible(letter)
    const greeting = visible.indexOf('Hi there')
    const intro = visible.indexOf('My name is Matt Ryan, and I own Ryan Realty here in Bend.')
    const concession = visible.indexOf('A home that sells at full price with a 3% concession')
    const report = visible.indexOf('Our report accounts for that.')
    const cta = visible.indexOf('See the full market analysis')
    const questions = visible.indexOf('Please let me know if you have any questions about the numbers')
    const chosen = visible.indexOf("If you've already chosen a broker")
    expect(greeting).toBeGreaterThanOrEqual(0)
    expect(intro).toBeGreaterThan(greeting)
    expect(concession).toBeGreaterThan(intro)
    expect(report).toBeGreaterThan(concession)
    expect(cta).toBeGreaterThan(report)
    expect(questions).toBeGreaterThan(cta)
    expect(chosen).toBeGreaterThan(questions)
    expect(visible).not.toContain('support a value between')
    expect(visible).not.toContain('Your last list price')
    expect(visible).not.toContain('months of supply')
    expect(visible.trimEnd().endsWith('We hope it goes well for you.')).toBe(true)
    expect(visible).not.toContain('We would list it at')
    expect(visible).not.toContain('Our price')
    expect(visible).not.toContain('See our price')
    expect(visible).not.toContain("seller's market")
    expect(visible).not.toContain('$358,000')
    expect(visible).not.toContain('$346,000')
    expect(sent.html).not.toContain('$358,000')
    expect(sent.html).not.toContain('>4 sales<')
    expect(anchors(letter).map((l) => l.text)).toEqual(['See the full market analysis →'])
    const first = anchors(letter)[0]
    expect(first?.href).toContain(`/cma/${SLUG}`)
    expect(first?.href).not.toContain('/api/track/')
    expect(sent.html).toContain('MARKET ANALYSIS')
    expect(sent.html).not.toContain('https://cdn.resize.sparkplatform.com/')
    expect(sent.html).not.toContain('hero-oldmill')
    expect(sent.html).not.toContain('height:240px')
  })

  it('does not claim a list price when the row has no recommendation', () => {
    const facts = { ...FACTS, recommendedList: null }
    const sent = buildLeadBody({ ...ctx(), facts, recommendedList: null }, undefined, SIGNATURE)
    const visible = decodeVisible(letterHtml(sent.html))
    expect(visible).toContain("where we'd price it")
    expect(visible).not.toContain('support a value between')
    expect(visible).not.toContain('We would list it at $')
    expect(visible).not.toContain('the price we would list at')
    expect(visible).not.toContain('$358,000')
    expect(visible).not.toContain('Our price')
    expect(visible).not.toContain('See our price')
    expect(anchors(letterHtml(sent.html)).map((l) => l.text)).toEqual(['See the full market analysis →'])
    expect(visible.indexOf('Hi there')).toBeLessThan(visible.indexOf('My name is Matt Ryan'))
  })

  it('keeps months of supply out of the expired letter even when the pulse was loaded', () => {
    const facts = { ...FACTS, monthsOfSupply: 2.95 }
    const sent = buildLeadBody({ ...ctx(), facts }, undefined, SIGNATURE)
    expect(sent.html).not.toContain('months of supply')
    expect(decodeVisible(letterHtml(sent.html))).toContain('See the full market analysis')
  })

  it('puts one listing photo inside the analysis card, not above the greeting', () => {
    const sent = buildLeadBody(
      { ...ctx(), heroUrl: 'https://cdn.resize.sparkplatform.com/ore/1600x1200/true/house.jpg' },
      undefined,
      SIGNATURE,
    )
    const src = 'src="https://cdn.resize.sparkplatform.com/ore/640x360/true/house.jpg"'
    expect(sent.html).toContain(src)
    expect(sent.html).toContain('alt="62017 Nate&#39;s, photo 1"')
    expect(sent.html).toContain('data-cma-analysis="1"')
    expect(sent.html).toContain('See the full market analysis')
    expect(sent.html.indexOf(src)).toBeGreaterThan(sent.html.indexOf('Hi there'))
    expect(sent.html.indexOf(src)).toBeLessThan(sent.html.indexOf('See the full market analysis'))
    expect(sent.html).not.toContain('width="240"')
    expect(sent.html).not.toContain('height="160"')
    expect(sent.html).not.toContain('hero-oldmill')
    expect(sent.html).not.toContain('height:240px')
    expect(sent.html).not.toContain('/1600x1200/')
  })

  it('puts two or three subject photos in the card and does not repeat the hero', () => {
    const sent = buildLeadBody(
      {
        ...ctx(),
        heroUrl: 'https://cdn.resize.sparkplatform.com/ore/1600x1200/true/hero.jpg',
        galleryUrls: [
          'https://cdn.resize.sparkplatform.com/ore/1600x1200/true/a.jpg',
          'https://cdn.resize.sparkplatform.com/ore/1024x768/true/b.jpg',
          'https://cdn.resize.sparkplatform.com/ore/800x600/true/c.jpg',
          'https://cdn.resize.sparkplatform.com/ore/800x600/true/d.jpg',
          'http://cdn.resize.sparkplatform.com/ore/800x600/true/nope.jpg',
        ],
      },
      undefined,
      SIGNATURE,
    )
    expect(sent.html).toContain('/360x240/true/a.jpg')
    expect(sent.html).toContain('/360x240/true/b.jpg')
    expect(sent.html).toContain('/360x240/true/c.jpg')
    expect(sent.html).not.toContain('d.jpg')
    expect(sent.html).not.toContain('hero.jpg')
    expect(sent.html).not.toContain('nope.jpg')
    const hi = sent.html.indexOf('Hi there')
    const photos = sent.html.indexOf('/360x240/true/a.jpg')
    const label = sent.html.indexOf('See the full market analysis')
    expect(photos).toBeGreaterThan(hi)
    expect(label).toBeGreaterThan(photos)
    const letter = letterHtml(sent.html)
    const links = anchors(letter)
    expect(links.filter((l) => l.text === 'See the full market analysis →')).toHaveLength(1)
    expect(links.every((l) => l.href.includes(`/cma/${SLUG}`))).toBe(true)
    expect(links.length).toBe(4)
  })

  it('keeps another origin on the single photo and the plain report button', () => {
    const sent = buildLeadBody(
      {
        ...ctx(),
        origin: 'seller-valuation',
        heroUrl: 'https://cdn.resize.sparkplatform.com/ore/1600x1200/true/house.jpg',
        galleryUrls: ['https://cdn.resize.sparkplatform.com/ore/1600x1200/true/a.jpg'],
      },
      undefined,
      SIGNATURE,
    )
    const src = 'src="https://cdn.resize.sparkplatform.com/ore/640x360/true/house.jpg"'
    expect(sent.html).toContain(src)
    expect(sent.html.indexOf(src)).toBeLessThan(sent.html.indexOf('Hi there'))
    expect(sent.html).toContain('width="240"')
    expect(sent.html).not.toContain('data-cma-analysis')
    expect(sent.html).not.toContain('a.jpg')
    expect(decodeVisible(letterHtml(sent.html))).toContain('Read the full report')
    expect(sent.html).not.toContain('See the full market analysis')
  })

  it('tracks every letter link as words, with the email tag set', () => {
    const sent = buildLeadBody(ctx(), undefined, SIGNATURE)
    const html = track(sent.html)
    const letter = letterHtml(html)
    const links = anchors(letter)
    expect(links.map((l) => l.text)).toEqual(['See the full market analysis →'])
    expect(decodeVisible(letter).toLowerCase()).not.toContain('http')
    const paths: string[] = []
    for (const link of links) {
      const href = new URL(link.href, 'https://ryan-realty.com')
      expect(href.pathname).toBe('/api/track/e/click')
      const token = verifyEmailToken(href.searchParams.get('t'))
      expect(token?.url).toBeTruthy()
      const dest = new URL(token!.url!)
      expect(dest.searchParams.getAll('utm_source')).toEqual(['cma'])
      expect(dest.searchParams.getAll('utm_medium')).toEqual(['email'])
      expect(dest.searchParams.getAll('utm_campaign')).toEqual(['cma-letter'])
      expect(dest.searchParams.getAll('rr_doc')).toEqual([SLUG])
      expect(dest.searchParams.getAll('utm_content')).toEqual(['agent-matt'])
      expect(dest.searchParams.getAll('agent')).toEqual(['matt'])
      expect(dest.searchParams.getAll('_pid')).toHaveLength(1)
      expect(verifyPersonLinkToken(dest.searchParams.get('_pid'))).toEqual({ personId: 4242, channel: 'document' })
      expect(dest.searchParams.get('utm_medium')).not.toBe('document')
      expect(dest.search).not.toContain('utm_medium=document')
      paths.push(dest.pathname)
    }
    expect(paths).toEqual([`/cma/${SLUG}`])
  })

  it('keeps http out of the letter plain text, and leaves the signature plain part alone', () => {
    const sent = buildLeadBody(ctx(), undefined, SIGNATURE)
    const letter = sent.text.split('\n--\n')[0] ?? ''
    expect(letter.toLowerCase()).not.toContain('http')
    expect(letter.trim()).toBe(copy.bodyText)
    expect(sent.text).toContain('https://ryan-realty.com/docs/oregon-initial-agency-disclosure-pamphlet.pdf')
    const sigVisible = decodeVisible(sent.html.split('data-cma-letter')[1]?.split('</div>')[1] ?? '')
    expect(sigVisible).toContain('Oregon Initial Agency Disclosure Pamphlet')
    expect(sigVisible.toLowerCase()).not.toContain('http')
  })

  it('renders an unedited override the same as the default path', () => {
    const base = buildLeadBody(ctx(), undefined, SIGNATURE)
    const plain = buildLeadBody(ctx(), { bodyText: copy.bodyText }, SIGNATURE)
    const markers = buildLeadBody(ctx(), { bodyText: copy.bodyMarkers }, SIGNATURE)
    expect(plain.html).toBe(base.html)
    expect(plain.text).toBe(base.text)
    expect(markers.html).toBe(base.html)
    expect(markers.text).toBe(base.text)
  })

  it('still puts the report button on an edited note, and converts a stored document URL', () => {
    const note = buildLeadBody(ctx(), { bodyText: 'Hi there,\n\nA short note.' }, SIGNATURE)
    expect(note.text).not.toContain('Read the full report')
    expect(note.text.split('\n--\n')[0]?.toLowerCase()).not.toContain('http')
    const edited = letterHtml(note.html)
    const editedVisible = decodeVisible(edited)
    expect(editedVisible.indexOf('Read the full report')).toBeGreaterThan(editedVisible.indexOf('Hi there'))
    expect(editedVisible.indexOf('A short note')).toBeGreaterThan(editedVisible.indexOf('Read the full report'))
    expect(edited).toContain(`/cma/${SLUG}`)

    const stale = [
      'Hi there,',
      '',
      'Read our reviews at https://ryan-realty.com/reviews?utm_source=cma&utm_medium=document&utm_campaign=cma-62017-nate-s. and who we are at https://ryan-realty.com/about?utm_source=cma&amp;utm_medium=document&amp;utm_campaign=cma-62017-nate-s.',
    ].join('\n')
    const rescued = track(buildLeadBody(ctx(), { bodyText: stale }, SIGNATURE).html)
    const letter = letterHtml(rescued)
    expect(decodeVisible(letter).toLowerCase()).not.toContain('http')
    const links = anchors(letter)
    expect(links.map((l) => l.text)).toEqual([
      'Read the full report →',
      'our reviews',
      'who we are',
      'Read the full report →',
    ])
    const opening = new URL(verifyEmailToken(new URL(links[0]!.href).searchParams.get('t'))!.url!)
    const reviews = new URL(verifyEmailToken(new URL(links[1]!.href).searchParams.get('t'))!.url!)
    const about = new URL(verifyEmailToken(new URL(links[2]!.href).searchParams.get('t'))!.url!)
    const closing = new URL(verifyEmailToken(new URL(links[3]!.href).searchParams.get('t'))!.url!)
    expect(opening.pathname).toBe(`/cma/${SLUG}`)
    expect(closing.pathname).toBe(`/cma/${SLUG}`)
    expect(reviews.pathname).toBe('/reviews')
    expect(about.pathname).toBe('/about')
    for (const dest of [reviews, about]) {
      expect(dest.searchParams.getAll('utm_medium')).toEqual(['email'])
      expect(dest.searchParams.getAll('utm_source')).toEqual(['cma'])
      expect(dest.searchParams.getAll('utm_campaign')).toEqual(['cma-letter'])
      expect(dest.searchParams.getAll('rr_doc')).toEqual([SLUG])
      expect(dest.search).not.toContain('utm_medium=document')
    }
  })

  it('matches the Review helper for the same row', async () => {
    const row = {
      slug: SLUG,
      subject_address: FACTS.address,
      subject_city: 'Bend',
      subject_subdivision: 'Clarendon Place',
      client_name: 'Nate Someone',
      value_low: 346000,
      value_high: 372000,
      recommended_list: 358000,
      comps_count: 4,
      build_summary: { comp_selection: { final_tier_counts: { 'subdivision-6mo': 4 } } },
    }
    const preview = await buildCmaFirstContactForRow(row, {
      origin: 'expired',
      brokerName: 'Matt Ryan',
      brokerSlug: 'matt',
      lastListPrice: 405000,
      place: PLACE,
    })
    const sent = buildLeadBody(
      { ...ctx(), facts: preview.facts },
      undefined,
      SIGNATURE,
    )
    expect(preview.facts.firstName).toBe('Nate')
    expect(preview.copy.bodyText.startsWith('Hi Nate,')).toBe(true)
    expect(preview.copy.subject).toBe("An analysis of your home at 62017 Nate's")
    expect(preview.copy.bodyText).not.toBe(copy.bodyText)
    expect(mailedPlain(sent.text)).toBe(preview.copy.bodyText)
    expect(preview.copy.bodyText).not.toContain('Someone')
  })

  it('does not greet a trust by name', async () => {
    const preview = await buildCmaFirstContactForRow(
      {
        slug: SLUG,
        subject_address: FACTS.address,
        subject_city: 'Bend',
        client_name: 'Jan North & Bea North Rev Liv Trust',
        value_low: 346000,
        value_high: 372000,
        recommended_list: 358000,
        comps_count: 4,
      },
      { origin: 'expired', brokerName: 'Matt Ryan', brokerSlug: 'matt', lastListPrice: 405000, place: null },
    )
    expect(preview.facts.firstName).toBeNull()
    expect(preview.copy.bodyText.startsWith('Hi there,')).toBe(true)
    expect(preview.copy.bodyText).not.toMatch(/\b(Jan|Bea|North|Rev|Liv|Trust)\b/)
  })
})
