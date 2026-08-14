/**
 * Today inbound Yes-path — pure SMS draft. No model call.
 *
 * Priority: classified `recommendedReply` (already sanitized at inbound time)
 * then a short deterministic line from intent + who. Empty is allowed.
 * Never invent a number, price, %, date, or fact. Never a worth-question CTA.
 */
import {
  deterministicReplyIntent,
  sanitizeRecommendedReply,
  type ReplyIntent,
} from '@/lib/crm/reply-intent'
import type { PersonWhoLabel } from '@/lib/crm/person-who-labels'

/** Locked in reply-intent.ts deterministic pre-pass. */
const NOT_INTERESTED_REPLY = 'Understood, I will not text you again.'
const WRONG_NUMBER_REPLY = 'Apologies for the mix-up. I will remove this number from my list.'

const WORTH_QUESTION_RE = /what(?:'s|s| is) (?:my|your) home worth/i

export type TodayInboundDraftInput = {
  inboundBody: string
  inboundChannel: 'sms' | 'email'
  intent: ReplyIntent | null
  whoLabels: readonly PersonWhoLabel[]
  nextStep: string
  recommendedReply?: string | null
  personName?: string | null
  address?: string | null
}

export function todayInboundYesEnabled(input: {
  kind: string
  inboundChannel: 'sms' | 'email' | null
  draftSms: string
}): boolean {
  return input.kind === 'reply' && input.inboundChannel === 'sms' && input.draftSms.trim().length > 0
}

function stripVoiceMarks(text: string): string {
  return text.replace(/!+/g, '.').replace(/\s+/g, ' ').trim()
}

function isWorthQuestion(text: string): boolean {
  return WORTH_QUESTION_RE.test(text)
}

function draftForInterested(who: readonly PersonWhoLabel[]): string {
  if (who.includes('Expired listing') || who.includes('FSBO') || who.includes('Seller')) {
    return 'Thanks for writing back. Happy to talk about the house.'
  }
  if (who.includes('Buyer')) {
    return 'Thanks for writing back. Happy to help you look.'
  }
  return 'Thanks for writing back. When is a good time to talk?'
}

function draftForIntent(intent: ReplyIntent | null, who: readonly PersonWhoLabel[]): string {
  if (!intent) return ''
  switch (intent) {
    case 'not_interested':
      return NOT_INTERESTED_REPLY
    case 'wrong_number':
      return WRONG_NUMBER_REPLY
    case 'interested':
      return draftForInterested(who)
    case 'question':
      return 'Happy to answer that. When works for a quick call?'
    case 'later':
      return 'No rush. I will check back later.'
    case 'other':
      return ''
    default: {
      const _exhaustive: never = intent
      return _exhaustive
    }
  }
}

function finishDraft(raw: string, allowedText: string): string {
  const stripped = stripVoiceMarks(raw)
  if (!stripped || isWorthQuestion(stripped)) return ''
  const clean = sanitizeRecommendedReply(stripped, allowedText)
  if (!clean || isWorthQuestion(clean)) return ''
  return clean
}

/**
 * One recommended SMS for a Today inbound row. Pure. Empty means Yes is off.
 */
export function composeTodayInboundDraft(input: TodayInboundDraftInput): string {
  const inboundBody = (input.inboundBody ?? '').trim()
  const allowedText = [inboundBody, input.personName ?? '', input.address ?? ''].join('\n')

  const classified = finishDraft(input.recommendedReply ?? '', allowedText)
  if (classified) return classified

  const intent = input.intent ?? deterministicReplyIntent(inboundBody)?.intent ?? null
  return finishDraft(draftForIntent(intent, input.whoLabels), allowedText)
}
