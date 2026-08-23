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
