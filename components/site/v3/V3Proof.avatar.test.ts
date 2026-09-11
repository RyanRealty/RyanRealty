import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const SRC = readFileSync('components/site/v3/V3Proof.client.tsx', 'utf8')

describe('V3Proof shadcn-avatar install (SITE-79)', () => {
  it('literally imports Avatar + AvatarFallback from @/components/ui/avatar', () => {
    expect(SRC).toContain("from '@/components/ui/avatar'")
    expect(SRC).toContain('Avatar')
    expect(SRC).toContain('AvatarFallback')
  })

  it('renders AvatarFallback initials, not invented portraits', () => {
    expect(SRC).toContain('AvatarFallback')
    expect(SRC).toContain('reviewerInitials')
    expect(SRC).not.toMatch(/AvatarImage/)
  })
})

