/**
 * /about playbook sections (Matt 2026-09-23): the facts the page prints come
 * from the live reads or the one spelling in lib/brand + sell-constants, the
 * FAQ is two or three sentences per answer and is the same array FAQPage
 * emits, no competitor is named, and clients are named by need.
 */
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { BRAND, CONTACT } from '@/lib/brand/contact'
import { buildJsonLd } from '@/lib/site/json-ld'
import { V3Answers, V3Entries, V3Facts } from '@/components/site/v3'
import { LISTING_TERMS } from '@/app/sell/_v3/sell-constants'
import { aboutFaqItems, FIRM_LICENSE } from './about-constants'
import {
  ABOUT_CLIENTS,
  ABOUT_HOW_STEPS,
  ABOUT_PROMISE_LINE,
  ABOUT_SERVICE_AREA,
  aboutBrokerDoors,
  aboutClosingSpan,
  aboutClosingStrip,
  aboutDifferentiators,
  aboutHoursSentence,
  aboutKeyFacts,
  aboutOrganizationFacts,
  aboutOriginBody,
  aboutServices,
  aboutTeamBody,
  type AboutPerson,
} from './about-playbook'

const PEOPLE: AboutPerson[] = [
  { name: 'Founder Person', title: 'Owner & Principal Broker', href: '/team/founder' },
  { name: 'Second Person', title: 'Broker', href: '/team/second' },
  { name: 'Third Person', title: 'Broker', href: '/team/third' },
]
const RECORD = {
  count: 3,
  firstClose: '2015-04-30',
  lastClose: '2026-09-18',
  dated: [
    { day: '2015-04-30', what: '1 First St, Bend', value: '$400,000' },
    { day: '2024-05-01', what: '2 Second St, Redmond', value: '$500,000' },
    { day: '2026-09-18', what: '3 Third St, Sisters', value: '$600,000' },
  ],
}
const REVIEWS = { average: 5, count: 25 }
const HOURS = aboutHoursSentence(
  [{ days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], start_time: '09:00', end_time: '17:00' }],
  'America/Los_Angeles',
)
const SERVICES = aboutServices('/sell/valuation')

function sentences(text: string): number {
  return (text.match(/[.?!](\s|$)/g) ?? []).length
}

function allCopy(): string {
  const faq = aboutFaqItems(PEOPLE, { hours: HOURS })
  const facts = aboutKeyFacts({ founder: PEOPLE[0]!, people: PEOPLE, services: SERVICES, hours: HOURS, record: RECORD, reviews: REVIEWS })
  return [
    ...SERVICES.flatMap((s) => [s.title, String(s.body), s.door?.label ?? '']),
    ...aboutDifferentiators({ reviews: REVIEWS, record: RECORD, valuationHref: '/v' }).flatMap((c) => [c.title, String(c.body), c.figure?.label ?? '']),
    ...ABOUT_CLIENTS.map((c) => c.label),
    ABOUT_PROMISE_LINE,
    ...ABOUT_HOW_STEPS.flatMap((s) => [s.title, String(s.body)]),
    aboutOriginBody(),
    aboutTeamBody(PEOPLE) ?? '',
    ...facts.flatMap((f) => [f.term, f.value ?? '', f.detail ?? '', ...(f.links ?? []).map((l) => l.label)]),
    ...faq.flatMap((q) => [q.question, q.answer]),
  ].join('\n')
}

