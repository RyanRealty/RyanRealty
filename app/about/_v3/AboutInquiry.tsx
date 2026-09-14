/**
 * One-line inquiry on /about. GET to /contact — not a second form.
 *
 * Mini 2026-09-14: shadcn Input as the control + catalog Button submit.
 * Not a labeled cream field and not a house outline Send rectangle.
 * Field `inquiry` is the same search param ContactAsk already reads.
 */

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { V3_ROOT_CLASS } from '@/components/site/v3'

export function AboutInquiry({ id = 'write' }: { id?: string } = {}) {
  return (
    <form
      id={id}
      className={cn(V3_ROOT_CLASS, 'about-inquiry')}
      action="/contact"
      method="get"
    >
      <div className="about-inquiry__row">
        <Input
          id="about-inquiry"
          name="inquiry"
          type="text"
          placeholder="Buying, selling, or a question"
          aria-label="How can we help"
          autoComplete="off"
        />
        <Button type="submit">Send a message</Button>
      </div>
    </form>
  )
}
