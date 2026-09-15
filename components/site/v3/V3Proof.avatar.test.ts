import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const SRC = readFileSync('components/site/v3/V3Proof.client.tsx', 'utf8')
const GROUP = readFileSync('app/reviews/_v3/ReviewsAvatarGroup.client.tsx', 'utf8')

describe('V3Proof shadcn-avatar install (SITE-109)', () => {
  it('renders the route AvatarGroup catalog island, not a house initials row', () => {
    expect(SRC).toContain('ReviewsAvatarGroup')
    expect(SRC).toContain("from '@/app/reviews/_v3/ReviewsAvatarGroup.client'")
    expect(SRC).not.toContain('v3-proof__face-avatars')
  })
})

describe('ReviewsAvatarGroup catalog composition', () => {
  it('is the shadcn AvatarGroup demo: Image, Fallback, Badge, Count, catalog dropdown', () => {
    expect(GROUP).toContain("from '@/components/ui/avatar'")
    expect(GROUP).toContain('AvatarGroup')
    expect(GROUP).toContain('AvatarImage')
    expect(GROUP).toContain('AvatarFallback')
    expect(GROUP).toContain('AvatarBadge')
    expect(GROUP).toContain('AvatarGroupCount')
    expect(GROUP).toContain('DropdownMenu')
    expect(GROUP).toContain('DropdownMenuGroup')
    expect(GROUP).toContain('DropdownMenuItem')
    expect(GROUP).toContain('DropdownMenuSeparator')
    expect(GROUP).toContain('v3-proof__avatar-btn')
    expect(GROUP).toContain("variant=\"ghost\"")
    expect(GROUP).toContain('Account')
    expect(GROUP).toContain('Billing')
    expect(GROUP).toContain('Notifications')
    expect(GROUP).toContain('Sign Out')
    expect(GROUP).toContain('https://github.com/shadcn.png')
    expect(GROUP).toContain('/images/catalog/shadcn-avatar/')
    expect(GROUP).not.toContain('v3-proof__avatar-ink')
    expect(GROUP).not.toMatch(/<p className=/)
    expect(GROUP).not.toContain('face.pull')
  })
})
