/**
 * The model stage: a last check for mail the rules marked `not_deal` or
 * `unfiled_transaction` that still smells like a transaction — a non-general
 * category, a transaction-form attachment, or a property the subject names.
 * Every signal it uses is one the rules already computed (lib/tc/mail-rules.ts
 * `isTransactionCategory`, `isTransactionFormAttachment`, `propertyInSubject`
 * via `MailDecision.propertyHint`); this module invents no new regex.
 *
 * One structured Grok call per message, gated behind an explicit option
 * (lib/tc/mail-index.ts `indexGmailMessage({ modelStage: true })`) so tests
 * and dry runs never touch the network. The model never files on its own:
 * confidence ≥ 0.9 with a dealId files (decided_by 'model', same path as a
 * rules-filed message); anything else queues for a person with the model's
 * reason. A `notDeal: true` from the model never dismisses the message — the
 * rules' own status stands, and the review row just records that the model
 * agreed.
 */
import { GROK_MODELS } from '@/lib/grok/client'
import { generateGrokStructured } from '@/lib/grok/text'
import {
  isTransactionCategory,
  isTransactionFormAttachment,
  type DealFacts,
  type MailAttachmentFacts,
  type MailCategory,
  type MailFacts,
  type MailStatus,
} from './mail-rules'

export type ModelStageCandidateDeal = {
  dealId: string
  address: string
  city: string | null
  mlsNumber: string | null
  escrowNumber: string | null
  parties: string[]
}

export type ModelStageDecision = {
  dealId: string | null
  newTransactionAddress: string | null
  notDeal: boolean
  confidence: number
  reason: string
}

/**
 * Worth asking the model: the rules said `not_deal` or `unfiled_transaction`,
 * but the category is already transactional, a transaction-form attachment
 * showed up, or the subject named a property. Ambiguous and filed messages
 * never reach the model — the rules already placed them.
 */
export function worthModelStage(input: {
  status: MailStatus
  category: MailCategory
  attachments: readonly MailAttachmentFacts[]
  propertyHint: string | null
  /** Deals the rules could not choose between (ambiguous mail). */
  candidateCount?: number
}): boolean {
  // Ambiguous mail the rules narrowed to a few deals: the model reads it and picks one.
  if (input.status === 'ambiguous') return (input.candidateCount ?? 0) >= 2
  if (input.status !== 'not_deal' && input.status !== 'unfiled_transaction') return false
  if (isTransactionCategory(input.category)) return true
  if (input.attachments.some(isTransactionFormAttachment)) return true
  return !!input.propertyHint
}

/** The deals the model is allowed to name — the ones open (or recently closed) at the time this message was sent. */
export function candidateDealsForModel(
  deals: readonly DealFacts[],
  sentAt: string,
  openAt: (deal: DealFacts, at: string) => boolean,
): ModelStageCandidateDeal[] {
  return deals
    .filter((d) => openAt(d, sentAt))
    .map((d) => ({
      dealId: d.dealId,
      address: d.address,
      city: d.city,
      mlsNumber: d.cycles.map((c) => c.mlsNumber).find((n): n is string => !!n) ?? null,
      escrowNumber: d.cycles.map((c) => c.escrowNumber).find((n): n is string => !!n) ?? null,
      parties: d.partyEmails,
    }))
}

export const MODEL_STAGE_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: ['dealId', 'newTransactionAddress', 'notDeal', 'confidence', 'reason'],
  properties: {
    dealId: { type: ['string', 'null'], description: 'The id of the ONE listed deal this message is about, or null.' },
    newTransactionAddress: {
      type: ['string', 'null'],
      description: 'The full street address of a transaction this message is about that has no listed deal, or null.',
    },
    notDeal: { type: 'boolean', description: 'True when this message is not about a real-estate transaction at all.' },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    reason: { type: 'string', description: 'One sentence: why.' },
  },
}

type PromptFacts = Pick<MailFacts, 'subject' | 'from' | 'to' | 'cc' | 'body' | 'attachments'>

function dealLine(d: ModelStageCandidateDeal, withParties = false): string {
  const bits = [
    d.address,
    d.city ? `${d.city}, OR` : null,
    d.mlsNumber ? `MLS ${d.mlsNumber}` : null,
    d.escrowNumber ? `escrow ${d.escrowNumber}` : null,
    withParties && d.parties.length ? `clients ${d.parties.join(' ')}` : null,
  ]
  return `- ${d.dealId}: ${bits.filter(Boolean).join(', ')}`
}

/**
 * The prompt, pure and testable without a network call. Never invents a deal
 * or an address the message and the candidate list don't support.
 */
