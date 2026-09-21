import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const FACES = readFileSync('app/about/_v3/AboutFirmFaces.client.tsx', 'utf8')
const AVATAR = readFileSync('components/site/v3/V3Avatar.tsx', 'utf8')
const FIRM = readFileSync('app/about/_v3/AboutFirm.tsx', 'utf8')
const PAGE = readFileSync('app/about/page.tsx', 'utf8')
const CSS = readFileSync('app/about/_v3/about-fold.css', 'utf8')

describe('SITE-163 AboutFirm faces at display scale', () => {
  it('installs shadcn Avatar on the route and wraps it from V3Avatar', () => {
    expect(AVATAR).toContain("from '@/components/ui/avatar'")
    expect(AVATAR).toContain('AvatarImage')
    expect(AVATAR).toContain('AvatarFallback')
    expect(AVATAR).toContain('AvatarBadge')
    expect(FACES).toContain("from '@/components/ui/avatar'")
    expect(FACES).toContain('<AvatarGroup')
    expect(FACES).toContain("from '@/components/site/v3/V3Avatar'")
    expect(FACES).toContain('<V3Avatar')
    expect(FACES).toContain('size="display"')
  })

  it('keeps 5.0 from 25 on the fold and does not mount the AboutFaces roster', () => {
    expect(FACES).toContain('from {proof.count} Google reviews')
    expect(FACES).toContain('proof?.value')
    expect(PAGE).toContain('people={proof.faces}')
    expect(PAGE).not.toContain('<AboutFaces')
    expect(FIRM).not.toContain('officeSrc')
    expect(CSS).toContain('about-firm__faces')
    expect(CSS).toContain('display scale')
  })

  it('opens the broker on click, not a cream menu or Meet-the-Team dump', () => {
    expect(FACES).toContain('href={person.href}')
    expect(FACES).toContain('about-firm__avatar-btn')
    expect(FACES).not.toContain('DropdownMenu')
    expect(FACES).not.toContain('Meet the team')
    expect(FACES).not.toContain('This broker')
    expect(FACES).not.toContain('CardHeader')
  })
})
