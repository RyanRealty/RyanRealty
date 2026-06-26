/**
 * Unit tests for lib/crm/import.ts
 * Run: npx vitest run lib/crm/import.test.ts
 */

import { describe, it, expect } from 'vitest'
import {
  parseCsv,
  autoDetectMapping,
  mapRowToContact,
  findCsvDuplicates,
  type FieldMapping,
} from './import'

// ─── parseCsv ────────────────────────────────────────────────────────────────

describe('parseCsv', () => {
  it('parses a simple 2-row CSV', () => {
    const raw = 'first_name,last_name,email\nJohn,Doe,john@example.com\nJane,Doe,jane@example.com'
    const { headers, rows } = parseCsv(raw)
    expect(headers).toEqual(['first_name', 'last_name', 'email'])
    expect(rows).toHaveLength(2)
    expect(rows[0]).toEqual({ first_name: 'John', last_name: 'Doe', email: 'john@example.com' })
  })

  it('handles quoted fields with embedded commas', () => {
    const raw = 'name,address\nJohn Doe,"123 Main St, Portland, OR"'
    const { rows } = parseCsv(raw)
    expect(rows[0].address).toBe('123 Main St, Portland, OR')
  })

  it('skips blank rows', () => {
    const raw = 'first_name,email\nJohn,john@x.com\n\nJane,jane@x.com'
    const { rows } = parseCsv(raw)
    expect(rows).toHaveLength(2)
  })

  it('returns empty when given empty string', () => {
    const { headers, rows } = parseCsv('')
    expect(headers).toHaveLength(0)
    expect(rows).toHaveLength(0)
  })

  it('handles CRLF line endings', () => {
    const raw = 'first_name,email\r\nJohn,john@x.com'
    const { rows } = parseCsv(raw)
    expect(rows).toHaveLength(1)
    expect(rows[0].first_name).toBe('John')
  })
})

// ─── autoDetectMapping ────────────────────────────────────────────────────────

describe('autoDetectMapping', () => {
  it('maps common FUB export headers', () => {
    const m = autoDetectMapping(['First Name', 'Last Name', 'Email Address', 'Phone Number', 'Stage'])
    expect(m['First Name']).toBe('first_name')
    expect(m['Last Name']).toBe('last_name')
    expect(m['Email Address']).toBe('email')
    expect(m['Phone Number']).toBe('phone')
    expect(m['Stage']).toBe('stage')
  })

  it('skips unknown headers', () => {
    const m = autoDetectMapping(['weird_column_xyz'])
    expect(m['weird_column_xyz']).toBe('__skip__')
  })
})

// ─── mapRowToContact ──────────────────────────────────────────────────────────

describe('mapRowToContact', () => {
  const mapping: FieldMapping = {
    'First Name': 'first_name',
    'Last Name':  'last_name',
    Email:        'email',
    Phone:        'phone',
    Tags:         'tags',
    Stage:        'stage',
    Source:       'source',
    Address:      'address',
  }

  it('maps all fields correctly', () => {
    const row = {
      'First Name': 'John',
      'Last Name':  'Doe',
      Email:        'john@example.com',
      Phone:        '5415550100',
      Tags:         'buyer, hot-lead',
      Stage:        'Active',
      Source:       'Website',
      Address:      '123 Main St',
    }
    const contact = mapRowToContact(row, mapping)
    expect(contact.first_name).toBe('John')
    expect(contact.last_name).toBe('Doe')
    expect(contact.name).toBe('John Doe')
    expect(contact.email).toBe('john@example.com')
    expect(contact.phone).toBe('5415550100')
    expect(contact.tags).toEqual(['buyer', 'hot-lead'])
    expect(contact.stage).toBe('Active')
    expect(contact.source).toBe('Website')
    expect(contact.address).toBe('123 Main St')
  })

  it('produces name from first+last', () => {
    const row = { First: 'Jane', Last: 'Smith', Email: 'j@x.com' }
    const m: FieldMapping = { First: 'first_name', Last: 'last_name', Email: 'email' }
    const c = mapRowToContact(row, m)
    expect(c.name).toBe('Jane Smith')
  })

  it('handles empty tags gracefully', () => {
    const row = { Email: 'x@x.com', Tags: '' }
    const m: FieldMapping = { Email: 'email', Tags: 'tags' }
    const c = mapRowToContact(row, m)
    expect(c.tags).toEqual([])
  })

  it('skips __skip__ columns', () => {
    const row = { Notes: 'ignore me', Email: 'x@x.com' }
    const m: FieldMapping = { Notes: '__skip__', Email: 'email' }
    const c = mapRowToContact(row, m)
    expect(c.email).toBe('x@x.com')
  })
})

// ─── findCsvDuplicates ────────────────────────────────────────────────────────

describe('findCsvDuplicates', () => {
  it('flags duplicate emails within the same file', () => {
    const contacts = [
      { first_name: 'A', last_name: '', email: 'dup@x.com', phone: null, stage: null, tags: [], source: null, address: null, name: 'A' },
      { first_name: 'B', last_name: '', email: 'unique@x.com', phone: null, stage: null, tags: [], source: null, address: null, name: 'B' },
      { first_name: 'C', last_name: '', email: 'dup@x.com', phone: null, stage: null, tags: [], source: null, address: null, name: 'C' },
    ]
    const warnings = findCsvDuplicates(contacts)
    expect(warnings).toHaveLength(1)
    expect(warnings[0].rowIndex).toBe(3)
    expect(warnings[0].type).toBe('csv')
  })

  it('returns empty when no duplicates', () => {
    const contacts = [
      { first_name: 'A', last_name: '', email: 'a@x.com', phone: null, stage: null, tags: [], source: null, address: null, name: 'A' },
    ]
    expect(findCsvDuplicates(contacts)).toHaveLength(0)
  })

  it('ignores rows without an email', () => {
    const contacts = [
      { first_name: 'A', last_name: '', email: null, phone: null, stage: null, tags: [], source: null, address: null, name: 'A' },
      { first_name: 'B', last_name: '', email: null, phone: null, stage: null, tags: [], source: null, address: null, name: 'B' },
    ]
    expect(findCsvDuplicates(contacts)).toHaveLength(0)
  })
})
