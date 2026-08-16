/**
 * Plain-language copy for /admin/loop. Matt reads this page to see what is
 * being fixed and what just finished — not agent session ids or shop jargon.
 * reachability: app/admin/(protected)/loop/page.tsx
 */

const DOMAIN_PLAIN: Record<string, string> = {
  'public-ux': 'the website',
  'seo-aeo': 'search visibility',
  'leads': 'leads',
  'nurture': 'follow-up',
  'social-presence': 'social and video',
  'sales-insights': 'pricing and market numbers',
  'transactions': 'deals',
  'broker-tools': 'broker tools',
  'recruit-retain': 'the broker team',
  'data-sync': 'listing sync',
  'factory': 'how the loop itself runs',
  'license-voice': 'license and voice',
}

const BOT_PLAIN: Record<string, string> = {
  'walker-mobile': 'Phone walk',
  'walker-desktop': 'Desktop walk',
  'money-path': 'Buyer/seller path',
  'stats-truth': 'Number check',
  'regression-certifier': 'Recheck of finished work',
  'flow-prover': 'Form submit test',
  'page-core': 'Core pages',
  'chrome-nav': 'Header and footer',
  'content-blog': 'Blog walk',
  'geo-cities': 'City pages',
  'geo-places': 'Place pages',
  'geo-subdivisions': 'Plat pages',
  'listings-bend': 'Bend listings',
  'listings-central': 'Town listings',
  'listings-state': 'Oregon listings',
  'matrix-a': 'Search filters',
  'matrix-b': 'Search map',
  LEGAL: 'Legal copy',
  SOCIALS: 'Share links',
  'e2e-proof': 'Setup test',
}

export type LoopKindTone = 'down' | 'slow' | 'waiting' | 'ok' | 'accent'

export function plainDomain(domain: string): string {
  return DOMAIN_PLAIN[domain] ?? domain.replace(/-/g, ' ')
}

export function plainBot(bot: string): string {
  return BOT_PLAIN[bot] ?? bot.replace(/-/g, ' ')
}

export function stripShopPrefix(title: string): string {
  return title
    .replace(/^Fleet finding \[(p0|major|minor)\]:\s*/i, '')
    .replace(/^Matt (ADD|CHANGE) \[(p0|major|minor)\]:\s*/i, '')
    .replace(/^Matt (ADD|CHANGE):\s*/i, '')
    .trim()
}

export function plainNodeTitle(title: string): string {
  const body = stripShopPrefix(title)
  if (/^Matt (ADD|CHANGE)/i.test(title)) {
    return `You asked: ${body}`
  }
  return body
}

export function nodeKind(title: string): { kind: string; tone: LoopKindTone } {
  if (title.startsWith('Fleet finding [p0]') || title.startsWith('Matt ADD [p0]') || title.startsWith('Matt CHANGE [p0]')) {
    return { kind: 'Urgent', tone: 'down' }
  }
  if (title.startsWith('Fleet finding [major]')) return { kind: 'Fix', tone: 'slow' }
  if (title.startsWith('Fleet finding [minor]')) return { kind: 'Polish', tone: 'accent' }
  if (title.startsWith('Matt ADD') || title.startsWith('Matt CHANGE')) return { kind: 'You asked', tone: 'accent' }
  return { kind: 'Plan', tone: 'ok' }
}

export function upcomingBucket(title: string): 'urgent' | 'fix' | 'polish' | 'plan' {
  const { kind } = nodeKind(title)
  if (kind === 'Urgent') return 'urgent'
  if (kind === 'Fix') return 'fix'
  if (kind === 'Polish') return 'polish'
  return 'plan'
}

export function plainFindingStatus(status: string): string {
  switch (status) {
    case 'new':
      return 'Not in the fix list yet'
    case 'node_created':
      return 'In the fix list'
    case 'confirmed':
      return 'Noted, not a fix'
    case 'rejected':
      return 'False alarm'
    case 'duplicate':
      return 'Already in the fix list'
    default:
      return status.replace(/_/g, ' ')
  }
}

export function plainFindingSeverity(severity: string): { kind: string; tone: LoopKindTone } {
  switch (severity) {
    case 'p0':
      return { kind: 'Urgent', tone: 'down' }
    case 'major':
      return { kind: 'Fix', tone: 'slow' }
    case 'minor':
      return { kind: 'Polish', tone: 'accent' }
    case 'info':
      return { kind: 'Note', tone: 'ok' }
    default:
      return { kind: severity, tone: 'accent' }
  }
}

export function plainBlockedReason(reason: string | null): string {
  if (!reason?.trim()) return 'Waiting — no reason recorded'
  const r = reason.trim()
  if (/marketing.?line|APPROVE|sms agent|live SMS/i.test(r)) {
    return 'Waiting on you: approve a real reply on the marketing text line'
  }
  if (/2026-08-22|calendar accept|holdMet|audience hold/i.test(r)) {
    return 'Waiting until August 22: seven-day audience check has to finish'
  }
  return r
}

export function plainEvidence(line: string | null): string {
  if (!line?.trim()) return 'Finished'
  const text = line.trim()
  if (/READY|deploy:verify|main@|dpl_/i.test(text)) {
    const classBit = text.match(/Class:\s*([^.]{8,160})/i)
    if (classBit) return `Live on the site. ${classBit[1].trim()}.`
    return 'Live on the site'
  }
  return text.length > 160 ? `${text.slice(0, 159).trim()}…` : text
}

export function plainShipClass(key: string): string {
  if (key.includes(':place-pages')) return 'place pages'
  if (key.includes(':listing-detail')) return 'listing pages'
  if (key.includes(':search')) return 'search'
  if (key.includes(':seller')) return 'seller pages'
  if (key.includes(':team')) return 'team pages'
  if (key.includes(':blog')) return 'blog posts'
  if (key.includes(':buy')) return 'buyer guides'
  if (key.startsWith('gap:')) return key.slice(4)
  if (key.startsWith('matt:') || key.startsWith('solo:')) return 'this item'
  return 'this set'
}

export function upcomingHint(counts: { urgent: number; fix: number; polish: number; plan: number }): string {
  const bits: string[] = []
  if (counts.urgent) bits.push(`${counts.urgent} urgent`)
  if (counts.fix) bits.push(`${counts.fix} website fixes`)
  if (counts.polish) bits.push(`${counts.polish} polish`)
  if (counts.plan) bits.push(`${counts.plan} on the company list`)
  return bits.length ? bits.join(' · ') : 'Nothing waiting'
}

export function hostPath(url: string): string {
  try {
    const u = new URL(url)
    return `${u.pathname}${u.search}` || '/'
  } catch {
    return url
  }
}
