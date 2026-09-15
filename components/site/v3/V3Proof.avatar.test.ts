import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const SRC = readFileSync('components/site/v3/V3Proof.client.tsx', 'utf8')
const GROUP = readFileSync('app/reviews/_v3/ReviewsAvatarGroup.client.tsx', 'utf8')

describe('V3Proof shadcn-avatar install (SITE-109)', () => {
  it('renders the route AvatarGroup island, not a house initials row', () => {
    expect(SRC).toContain('ReviewsAvatarGroup')
    expect(SRC).toContain("from '@/app/reviews/_v3/ReviewsAvatarGroup.client'")
    expect(SRC).not.toContain('v3-proof__face-avatars')
  })
})

describe('ReviewsAvatarGroup honest faces', () => {
  it('is AvatarGroup + reviewer initials + reviewer-identity open menu — no catalog portraits', () => {
    expect(GROUP).toContain("from '@/components/ui/avatar'")
    expect(GROUP).toContain('AvatarGroup')
    expect(GROUP).toContain('AvatarFallback')
    expect(GROUP).toContain('AvatarBadge')
    expect(GROUP).toContain('AvatarGroupCount')
    expect(GROUP).toContain('DropdownMenu')
    expect(GROUP).toContain('DropdownMenuGroup')
    expect(GROUP).toContain('DropdownMenuItem')
    expect(GROUP).toContain('DropdownMenuLabel')
    expect(GROUP).toContain('v3-proof__avatar-btn')
    expect(GROUP).toContain('variant="ghost"')
    expect(GROUP).toContain('face.author')
    expect(GROUP).toContain('Read this review')
    expect(GROUP).toContain('View on Google')
    expect(GROUP).toContain('All reviews')
    expect(GROUP).not.toContain('AvatarImage')
    expect(GROUP).not.toContain('https://github.com/shadcn.png')
    expect(GROUP).not.toContain('https://github.com/leerob.png')
    expect(GROUP).not.toContain('https://github.com/evilrabbit.png')
    expect(GROUP).not.toContain('/images/catalog/shadcn-avatar/')
    expect(GROUP).not.toContain('CATALOG_PORTRAITS')
    expect(GROUP).not.toMatch(/>\s*Account\s*</)
    expect(GROUP).not.toMatch(/>\s*Billing\s*</)
    expect(GROUP).not.toMatch(/>\s*Notifications\s*</)
    expect(GROUP).not.toMatch(/>\s*Sign Out\s*</)
    expect(GROUP).not.toContain('v3-proof__avatar-ink')
    expect(GROUP).not.toMatch(/<p className=/)
    expect(GROUP).not.toContain('face.pull')
  })
})
