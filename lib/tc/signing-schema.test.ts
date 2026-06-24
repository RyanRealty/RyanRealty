import { describe, it, expect, expectTypeOf } from 'vitest'
import {
  SignFieldValueSchema,
  SubmitSigningSchema,
  type ValidatedSignFieldValue,
} from './signing-schema'
import type { SignFieldValue } from './signing'

const PNG = 'data:image/png;base64,iVBORw0KGgo='

describe('SignFieldValueSchema (H5 public signing boundary)', () => {
  it('accepts each valid field-value kind', () => {
    expect(SignFieldValueSchema.safeParse({ kind: 'signature', png: PNG }).success).toBe(true)
    expect(SignFieldValueSchema.safeParse({ kind: 'initials', png: PNG }).success).toBe(true)
    expect(SignFieldValueSchema.safeParse({ kind: 'date_signed', text: '2026-06-24' }).success).toBe(true)
    expect(SignFieldValueSchema.safeParse({ kind: 'text', text: 'Initialed' }).success).toBe(true)
    expect(SignFieldValueSchema.safeParse({ kind: 'checkbox', checked: true }).success).toBe(true)
  })

  it('rejects an oversized signature PNG (the row/PDF-bloat guard)', () => {
    const huge = 'data:image/png;base64,' + 'A'.repeat(800_000)
    expect(SignFieldValueSchema.safeParse({ kind: 'signature', png: huge }).success).toBe(false)
  })

  it('rejects a non-PNG-data-url scheme (no arbitrary blobs / SVG / js)', () => {
    expect(SignFieldValueSchema.safeParse({ kind: 'signature', png: 'data:image/svg+xml;base64,xxx' }).success).toBe(false)
    expect(SignFieldValueSchema.safeParse({ kind: 'signature', png: 'javascript:alert(1)' }).success).toBe(false)
  })

  it('bounds text fields', () => {
    expect(SignFieldValueSchema.safeParse({ kind: 'date_signed', text: 'x'.repeat(33) }).success).toBe(false)
    expect(SignFieldValueSchema.safeParse({ kind: 'text', text: 'x'.repeat(2001) }).success).toBe(false)
  })

  it('rejects an unknown kind and a kind/payload mismatch', () => {
    expect(SignFieldValueSchema.safeParse({ kind: 'strike', text: 'x' }).success).toBe(false) // dropped type
    expect(SignFieldValueSchema.safeParse({ kind: 'signature', text: 'oops' }).success).toBe(false) // wrong payload
    expect(SignFieldValueSchema.safeParse({ kind: 'checkbox', checked: 'yes' }).success).toBe(false)
  })

  it('conforms to the canonical SignFieldValue type', () => {
    expectTypeOf<ValidatedSignFieldValue>().toMatchTypeOf<SignFieldValue>()
  })
})

describe('SubmitSigningSchema', () => {
  it('accepts a valid array of submitted fields', () => {
    const ok = SubmitSigningSchema.safeParse([
      { fieldId: '11111111-1111-4111-8111-111111111111', value: { kind: 'signature', png: PNG } },
      { fieldId: '22222222-2222-4222-8222-222222222222', value: { kind: 'checkbox', checked: false } },
    ])
    expect(ok.success).toBe(true)
  })

  it('rejects a non-uuid fieldId', () => {
    expect(
      SubmitSigningSchema.safeParse([{ fieldId: 'not-a-uuid', value: { kind: 'text', text: 'a' } }]).success,
    ).toBe(false)
  })

  it('caps the payload at 200 fields', () => {
    const many = Array.from({ length: 201 }, (_, i) => ({
      fieldId: `${String(i).padStart(8, '0')}-1111-4111-8111-111111111111`,
      value: { kind: 'checkbox' as const, checked: true },
    }))
    expect(SubmitSigningSchema.safeParse(many).success).toBe(false)
  })
})
