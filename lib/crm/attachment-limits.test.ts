import { describe, it, expect } from 'vitest'
import {
  attachmentPathFor,
  isValidAttachmentPath,
  parseAttachmentPath,
  parseAttachmentRefs,
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
