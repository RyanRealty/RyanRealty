import 'server-only'
import { randomBytes } from 'node:crypto'
import { createServiceClient } from '@/lib/supabase/service'

/**
 * Trackable short links for outbound SMS — the Twilio "click tracking" feature,
 * built in-house so texted links stay SHORT (a signed tracking token would blow
 * up the segment count). Every http(s) link in an outbound text is rewritten to
 * ryan-realty.com/r/<code>; the /r/<code> route (app/r/[code]) resolves the code,
 * logs an `sms_click` engagement event to crm_timeline, and 302s to the target.
 * The SMS analog of the email click tracker (/api/track/e/click).
 *
 * All DB access lives here (DAL boundary G1). The redirect route + SMS composer
 * are the only callers.
 */

const TRACK_ORIGIN = 'https://ryan-realty.com'
// No confusable chars (0/O/1/l/I) — codes read cleanly if a client ever sees one.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'

function genCode(len = 7): string {
  const b = randomBytes(len)
  let s = ''
  for (let i = 0; i < len; i++) s += ALPHABET[b[i] % ALPHABET.length]
  return s
}

/** Never wrap our own tracker, compliance/unsubscribe links, or opt-out rails. */
function isUntrackableLink(url: string): boolean {
  return /\/r\/[A-Za-z0-9]|\/api\/track\/|unsubscribe|opt[-_]?out|email-preferences|agency-disclosure/i.test(url)
}

/** Trailing sentence punctuation the URL regex greedily captures ("…/sell." → "."). */
const TRAILING_PUNCT = /[.,;:!?)\]'"]+$/

/**
 * Link-preview prefetchers (iMessage, WhatsApp, Slack, social crawlers) fetch a
 * texted link to build a preview — that is NOT a human click and must not inflate
 * the count. A missing UA is treated as automation too (real browsers always send
 * one). CLI/library bots are already 403'd upstream by the middleware bot screen;
 * this catches the preview/prefetch class that middleware lets through.
 */
const BOT_UA_RE = /bot\b|crawl|spider|slurp|facebookexternalhit|facebot|whatsapp|telegram|slackbot|discordbot|twitterbot|linkedinbot|skypeuripreview|applebot|bingbot|googlebot|preview|prerender|scanner|monitor|python-requests|curl|wget|headless/i
export function isLikelyBotUserAgent(ua: string | null | undefined): boolean {
  if (!ua || !ua.trim()) return true
  return BOT_UA_RE.test(ua)
}

export async function createShortLink(params: {
  personId: number
  targetUrl: string
  broker?: string | null
  channel?: string
  messageSid?: string | null
}): Promise<string | null> {
  const sb = createServiceClient()
  for (let attempt = 0; attempt < 4; attempt++) {
    const code = genCode()
    const { error } = await sb.from('crm_short_links').insert({
      code,
      person_id: params.personId,
      target_url: params.targetUrl,
      broker: params.broker ?? null,
      channel: params.channel ?? 'sms',
      message_sid: params.messageSid ?? null,
    })
    if (!error) return code
    // 23505 = unique_violation → the random code collided; retry with a new one.
    if (error.code !== '23505') {
      console.warn('[short-links] create error:', error.message)
      return null
    }
  }
  return null
}

/**
 * Rewrite every trackable http(s) link in an outbound text to a short tracked
 * link. Returns the body unchanged when there are no links. Best-effort: a link
 * whose short-code can't be minted is left as-is (the text still sends).
 */
export async function instrumentSmsLinks(
  text: string,
  params: { personId: number; broker?: string | null; messageSid?: string | null },
): Promise<string> {
  try {
    const matches = [...text.matchAll(/https?:\/\/[^\s"'<)\]]+/g)]
    if (matches.length === 0) return text

    // Mint one short link per UNIQUE cleaned URL (trailing punctuation stripped
    // so the redirect target is the real URL).
    const codeByUrl = new Map<string, string>()
    for (const m of matches) {
      const clean = m[0].replace(TRAILING_PUNCT, '')
      if (!clean || isUntrackableLink(clean) || codeByUrl.has(clean)) continue
      const code = await createShortLink({
        personId: params.personId,
        targetUrl: clean,
        broker: params.broker ?? null,
        channel: 'sms',
        messageSid: params.messageSid ?? null,
      })
      if (code) codeByUrl.set(clean, `${TRACK_ORIGIN}/r/${code}`)
    }
    if (codeByUrl.size === 0) return text

    // Rebuild left-to-right by match position. A single pass (never replaceAll)
    // is REQUIRED: the short link itself contains "ryan-realty.com", so a naive
    // replace of a bare ryan-realty.com URL would corrupt an already-inserted
    // short link. Position-based reconstruction can't re-match inserted text.
    let out = ''
    let last = 0
    for (const m of matches) {
      const start = m.index ?? 0
      const orig = m[0]
      const clean = orig.replace(TRAILING_PUNCT, '')
      const trail = orig.slice(clean.length) // punctuation kept AFTER the link
      const repl = codeByUrl.get(clean)
      out += text.slice(last, start) + (repl ? repl + trail : orig)
      last = start + orig.length
    }
    out += text.slice(last)
    return out
  } catch (err) {
    // Tracking must NEVER block the actual text — fail open to the original body.
    console.warn('[short-links] instrument failed, sending untracked:', err)
    return text
  }
}

export type ResolvedShortLink = { targetUrl: string; personId: number; broker: string | null; channel: string }

/**
 * Resolve a short code, log the click as an `sms_click` engagement event, bump
 * the click counters, and return the redirect target. The timeline event is
 * deduped per person+code (repeat clicks of the SAME link collapse to one row,
 * matching the email_click grain) while click_count still increments every hit.
 * Returns null for an unknown code (caller fails open to the homepage).
 */
export async function resolveAndLogShortLinkClick(
  code: string,
  opts?: { log?: boolean },
): Promise<ResolvedShortLink | null> {
  const sb = createServiceClient()
  const { data } = await sb
    .from('crm_short_links')
    .select('code,person_id,target_url,broker,channel,click_count,first_click_at')
    .eq('code', code)
    .maybeSingle()
  if (!data) return null

  const personId = data.person_id as number
  const target = data.target_url as string
  const broker = (data.broker as string | null) ?? null
  const channel = (data.channel as string) ?? 'sms'

  // A link-preview prefetch (opts.log === false) redirects but records nothing —
  // it is not a human click. Everything below is the real-click bookkeeping.
  if (opts?.log === false) return { targetUrl: target, personId, broker, channel }

  const { error: logErr } = await sb.from('crm_timeline').upsert(
    {
      person_id: personId,
      kind: 'sms_click',
      source: 'sms-tracking',
      broker,
      title: 'Clicked a link you texted',
      body: target,
      payload: { url: target, channel, code },
      dedupe_key: `sms_click:${personId}:${code}`,
    },
    { onConflict: 'dedupe_key', ignoreDuplicates: true },
  )
  // Never swallow the write: a missing kind in the crm_timeline CHECK constraint
  // (or any insert error) would otherwise drop the click silently.
  if (logErr) console.warn('[short-links] sms_click log failed:', logErr.message)

  const now = new Date().toISOString()
  await sb
    .from('crm_short_links')
    .update({
      click_count: ((data.click_count as number) ?? 0) + 1,
      last_click_at: now,
      first_click_at: (data.first_click_at as string | null) ?? now,
    })
    .eq('code', code)

  return { targetUrl: target, personId, broker, channel }
}
