/**
 * Receptionist routing (Matt 2026-10-14): on a receptionist line, known callers
 * (number matches a CRM person, or a broker's own cell) ring straight through;
 * unknown callers go to the Grok Voice receptionist over xAI SIP. The
 * receptionist may transfer (SIP REFER) only to the allowlisted numbers below.
 */
import { normalizeTo10, toE164 } from '@/lib/crm/twilio'

/** Twilio numbers whose unknown callers get the receptionist. Default: spare test line only. */
export function receptionistLines(): string[] {
  return (process.env.RECEPTIONIST_LINES ?? '+15412245025').split(',').map((s) => normalizeTo10(s)).filter((s): s is string => !!s)
}

export function isReceptionistLine(dialed: string | null | undefined): boolean {
  const ten = normalizeTo10(dialed)
  return !!ten && receptionistLines().includes(ten)
}

/** The registered xAI SIP endpoint (BYO number phone_8kd3wo7vNfmRVGNm). */
export const XAI_SIP_URI = `sip:${process.env.XAI_SIP_NUMBER ?? '+15412245025'}@sip.voice.x.ai;transport=tls`

export const AGENT_LINES = { rebecca: '+15412503380', paul: '+15415023436' } as const

/** Optional test override: every transfer goes to this number instead (never ring Matt during tests). */
export function transferTestTarget(): string | null {
  return toE164(process.env.RECEPTIONIST_TRANSFER_TEST_TARGET ?? '')
}

/** Allowlist check for a REFER target coming back from Twilio (ReferTransferTarget like "<tel:+1541...>"). */
export function parseReferTarget(raw: string | null | undefined, allowed: (string | null)[]): string | null {
  const m = String(raw ?? '').match(/(?:tel:|sip:)?\+?(\d{10,11})/)
  const ten = normalizeTo10(m?.[1] ?? '')
  if (!ten) return null
  const ok = allowed.map((a) => normalizeTo10(a)).filter(Boolean)
  return ok.includes(ten) ? toE164(ten) : null
}

export function escapeXml(s: string): string {
  return s.replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c] as string))
}
