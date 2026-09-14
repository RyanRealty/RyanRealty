/**
 * Bend office + firm OREA on About. Not a broker roster.
 *
 * Catalog: shadcn Card (header, title, description, content). Navy/cream
 * paint only. The brokers live on /team.
 */

import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { V3_ROOT_CLASS } from '@/components/site/v3'
import { BRAND } from '@/lib/brand/contact'
import { FIRM_LICENSE } from './about-constants'
import { teamPath } from '@/lib/slug'

export function AboutOffice({ id = 'office' }: { id?: string } = {}) {
  const street = BRAND.address.street
  const cityLine = `${BRAND.address.city}, ${BRAND.address.region} ${BRAND.address.postalCode}`
  return (
    <section id={id} className={cn(V3_ROOT_CLASS, 'about-office')} aria-labelledby="office-heading">
      <Card className="about-office__card">
        <CardHeader>
          <CardTitle id="office-heading">Bend office 115 NW Oregon Ave #2.</CardTitle>
          <CardDescription>
            {street}, {cityLine}. Firm OREA license {FIRM_LICENSE}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="about-office__license">Firm OREA license {FIRM_LICENSE}.</p>
          <Button asChild variant="link">
            <Link href={teamPath()}>The brokers are on /team</Link>
          </Button>
        </CardContent>
      </Card>
    </section>
  )
}
