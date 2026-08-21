import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const read = (rel: string) => readFileSync(join(root, rel), 'utf8')

describe('featured community comm-d restyle', () => {
  it('keeps the SEO H1 as community homes for sale', () => {
    const identity = read('components/site/comm-d/CommDIdentity.tsx')
    expect(identity).toMatch(/aria-label=\{\`\$\{name\} homes for sale\`\}/)
    expect(identity).toMatch(/<span>homes for sale<\/span>/)
  })

  it('does not invent Tetherow village URLs or kit sample villages', () => {
    const page = read('app/communities/[slug]/page.tsx')
    const featured = read('components/site/comm-d/CommunityFeaturedView.tsx')
    const blob = page + featured
    expect(blob).not.toMatch(/\/communities\/tetherow\/heath/)
    expect(blob).not.toMatch(/\/communities\/highlands-ridge/)
    expect(blob).not.toMatch(/href=\{['"`]\/communities\/juniper-preserve/)
    expect(blob).not.toMatch(/Sunrise Village/)
  })

  it('does not use plat or nest jargon on the restyle', () => {
    const files = [
      'components/site/comm-d/CommunityFeaturedView.tsx',
      'components/site/comm-d/CommDGround.tsx',
      'components/site/comm-d/CommDCopy.tsx',
      'components/site/comm-d/CommDSchools.tsx',
      'components/site/comm-d/CommDChartRoom.tsx',
    ]
    const blob = files.map(read).join('\n')
    expect(blob).not.toMatch(/\bplat\b/i)
    expect(blob).not.toMatch(/\bnest(?:ed|ing)?\b/i)
  })

  it('does not mount a mid-page Ask me band', () => {
    const view = read('components/site/comm-d/CommunityFeaturedView.tsx')
    expect(view).not.toMatch(/<KbSell/)
    expect(view).not.toMatch(/<KbTeam/)
    expect(view).not.toMatch(/community-contact-line/)
    expect(view).toMatch(/<CommDAsk/)
    const askIndex = view.indexOf('<CommDAsk')
    const copyIndex = view.indexOf('<CommDCopy')
    expect(askIndex).toBeGreaterThan(copyIndex)
  })

  it('renders Chart Room Time, Relate, Rank', () => {
    const charts = read('components/site/comm-d/CommDChartRoom.tsx')
    expect(charts).toMatch(/Time, Relate, Rank/)
    expect(read('lib/communities/comm-d-chart-room.ts')).toMatch(/id: 'time' \| 'relate' \| 'rank'/)
  })

  it('holds sunriver off the restyle list', () => {
    const slugs = read('lib/communities/featured-slugs.ts')
    expect(slugs).toMatch(/'sunriver'/)
    expect(slugs).toMatch(/HELD_COMMUNITY_SLUGS/)
    expect(read('app/communities/[slug]/page.tsx')).toMatch(/isFeaturedCommunitySlug/)
  })

  it('keeps KbFooter on the page source so G53 shared-shell passes', () => {
    const page = read('app/communities/[slug]/page.tsx')
    const featured = read('components/site/comm-d/CommunityFeaturedView.tsx')
    const kb = read('components/site/community/CommunityKbView.tsx')
    expect(page).toMatch(/<KbFooter\b/)
    expect(featured).toMatch(/<CommDFooter\b/)
    expect(kb).not.toMatch(/<KbFooter\b/)
  })

  it('does not invent restaurants or HOA dollars in the restyle objects', () => {
    const ground = read('lib/communities/comm-d-ground.ts')
    expect(ground).not.toMatch(/Coorie/)
    expect(ground).not.toMatch(/1,?464/)
    expect(ground).toMatch(/architect, acres, founded/)
  })
})
