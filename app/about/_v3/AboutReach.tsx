/**
 * Equal four-up reach on About. Catalog Button Group, not editorial doors.
 *
 * Official demo chrome: one ButtonGroup, four outline Buttons, same weight.
 * Call | Text | Email | Schedule. Live hours stay V3OnDuty above this.
 */

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ButtonGroup } from '@/components/ui/button-group'
import { CONTACT } from '@/lib/brand/contact'

export function AboutReach({ id = 'reach' }: { id?: string } = {}) {
  return (
    <section id={id} className="about-reach" aria-label="Reach a broker">
      <ButtonGroup className="w-full" aria-label="Call, text, email, or schedule">
        <Button asChild variant="outline" className="flex-1">
          <a href={`tel:${CONTACT.phoneDirectTel}`}>Call</a>
        </Button>
        <Button asChild variant="outline" className="flex-1">
          <a href={`sms:${CONTACT.phoneDirectTel}`}>Text</a>
        </Button>
        <Button asChild variant="outline" className="flex-1">
          <a href={`mailto:${CONTACT.email.primary}`}>Email</a>
        </Button>
        <Button asChild variant="outline" className="flex-1">
          <Link href="/book">Schedule</Link>
        </Button>
      </ButtonGroup>
    </section>
  )
}
