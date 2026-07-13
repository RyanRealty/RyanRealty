/**
 * TC e-signature core — tokens, field geometry, shared types.
 *
 * Plain module (no 'use server'): imported by server actions AND by the
 * public signing route. Crypto helpers run server-side only.
 *
 * Geometry convention (locked here so the composer, the signing page, and the
 * sealer all agree): a field's { page, x, y, w, h } are stored as page-relative
 * FRACTIONS in [0,1], with the origin at the TOP-LEFT of the page (CSS/DOM
 * convention) — x→right, y→down. `page` is 1-indexed to match pdf.js page
 * numbers. The sealer converts to pdf-lib's bottom-left point space.
 */
import { createHash, randomBytes } from 'node:crypto'

export const SIGN_FIELD_TYPES = ['signature', 'initials', 'date_signed', 'text', 'checkbox'] as const
export type SignFieldType = (typeof SIGN_FIELD_TYPES)[number]

export const SIGN_FIELD_LABEL: Record<SignFieldType, string> = {
  signature: 'Signature',
  initials: 'Initials',
  date_signed: 'Date signed',
  text: 'Text',
  checkbox: 'Checkbox',
}

/** Recipient roles. CC recipients receive the completed copy but never sign. */
export const RECIPIENT_ROLES = [
  'buyer1',
  'buyer2',
  'seller1',
  'seller2',
  'listing_broker',
  'buyer_broker',
  'escrow',
  'title',
  'lender',
  'other',
  'cc',
] as const
export type RecipientRole = (typeof RECIPIENT_ROLES)[number]

export const RECIPIENT_ROLE_LABEL: Record<RecipientRole, string> = {
  buyer1: 'Buyer',
  buyer2: 'Buyer (2nd)',
  seller1: 'Seller',
  seller2: 'Seller (2nd)',
  listing_broker: 'Listing broker',
  buyer_broker: "Buyer's broker",
  escrow: 'Escrow officer',
  title: 'Title',
  lender: 'Lender',
  other: 'Other party',
  cc: 'CC (copy only)',
}

export const ENVELOPE_STATUSES = ['draft', 'sent', 'partially_signed', 'completed', 'voided'] as const
export type EnvelopeStatus = (typeof ENVELOPE_STATUSES)[number]

export const ENVELOPE_STATUS_LABEL: Record<EnvelopeStatus, string> = {
  draft: 'Draft',
  sent: 'Out for signature',
  partially_signed: 'Partially signed',
  completed: 'Completed',
  voided: 'Voided',
}

/** A placed field as the composer/signing UI sees it. */
export type EnvelopeField = {
  id: string
  documentId: string
  recipientId: string | null
  type: SignFieldType
  page: number // 1-indexed
  x: number // fraction [0,1] from left
  y: number // fraction [0,1] from top
  w: number // fraction [0,1] of page width
  h: number // fraction [0,1] of page height
  required: boolean
  value: SignFieldValue | null
  signedAt: string | null
}

/** Stored value of a completed field (jsonb). */
export type SignFieldValue =
  | { kind: 'signature'; png: string } // data URL of drawn/typed signature
  | { kind: 'initials'; png: string }
  | { kind: 'date_signed'; text: string }
  | { kind: 'text'; text: string }
  | { kind: 'checkbox'; checked: boolean }

/**
 * Generate a per-recipient signing token. The raw token goes in the emailed
 * link; only its sha256 hash is stored (tc_envelope_recipients.auth_token_hash),
 * so a DB read can never reconstruct a live signing link.
 */
export function generateSigningToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url')
  return { token, hash: hashSigningToken(token) }
}

export function hashSigningToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/** Default field sizes (page fractions) when the composer drops a new field. */
export const DEFAULT_FIELD_SIZE: Record<SignFieldType, { w: number; h: number }> = {
  signature: { w: 0.22, h: 0.05 },
  initials: { w: 0.08, h: 0.045 },
  date_signed: { w: 0.14, h: 0.035 },
  text: { w: 0.2, h: 0.035 },
  checkbox: { w: 0.03, h: 0.022 },
}

export function isSignableRole(role: string | null | undefined): boolean {
  return !!role && role !== 'cc'
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export function isValidEmail(email: string | null | undefined): boolean {
  return !!email && EMAIL_RE.test(email.trim())
}
