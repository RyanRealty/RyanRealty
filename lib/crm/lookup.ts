import 'server-only'

/**
 * Twilio Lookup v2 — resolve an unknown caller's name (CNAM) and line type so an
 * inbound call shows a real person instead of "Call lead 5551234567", and so we
 * can later skip texting landlines. Fail-safe: any error returns nulls; callers
 * proceed without enrichment. Runs via `after()` so it never blocks the live call.
 */
export type CallerLookup = {
  callerName: string | null
  lineType: string | null // 'mobile' | 'landline' | 'nonFixedVoip' | 'fixedVoip' | ...
  carrier: string | null
}

function toE164(phone: string | null | undefined): string | null {
  const d = String(phone ?? '').replace(/\D/g, '')
  return d.length >= 10 ? `+1${d.slice(-10)}` : null
}

export async function lookupCaller(phone: string | null | undefined): Promise<CallerLookup> {
  const empty: CallerLookup = { callerName: null, lineType: null, carrier: null }
  const e164 = toE164(phone)
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  if (!e164 || !sid || !token) return empty
  try {
    const url = `https://lookups.twilio.com/v2/PhoneNumbers/${encodeURIComponent(e164)}?Fields=caller_name,line_type_intelligence`
    const res = await fetch(url, {
      headers: { Authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64') },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return empty
    const d = (await res.json()) as {
      caller_name?: { caller_name?: string | null } | null
      line_type_intelligence?: { type?: string | null; carrier_name?: string | null } | null
    }
    const name = d.caller_name?.caller_name?.trim() || null
    return {
      callerName: name,
      lineType: d.line_type_intelligence?.type ?? null,
      carrier: d.line_type_intelligence?.carrier_name ?? null,
    }
  } catch {
    return empty
  }
}
