/**
 * AI-assistant referrer classification.
 *
 * Matt's directive: "drive traffic to my site through ai ... maximized and then
 * analyzed to provide continuous self improvement in traffic." To measure that,
 * we have to separate AI-assistant referrals (ChatGPT, Perplexity, Gemini, ...)
 * out of GA4's generic "Referral" channel — GA4 has no built-in AI bucket.
 *
 * GA4 reports the referrer as either a host (`sessionSource` = "chatgpt.com")
 * or a source/medium string (`sessionSourceMedium` = "chatgpt.com / referral").
 * classifyAiReferrer() accepts either form and returns the engine name, or null
 * when the source is not a known AI assistant.
 *
 * Hosts current as of 2026-01. New AI surfaces get added here (single source of
 * truth) — every consumer that wants an "AI" channel reads this list.
 */

/** Known AI-assistant referrer hosts grouped by the engine they belong to. */
export const AI_REFERRER_PATTERNS: ReadonlyArray<{ engine: string; hosts: readonly string[] }> = [
  { engine: 'ChatGPT', hosts: ['chatgpt.com', 'chat.openai.com', 'openai.com'] },
  { engine: 'Perplexity', hosts: ['perplexity.ai'] },
  { engine: 'Gemini', hosts: ['gemini.google.com', 'bard.google.com'] },
  { engine: 'Copilot', hosts: ['copilot.microsoft.com'] },
  { engine: 'Claude', hosts: ['claude.ai'] },
  { engine: 'Grok', hosts: ['grok.com', 'x.ai'] },
  { engine: 'Meta AI', hosts: ['meta.ai'] },
  { engine: 'DeepSeek', hosts: ['deepseek.com'] },
  { engine: 'Le Chat', hosts: ['mistral.ai', 'chat.mistral.ai'] },
  { engine: 'You.com', hosts: ['you.com'] },
  { engine: 'Phind', hosts: ['phind.com'] },
  { engine: 'Poe', hosts: ['poe.com'] },
]

/** Extract the bare host from a GA4 source string. Accepts "chatgpt.com",
 *  "chatgpt.com / referral", or "www.chatgpt.com" and returns "chatgpt.com". */
function extractHost(sourceOrSourceMedium: string): string {
  const raw = sourceOrSourceMedium.toLowerCase().trim()
  // source/medium is "<source> / <medium>" — take the source side.
  const source = raw.split('/')[0].trim()
  return source.replace(/^www\./, '')
}

/**
 * Classify a GA4 source (or source/medium) string as an AI assistant.
 * Returns the engine name (e.g. "ChatGPT") or null if it is not a known AI host.
 *
 * Match is host-boundary safe: "chatgpt.com" and any "*.chatgpt.com" subdomain
 * match the ChatGPT pattern, but an unrelated host that merely contains the
 * substring (e.g. "notchatgpt.com.evil.test") does not.
 */
export function classifyAiReferrer(sourceOrSourceMedium: string | null | undefined): string | null {
  if (!sourceOrSourceMedium) return null
  const host = extractHost(sourceOrSourceMedium)
  if (!host) return null
  for (const { engine, hosts } of AI_REFERRER_PATTERNS) {
    for (const h of hosts) {
      if (host === h || host.endsWith(`.${h}`)) return engine
    }
  }
  return null
}

/** True when the source string is any known AI assistant referrer. */
export function isAiReferrer(sourceOrSourceMedium: string | null | undefined): boolean {
  return classifyAiReferrer(sourceOrSourceMedium) !== null
}
