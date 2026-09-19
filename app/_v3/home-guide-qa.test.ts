import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { getFaqBySlug } from '@/app/faq/data'
import { AEO_HUB_OMIT, AEO_HUB_TIP_MINS, aeoHubHomeStripDoors } from '@/lib/seo/aeo-hub-guides'
import { HOME_GUIDE_QA_IDS, homeGuideQaJsonLd, homeGuideQaQuestions } from './home-guide-qa'

const PAGE = readFileSync(resolve('app/page.tsx'), 'utf8')

describe('homepage guides / Q&A strip (SITE-125)', () => {
  it('asks three live FAQ questions and does not invent answers', () => {
    const questions = homeGuideQaQuestions()
    expect(HOME_GUIDE_QA_IDS).toEqual(['first-time-buyers', 'cost-to-list', 'bend-neighborhoods'])
    expect(questions).toHaveLength(3)
    for (const id of HOME_GUIDE_QA_IDS) {
      const source = getFaqBySlug(id)
      const row = questions.find((item) => item.id === `home-qa-${id}`)
      expect(source, id).toBeDefined()
      expect(row?.question).toBe(source?.question)
      expect(row?.body).toBe(source?.answer)
      expect(row?.action).toEqual({ label: 'Full answer', href: `/faq/${id}` })
    }
  })

  it('emits FAQPage from the same three answers', () => {
    const ld = homeGuideQaJsonLd()
    expect(ld).toMatchObject({ '@type': 'FAQPage' })
    const entities = ld?.mainEntity as Array<{ name: string }>
    expect(entities.map((item) => item.name)).toEqual(
      HOME_GUIDE_QA_IDS.map((id) => getFaqBySlug(id)?.question),
    )
  })

  it('opens with the unique AEO tip-min doors and omits the 404 closing-costs slug', () => {
    const doors = aeoHubHomeStripDoors()
    const hrefs = doors.map((door) => door.href)
    const expected = [...new Set(Object.values(AEO_HUB_TIP_MINS).flat())]
    expect(hrefs).toEqual(expected)
    expect(hrefs).toHaveLength(8)
    expect(hrefs).not.toContain(AEO_HUB_OMIT[0])
    expect(hrefs).not.toContain('/blog/buyers-agent-bend-buyer-broker-agreement')
    expect(doors[0]?.label).toBe('First-Time Home Buyer Guide for Bend and Central Oregon')
    expect(doors.find((door) => door.href === '/blog/how-to-sell-your-home-bend')?.group).toBe('Sell')
  })

  it('mounts the strip above the house rails and keeps Work with us in chrome', () => {
    const guidesAt = PAGE.indexOf('id="guides"')
    const railsAt = PAGE.indexOf('<HomeHomesRails')
    expect(guidesAt).toBeGreaterThan(-1)
    expect(railsAt).toBeGreaterThan(guidesAt)
    expect(PAGE).toContain('layout="strip"')
    expect(PAGE).toContain('aeoHubHomeStripDoors')
    expect(PAGE).toContain('homeGuideQaQuestions')
    expect(PAGE.slice(guidesAt, railsAt)).not.toMatch(/Work with us/)
  })

  it('keeps eight AEO doors and three FAQ rows after the fold rematch', () => {
    expect(aeoHubHomeStripDoors()).toHaveLength(8)
    expect(homeGuideQaQuestions()).toHaveLength(3)
    expect(PAGE).not.toMatch(/V3PhoneDock/)
    const LAYOUT = readFileSync(resolve('app/layout.tsx'), 'utf8')
    expect(LAYOUT).not.toMatch(/V3PhoneDock/)
  })
})
