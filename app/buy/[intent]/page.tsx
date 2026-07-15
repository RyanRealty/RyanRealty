import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import LeadLandingPage from '@/components/landing/LeadLandingPage'
import { getBuyLanding } from '@/lib/lead-landing-content'
import { getSession } from '@/app/actions/auth'
import { getPersonIdFromCookie } from '@/app/actions/identity-bridge'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

type Props = {
  params: Promise<{ intent: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { intent } = await params
  const config = getBuyLanding(intent)
  if (!config) return { title: 'Page Not Found' }
  return {
    title: config.seoTitle,
    description: config.seoDescription,
    alternates: { canonical: `${siteUrl}${config.path}` },
    openGraph: {
      title: config.seoTitle,
      description: config.seoDescription,
      url: `${siteUrl}${config.path}`,
      siteName: 'Ryan Realty',
      type: 'website',
      images: [{ url: config.heroImageUrl, width: 1200, height: 630, alt: config.imageAlt }],
    },
    twitter: {
      card: 'summary_large_image',
      title: config.seoTitle,
      description: config.seoDescription,
      images: [config.heroImageUrl],
    },
  }
}

export default async function BuyLeadIntentPage({ params }: Props) {
  const { intent } = await params
  const config = getBuyLanding(intent)
  if (!config) notFound()

  // Session + identity-bridge reads kept (they pin this route's dynamic
  // rendering mode); the FUB page-view mirror they fed was deleted with the
  // FUB decommission — first-party visitor_sessions covers page views now.
  await Promise.all([getSession(), getPersonIdFromCookie()])

  return <LeadLandingPage config={config} />
}
