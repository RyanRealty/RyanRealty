'use client'

import ShareButton from '@/components/ShareButton'

type Props = {
  brokerFirstName: string
  brokerName: string
  slug: string
  transactionCount: number
}

export default function BrokerShare({ brokerFirstName, brokerName, slug, transactionCount }: Props) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryanrealty.com'
  const url = `${siteUrl.replace(/\/$/, '')}/agents/${slug}`
  const title = `${brokerName} — Real Estate Agent | Ryan Realty`
  const text = transactionCount > 0
    ? `${brokerName} has helped with ${transactionCount} transactions. View profile.`
    : `${brokerName} — Real Estate Agent at Ryan Realty.`

  return (
    <section className="bg-white px-4 py-8 sm:px-6" aria-label="Share profile">
      <ShareButton
        title={title}
        text={text}
        url={url}
        aria-label={`Share ${brokerFirstName}'s profile`}
        variant="default"
        className="rounded-lg border-[var(--gray-border)] bg-[var(--gray-bg)] text-[var(--brand-navy)] hover:bg-[var(--gray-border)]"
      />
    </section>
  )
}
