/**
 * Bend office + firm OREA on About. Not a broker roster.
 *
 * Catalog: shadcn Card demo — photo, body, facts chrome, footer door.
 * Mini 2026-09-14: not a cream title stack that restates the hero address.
 * The brokers live on /team.
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
import { cn } from '@/lib/utils'
import { V3_ROOT_CLASS } from '@/components/site/v3'
import { BRAND } from '@/lib/brand/contact'
import { FIRM_LICENSE } from './about-constants'
import { teamPath } from '@/lib/slug'

const OFFICE_EXTERIOR = '/images/office/ryan-realty-bend-office-exterior-01.jpg'

export function AboutOffice({ id = 'office' }: { id?: string } = {}) {
  const street = BRAND.address.street
  const cityLine = `${BRAND.address.city}, ${BRAND.address.region} ${BRAND.address.postalCode}`
  return (
    <section id={id} className={cn(V3_ROOT_CLASS, 'about-office')} aria-labelledby="office-heading">
      <Card className="about-office__card">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="about-office__photo"
          src={OFFICE_EXTERIOR}
          alt=""
          width={800}
          height={533}
        />
        <CardHeader>
          <CardTitle id="office-heading">Downtown Bend office</CardTitle>
          <CardDescription>The brokerage address on file.</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="about-office__facts">
            <div>
              <dt>Street</dt>
              <dd>{street}</dd>
            </div>
            <div>
              <dt>City</dt>
              <dd>{cityLine}</dd>
            </div>
            <div>
              <dt>Firm OREA</dt>
              <dd>{FIRM_LICENSE}</dd>
            </div>
          </dl>
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
