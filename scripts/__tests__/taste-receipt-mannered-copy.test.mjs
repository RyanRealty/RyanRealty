import { describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ACTION_BILLBOARD_REFUSE,
  FORM_ALERT_ASK_REFUSE,
  HOME_BRIEF_LEAK_REFUSE,
  INVENTORY_LECTURE_REFUSE,
  PLATS_VOICE_REFUSE,
  EVERY_HOME_LECTURE_REFUSE,
  MANNERED_COPY_REFUSE,
  manneredPublicCopyProblems,
  publicCopyHaystack,
} from '../lib/mannered-public-copy.mjs'
import { tasteDoneProblems } from '../lib/taste-receipt.mjs'

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SHIP = join(REPO, 'scripts/lib/taste-receipt.mjs')

const BAD_TEAM_CLAIM =
  'Every closing a Ryan Realty broker recorded on the MLS that carries a coordinate. The 12-month counts on the faces are a trailing window of that same feed; this map is the full record.'

/** Pre-fix /team AboutFaces claim (Writing Bot 2026-09-15 — delete, do not soften). */
const BAD_TEAM_INTRO =
  'Three licensed Oregon brokers, all of them here. The one you call is the one who works your deal, start to close, and each of them shows what they have actually closed.'

const BAD_PLACES_SUMMARY = 'Where those closings were'

const PLAIN_CLAIM = '25 closings.'

const BAD_CALL_BILLBOARD = 'CALL 541.703.3095'

const editorialBillboardSource = `
function editorialReach(person) {
  return (
    <a className="about-faces__reach--call" aria-label={\`Call \${person.name}\`}>
      <span className="about-faces__reach-label">
        Call
        <span className="about-faces__reach-num">{person.phoneDisplay}</span>
      </span>
    </a>
  )
}
function faceIdentity() { return null }
`

function doneReceipt(over = {}) {
  return {
    demoMatch: true,
    competitiveBriefPass: true,
    evaluatorModel: 'grok-4.6',
    adaptedFrom: [{ id: 'house-atlas' }],
    shots: { desktop: 'shots/desktop.png' },
    shotSpec: { states: ['default'] },
    shotsHash: `sha256:${'a'.repeat(64)}`,
    ...over,
  }
}

describe('publicCopyHaystack', () => {
  it('reads JSX claimText and ignores comments', () => {
    const src = `
      /* this map is the full record — code note, not copy */
      <V3Atlas claimText="${BAD_TEAM_CLAIM}" />
    `
    expect(publicCopyHaystack(src)).toMatch(/this map is the full record/)
    expect(publicCopyHaystack(`// trailing window of that same feed\nconst n = 25`)).not.toMatch(
      /trailing window/,
    )
  })
})

describe('manneredPublicCopyProblems', () => {
  it('refuses the /team map feed lecture', () => {
    const p = manneredPublicCopyProblems(`claimText="${BAD_TEAM_CLAIM}"`)
    expect(p).toContain(MANNERED_COPY_REFUSE)
  })

  it('refuses the old /team self-explaining intro', () => {
    const p = manneredPublicCopyProblems(`claim="${BAD_TEAM_INTRO}"`)
    expect(p).toContain(MANNERED_COPY_REFUSE)
    expect(p.join('\n')).toMatch(/Three licensed|the one you call|mannered public copy/)
  })

  it('refuses the mannered places dropdown label', () => {
    const p = manneredPublicCopyProblems(`placesSummary: '${BAD_PLACES_SUMMARY}'`)
    expect(p).toContain(MANNERED_COPY_REFUSE)
  })

  it('passes a plain short claim', () => {
    expect(manneredPublicCopyProblems(`claimText="${PLAIN_CLAIM}"`)).toEqual([])
    expect(manneredPublicCopyProblems(PLAIN_CLAIM)).toEqual([])
  })

  it('refuses a CALL phone billboard', () => {
    const p = manneredPublicCopyProblems(`<span>${BAD_CALL_BILLBOARD}</span>`)
    expect(p).toContain(ACTION_BILLBOARD_REFUSE)
  })

  it('refuses editorial Call + phoneDisplay on the same chip', () => {
    const p = manneredPublicCopyProblems(editorialBillboardSource)
    expect(p).toContain(ACTION_BILLBOARD_REFUSE)
  })

  it('passes quiet Call | Text | Email | Schedule labels', () => {
    const src = `
      function editorialReach(person) {
        return (
          <a href={\`tel:\${person.tel}\`} aria-label={\`Call \${person.name}\`}>
            <span className="about-faces__reach-label">Call</span>
          </a>
        )
      }
      function faceIdentity() { return null }
    `
    expect(manneredPublicCopyProblems(src)).toEqual([])
    expect(manneredPublicCopyProblems("label: 'Call'")).toEqual([])
  })

  it('is silent when sourceText is omitted', () => {
    expect(manneredPublicCopyProblems(undefined)).toEqual([])
    expect(manneredPublicCopyProblems('')).toEqual([])
  })

  it('refuses homepage competitive brief leaked as public copy', () => {
    const p = manneredPublicCopyProblems(
      '<p className="home-hero-search__brief">{homeBriefText(\'2\')} Search field that morphs into results.</p>',
    )
    expect(p).toContain(HOME_BRIEF_LEAK_REFUSE)
  })

  it('refuses a list-intro lecture about the map and filters', () => {
    const lecture =
      'The same homes the map above marks, with price, beds and property type on the filters. Sold and pending homes are counted on the market section further down, not here.'
    expect(manneredPublicCopyProblems(`body: \`${lecture}\``)).toContain(MANNERED_COPY_REFUSE)
  })

  it('refuses inventory-count lectures on rails and place folds', () => {
    const p = manneredPublicCopyProblems(
      '<span>3,271 homes for sale across Central Oregon</span>',
    )
    expect(p).toContain(INVENTORY_LECTURE_REFUSE)
    expect(
      manneredPublicCopyProblems('`1,746 homes for sale across these cities.`'),
    ).toContain(INVENTORY_LECTURE_REFUSE)
  })
})

