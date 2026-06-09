// @no-parity — utility calculator tool, no mockup contract (same as /tools/mortgage-calculator)
// @data-free — pure client-side calculator, fetches no data (rent/MLS pre-fill is a future enhancement)
import type { Metadata } from 'next'
import Link from 'next/link'
import RentalCalculator from '@/components/tools/RentalCalculator'
import ContentPageHero from '@/components/layout/ContentPageHero'
import { BreadcrumbNav } from '@/components/site/BreadcrumbNav'
import { Container, H2, Body } from '@/components/site/primitives'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
const ogImage = `${siteUrl}/api/og?type=default`

export const metadata: Metadata = {
  title: 'Rental Property Calculator',
  description:
    'Run the numbers on any rental in Bend and Central Oregon. See monthly cash flow, cap rate, cash-on-cash return, and a long-term projection.',
  alternates: { canonical: `${siteUrl}/tools/rental-property-calculator` },
  openGraph: {
    title: 'Rental Property Calculator | Ryan Realty',
    description:
      'See monthly cash flow, cap rate, cash-on-cash return, and a long-term projection for any rental property.',
    url: `${siteUrl}/tools/rental-property-calculator`,
    type: 'website',
    images: [{ url: ogImage, width: 1200, height: 630 }],
  },
  twitter: { card: 'summary_large_image', images: [ogImage] },
}

type Props = {
  searchParams: Promise<{
    price?: string
    rent?: string
    taxes?: string
    down?: string
    rate?: string
  }>
}

export default async function RentalPropertyCalculatorPage({ searchParams }: Props) {
  const sp = await searchParams
  const initialPrice = sp.price ? parseInt(sp.price, 10) : undefined
  const initialRent = sp.rent ? parseInt(sp.rent, 10) : undefined
  const initialPropertyTaxesYear = sp.taxes ? parseInt(sp.taxes, 10) : undefined
  const initialDownPaymentPct = sp.down != null ? parseInt(sp.down, 10) : undefined
  const initialInterestRate = sp.rate != null ? parseFloat(sp.rate) : undefined

  return (
    <main className="min-h-screen bg-background">
      <Container className="pt-3 pb-1">
        <BreadcrumbNav items={[{ label: 'Home', href: '/' }, { label: 'Rental property calculator' }]} />
      </Container>
      <ContentPageHero
        title="Rental Property Calculator"
        subtitle="Run the numbers on any rental. Adjust price, financing, rent, and expenses to see monthly cash flow, cap rate, cash-on-cash return, and how equity builds over time."
        imageUrl="/images/hero/hero-old-mill-master-4k.jpg"
        ctas={[
          { label: 'Browse Homes for Sale', href: '/homes-for-sale', primary: true },
          { label: 'Talk to an Agent', href: '/contact', primary: false },
        ]}
      />
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 space-y-8">
        <RentalCalculator
          initialPrice={initialPrice}
          initialRent={initialRent}
          initialPropertyTaxesYear={initialPropertyTaxesYear}
          initialDownPaymentPct={initialDownPaymentPct}
          initialInterestRate={initialInterestRate}
        />
        <Card>
          <CardContent className="pt-6 space-y-4">
            <H2 as="h2">How to use this calculator</H2>
            <Body>
              Start with the purchase price and the rent you expect to collect. Set your down payment, interest
              rate, and loan term to match the financing you plan to use. The operating-expense fields carry
              editable defaults for Central Oregon, property taxes near 0.75 percent of price, management at 8
              percent of rent, and reserves for maintenance and capital repairs. Adjust each one to fit the
              property.
            </Body>
            <Body>
              The results panel updates as you type. Cash flow is what is left each month after the mortgage,
              taxes, insurance, management, and reserves. Cap rate measures yield independent of financing.
              Cash-on-cash compares your annual cash flow to the cash you put in. Open the 30-year projection to
              see how rent, value, and equity grow over time.
            </Body>
            <Body>
              These figures are estimates, not investment advice or a guarantee of rent, value, or return. When
              you find a property worth a closer look, a Ryan Realty broker can pull real rent comps and help you
              underwrite it.
            </Body>
            <Button asChild variant="outline">
              <Link href="/contact">Talk to a Ryan Realty broker</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
