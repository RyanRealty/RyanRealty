import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { NOT_DRAFTS, isUnsentDraft, withoutDrafts } from './gmail-drafts'

describe('withoutDrafts', () => {
  it('leaves drafts out of a query, once', () => {
    expect(withoutDrafts('after:1700000000 -in:spam -in:trash')).toBe(`after:1700000000 -in:spam -in:trash ${NOT_DRAFTS}`)
    expect(withoutDrafts(withoutDrafts('from:x@y.com'))).toBe(`from:x@y.com ${NOT_DRAFTS}`)
    expect(withoutDrafts('  ')).toBe(NOT_DRAFTS)
    expect(withoutDrafts('subject:offer -in:draft')).toBe('subject:offer -in:draft')
  })
})

describe('isUnsentDraft', () => {
  it('is a draft only while Gmail labels it DRAFT and not SENT', () => {
    expect(isUnsentDraft(['DRAFT'])).toBe(true)
    expect(isUnsentDraft(['DRAFT', 'IMPORTANT'])).toBe(true)
    expect(isUnsentDraft(['SENT'])).toBe(false)
    expect(isUnsentDraft(['DRAFT', 'SENT'])).toBe(false)
    expect(isUnsentDraft(['INBOX', 'UNREAD'])).toBe(false)
    expect(isUnsentDraft(null)).toBe(false)
    expect(isUnsentDraft(undefined)).toBe(false)
  })
})

describe('every mail walk that writes a timeline row, files or harvests leaves drafts out', () => {
  // The one-time full-history review walk (reviewMailbox, `-in:chats`) lists
  // drafts on purpose: its coverage counts every message, and the filing rules
  // record each draft as not a deal.
  const REPO = join(__dirname, '..', '..')
  const walks = ['lib/crm/gmail.ts', 'lib/tc/mail-index.ts', 'lib/tc/mailbox-harvest-run.ts', 'scripts/tc-mail-backfill.ts']
  for (const file of walks) {
    it(file, () => {
      const src = readFileSync(join(REPO, file), 'utf8')
      const calls = [...src.matchAll(/users\.messages\.list\(/g)].map((m) => src.slice(m.index, (m.index ?? 0) + 240))
      expect(calls.length).toBeGreaterThan(0)
      for (const call of calls) {
        const reviewWalk = file === 'lib/tc/mail-index.ts' && call.includes("q: '-in:chats'")
        // `q` shorthand: the file's one `const q` must itself leave drafts out.
        const shorthand = /\{ userId: 'me', q, /.test(call) && (src.match(/const q = /g) ?? []).length === 1 && /const q = withoutDrafts\(/.test(src)
        const draftsLeftOut = call.includes('withoutDrafts(') || shorthand
        if (!reviewWalk) expect(draftsLeftOut, call.slice(0, 120)).toBe(true)
      }
    })
  }
})
