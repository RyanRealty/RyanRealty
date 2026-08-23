/**
 * Pull a deal party's email from broker mailbox headers.
 * Match "Hunter Allen <tigtactical@yahoo.com>" — not the brokerage mailbox.
 * Pure. No I/O.
 */

const HOUSE = /@(?:mail\.)?ryan-realty\.com$/i

export type MailHeader = { from?: string; to?: string; cc?: string; subject?: string }

function normName(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

/** Display-name + address pairs from a From/To/Cc header. */
export function parseMailboxHeader(raw: string | null | undefined): Array<{ name: string; email: string }> {
  if (!raw?.trim()) return []
  const out: Array<{ name: string; email: string }> = []
  const re = /(?:"?([^"<,]+)"?\s*)?<([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(raw))) {
    const email = m[2].trim().toLowerCase()
    if (HOUSE.test(email)) continue
    const name = (m[1] ?? '').replace(/\\"/g, '').trim()
    out.push({ name, email })
  }
  if (!out.length) {
    const lone = raw.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)
    if (lone && !HOUSE.test(lone[0])) out.push({ name: '', email: lone[0].toLowerCase() })
  }
  return out
}

/**
 * Unique non-brokerage email whose display name is the party.
 * Several hits for the same address count as one. Two different addresses → skip.
 */
export function harvestPartyEmail(partyName: string, headers: readonly MailHeader[]): string | null {
  const want = normName(partyName)
  if (!want) return null
  const last = want.split(' ').at(-1) ?? want
  const counts = new Map<string, number>()
  for (const h of headers) {
    for (const p of [...parseMailboxHeader(h.from), ...parseMailboxHeader(h.to), ...parseMailboxHeader(h.cc)]) {
      const n = normName(p.name)
      if (!n) continue
      const hit = n === want || (n.endsWith(` ${last}`) && n.split(' ')[0] === want.split(' ')[0])
      if (!hit) continue
      counts.set(p.email, (counts.get(p.email) ?? 0) + 1)
    }
  }
  if (counts.size !== 1) return null
  return [...counts.keys()][0]
}

export function gmailQueryForParty(partyName: string, addressTokens: readonly string[]): string {
  const quoted = `"${partyName.trim()}"`
  const addr = addressTokens.filter(Boolean).slice(0, 3).map((t) => `"${t}"`).join(' OR ')
  return addr ? `${quoted} (${addr})` : quoted
}
