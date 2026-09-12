import { afterAll, describe, expect, it } from 'vitest'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { aboutOpenerProblems, competitiveBriefPurposeProblems } from '../lib/taste-receipt.mjs'

/**
 * Break-tests for ci:page-purpose (scripts/check-page-purpose.mjs).
 *
 * The 2026-09-12 arm: About must publish a structured competitiveBrief
 * (Researchy 1–8). Any kit that already carries the field must be complete.
 * Tip Ready / node-complete still refuse via taste-receipt --ship +
 * site-queue-done — this gate does not invent competitiveBriefPass.
 */

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const GATE = join(REPO, 'scripts/check-page-purpose.mjs')
const ABOUT_PARITY = join(REPO, 'design_system/ryan-realty/ui_kits/about/parity.json')

const cleanEnv = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('GIT_')))

const SANDBOX = join(tmpdir(), `rr-page-purpose-sandbox-${process.pid}-${Math.random().toString(16).slice(2)}`)

const ABOUT_BRIEF = {
  id: 'about-researchy-1-8',
  source: 'Researchy About beats 1–8',
  productLock: 'firm story + reviews + closings + Call|Text|Email|Schedule + team teaser→/team + inquiry→/contact',
  refuse: 'AboutFaces three broker Cards as the opener.',
  beats: [
    { id: '1', text: 'Firm story opens the page: since 2014, Bend office, who you call works your deal.' },
    { id: '2', text: 'Firm reviews: brokerage Google record as words (V3Proof), with a door to /reviews.' },
    { id: '3', text: 'Firm closings: recent Ryan Realty sales as house-row cards with recorded prices.' },
    { id: '4', text: 'Call is the primary conversion on the reach control, carrying live hours.' },
    { id: '5', text: 'Text sits on the same reach control as Call, not a seven-row phone book.' },
    { id: '6', text: 'Email sits on the same reach control as Call, Text, and Schedule.' },
    { id: '7', text: 'Schedule sits on the same reach control as Call, Text, and Email.' },
    { id: '8', text: 'Team teaser doors to /team (and /team/[slug]); inquiry doors to /contact.' },
  ],
}

const TARGET =
  'Beat generic national-brokerage profile pages by opening on the firm story, reviews, closings, and reach.'

function write(rel, contents) {
  const dest = join(SANDBOX, rel)
  mkdirSync(dirname(dest), { recursive: true })
  writeFileSync(dest, contents)
}

function writeJson(rel, value) {
  write(rel, `${JSON.stringify(value, null, 2)}\n`)
}

function pageSrc() {
  return [
    'export default function AboutPage() {',
    '  return (',
    '    <main>',
    '      <V3Breadcrumb />',
    '      <V3Atlas id="service-area" />',
    '      <V3Quiet id="about" />',
    '      <V3Answers id="faq" />',
    '      <V3Footer />',
    '    </main>',
    '  )',
    '}',
    '',
  ].join('\n')
}

function aboutParity(over = {}) {
  return {
    route: 'app/about/page.tsx',
    competitiveTarget: TARGET,
    sectionOrder: [
      'V3Breadcrumb',
      'V3Atlas #service-area',
      'V3Quiet #about',
      'V3Answers #faq',
      'V3Footer',
    ],
    ...over,
  }
}

function scaffold(parity) {
  rmSync(SANDBOX, { recursive: true, force: true })
  mkdirSync(SANDBOX, { recursive: true })
  write('app/about/page.tsx', pageSrc())
  writeJson('design_system/ryan-realty/ui_kits/about/parity.json', parity)
}

function run(cwd = SANDBOX) {
  const r = spawnSync('node', [GATE], { cwd, encoding: 'utf8', env: cleanEnv })
  return { code: r.status, out: `${r.stdout}${r.stderr}` }
}

