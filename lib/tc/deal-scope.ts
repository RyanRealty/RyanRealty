/**
 * Per-broker deal visibility (tc-builder rung 16).
 * Superuser sees every file. A broker sees files where tc_deals.broker_name
 * is their brokerage identity. Unmapped brokers see nothing (fail closed).
 */
export const BROKER_FILE_NAME: Record<string, string> = {
  matt: 'Matt Ryan',
  paul: 'Paul Stevenson',
  rebecca: 'Rebecca Peterson',
}

export const BROKER_FILE_EMAIL: Record<string, string> = {
  'Matt Ryan': 'matt@ryan-realty.com',
  'Paul Stevenson': 'paul@ryan-realty.com',
  'Rebecca Peterson': 'rebeccapeterson@ryan-realty.com',
}

export function fileNameFromBrokerSlug(slug: string | null | undefined): string | null {
  const key = (slug ?? '').trim().toLowerCase()
  if (!key) return null
  return BROKER_FILE_NAME[key] ?? null
}

export function brokerEmailFromFileName(name: string | null | undefined): string | null {
  const n = (name ?? '').trim().toLowerCase()
  if (!n) return null
  for (const [fileName, email] of Object.entries(BROKER_FILE_EMAIL)) {
    if (fileName.toLowerCase() === n) return email
  }
  return null
}

export function dealVisibleToBroker(input: {
  role: string
  brokerSlug: string | null | undefined
  dealBrokerName: string | null | undefined
}): boolean {
  if (input.role === 'superuser') return true
  const slug = (input.brokerSlug ?? '').trim().toLowerCase()
  if (!slug) return false
  const want = BROKER_FILE_NAME[slug]
  if (!want) return false
  return (input.dealBrokerName ?? '').trim().toLowerCase() === want.toLowerCase()
}
