/**
 * Render an E.164 US number ('+15417033095') as '(541) 703-3095' for
 * client-facing signature blocks. brokers.twilio_number is stored E.164;
 * rendering it raw regressed the CMA signature when the signing-broker
 * resolver switched the publishable line from brokers.phone (pre-formatted)
 * to twilio_number (E.164). Non-US / unparseable input renders unchanged.
 */
export function formatPublishedPhone(e164: string | null | undefined): string | null {
  const raw = (e164 ?? '').trim()
  if (!raw) return null
  const m = raw.match(/^\+?1?(\d{3})(\d{3})(\d{4})$/)
  if (!m) return raw
  return `(${m[1]}) ${m[2]}-${m[3]}`
}
