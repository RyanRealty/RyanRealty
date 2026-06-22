import { describe, it, expect, afterEach } from 'vitest'
import { getMetaPageToken } from './meta-env'

// Dual-name Meta token collapse (audit p3.3). A token set under only one name
// must work everywhere. That is the bug this accessor fixes. Prefer META_PAGE_ACCESS_TOKEN.
const ACCESS = process.env.META_PAGE_ACCESS_TOKEN
const TOKEN = process.env.META_PAGE_TOKEN

afterEach(() => {
  if (ACCESS === undefined) delete process.env.META_PAGE_ACCESS_TOKEN
  else process.env.META_PAGE_ACCESS_TOKEN = ACCESS
  if (TOKEN === undefined) delete process.env.META_PAGE_TOKEN
  else process.env.META_PAGE_TOKEN = TOKEN
})

describe('getMetaPageToken', () => {
  it('prefers META_PAGE_ACCESS_TOKEN when set', () => {
    process.env.META_PAGE_ACCESS_TOKEN = 'access-123'
    process.env.META_PAGE_TOKEN = 'legacy-456'
    expect(getMetaPageToken()).toBe('access-123')
  })
  it('falls back to META_PAGE_TOKEN when the primary is unset', () => {
    delete process.env.META_PAGE_ACCESS_TOKEN
    process.env.META_PAGE_TOKEN = 'legacy-456'
    expect(getMetaPageToken()).toBe('legacy-456')
  })
  it('is undefined when neither is set', () => {
    delete process.env.META_PAGE_ACCESS_TOKEN
    delete process.env.META_PAGE_TOKEN
    expect(getMetaPageToken()).toBeUndefined()
  })
})