describe('check-page-purpose — competitiveBrief contract', () => {
  afterAll(() => rmSync(SANDBOX, { recursive: true, force: true }))

  it('loads the live About brief as a complete checklist', () => {
    const parsed = JSON.parse(readFileSync(ABOUT_PARITY, 'utf8'))
    expect(competitiveBriefPurposeProblems('about', parsed)).toEqual([])
    expect(parsed.competitiveBrief.beats).toHaveLength(8)
  })

  it('refuses About with no competitiveBrief', () => {
    scaffold(aboutParity())
    const r = run()
    expect(r.code).toBe(1)
    expect(r.out).toMatch(/competitiveBrief/)
    expect(r.out).toMatch(/structured checklist/)
  })

  it('refuses an empty competitiveBrief on About', () => {
    scaffold(aboutParity({ competitiveBrief: {} }))
    const r = run()
    expect(r.code).toBe(1)
    expect(r.out).toMatch(/beats/)
  })

  it('refuses a three-beat incomplete checklist', () => {
    scaffold(
      aboutParity({
        competitiveBrief: { id: 'short', beats: ABOUT_BRIEF.beats.slice(0, 3) },
      }),
    )
    const r = run()
    expect(r.code).toBe(1)
    expect(r.out).toMatch(/8 Researchy beats/)
  })

  it('passes About when the Researchy 1–8 brief is complete', () => {
    scaffold(aboutParity({ competitiveBrief: ABOUT_BRIEF }))
    const r = run()
    expect(r.out).toMatch(/OK - every public page/)
    expect(r.code).toBe(0)
  })

  it('refuses an incomplete brief on a non-About kit that already carries the field', () => {
    scaffold(aboutParity({ competitiveBrief: ABOUT_BRIEF }))
    write(
      'app/home/page.tsx',
      'export default function HomePage() { return <main><V3Footer /></main> }\n',
    )
    writeJson('design_system/ryan-realty/ui_kits/home/parity.json', {
      route: 'app/home/page.tsx',
      competitiveTarget: TARGET,
      competitiveBrief: { beats: [] },
      sectionOrder: ['V3Footer'],
    })
    const r = run()
    expect(r.code).toBe(1)
    expect(r.out).toMatch(/ui_kits\/home\/parity\.json/)
    expect(r.out).toMatch(/beats/)
  })

  it('passes the real tree (About + Contact + Team briefs complete)', () => {
    const r = run(REPO)
    expect(r.out).toMatch(/OK - every public page/)
    expect(r.code).toBe(0)
  })

  it('fails AboutFaces required as opener', () => {
    const p = aboutOpenerProblems('about', {
      requiredComponents: [{ name: 'AboutFaces', section: 'OPENS THE PAGE, three broker Cards' }],
    })
    expect(p.join('\n')).toMatch(/AboutFirm/)
    expect(p.join('\n')).toMatch(/AboutFaces as opener/)

    scaffold(
      aboutParity({
        competitiveBrief: ABOUT_BRIEF,
        requiredComponents: [{ name: 'AboutFaces', section: 'OPENS THE PAGE, three broker Cards' }],
      }),
    )
    const r = run()
    expect(r.code).toBe(1)
    expect(r.out).toMatch(/AboutFirm/)
  })

  it('loads live Contact and Team briefs as complete checklists', () => {
    const contact = JSON.parse(
      readFileSync(join(REPO, 'design_system/ryan-realty/ui_kits/contact/parity.json'), 'utf8'),
    )
    const team = JSON.parse(readFileSync(join(REPO, 'design_system/ryan-realty/ui_kits/team/parity.json'), 'utf8'))
    expect(competitiveBriefPurposeProblems('contact', contact)).toEqual([])
    expect(competitiveBriefPurposeProblems('team', team)).toEqual([])
    expect(contact.competitiveBrief.beats).toHaveLength(8)
    expect(team.competitiveBrief.beats).toHaveLength(8)
    expect(team.perBrokerPage.competitiveBrief.beats).toHaveLength(8)
  })
})
