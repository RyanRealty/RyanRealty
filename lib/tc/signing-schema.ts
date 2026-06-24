/**
 * Zod validation for the PUBLIC signing boundary (H5 in the TC architecture
 * review). `/sign/[token]` is unauthenticated, and its submitted field values are
 * written to tc_envelope_fields.value (jsonb) and then embedded into the SEALED
 * legal PDF — today after only minimal hand-rolled checks, with no size cap on
 * the base64 PNG. This schema is the trust boundary: a discriminated union per
 * field kind, a hard cap on the signature image, and bounded text.
 *
 * Lives in lib/tc (the domain layer, testable under the vitest glob) and is
 * imported by the signing action. The shape mirrors SignFieldValue in ./signing.ts;
 * a compile-time conformance check lives in the test.
 */
import { z } from 'zod'

/** Base64 PNG data URL cap (~750 KB of string) — a drawn signature is a few KB;
 *  this stops an unauthenticated client bloating the row and the sealed PDF. */
const PngDataUrl = z.string().startsWith('data:image/png;base64,').max(750_000)

/** Validated value of a completed field (the public trust boundary). */
export const SignFieldValueSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('signature'), png: PngDataUrl }),
  z.object({ kind: z.literal('initials'), png: PngDataUrl }),
  z.object({ kind: z.literal('date_signed'), text: z.string().max(32) }),
  z.object({ kind: z.literal('text'), text: z.string().max(2000) }),
  z.object({ kind: z.literal('checkbox'), checked: z.boolean() }),
])

/** One submitted field from the signer: which field + its value. */
export const SubmitFieldSchema = z.object({
  fieldId: z.string().uuid(),
  value: SignFieldValueSchema,
})

/** The full /sign submission payload — at most 200 fields per envelope. */
export const SubmitSigningSchema = z.array(SubmitFieldSchema).max(200)

export type ValidatedSignFieldValue = z.infer<typeof SignFieldValueSchema>
export type SubmitField = z.infer<typeof SubmitFieldSchema>
export type SubmitSigningPayload = z.infer<typeof SubmitSigningSchema>
