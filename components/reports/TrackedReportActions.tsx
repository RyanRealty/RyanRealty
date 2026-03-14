'use client'

import Link from 'next/link'
import { trackEvent } from '@/lib/tracking'

type Props = {
  geoName: string
  periodStart: string
}

export function TrackedReportDownloadLink({ geoName, periodStart, className, children }: Props & { className?: string; children: React.ReactNode }) {
  const href = `/api/pdf/report?geoName=${encodeURIComponent(geoName)}&period=${periodStart}`
  return (
    <a
      href={href}
      className={className}
      onClick={() => trackEvent('download_report', { geo_name: geoName, period: periodStart, context: 'report_geo_page' })}
    >
      {children}
    </a>
  )
}

export function TrackedReportExploreLink({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <Link
      href="/reports/explore"
      className={className}
      onClick={() => trackEvent('view_market_report', { context: 'report_explore_more' })}
    >
      {children}
    </Link>
  )
}

export function TrackedReportListingsLink({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <Link
      href="/listings"
      className={className}
      onClick={() => trackEvent('click_cta', { context: 'report_view_listings' })}
    >
      {children}
    </Link>
  )
}

export function TrackedReportValuationLink({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <Link
      href="/sell/valuation"
      className={className}
      onClick={() => trackEvent('valuation_requested', { context: 'report_page' })}
    >
      {children}
    </Link>
  )
}
