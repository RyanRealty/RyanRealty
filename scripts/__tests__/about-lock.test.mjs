import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import {
  ABOUT_LOCK_BEATS,
  aboutLockSourceProblems,
  aboutRequiredComponentProblems,
  aboutTipReadyProblems,
  competitiveBriefEvidenceProblems,
} from '../lib/about-lock.mjs'
import { defectReplaceWithProblems, tasteDoneProblems } from '../lib/taste-receipt.mjs'

const ABOUT_LOCK_QUOTES = {
  '1': 'Ryan Realty is a boutique brokerage in Central Oregon that helps clients buy and sell their properties.',
  '2': 'Faces open the page at display scale. Deep bios stay on /team.',
  '3': 'V3Proof reviews as words plus dated local closings as a carousel',
  '4': 'Call | Text | Email | Schedule. Live hours stay V3OnDuty above this.',
  '5': "street: '115 NW Oregon Ave #2'",
  '6': '5. AboutOffice — 115 NW Oregon Ave #2 + firm OREA. Brokers on /team only. * 6. AboutInquiry GET to /contact.',
  '7': '/about first viewport — faces at display scale. Navy and cream only.',
  '8': 'shadcn Avatar image, fallback, and badge at display scale.',
  '9': 'Below the proof: What Ryan Realty does, the differentiators, Key facts in one <dl>, and the same business day reply.',
}

const ABOUT_BRIEF = {
  id: 'about-matt-2026-09-21',
  source: 'Matt lock',
  productLock: 'faces at display scale + firm story + reviews + closings + four-up + office + OREA',
  refuse: 'Meet-the-Team dump on About',
  beats: ABOUT_LOCK_BEATS.map((b) => ({ id: b.id, text: b.text })),
}

const PASSING_TR = {
  evaluatedAt: '2026-09-14',
  rubricVersion: 'v1-2026-09-12',
  evaluatorModel: 'grok-4.6',
  demoMatch: true,
  competitiveBriefPass: true,
  competitiveBriefEvidence: { ...ABOUT_LOCK_QUOTES },
  adaptedFrom: [{ id: 'shadcn-carousel' }, { id: 'house-firm' }],
  shotSpec: { states: ['default', 'firm-sales-open'] },
  defects: [{ section: '#office', severity: 'taste', finding: 'Keep office + OREA visible.', replaceWith: 'house-office' }],
}

const LIVE_CATALOG = JSON.parse(readFileSync('design_system/public/taste-catalog.json', 'utf8'))

