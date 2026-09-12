import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { faceInitials } from '@/app/about/_v3/about-faces'

const FACES = readFileSync('app/about/_v3/AboutFaces.tsx', 'utf8')
const CSS = readFileSync('app/about/_v3/about-faces.css', 'utf8')
const PAGE = readFileSync('app/team/page.tsx', 'utf8')
const FOLD_CSS = readFileSync('app/team/_v3/team-fold.css', 'utf8')
const PORTRAIT = readFileSync('app/about/_v3/FacePortrait.client.tsx', 'utf8')

describe('SITE-74 editorial /team fold', () => {
  it('adapts shadcn Avatar into AboutFaces rather than a second face kit', () => {
    expect(PORTRAIT).toContain("from '@/components/ui/avatar'")
    expect(PORTRAIT).toContain('AvatarFallback')
    expect(FACES).toContain('FacePortrait')
    expect(FACES).toContain('size === "editorial"')
    expect(PAGE).not.toContain("from '@/components/ui/avatar'")
  })

  it('opens on a principal plus companion rows, not three identical columns', () => {
    const editorial = FACES.slice(FACES.indexOf('if (size === "editorial")'))
    expect(editorial).toContain('about-faces__lead')
    expect(editorial).toContain('about-faces__companions')
    expect(editorial).toContain('about-faces__specialty')
    expect(editorial).toContain('editorialReach')
    expect(CSS).toMatch(/\.about-faces__lead \{[\s\S]*?grid-template-columns: var\(--v3-card-photo-w\) minmax\(0, 1fr\)/)
    expect(CSS).toMatch(/\.about-faces__companion \{[\s\S]*?grid-template-columns: var\(--v3-card-photo-h\) minmax\(0, 1fr\)/)
  })

  it('keeps Call as the one primary reach and the other three as text links', () => {
    const editorial = FACES.slice(FACES.indexOf('function editorialReach'), FACES.indexOf('function faceIdentity'))
    expect(editorial).toContain('about-faces__reach--call')
    expect(editorial).toContain('about-faces__reach-text')
    expect(editorial).toContain('Schedule')
    expect(editorial).not.toContain('IconPhone')
  })

  it('prints the Oregon license as a credential row, not a caption under a pill', () => {
    expect(FACES).toContain('about-faces__license--credential')
    expect(FACES).toContain('Oregon license')
    expect(CSS).toMatch(/\.about-faces__license--credential \{[\s\S]*?border-top: var\(--v3-rule-hairline\)/)
  })

  it('puts the coverage Atlas in the first viewport beside the faces at 64rem', () => {
    expect(PAGE).toContain('className="team-fold"')
    expect(PAGE).toContain('className="team-fold__atlas"')
    expect(PAGE).toContain('headlineTone="eyebrow"')
    expect(PAGE).toContain('keyPlacement="head"')
    expect(FOLD_CSS).toMatch(/@media \(min-width: 64rem\) \{[\s\S]*?grid-template-columns: minmax\(0, 38%\) minmax\(0, 1fr\)/)
    expect(FOLD_CSS).toMatch(/\.team-fold__atlas \{[\s\S]*?grid-column: 2/)
  })

  it('uses the shadcn Avatar circle, not a painted-over cutout card', () => {
    expect(CSS).not.toContain('about-faces__avatar')
    expect(PORTRAIT).toContain('AvatarImage')
    expect(PORTRAIT).toContain('AvatarFallback')
    expect(PORTRAIT).not.toContain('about-faces__avatar')
    expect(CSS).not.toMatch(/\.about-faces--editorial[\s\S]{0,200}box-shadow/)
  })
})

describe('faceInitials', () => {
  it('takes the first letter of the first two names', () => {
    expect(faceInitials('Matt Ryan')).toBe('MR')
    expect(faceInitials('Rebecca Peterson')).toBe('RP')
    expect(faceInitials('Paul Stevenson')).toBe('PS')
  })
})
