import { NextResponse } from 'next/server'

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

export const revalidate = 3600

export async function GET() {
  const body = `# Ryan Realty Central Oregon Real Estate

> Ryan Realty serves Central Oregon buyers and sellers with live listings, market reports, and neighborhood guidance.

## Listings
- Homes for sale: ${SITE_URL}/homes-for-sale
- Bend homes for sale: ${SITE_URL}/homes-for-sale/bend
- Redmond homes for sale: ${SITE_URL}/homes-for-sale/redmond
- Sisters homes for sale: ${SITE_URL}/homes-for-sale/sisters

## Price Drops
- Price Drop Radar (Central Oregon): ${SITE_URL}/price-drops
- Bend price drops: ${SITE_URL}/price-drops/bend
- Redmond price drops: ${SITE_URL}/price-drops/redmond
- Sisters price drops: ${SITE_URL}/price-drops/sisters

## Market Data
- Housing market hub: ${SITE_URL}/housing-market
- Market reports: ${SITE_URL}/reports
- Market explorer: ${SITE_URL}/reports/explore

## Local Areas
- Cities: ${SITE_URL}/cities
- Communities: ${SITE_URL}/communities
- Guides: ${SITE_URL}/guides

## Brokerage
- Team: ${SITE_URL}/team
- Contact: ${SITE_URL}/contact
`

  return new NextResponse(body, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=0, s-maxage=3600',
    },
  })
}