describe('tasteDoneProblems — mannered copy is Tip Ready refuse', () => {
  it('refuses a receipt whose page source is the /team lecture', () => {
    const p = tasteDoneProblems(doneReceipt(), { sourceText: `claimText="${BAD_TEAM_CLAIM}"` })
    expect(p).toContain(MANNERED_COPY_REFUSE)
    expect(p.join('\n')).toMatch(/mannered public copy|this map is the full record/)
  })

  it('refuses a receipt whose page source is the old /team intro', () => {
    const p = tasteDoneProblems(doneReceipt(), { sourceText: `claim="${BAD_TEAM_INTRO}"` })
    expect(p).toContain(MANNERED_COPY_REFUSE)
  })

  it('refuses a CALL 541 billboard on an otherwise Tip Ready receipt', () => {
    const p = tasteDoneProblems(doneReceipt(), { sourceText: BAD_CALL_BILLBOARD })
    expect(p).toContain(ACTION_BILLBOARD_REFUSE)
  })

  it('passes a plain short line', () => {
    expect(tasteDoneProblems(doneReceipt(), { sourceText: PLAIN_CLAIM })).toEqual([])
  })

  it('refuses an inventory-count lecture on an otherwise Tip Ready receipt', () => {
    const p = tasteDoneProblems(doneReceipt(), {
      sourceText: '3,271 homes for sale across Central Oregon',
    })
    expect(p).toContain(INVENTORY_LECTURE_REFUSE)
  })
})

describe('live /team source after the copy fix', () => {
  it('passes manneredPublicCopyProblems on the team page + editorial faces', () => {
    const page = readFileSync(join(REPO, 'app/team/page.tsx'), 'utf8')
    const faces = readFileSync(join(REPO, 'app/about/_v3/AboutFaces.tsx'), 'utf8')
    const roster = readFileSync(join(REPO, 'app/team/_v3/broker-roster-record.ts'), 'utf8')
    expect(manneredPublicCopyProblems(`${page}\n${faces}\n${roster}`)).toEqual([])
  })

  it('cuts the AboutFaces claim under The brokers and labels places Cities', () => {
    const page = readFileSync(join(REPO, 'app/team/page.tsx'), 'utf8')
    const roster = readFileSync(join(REPO, 'app/team/_v3/broker-roster-record.ts'), 'utf8')
    expect(page).not.toMatch(/\bclaim\s*=/)
    expect(page).not.toContain('Three licensed Oregon brokers')
    expect(page).not.toContain('the one you call')
    expect(roster).toContain("placesSummary: places.length > 0 ? 'Cities'")
    expect(roster).not.toContain('Where those closings were')
  })
})

describe('live homepage source after the brief leak kill', () => {
  it('passes manneredPublicCopyProblems on public Home files', () => {
    const files = [
      'app/page.tsx',
      'app/_v3/HomeHeroSearch.client.tsx',
      'app/_v3/HomeHomesRails.tsx',
      'app/_v3/HomeListingRail.client.tsx',
      'app/_v3/HomeBrowsePlaces.tsx',
      'app/_v3/HomeFeaturedCommunity.client.tsx',
    ]
    const src = files.map((rel) => readFileSync(join(REPO, rel), 'utf8')).join('\n')
    expect(manneredPublicCopyProblems(src)).toEqual([])
  })
})