describe('about playbook: live facts', () => {
  it('reads the published booking hours as one sentence, and nothing when none parse', () => {
    expect(HOURS).toBe('Monday through Saturday, 9:00 am to 5:00 pm Pacific')
    expect(aboutHoursSentence([], 'America/Los_Angeles')).toBeNull()
    expect(aboutHoursSentence([{ days: ['Xyz'], start_time: '09:00', end_time: '17:00' }], null)).toBeNull()
    expect(
      aboutHoursSentence([{ days: ['Mon', 'Wed'], start_time: '10:00', end_time: '14:30' }], 'America/Los_Angeles'),
    ).toBe('Monday and Wednesday, 10:00 am to 2:30 pm Pacific')
  })

  it('prints the closings span from the record, and nothing without dates', () => {
    expect(aboutClosingSpan(RECORD)).toBe('Apr 2015 to Sep 2026')
    expect(aboutClosingSpan({ count: 3, firstClose: null, lastClose: null })).toBeNull()
  })

  it('counts the team from the roster and names no one when it did not load', () => {
    expect(aboutTeamBody(PEOPLE)).toMatch(/^Ryan Realty has three licensed brokers, and all three live and work in Central Oregon\./)
    expect(aboutTeamBody([])).toBeNull()
    expect(aboutOriginBody()).toContain(`${BRAND.legalName} in ${BRAND.llcSince}`)
    expect(aboutOriginBody()).toContain(BRAND.foundedLabel)
    expect(aboutOriginBody()).not.toMatch(/boutique|authentic|exceptional/)
  })

  it('drops a differentiator whose live figure did not load', () => {
    const full = aboutDifferentiators({ reviews: REVIEWS, record: RECORD, valuationHref: '/v' })
    expect(full).toHaveLength(5)
    expect(full[0]?.figure).toEqual({ value: '5.0', label: 'Google rating, 25 reviews' })
    expect(full.find((c) => c.id === 'different-closings')?.figure).toEqual({ value: '3', label: 'Closings since 2015' })
    const bare = aboutDifferentiators({ reviews: null, record: null, valuationHref: '/v' })
    expect(bare.map((c) => c.id)).toEqual(['different-listing', 'different-valuation', 'different-broker'])
  })
})

describe('about playbook: the closings record drawn', () => {
  it('places one mark per dated closing between the first and last close, labelled from the rows', () => {
    const strip = aboutClosingStrip(RECORD)
    expect(strip?.from).toBe('Apr 2015')
    expect(strip?.to).toBe('Sep 2026')
    expect(strip?.marks.map((m) => m.at)).toEqual([0, expect.any(Number), 1])
    expect(strip?.marks[1]?.at).toBeGreaterThan(0.7)
    expect(strip?.marks[2]?.label).toBe('3 Third St, Sisters, $600,000, Sep 2026')
    expect(strip?.notes?.[0]?.label).toBe(`Bend office, Jun 2023`)
    expect(strip?.label).toContain('3 recorded closings from Apr 2015 to Sep 2026')
    const claim = aboutDifferentiators({ reviews: REVIEWS, record: RECORD, valuationHref: '/v' }).find(
      (c) => c.id === 'different-closings',
    )
    expect(claim?.strip).toEqual(strip)
  })

  it('draws nothing from fewer than two dated closings', () => {
    expect(aboutClosingStrip({ ...RECORD, dated: RECORD.dated.slice(0, 1) })).toBeNull()
    expect(aboutClosingStrip(null)).toBeNull()
  })

  it('puts each broker face on their own inline door, never a card', () => {
    const doors = aboutBrokerDoors([{ ...PEOPLE[0]!, src: '/images/brokers/a.png' }, PEOPLE[1]!])
    expect(doors[0]).toMatchObject({ weight: 'secondary', media: { src: '/images/brokers/a.png', alt: '' } })
    expect(doors[1]).not.toHaveProperty('media')
  })
})

