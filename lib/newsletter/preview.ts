import 'server-only'

/**
 * Newsletter preview rendering — the ONE place the admin review surface turns a
 * draft row into the exact HTML the send pipeline would deliver. Used by the
 * review page (server render, default view) and by the preview server action
 * (per-broker re-render from the client switcher). Mirrors the identity logic in
 * lib/newsletter/send-queue.ts so what Matt approves is what recipients get.
 *
 * The preview NEVER sends and always uses a placeholder unsubscribe URL.
 */

import { getCrmBrokers } from '@/lib/data/crm/getCrmBrokers'
import { getNewsletter } from '@/lib/data/newsletter'
import { wrapNewsletterHtml, type SenderBroker } from '@/lib/email-templates/newsletter-shell'

export const PREVIEW_UNSUBSCRIBE_URL = 'https://ryan-realty.com/newsletter/unsubscribe?token=preview'

const KNOWN_BROKERS = new Set(['matt', 'rebecca', 'paul'])

/** Absolute-HTTPS headshots — email can't load app-relative assets (mirrors send-queue). */
const HEADSHOTS: Record<string, string> = {
  matt: 'https://ryan-realty.com/images/brokers/ryan-matt.png',
  rebecca: 'https://ryan-realty.com/images/brokers/peterson-rebecca.png',
  paul: 'https://ryan-realty.com/images/brokers/stevenson-paul.png',
}

export function normalizePreviewBroker(slug: string | null | undefined): string {
  const s = (slug ?? '').trim().toLowerCase()
  return KNOWN_BROKERS.has(s) ? s : 'matt'
}

/** Brand-voice dotted phone (541.703.3095). Returns the input if it can't parse 10 digits. */
function formatPhoneDotted(phone: string | null): string | null {
  if (!phone) return null
  const d = phone.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '')
  return d.length === 10 ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}` : phone
}

/**
 * Build the per-recipient close identity for a chosen broker slug — the same
 * identity the real send uses (send-queue senderBrokerFor). Returns null when
 * the broker roster can't be read.
 */
export async function senderIdentityFor(slug: string): Promise<{ sender: SenderBroker; replyTo: string | null } | null> {
  const brokers = await getCrmBrokers()
  if (brokers.length === 0) return null
  const target = normalizePreviewBroker(slug)
  const b = brokers.find((x) => x.slug === target) ?? brokers.find((x) => x.slug === 'matt') ?? brokers[0]
  const sender: SenderBroker = {
    name: b.name || 'Ryan Realty',
    firstName: (b.name || 'Ryan').split(/\s+/)[0] || b.name,
    title: b.title,
    phone: formatPhoneDotted(b.phone),
    email: b.email,
    headshotUrl: HEADSHOTS[b.slug] ?? HEADSHOTS.matt,
    isOwner: b.slug === 'matt',
  }
  return { sender, replyTo: b.email }
}

export type NewsletterPreviewResult = { ok: boolean; html?: string; error?: string }

/**
 * Render a newsletter draft through the REAL send shell (wrapNewsletterHtml) for
 * a chosen broker identity. This is the visual Matt approves — never raw HTML.
 */
export async function renderNewsletterPreview(id: string, brokerSlug: string): Promise<NewsletterPreviewResult> {
  const letter = await getNewsletter(id)
  if (!letter) return { ok: false, error: 'not_found' }
  if (!letter.body_html) return { ok: false, error: 'empty_body' }
  const identity = await senderIdentityFor(brokerSlug)
  if (!identity) return { ok: false, error: 'no_brokers' }
  const html = wrapNewsletterHtml({
    bodyHtml: letter.body_html,
    previewText: letter.preview_text,
    unsubscribeUrl: PREVIEW_UNSUBSCRIBE_URL,
    senderBroker: identity.sender,
  })
  return { ok: true, html }
}