describe('aboutLockSourceProblems — live tree', () => {
  it('passes the locked About source', () => {
    expect(aboutLockSourceProblems()).toEqual([])
  })

  it('fails a fixture that drops the firm story', () => {
    const p = aboutLockSourceProblems({
      sourceText: 'export default function Page() { return <AboutTeamTeaser /> }',
    })
    expect(p.join('\n')).toMatch(/beat 1 missing/)
    expect(p.join('\n')).toMatch(/AboutTeamTeaser/)
  })

  it('fails a fixture that reintroduces Meet the team', () => {
    const good = aboutLockSourceProblems()
    expect(good).toEqual([])
    const p = aboutLockSourceProblems({
      sourceText: `${ABOUT_LOCK_QUOTES[1]}\n<AboutFirm />\nMeet the team\n`,
    })
    expect(p.join('\n')).toMatch(/Meet the team/)
  })

  it('fails a fixture that keeps #team-teaser or a broker roster dump', () => {
    const p = aboutLockSourceProblems({
      sourceText: '<section id="team-teaser">Who you work with</section>\nexport const ABOUT_BROKER_ROSTER = "Matt Ryan"',
    })
    expect(p.join('\n')).toMatch(/team-teaser|Who you work with|ABOUT_BROKER_ROSTER/)
  })

  it('fails a fixture that keeps Call-dominant primary lead', () => {
    const p = aboutLockSourceProblems({
      sourceText: "kicker: v3Text('Call')\nprimary: true\nclassName=\"v3-doors--lead\"",
    })
    expect(p.join('\n')).toMatch(/primary|v3-doors--lead/)
  })

  it('fails the staccato three-liner purpose', () => {
    const p = aboutLockSourceProblems({
      sourceText:
        'We are a small boutique brokerage. We work all of Central Oregon. We help clients buy and sell their properties.',
    })
    expect(p.join('\n')).toMatch(/staccato|small boutique brokerage|beat 1/)
  })

  it('fails a source that answers "Who are the brokers?" without the live-roster answer (Matt 2026-09-23)', () => {
    const p = aboutLockSourceProblems({
      sourceText: "question: 'Who are the brokers?', answer: 'The brokers are on /team.'",
    })
    expect(p.join('\n')).toMatch(/aboutBrokersAnswer/)
  })

  it('fails a FAQ that dumps broker license numbers', () => {
    const p = aboutLockSourceProblems({
      sourceText: 'Who are the brokers?\nMatt Ryan OR #201217889, Rebecca Peterson OR #201239012.',
    })
    expect(p.join('\n')).toMatch(/OR #|Who are the brokers/)
  })
})

describe('competitiveBriefEvidenceProblems — boolean checkbox is refuse', () => {
  it('refuses a lone competitiveBriefPass boolean', () => {
    const p = competitiveBriefEvidenceProblems(
      { competitiveBriefPass: true },
      ABOUT_BRIEF,
      { sourceText: Object.values(ABOUT_LOCK_QUOTES).join('\n') },
    )
    expect(p.join('\n')).toMatch(/lone competitiveBriefPass boolean/)
  })

  it('refuses an invented quote that is not in the source', () => {
    const evidence = { ...ABOUT_LOCK_QUOTES, '1': 'We are a small boutique brokerage in Central Oregon that helps clients buy and sell invented homes.' }
    const p = competitiveBriefEvidenceProblems(
      { competitiveBriefEvidence: evidence },
      ABOUT_BRIEF,
      { sourceText: Object.values(ABOUT_LOCK_QUOTES).join('\n') },
    )
    expect(p.join('\n')).toMatch(/not in the About source/)
  })

  it('refuses a quote that misses a locked token', () => {
    const evidence = { ...ABOUT_LOCK_QUOTES, '5': 'The Bend office is downtown on a cream page.' }
    const p = competitiveBriefEvidenceProblems(
      { competitiveBriefEvidence: evidence },
      ABOUT_BRIEF,
      { sourceText: `${Object.values(ABOUT_LOCK_QUOTES).join('\n')}\nThe Bend office is downtown on a cream page.` },
    )
    expect(p.join('\n')).toMatch(/115 NW Oregon Ave #2/)
  })

  it('passes when every quote is in the source and carries the tokens', () => {
    expect(
      competitiveBriefEvidenceProblems(
        { competitiveBriefEvidence: { ...ABOUT_LOCK_QUOTES } },
        ABOUT_BRIEF,
        { sourceText: Object.values(ABOUT_LOCK_QUOTES).join('\n') },
      ),
    ).toEqual([])
  })
})

describe('aboutTipReadyProblems + tasteDoneProblems', () => {
  it('refuses Tip Ready on a checkbox pass without evidence', () => {
    const p = tasteDoneProblems(
      { demoMatch: true, competitiveBriefPass: true, evaluatorModel: 'grok-4.6' },
      { competitiveBrief: ABOUT_BRIEF, kit: 'about', sourceText: Object.values(ABOUT_LOCK_QUOTES).join('\n') },
    )
    expect(p.join('\n')).toMatch(/lone competitiveBriefPass boolean/)
  })

  it('refuses empty replaceWith on a defect', () => {
    const p = defectReplaceWithProblems({
      defects: [{ section: '#proof', finding: 'Cream box carousel', replaceWith: '' }],
    })
    expect(p.join('\n')).toMatch(/empty replaceWith/)
  })

  it('records demoMatch false on About without refusing (Matt 2026-09-23)', () => {
    const p = tasteDoneProblems(
      {
        ...PASSING_TR,
        demoMatch: false,
      },
      { competitiveBrief: ABOUT_BRIEF, kit: 'about', sourceText: Object.values(ABOUT_LOCK_QUOTES).join('\n') },
    )
    expect(p.join('\n')).not.toMatch(/demoMatch/)
  })

  it('passes Tip Ready only with evidence, demoMatch, and the live source lock', () => {
    expect(aboutTipReadyProblems(PASSING_TR, ABOUT_BRIEF, { kit: 'about' })).toEqual([])
    expect(
      tasteDoneProblems(PASSING_TR, {
        competitiveBrief: ABOUT_BRIEF,
        kit: 'about',
        catalog: LIVE_CATALOG,
        route: 'app/about/page.tsx',
      }),
    ).toEqual([])
  })
})

describe('aboutRequiredComponentProblems', () => {
  it('refuses AboutFaces or AboutTeamTeaser on About', () => {
    expect(
      aboutRequiredComponentProblems('about', {
        requiredComponents: [{ name: 'AboutFaces', section: 'OPENS THE PAGE' }],
      }).join('\n'),
    ).toMatch(/AboutFaces/)
    expect(
      aboutRequiredComponentProblems('about', {
        requiredComponents: [
          { name: 'AboutFirm', section: 'OPENS THE PAGE' },
          { name: 'AboutTeamTeaser', section: 'teaser' },
        ],
      }).join('\n'),
    ).toMatch(/AboutTeamTeaser/)
  })

  it('passes the live About kit', () => {
    const parsed = JSON.parse(readFileSync('design_system/ryan-realty/ui_kits/about/parity.json', 'utf8'))
    expect(aboutRequiredComponentProblems('about', parsed)).toEqual([])
  })
})

describe('CLI --about-lock and --ship', () => {
  it('about-lock exits 0 on the live tree', () => {
    const r = spawnSync('node', ['scripts/lib/taste-receipt.mjs', '--about-lock'], { encoding: 'utf8' })
    expect(r.status).toBe(0)
    expect(`${r.stdout}${r.stderr}`).toMatch(/about lock OK/)
  })

  it('ship exits 0 on the live About receipt when demoMatch and source quotes hold', () => {
    const r = spawnSync(
      'node',
      ['scripts/lib/taste-receipt.mjs', '--ship', 'design_system/ryan-realty/ui_kits/about/parity.json'],
      { encoding: 'utf8' },
    )
    expect(`${r.stdout}${r.stderr}`).toMatch(/ship OK/)
    expect(r.status).toBe(0)
  })
})
