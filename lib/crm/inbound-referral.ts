/**
 * Incoming agent-referral intake — pure rules for /refer-a-client.
 *
 * Another licensed broker sends a Central Oregon buyer or seller. The client
 * is the lead. The sending agent is a relationship, never a consumer drip.
 * Fee default matches recordReferralReceivable (25% of our side).
 */

import {
  REFERRAL_INBOUND_TAG,
  REFERRING_AGENT_TAG,
} from '@/lib/referral-geo'

export const INBOUND_REFERRAL_SOURCE = 'agent-referral'
export const DEFAULT_INBOUND_FEE_PCT = 25

export const INBOUND_INTENTS = ['buy', 'sell', 'both'] as const
export type InboundIntent = (typeof INBOUND_INTENTS)[number]

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type InboundReferralInput = {
  intent: string
  area: string
  clientName: string
  clientEmail: string
  clientPhone?: string
  agentName: string
  agentEmail: string
  agentPhone?: string
  brokerage: string
  notes?: string
  /** Honeypot. Humans never see it. */
  company?: string
  smsConsent?: boolean
}

export type InboundReferralParsed = {
  intent: InboundIntent
  area: string
  clientName: string
  clientEmail: string
  clientPhone: string
  agentName: string
  agentEmail: string
  agentPhone: string
  brokerage: string
  notes: string
  smsConsent: boolean
}

export function isInboundIntent(value: string): value is InboundIntent {
  return (INBOUND_INTENTS as readonly string[]).includes(value)
}

export function normalizeEmail(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase()
}

export function clientAudienceTags(intent: InboundIntent): string[] {
  if (intent === 'sell') return ['audience:seller']
  if (intent === 'both') return ['audience:buyer', 'audience:seller']
  return ['audience:buyer']
}

export function inboundClientTags(intent: InboundIntent): string[] {
  return [
    ...clientAudienceTags(intent),
    'source:agent-referral',
    REFERRAL_INBOUND_TAG,
  ]
}

export function inboundAgentTags(): string[] {
  return [REFERRING_AGENT_TAG, 'source:agent-referral']
}

/**
 * When the two people share a phone, omit it on the second create so
 * ensureNativeLead does not phone-merge them onto one row.
 */
export function phoneForSecondPerson(firstPhone: string, secondPhone: string): string {
  const a = firstPhone.replace(/\D/g, '').slice(-10)
  const b = secondPhone.replace(/\D/g, '').slice(-10)
  if (!b) return ''
  if (a && a === b) return ''
  return secondPhone
}

export function validateInboundReferral(
  input: InboundReferralInput,
): { ok: true; honeypot: boolean; parsed: InboundReferralParsed } | { ok: false; error: string } {
  if (input.company?.trim()) {
    return {
      ok: true,
      honeypot: true,
      parsed: {
        intent: 'buy',
        area: '',
        clientName: '',
        clientEmail: '',
        clientPhone: '',
        agentName: '',
        agentEmail: '',
        agentPhone: '',
        brokerage: '',
        notes: '',
        smsConsent: false,
      },
    }
  }

  const intent = (input.intent ?? '').trim().toLowerCase()
  if (!isInboundIntent(intent)) {
    return { ok: false, error: 'Say whether they are buying, selling, or both.' }
  }

  const area = input.area?.trim() ?? ''
  if (area.length < 2) {
    return { ok: false, error: 'Name the city or community they want.' }
  }

  const clientName = input.clientName?.trim() ?? ''
  if (clientName.length < 2) {
    return { ok: false, error: 'Enter the client\'s name.' }
  }

  const clientEmail = normalizeEmail(input.clientEmail)
  if (!clientEmail || !EMAIL_RE.test(clientEmail)) {
    return { ok: false, error: 'Enter a valid email for the client.' }
  }

  const agentName = input.agentName?.trim() ?? ''
  if (agentName.length < 2) {
    return { ok: false, error: 'Enter your name.' }
  }

  const agentEmail = normalizeEmail(input.agentEmail)
  if (!agentEmail || !EMAIL_RE.test(agentEmail)) {
    return { ok: false, error: 'Enter a valid email for you.' }
  }

  if (agentEmail === clientEmail) {
    return { ok: false, error: 'Enter the client\'s email, not yours.' }
  }

  const brokerage = input.brokerage?.trim() ?? ''
  if (brokerage.length < 2) {
    return { ok: false, error: 'Enter your brokerage.' }
  }

  return {
    ok: true,
    honeypot: false,
    parsed: {
      intent,
      area: area.slice(0, 200),
      clientName: clientName.slice(0, 120),
      clientEmail,
      clientPhone: (input.clientPhone ?? '').trim().slice(0, 40),
      agentName: agentName.slice(0, 120),
      agentEmail,
      agentPhone: (input.agentPhone ?? '').trim().slice(0, 40),
      brokerage: brokerage.slice(0, 200),
      notes: (input.notes ?? '').trim().slice(0, 1000),
      smsConsent: input.smsConsent === true,
    },
  }
}

export type InboundReferralRow = {
  personId: number
  name: string
  source: string | null
  createdAt: string
  intent: string | null
  area: string | null
  referringAgentName: string | null
  referringBrokerage: string | null
  referringAgentEmail: string | null
}

function customString(custom: Record<string, unknown> | null, key: string): string | null {
  const raw = custom?.[key]
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function inboundReferralFromPerson(row: {
  id: number
  name: string | null
  source: string | null
  created_at: string
  custom?: unknown
}): InboundReferralRow {
  const custom =
    row.custom && typeof row.custom === 'object' && !Array.isArray(row.custom)
      ? (row.custom as Record<string, unknown>)
      : null
  return {
    personId: row.id,
    name: row.name?.trim() || `Lead ${row.id}`,
    source: row.source,
    createdAt: row.created_at,
    intent: customString(custom, 'inboundIntent'),
    area: customString(custom, 'inboundArea'),
    referringAgentName: customString(custom, 'referringAgentName'),
    referringBrokerage: customString(custom, 'referringBrokerage'),
    referringAgentEmail: customString(custom, 'referringAgentEmail'),
  }
}
