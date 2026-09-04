/**
 * Compose prefill for a CMA send through the CRM composers.
 * Drafts stay off the public /cma URL (that path 404s until publish).
 *
 * Email subject/body follow fsbo_cma_first_touch_v1 - never bare CMA in subject.
 */

import {
 composeFsboCmaFirstTouchEmail,
 emptyFsboCmaMergeFacts,
 formatFsboCmaUsd,
 pickFsboCmaFirstTouchSubject,
 type FsboCmaMergeFacts,
} from '@/lib/cma/fsbo-cma-templates'

export type CmaComposeCopyFacts = {
 subjectAddress: string
 ownerFirstName?: string | null
 ownerFullName?: string | null
 propertyStreet?: string | null
 propertyCity?: string | null
 priceRangeLow?: number | null
 priceRangeHigh?: number | null
 suggestedListPrice?: number | null
 currentAskPrice?: number | null
 calendarLink?: string | null
 agentName?: string | null
 agentPhone?: string | null
 agentEmail?: string | null
 brokerageDisclosureLine?: string | null
 leadType?: 'fsbo' | 'expired' | null
}

function streetFromAddress(address: string): string | null {
 const trimmed = address.trim()
 if (!trimmed) return null
 const comma = trimmed.indexOf(',')
 return comma > 0 ? trimmed.slice(0, comma).trim() : trimmed
}

function cityFromAddress(address: string): string | null {
 const parts = address.split(',').map((p) => p.trim()).filter(Boolean)
 if (parts.length < 2) return null
 // "Street, City, OR 97701" → City
 return parts[1]?.replace(/\s+OR\b.*$/i, '').trim() || null
}

export function cmaComposeFactsToMerge(facts: CmaComposeCopyFacts): FsboCmaMergeFacts {
 const address = facts.subjectAddress.trim()
 return {
 ...emptyFsboCmaMergeFacts(),
 ownerFirstName: facts.ownerFirstName?.trim() || null,
 ownerFullName: facts.ownerFullName?.trim() || null,
 propertyAddress: address || null,
 propertyStreet: facts.propertyStreet?.trim() || streetFromAddress(address),
 propertyCity: facts.propertyCity?.trim() || cityFromAddress(address),
 priceRangeLow: formatFsboCmaUsd(facts.priceRangeLow ?? null),
 priceRangeHigh: formatFsboCmaUsd(facts.priceRangeHigh ?? null),
 suggestedListPrice: formatFsboCmaUsd(facts.suggestedListPrice ?? null),
 currentAskPrice: formatFsboCmaUsd(facts.currentAskPrice ?? null),
 calendarLink: facts.calendarLink?.trim() || null,
 agentName: facts.agentName?.trim() || null,
 agentPhone: facts.agentPhone?.trim() || null,
 agentEmail: facts.agentEmail?.trim() || null,
 brokerageDisclosureLine:
 facts.brokerageDisclosureLine?.trim() || 'Licensed in Oregon · Ryan Realty',
 leadType: facts.leadType ?? null,
 }
}

export function cmaComposeEmailSubject(subjectAddress: string): string {
 const address = subjectAddress.trim()
 return pickFsboCmaFirstTouchSubject({
 propertyAddress: address || null,
 propertyStreet: streetFromAddress(address),
 })
}

export function cmaComposeEmailBody(subjectAddress: string): string {
 return composeFsboCmaFirstTouchEmail(
 cmaComposeFactsToMerge({ subjectAddress }),
 ).body
}

/** Richer prefill when CRM has owner + pricing facts. */
export function cmaComposeEmailFromFacts(facts: CmaComposeCopyFacts): {
 subject: string
 body: string
 requiresPdfAttachment: true
} {
 const email = composeFsboCmaFirstTouchEmail(cmaComposeFactsToMerge(facts))
 return {
 subject: email.subject,
 body: email.body,
 requiresPdfAttachment: true,
 }
}

export function cmaComposeSmsBody(subjectAddress: string): string {
 const address = subjectAddress.trim()
 return address
 ? `Pricing report for ${address} is attached.`
 : 'Pricing report PDF is attached.'
}

export function cmaComposePdfFilename(slug: string): string {
 const safe = slug.trim().toLowerCase().replace(/[^\w.\-]/g, '_') || 'cma'
 return `${safe}.pdf`
}
