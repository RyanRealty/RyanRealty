'use server'

/**
 * Stage a DSCR deal list as a Gmail DRAFT. This action NEVER sends.
 *
 * CLAUDE.md §1: an outbound message to a real person that an agent initiates is
 * per-action approval, every time. The draft-first shape makes that structural
 * rather than a promise — the code has no send path at all. Matt opens the draft
 * in his own mailbox, reads it, and presses send himself. Same mechanism the CMA
 * delivery path uses (lib/cma-deliver.ts), for the same reason: the message
 * carries real financial figures a recipient may act on.
 *
 * Suppression is still checked before the draft is written. A person who has
 * opted out should not have a message about them queued up where a hurried
 * click could send it.
 */

import { requireAdminAction } from '@/lib/admin/require-admin'
import { formatDate } from '@/lib/format/date'
import { isSuppressedByEmail } from '@/lib/crm/suppressions'
import { createGmailDraft } from '@/lib/gmail-draft'
import { getDscrScreen, DSCR_DEFAULTS } from '@/lib/data/dscr/screen'
import { buildDscrDealListEmail, type DscrEmailProperty } from '@/lib/email-templates/dscr-deal-list'

export type StageDscrDraftResult =
  | { ok: true; draftId: string; recipient: string; count: number; dropped: number }
  | { ok: false; error: string }

/**
 * Builds the email from LIVE screen data rather than from numbers posted by the
 * browser. A client that can name its own figures is a client that can send a
 * recipient a wrong one (CLAUDE.md §0) — the form supplies listing keys and
 * copy, never money.
 */
export async function stageDscrDealListDraftAction(formData: FormData): Promise<StageDscrDraftResult> {
  await requireAdminAction('financials.view')

  const to = String(formData.get('to') ?? '').trim()
  const subject = String(formData.get('subject') ?? '').trim()
  const intro = String(formData.get('body') ?? '').trim()
  const keys = String(formData.get('listingKeys') ?? '')
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean)

  if (!to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return { ok: false, error: 'Enter a valid recipient email address.' }
  if (!subject) return { ok: false, error: 'Add a subject line.' }
  if (keys.length === 0) return { ok: false, error: 'Select at least one property.' }

  const gate = await isSuppressedByEmail(to, 'email')
  if (gate.suppressed) {
    return { ok: false, error: `${to} has opted out of email (${gate.reasons.join(', ') || 'suppressed'}). No draft created.` }
  }

  const rows = await getDscrScreen()
  const wanted = new Set(keys)
  const selected = rows.filter((r) => wanted.has(r.listingKey))
  if (selected.length === 0) return { ok: false, error: 'None of the selected properties are still active.' }

  // A property with no rent estimate has no DSCR, no cash flow, and nothing
  // meaningful to say to a buyer. Dropping it beats emailing a row of dashes.
  const priced = selected.filter((r) => r.rent != null)
  if (priced.length === 0) {
    return { ok: false, error: 'None of the selected properties have a rent estimate yet, so there is nothing accurate to send.' }
  }

  const properties: DscrEmailProperty[] = priced.map((r) => ({
    address: r.address,
    city: r.city,
    beds: r.beds,
    sqft: r.sqft,
    propertySubType: r.propertySubType,
    price: r.price,
    rent: r.rent,
    rentSource: r.rentSource,
    pitia: r.pitia,
    dscr: r.dscr,
    cashFlowMonthly: r.cashFlowMonthly,
    cashOnCashPct: r.cashOnCashPct,
    maxPriceForDscr: r.maxPriceForDscr,
    priceDelta: r.priceDelta,
    dealScore: r.dealScore,
    listingUrl: r.listingUrl,
  }))

  const a = DSCR_DEFAULTS
  const { html, text } = buildDscrDealListEmail({
    properties,
    assumptions: {
      ratePct: a.ratePct,
      downPct: a.downPct,
      termYears: a.termYears,
      opexPct: a.vacancyPct + a.mgmtPct + a.maintPct + a.capexPct,
    },
    rentAsOf: formatDate(new Date(), { month: 'long', day: 'numeric', year: 'numeric' }),
    intro: intro || null,
  })

  const draft = await createGmailDraft({ to, subject, bodyHtml: html, bodyText: text })
  if (!draft.ok || !draft.draftId) {
    return { ok: false, error: draft.error ?? draft.hint ?? 'Could not create the Gmail draft.' }
  }

  // Surface anything that was silently dropped for want of a rent estimate, so
  // the sender knows the draft holds fewer properties than they picked.
  return {
    ok: true,
    draftId: draft.draftId,
    recipient: to,
    count: priced.length,
    dropped: selected.length - priced.length,
  }
}