describe('taste-receipt --ship CLI refuses mannered team copy', () => {
  it('exits 1 when the route source is the old /team self-explaining intro', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rr-team-intro-'))
    mkdirSync(join(dir, 'app/team'), { recursive: true })
    mkdirSync(join(dir, 'design_system/public'), { recursive: true })
    writeFileSync(
      join(dir, 'design_system/public/taste-catalog.json'),
      JSON.stringify({ installById: {}, classes: {}, routeClasses: {} }),
    )
    writeFileSync(
      join(dir, 'app/team/page.tsx'),
      `export default function Team() { return <AboutFaces claim="${BAD_TEAM_INTRO}" /> }\n`,
    )
    writeFileSync(
      join(dir, 'parity.json'),
      JSON.stringify({
        route: 'app/team/page.tsx',
        tasteReview: doneReceipt(),
      }),
    )
    const r = spawnSync(process.execPath, [SHIP, '--ship', 'parity.json'], {
      cwd: dir,
      encoding: 'utf8',
      env: process.env,
    })
    expect(r.status).toBe(1)
    expect(`${r.stderr}${r.stdout}`).toMatch(/Three licensed|the one you call|mannered public copy/)
  })

  it('exits 1 when the route source is the /team lecture', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rr-mannered-'))
    mkdirSync(join(dir, 'app/team'), { recursive: true })
    mkdirSync(join(dir, 'design_system/public'), { recursive: true })
    writeFileSync(
      join(dir, 'design_system/public/taste-catalog.json'),
      JSON.stringify({ installById: {}, classes: {}, routeClasses: {} }),
    )
    writeFileSync(
      join(dir, 'app/team/page.tsx'),
      `export default function Team() { return <p>${BAD_TEAM_CLAIM}</p> }\n`,
    )
    writeFileSync(
      join(dir, 'parity.json'),
      JSON.stringify({
        route: 'app/team/page.tsx',
        tasteReview: doneReceipt(),
      }),
    )
    const r = spawnSync(process.execPath, [SHIP, '--ship', 'parity.json'], {
      cwd: dir,
      encoding: 'utf8',
      env: process.env,
    })
    expect(r.status).toBe(1)
    expect(`${r.stderr}${r.stdout}`).toMatch(/this map is the full record|mannered public copy/)
  })

  it('exits 1 when the route source is a CALL phone billboard', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rr-call-billboard-'))
    mkdirSync(join(dir, 'app/team'), { recursive: true })
    mkdirSync(join(dir, 'design_system/public'), { recursive: true })
    writeFileSync(
      join(dir, 'design_system/public/taste-catalog.json'),
      JSON.stringify({ installById: {}, classes: {}, routeClasses: {} }),
    )
    writeFileSync(
      join(dir, 'app/team/page.tsx'),
      `export default function Team() { return <a href="tel:+15417033095">${BAD_CALL_BILLBOARD}</a> }\n`,
    )
    writeFileSync(
      join(dir, 'parity.json'),
      JSON.stringify({
        route: 'app/team/page.tsx',
        tasteReview: doneReceipt(),
      }),
    )
    const r = spawnSync(process.execPath, [SHIP, '--ship', 'parity.json'], {
      cwd: dir,
      encoding: 'utf8',
      env: process.env,
    })
    expect(r.status).toBe(1)
    expect(`${r.stderr}${r.stdout}`).toMatch(/CALL 541|action-narrating/)
  })
})


describe('plats voice refuse', () => {
  it('refuses recorded boundary / plats visitor copy', () => {
    expect(manneredPublicCopyProblems("claimText=\"Widgi Creek's recorded boundary — every mark\"" )).toContain(PLATS_VOICE_REFUSE)
    expect(manneredPublicCopyProblems("heading=\"The plats inside Tetherow\"" )).toContain(PLATS_VOICE_REFUSE)
    expect(manneredPublicCopyProblems("eyebrow: 'Sisters · Recorded plats'")).toContain(PLATS_VOICE_REFUSE)
  })

  it('passes subdivision / neighborhood buyer words', () => {
    expect(manneredPublicCopyProblems("heading=\"Subdivisions in Sisters\"" )).toEqual([])
    expect(manneredPublicCopyProblems("Neighborhoods in Widgi Creek")).toEqual([])
  })
})

