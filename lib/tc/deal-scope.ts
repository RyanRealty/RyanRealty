/**
 * Per-broker deal visibility (tc-builder rung 16).
 * Superuser sees every file. A broker sees files where tc_deals.broker_name
 * is their brokerage identity. Unmapped brokers see nothing (fail closed).
 *
 * The identities come from lib/brokers/directory.ts: the three founding
 * brokers are seeded, and a broker added from Google Workspace is read from
 * public.brokers (Matt 2026-09-24: "automatically ... all that stuff").
 */
import { SEEDED_BROKERS, brokerByFileName, brokerBySlug } from '@/lib/brokers/directory'

/** The founding brokers' file names (kept for callers that read the map). */
export const BROKER_FILE_NAME: Record<string, string> = Object.fromEntries(SEEDED_BROKERS.map((b) => [b.slug, b.fileName]))

export const BROKER_FILE_EMAIL: Record<string, string> = Object.fromEntries(SEEDED_BROKERS.map((b) => [b.fileName, b.email ?? '']))

export function fileNameFromBrokerSlug(slug: string | null | undefined): string | null {
  const b = brokerBySlug(slug)
  return b && b.active ? b.fileName : null
}

export function brokerEmailFromFileName(name: string | null | undefined): string | null {
  return brokerByFileName(name)?.email ?? null
}

/** The mailbox a broker's own-scope mail views read, by slug. */
export function brokerEmailFromSlug(slug: string | null | undefined): string | null {
  return brokerEmailFromFileName(fileNameFromBrokerSlug(slug))
}

export function fileDeadlineMatchesScope(input: {
  dealBrokerName: string | null | undefined
  assigneeEmail: string | null | undefined
  brokerScope: string | null | undefined
}): boolean {
  if (!input.brokerScope) return true
  const wantName = fileNameFromBrokerSlug(input.brokerScope)
  if (wantName && (input.dealBrokerName ?? '').trim().toLowerCase() === wantName.toLowerCase()) return true
  if (wantName) {
    const wantEmail = brokerEmailFromFileName(wantName)
    if (wantEmail && (input.assigneeEmail ?? '').trim().toLowerCase() === wantEmail.toLowerCase()) return true
  }
  return false
}

export function dealVisibleToBroker(input: {
  role: string
  brokerSlug: string | null | undefined
  dealBrokerName: string | null | undefined
}): boolean {
  if (input.role === 'superuser') return true
  const want = fileNameFromBrokerSlug(input.brokerSlug)
  if (!want) return false
  return (input.dealBrokerName ?? '').trim().toLowerCase() === want.toLowerCase()
}
