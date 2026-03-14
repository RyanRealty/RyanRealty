'use client'

import ShareButton from '@/components/ShareButton'

type Props = {
  brokerFirstName: string
  brokerName: string
  slug: string
  transactionCount: number
  /** Base path for share URL (e.g. 'agents' or 'team'). Default 'agents'. */
  basePath?: 'agents' | 'team'
}

export default function BrokerShare({ brokerFirstName, brokerName, slug, transactionCount, basePath = 'agents' }: Props) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com'
  const path = basePath === 'team' ? `/team/${slug}` : `/agents/${slug}`
  const url = `${siteUrl.replace(/\/$/, '')}${path}`
  const title = `${brokerName} — Real Estate Agent | Ryan Realty`
  const text = transactionCount > 0
    ? `${brokerName} has helped with ${transactionCount} transactions. View profile.`
    : `${brokerName} — Real Estate Agent at Ryan Realty.`

  return (
    <section className="bg-card px-4 py-8 sm:px-6" aria-label="Share profile">
      <ShareButton
        title={title}
        text={text}
        url={url}
        aria-label={`Share ${brokerFirstName}'s profile`}
        variant="default"
        trackContext="broker_profile"
        className="rounded-lg border-border bg-muted text-primary hover:bg-border"
      />
    </section>
  )
}