describe('about playbook: key facts', () => {
  const facts = aboutKeyFacts({ founder: PEOPLE[0]!, people: PEOPLE, services: SERVICES, hours: HOURS, record: RECORD, reviews: REVIEWS })
  const byTerm = new Map(facts.map((f) => [f.term, f]))

  it('carries every row the playbook asks for, and none of the three Matt cut', () => {
    for (const term of [
      'Company name', 'Type', 'Founded', 'Founder', 'Headquarters', 'Website', 'Core offering', 'Pricing',
      'Services', 'Communication', 'Service area', 'Brokerage license', 'Clients served', 'Reviews', 'Social',
    ]) {
      expect(byTerm.has(term), term).toBe(true)
    }
    for (const cut of ['Notable clients', 'Competitors', 'Contract terms']) expect(byTerm.has(cut)).toBe(false)
  })

  it('reads its values from the brand module, the fee constant, and the live record', () => {
    expect(byTerm.get('Company name')?.value).toBe(BRAND.name)
    expect(byTerm.get('Founded')?.figure).toBe(BRAND.llcSince)
    expect(byTerm.get('Founded')?.value).toBe(`as ${BRAND.legalName}`)
    expect(byTerm.get('Headquarters')?.value).toContain(BRAND.address.street)
    expect(byTerm.get('Website')?.links?.[0]?.href).toBe(BRAND.url)
    expect(byTerm.get('Pricing')?.figure).toBe('3%')
    expect(byTerm.get('Pricing')?.value).toMatch(/^of the sale price as the listing fee, with no add-on fees\./)
    expect(byTerm.get('Communication')?.value).toContain(CONTACT.phoneDirect)
    expect(byTerm.get('Communication')?.value).toContain('same business day')
    expect(byTerm.get('Brokerage license')?.value).toContain(FIRM_LICENSE.replace(/^OREA\s+/, ''))
    expect(byTerm.get('Clients served')?.figure).toBe('3')
    expect(byTerm.get('Clients served')?.value).toBe('recorded closings in Central Oregon')
    expect(byTerm.get('Clients served')?.detail).toBe('MLS record, Apr 2015 to Sep 2026')
    expect(byTerm.get('Reviews')?.figure).toBe('5.0')
    expect(byTerm.get('Reviews')?.value).toBe('average from 25 Google reviews')
    expect(byTerm.get('Services')?.value).toBe(SERVICES.map((s) => s.title).join('; '))
    expect(byTerm.get('Social')?.links?.map((l) => l.href)).toEqual(Object.values(BRAND.social))
  })

  it('leaves a live row out rather than printing a guess', () => {
    const lean = aboutKeyFacts({ founder: null, people: [], services: SERVICES, hours: null, record: null, reviews: null })
    const terms = lean.map((f) => f.term)
    for (const live of ['Founder', 'Brokers', 'Office hours', 'Clients served', 'Reviews']) expect(terms).not.toContain(live)
  })

  it('services render as H3 rows with a numbered index of hash links', () => {
    const html = renderToStaticMarkup(createElement(V3Entries, { id: 'services', heading: 'What Ryan Realty does', entries: SERVICES }))
    for (const s of SERVICES) {
      expect(html).toContain(`>${s.title}</h3>`)
      expect(html).toContain(`href="#${s.id}"`)
      expect(html).toContain(`id="${s.id}"`)
    }
  })

  it('renders as ONE definition list in the served HTML', () => {
    const html = renderToStaticMarkup(createElement(V3Facts, { id: 'key-facts', heading: 'Key facts about Ryan Realty', facts }))
    expect(html.match(/<dl\b/g)).toHaveLength(1)
    expect(html.match(/<dt\b/g)).toHaveLength(facts.length)
    expect(html).toContain('<dt class="v3-facts__term">Clients served</dt>')
    // The figure and its words read as one phrase in the served text.
    const plain = html.replace(/<[^>]+>/g, '')
    expect(plain).toContain('3 recorded closings in Central Oregon')
    expect(plain).toContain('5.0 average from 25 Google reviews')
    expect(plain).toContain('3% of the sale price as the listing fee')
  })

  it('JSON-LD organization facts are the ones the page prints', () => {
    const org = aboutOrganizationFacts({ services: SERVICES, brokerCount: PEOPLE.length })
    expect(org.knowsAbout).toEqual(SERVICES.map((s) => s.title))
    expect(org.areaServed).toEqual(['Central Oregon', ...ABOUT_SERVICE_AREA])
    for (const place of ABOUT_SERVICE_AREA) expect(byTerm.get('Service area')?.value).toContain(place)
    expect(byTerm.get('Brokers')?.figure).toBe(String(org.numberOfEmployees))
    expect(byTerm.get('Brokers')?.value).toBe('licensed brokers')
    const node = buildJsonLd({ type: 'webPage', pageType: 'AboutPage', name: 'About', url: '/about', aboutOrganization: true, organizationFacts: org }) as {
      mainEntity: { '@id': string; hasOfferCatalog: { itemListElement: Array<{ itemOffered: { name: string; description: string } }> } }
    }
    expect(node.mainEntity['@id']).toMatch(/#organization$/)
    expect(node.mainEntity.hasOfferCatalog.itemListElement.map((o) => o.itemOffered.name)).toEqual(SERVICES.map((s) => s.title))
    expect(node.mainEntity.hasOfferCatalog.itemListElement[0]?.itemOffered.description).toBe(SERVICES[0]?.body)
  })
})

describe('about playbook: FAQ', () => {
  const faq = aboutFaqItems(PEOPLE, { hours: HOURS })

  it('answers each question in two or three sentences', () => {
    expect(faq.length).toBeGreaterThanOrEqual(8)
    for (const { question, answer } of faq) {
      const n = sentences(answer)
      expect(n, question).toBeGreaterThanOrEqual(2)
      expect(n, question).toBeLessThanOrEqual(3)
    }
  })

  it('states the fee from the one spelling and the office hours from the live rows', () => {
    const cost = faq.find((q) => /charge to sell/.test(q.question))
    expect(cost?.answer.startsWith(LISTING_TERMS.fee)).toBe(true)
    const office = faq.find((q) => /office\?$/.test(q.question))
    expect(office?.answer).toContain(`Office hours are ${HOURS}.`)
    expect(aboutFaqItems(PEOPLE).find((q) => /office\?$/.test(q.question))?.answer).not.toMatch(/Office hours/)
  })

  it('renders every question as an H3, and FAQPage carries the same strings', () => {
    const html = renderToStaticMarkup(
      createElement(V3Answers, {
        id: 'faq',
        heading: 'Frequently asked questions',
        questionHeadings: true,
        questions: faq.map((q) => ({ question: q.question, body: q.answer })),
      }),
    )
    for (const q of faq) expect(html).toContain(`>${q.question.replace(/"/g, '&quot;')}</h3>`)
    const ld = buildJsonLd({ type: 'faqPage', items: faq }) as {
      mainEntity: Array<{ name: string; acceptedAnswer: { text: string } }>
    }
    expect(ld.mainEntity.map((m) => [m.name, m.acceptedAnswer.text])).toEqual(faq.map((q) => [q.question, q.answer]))
  })

  it('the page feeds the visible questions and FAQPage from one array', () => {
    const page = readFileSync('app/about/page.tsx', 'utf8')
    expect(page).toContain('const faqItems = aboutFaqItems(proof.faces, { hours: hoursLine })')
    expect(page).toContain("type: 'faqPage',\n      items: faqItems,")
    expect(page).toContain('questions={faqAnswers}')
    expect(page).toContain('questionHeadings')
  })
})

describe('about playbook: copy rules', () => {
  const copy = allCopy()

  it('names no competitor and makes no comparison to one', () => {
    expect(copy).not.toMatch(
      /Compass|Redfin|Zillow|Coldwell|Keller Williams|RE\/MAX|Remax|Sotheby|Berkshire|Windermere|\beXp\b|Cascade Hasson|Duke Warner|Fred Real Estate|Stellar|Bend Premier|Realty One|Century 21|Rocket|Opendoor|than other (brokers|agents|firms)|unlike (other|most|the big)/i,
    )
  })

  it('names clients by need, never by a protected class', () => {
    expect(copy).not.toMatch(/\bfamil(y|ies)\b|retire(e|es|d)\b|young professionals|empty nesters|singles|couples|seniors|christian|church/i)
  })

  it('carries no em dash and no " -- " stand-in', () => {
    expect(copy).not.toContain('—')
    expect(copy).not.toMatch(/ -- /)
  })

  it('states the reply-time promise as Matt chose it', () => {
    expect(ABOUT_PROMISE_LINE).toBe('We reply the same business day.')
    expect(copy).not.toMatch(/one business day|within an hour|24\/7/i)
  })
})
