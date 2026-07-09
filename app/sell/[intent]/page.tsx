import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import LeadLandingPage from '@/components/landing/LeadLandingPage'
import { getSellLanding } from '@/lib/lead-landing-content'
import { getSession } from '@/app/actions/auth'
import { getPersonIdFromCookie } from '@/app/actions/identity-bridge'
import { trackPageViewIfPossible } from '@/lib/followupboss'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

type Props = {
  params: Promise<{ intent: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { intent } = await params
  const config = getSellLanding(intent)
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

export default async function SellLeadIntentPage({ params }: Props) {
  const { intent } = await params
  const config = getSellLanding(intent)
  if (!config) notFound()

  const [session, fubPersonId] = await Promise.all([getSession(), getPersonIdFromCookie()])
  trackPageViewIfPossible({
    sessionUser: session?.user ?? undefined,
    fubPersonId,
    pageUrl: `${siteUrl}${config.path}`,
    pageTitle: config.seoTitle,
  })

  return <LeadLandingPage config={config} />
}
