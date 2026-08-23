/**
 * Pull a deal party's email from broker mailbox headers.
 * Match "Hunter Allen <tigtactical@yahoo.com>" — not the brokerage mailbox.
 * Pure. No I/O.
 */

const HOUSE = /@(?:mail\.)?ryan-realty\.com$/i

export type MailHeader = { from?: string; to?: string; cc?: string; subject?: string; snippet?: string }

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

export function gmailQueryForAddress(addressTokens: readonly string[]): string {
  return addressTokens.filter(Boolean).slice(0, 2).map((t) => `"${t}"`).join(' ')
}

const VENDOR =
  /@(?:westerntitle|inhere|skyslope|flexmls|flexmail|realtorpro|noreplydistribution)\./i

/** Unique outside broker who wrote us about this file (Tiffany, Joel). */
export function harvestOtherSideAgent(headers: readonly MailHeader[]): { name: string; email: string } | null {
  const counts = new Map<string, { name: string; n: number }>()
  for (const h of headers) {
    const sub = (h.subject ?? '').toLowerCase()
    const offerish = /offer/.test(sub)
    for (const p of parseMailboxHeader(h.from)) {
      if (VENDOR.test(p.email) || !p.name) continue
      const cur = counts.get(p.email) ?? { name: p.name, n: 0 }
      cur.n += offerish ? 3 : 1
      counts.set(p.email, cur)
    }
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1].n - a[1].n)
  if (!ranked.length) return null
  if (ranked.length > 1 && ranked[0][1].n === ranked[1][1].n) return null
  return { name: ranked[0][1].name, email: ranked[0][0] }
}

export function harvestEscrowNumber(headers: readonly MailHeader[]): string | null {
  const hits = new Map<string, number>()
  for (const h of headers) {
    const m = `${h.subject ?? ''} ${h.from ?? ''}`.match(/\b(WT\d{7,})\b/i)
    if (!m) continue
    const id = m[1].toUpperCase()
    hits.set(id, (hits.get(id) ?? 0) + 1)
  }
  if (hits.size !== 1) return null
  return [...hits.keys()][0]
}

/** $519K / $519,000 / Sale Price - $519K from offer mail. */
export function harvestOfferPrice(text: string): number | null {
  const k = text.match(/\$\s*([\d,.]+)\s*k\b/i)
  if (k) {
    const n = Number(k[1].replace(/,/g, ''))
    return Number.isFinite(n) ? Math.round(n * 1000) : null
  }
  const full = text.match(/\$\s*([\d,]+(?:\.\d{2})?)/)
  if (!full) return null
  const n = Number(full[1].replace(/,/g, ''))
  return Number.isFinite(n) && n >= 1000 ? Math.round(n) : null
}

export function harvestOffersFromMail(headers: readonly MailHeader[]): Array<{
  buyerAgent: string
  agentEmail: string
  price: number | null
  subject: string
}> {
  const out: Array<{ buyerAgent: string; agentEmail: string; price: number | null; subject: string }> = []
  for (const h of headers) {
    const sub = h.subject ?? ''
    if (!/offer/i.test(sub)) continue
    const from = parseMailboxHeader(h.from)[0]
    if (!from || VENDOR.test(from.email)) continue
    out.push({
      buyerAgent: from.name,
      agentEmail: from.email,
      price: harvestOfferPrice(`${sub} ${h.snippet ?? ''}`),
      subject: sub.slice(0, 180),
    })
  }
  const seen = new Set<string>()
  return out.filter((o) => {
    const k = `${o.agentEmail}|${o.price ?? ''}|${o.subject}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}