describe('Find a home + pulse lecture refuse', () => {
  it('refuses Find a home over-label and fraction lecture', () => {
    expect(manneredPublicCopyProblems("Find a home")).toContain(INVENTORY_LECTURE_REFUSE)
    expect(
      manneredPublicCopyProblems(
        'More than one in five listings on the Central Oregon market is already under contract.',
      ),
    ).toContain(INVENTORY_LECTURE_REFUSE)
  })
})

describe('every-home lecture refuse', () => {
  it('refuses Every home for sale in … headings', () => {
    expect(
      manneredPublicCopyProblems('headline={`Every home for sale in Lazy River South`}'),
    ).toContain(EVERY_HOME_LECTURE_REFUSE)
    expect(
      manneredPublicCopyProblems("label: 'See every home for sale'"),
    ).toContain(EVERY_HOME_LECTURE_REFUSE)
    expect(
      manneredPublicCopyProblems("label: 'See every Bend home for sale'"),
    ).toContain(EVERY_HOME_LECTURE_REFUSE)
  })

  it('passes the Redfin-like place-first heading', () => {
    expect(manneredPublicCopyProblems("headline: 'Lazy River South homes for sale'")).toEqual([])
    expect(manneredPublicCopyProblems("label: 'Bend homes for sale'")).toEqual([])
  })
})

describe('live place / search source after the every-home kill', () => {
  it('does not ship the every-home lecture on place + search heading files', () => {
    const files = [
      'app/cities/[slug]/page.tsx',
      'app/cities/[slug]/_v3/city-sections.ts',
      'app/cities/[slug]/[neighborhoodSlug]/page.tsx',
      'app/cities/[slug]/[neighborhoodSlug]/_v3/neighborhood-sections.ts',
      'app/communities/[slug]/_v3/community-opening.ts',
      'app/subdivisions/[slug]/page.tsx',
      'app/subdivisions/[slug]/_v3/plat-title.ts',
      'app/subdivisions/[slug]/_v3/subdivision-insight.ts',
      'app/zip/[zip]/page.tsx',
      'app/search/[...slug]/page.tsx',
      'app/search/[...slug]/search-metadata.ts',
      'app/listing/[listingKey]/page.tsx',
      'lib/site/place-homes-heading.ts',
    ]
    const src = files.map((rel) => readFileSync(join(REPO, rel), 'utf8')).join('\n')
    expect(manneredPublicCopyProblems(src)).not.toContain(EVERY_HOME_LECTURE_REFUSE)
  })
})

describe('taste-receipt --ship CLI refuses every-home lecture', () => {
  it('exits 1 when the route source is Every home for sale in …', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rr-every-home-'))
    mkdirSync(join(dir, 'app/search'), { recursive: true })
    mkdirSync(join(dir, 'design_system/public'), { recursive: true })
    writeFileSync(
      join(dir, 'design_system/public/taste-catalog.json'),
      JSON.stringify({ installById: {}, classes: {}, routeClasses: {} }),
    )
    writeFileSync(
      join(dir, 'app/search/page.tsx'),
      `export default function Search() { return <h1>Every home for sale in Lazy River South</h1> }\n`,
    )
    writeFileSync(
      join(dir, 'parity.json'),
      JSON.stringify({
        route: 'app/search/page.tsx',
        kit: 'search',
        tasteReview: doneReceipt(),
      }),
    )
    const r = spawnSync(process.execPath, [SHIP, '--ship', 'parity.json'], {
      cwd: dir,
      encoding: 'utf8',
      env: process.env,
    })
    expect(r.status).toBe(1)
    expect(`${r.stderr}${r.stdout}`).toMatch(/Every home for sale in|every-home lecture/)
  })
})

describe('SITE-120 form-voice alert ask refuse', () => {
  it('refuses the form-reciting sticky ask', () => {
    expect(manneredPublicCopyProblems("submitLabel: 'Email me each one'")).toContain(FORM_ALERT_ASK_REFUSE)
    expect(
      manneredPublicCopyProblems("after: 'listings, by email, as they come on the market.'"),
    ).toContain(FORM_ALERT_ASK_REFUSE)
    expect(
      manneredPublicCopyProblems("'Every new listing by email. Unsubscribe any time.'"),
    ).toContain(FORM_ALERT_ASK_REFUSE)
  })

  it('passes the person-voice family', () => {
    expect(manneredPublicCopyProblems("submitLabel: 'Send me new listings'")).toEqual([])
    expect(
      manneredPublicCopyProblems("claim: 'Hear about new listings in Bend the day they hit the market.'"),
    ).toEqual([])
    expect(
      manneredPublicCopyProblems("'Every new listing, with its price changes. Unsubscribe any time.'"),
    ).toEqual([])
  })
})
