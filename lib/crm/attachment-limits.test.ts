import { describe, it, expect } from 'vitest'
import {
  actorKeyFor,
  attachmentPathFor,
  batchAttachmentPathFor,
  isValidAttachmentPath,
  isValidBatchAttachmentPath,
  parseAttachmentPath,
  parseAttachmentRefs,
  parseAttachmentRefsFor,
  validateAttachmentFile,
} from './attachment-limits'

describe('validateAttachmentFile', () => {
  it('accepts a normal email PDF', () => {
    expect(validateAttachmentFile('email', { name: 'flyer.pdf', sizeBytes: 2_000_000, contentType: 'application/pdf' }).ok).toBe(true)
  })
  it('rejects empty files', () => {
    expect(validateAttachmentFile('email', { name: 'x.pdf', sizeBytes: 0, contentType: 'application/pdf' }).ok).toBe(false)
  })
  it('rejects an email file over the 10MB per-file cap', () => {
    expect(validateAttachmentFile('email', { name: 'big.pdf', sizeBytes: 11 * 1024 * 1024, contentType: 'application/pdf' }).ok).toBe(false)
  })
  it('rejects executables on email', () => {
    expect(validateAttachmentFile('email', { name: 'setup.exe', sizeBytes: 100, contentType: 'application/octet-stream' }).ok).toBe(false)
  })
  it('rejects non-carrier types on MMS', () => {
    expect(validateAttachmentFile('mms', { name: 'doc.docx', sizeBytes: 100, contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }).ok).toBe(false)
  })
  it('accepts JPEG on MMS, rejects over 5MB', () => {
    expect(validateAttachmentFile('mms', { name: 'a.jpg', sizeBytes: 4 * 1024 * 1024, contentType: 'image/jpeg' }).ok).toBe(true)
    expect(validateAttachmentFile('mms', { name: 'a.jpg', sizeBytes: 6 * 1024 * 1024, contentType: 'image/jpeg' }).ok).toBe(false)
  })
})

describe('attachment paths', () => {
  it('round-trips: generated paths validate for the same person + channel', () => {
    const p = attachmentPathFor('email', 42, 'My Flyer (final).pdf', 1720540000000)
    expect(p).toBe('email/person-42/1720540000000-My_Flyer__final_.pdf')
    expect(isValidAttachmentPath('email', 42, p)).toBe(true)
    expect(parseAttachmentPath(p)).toEqual({ channel: 'email', personId: 42 })
  })
  it("rejects another contact's path and cross-channel paths", () => {
    const p = attachmentPathFor('email', 42, 'a.pdf', 1720540000000)
    expect(isValidAttachmentPath('email', 43, p)).toBe(false)
    expect(isValidAttachmentPath('mms', 42, p)).toBe(false)
  })
  it('rejects traversal / arbitrary bucket paths', () => {
    expect(parseAttachmentPath('email/person-42/../../secrets.txt')).toBeNull()
    expect(parseAttachmentPath('avatars/person-42/1-x.png')).toBeNull()
    expect(parseAttachmentPath('email/person-42/nofilename')).toBeNull()
  })
})

describe('parseAttachmentRefs', () => {
  const ref = (over: Partial<{ path: string; name: string; sizeBytes: number; contentType: string }> = {}) => ({
    path: 'email/person-42/1720540000000-a.pdf',
    name: 'a.pdf',
    sizeBytes: 1000,
    contentType: 'application/pdf',
    ...over,
  })

  it('empty field → no attachments', () => {
    expect(parseAttachmentRefs('', 'email', 42)).toEqual({ ok: true, items: [] })
    expect(parseAttachmentRefs(null, 'email', 42)).toEqual({ ok: true, items: [] })
  })
  it('parses a valid list', () => {
    const res = parseAttachmentRefs(JSON.stringify([ref()]), 'email', 42)
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.items).toHaveLength(1)
  })
  it('rejects malformed JSON and non-arrays', () => {
    expect(parseAttachmentRefs('{not json', 'email', 42).ok).toBe(false)
    expect(parseAttachmentRefs('{"a":1}', 'email', 42).ok).toBe(false)
  })
  it("rejects a path that belongs to a different person (hidden-field tamper)", () => {
    const res = parseAttachmentRefs(JSON.stringify([ref({ path: 'email/person-7/1720540000000-a.pdf' })]), 'email', 42)
    expect(res.ok).toBe(false)
  })
  it('enforces the total-size cap across files', () => {
    const big = ref({ sizeBytes: 9 * 1024 * 1024 })
    const res = parseAttachmentRefs(JSON.stringify([big, { ...big, path: 'email/person-42/1720540000001-b.pdf' }, { ...big, path: 'email/person-42/1720540000002-c.pdf' }]), 'email', 42)
    expect(res.ok).toBe(false)
  })
  it('enforces the max-files cap', () => {
    const items = Array.from({ length: 11 }, (_, i) => ref({ path: `email/person-42/172054000000${i}-a.pdf` }))
    expect(parseAttachmentRefs(JSON.stringify(items), 'email', 42).ok).toBe(false)
  })
})

describe('batch attachment ownership', () => {
  const KEY = actorKeyFor('matt@ryan-realty.com')

  it('derives a stable, path-safe key from the broker email', () => {
    expect(KEY).toBe('matt_ryan_realty_com')
    expect(actorKeyFor('  Matt@Ryan-Realty.com ')).toBe(KEY)
  })

  it('builds and accepts its own path', () => {
    const p = batchAttachmentPathFor('email', KEY, 'Spring flyer.pdf', 1720540000000)
    expect(p).toBe('email/batch-matt_ryan_realty_com/1720540000000-Spring_flyer.pdf')
    expect(isValidBatchAttachmentPath('email', KEY, p)).toBe(true)
  })

  it('refuses another broker key, another channel, and a person path', () => {
    const p = batchAttachmentPathFor('email', KEY, 'f.pdf', 1)
    expect(isValidBatchAttachmentPath('email', actorKeyFor('paul@ryan-realty.com'), p)).toBe(false)
    expect(isValidBatchAttachmentPath('mms', KEY, p)).toBe(false)
    expect(isValidBatchAttachmentPath('email', KEY, 'email/person-42/1-f.pdf')).toBe(false)
  })

  it('parses a batch ref list and rejects one owned by someone else', () => {
    const mine = batchAttachmentPathFor('email', KEY, 'a.pdf', 1)
    const theirs = batchAttachmentPathFor('email', actorKeyFor('paul@ryan-realty.com'), 'b.pdf', 2)
    const ref = (path: string) => ({ path, name: 'a.pdf', sizeBytes: 1024, contentType: 'application/pdf' })
    const owner = { kind: 'batch' as const, actorKey: KEY }
    expect(parseAttachmentRefsFor(JSON.stringify([ref(mine)]), 'email', owner)).toEqual({
      ok: true,
      items: [ref(mine)],
    })
    expect(parseAttachmentRefsFor(JSON.stringify([ref(theirs)]), 'email', owner)).toEqual({
      ok: false,
      error: 'Attachment does not belong to this send',
    })
  })

  it('holds a batch to the same size limit as a one-to-one send', () => {
    const path = batchAttachmentPathFor('email', KEY, 'big.pdf', 1)
    const res = parseAttachmentRefsFor(
      JSON.stringify([{ path, name: 'big.pdf', sizeBytes: 11 * 1024 * 1024, contentType: 'application/pdf' }]),
      'email',
      { kind: 'batch', actorKey: KEY },
    )
    expect(res.ok).toBe(false)
  })
})