export function buildModelStagePrompt(input: {
  facts: PromptFacts
  candidates: readonly ModelStageCandidateDeal[]
  /** 'choose': the rules narrowed it to these deals (the sender is on each); pick one or none. */
  mode?: 'open' | 'choose'
}): {
  system: string
  user: string
} {
  const system = input.mode === 'choose' ? CHOOSE_SYSTEM : OPEN_SYSTEM
  const candidateBlock = input.candidates.length
    ? input.candidates.map((d) => dealLine(d, input.mode === 'choose')).join('\n')
    : '(no open deals)'
  const user = [
    `${input.mode === 'choose' ? 'Deals the sender or recipients are on' : 'Open deals'}:\n${candidateBlock}`,
    `Subject: ${input.facts.subject || '(none)'}`,
    `From: ${input.facts.from.join(', ') || '(none)'}`,
    `To: ${input.facts.to.join(', ') || '(none)'}`,
    `Cc: ${input.facts.cc.join(', ') || '(none)'}`,
    `Attachments: ${input.facts.attachments.map((a) => a.name).join(', ') || '(none)'}`,
    `Body excerpt:\n${(input.facts.body || '').slice(0, 4000)}`,
  ].join('\n\n')
  return { system, user }
}

const CHOOSE_SYSTEM =
  'A Ryan Realty broker email could not be filed by rule: its sender or recipients are on every deal listed below (address, city, MLS number, escrow number, client emails), and the email does not name a property. Decide from the message itself (subject, body, attachment names, the people on it) which ONE listed deal it is about. Name a deal only when the message points to it and not to the others: a street or neighborhood, a client, a step only one of the deals was at, a document only one of them had. If it could be about more than one, or about none of them, set dealId null. Never pick a deal not on the list. A wrong dealId is worse than an unanswered message: confidence is read literally, and 0.9+ means "file this without a person looking at it first."'

const OPEN_SYSTEM =
  'You decide which open Ryan Realty transaction file, if any, a broker email belongs to. Below is the complete list of open (or recently closed) deals: address, city, MLS number, escrow number. Answer only from the message and that list. Never invent an address or pick a deal not on the list. If the message names a property with no deal on the list, put its full street address in newTransactionAddress and leave dealId null. If the message is not about a real-estate transaction at all (marketing, personal, unrelated business), set notDeal true. A wrong dealId is worse than an unanswered message, so only name one you are actually confident about — confidence is read literally: 0.9+ means "file this without a person looking at it first."'

export type ModelStageAction =
  | { action: 'file'; dealId: string }
  | { action: 'queue'; status: 'ambiguous' | 'unfiled_transaction'; dealId: string | null }
  | { action: 'leave' }

/**
 * Pure decision logic, no I/O: what to do with the model's answer. The model
 * is never allowed to dismiss a message on its own word — the only actions
 * are file (high confidence, a named deal) or queue (a person decides); a
 * `notDeal` answer or a low-confidence guess just leaves the rules' status.
 */
export function applyModelStageDecision(decision: ModelStageDecision, confidenceThreshold = 0.9): ModelStageAction {
  if (decision.dealId) {
    return decision.confidence >= confidenceThreshold
      ? { action: 'file', dealId: decision.dealId }
      : { action: 'queue', status: 'ambiguous', dealId: decision.dealId }
  }
  if (decision.newTransactionAddress) return { action: 'queue', status: 'unfiled_transaction', dealId: null }
  return { action: 'leave' }
}

/**
 * The one network call. Never invoked directly by a sweep or a test — callers
 * gate it behind `indexGmailMessage({ modelStage: true })`.
 */
export async function askModelStage(input: {
  facts: PromptFacts
  candidates: readonly ModelStageCandidateDeal[]
  mode?: 'open' | 'choose'
}): Promise<ModelStageDecision> {
  const { system, user } = buildModelStagePrompt(input)
  const { value } = await generateGrokStructured<ModelStageDecision>({
    system,
    prompt: user,
    model: GROK_MODELS.text,
    schema: MODEL_STAGE_SCHEMA,
    schemaName: 'tc_mail_model_stage',
    reasoningEffort: 'low',
    maxTokens: 500,
  })
  return {
    dealId: value.dealId || null,
    newTransactionAddress: value.newTransactionAddress || null,
    notDeal: !!value.notDeal,
    confidence: Math.max(0, Math.min(1, Number(value.confidence) || 0)),
    reason: String(value.reason ?? '').trim().slice(0, 500) || 'no reason given',
  }
}
