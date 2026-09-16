/**
 * Bend office + firm OREA on About. Not a broker roster.
 *
 * Catalog Card demo: photo, header, body, footer door. Address and the firm
 * license live in the body once. The brokers live on /team.
 */

import Link from 'next/link'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { BRAND } from '@/lib/brand/contact'
import { FIRM_LICENSE } from './about-constants'
import { teamPath } from '@/lib/slug'

const OFFICE_EXTERIOR = '/images/office/ryan-realty-bend-office-exterior-01.jpg'

export function AboutOffice({ id = 'office' }: { id?: string } = {}) {
  const street = BRAND.address.street
  const cityLine = `${BRAND.address.city}, ${BRAND.address.region} ${BRAND.address.postalCode}`
  return (
    <section id={id} className="about-office" aria-labelledby="office-heading">
      <Card className="about-office__card">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={OFFICE_EXTERIOR} alt="" width={800} height={533} />
        <CardHeader>
          <CardTitle id="office-heading">Downtown Bend office</CardTitle>
          <CardDescription>Walk-in brokerage on Oregon Avenue.</CardDescription>
        </CardHeader>
        <CardContent>
          <p>
            {street}, {cityLine}. Firm OREA {FIRM_LICENSE}.
          </p>
        </CardContent>
        <CardFooter>
          <Button asChild>
            <Link href={teamPath()}>The brokers are on /team</Link>
          </Button>
        </CardFooter>
      </Card>
    </section>
  )
}
