/**
 * One-line inquiry on /about. GET to /contact — not a second form.
 *
 * Mini 2026-09-14: real shadcn Input + Label, navy/cream paint. Not a cream
 * pill and not a house V3 navy-rect button. G3 residual: the field is
 * `inquiry`, the same search param ContactAsk already reads as
 * defaultInquiryType. Submit leaves this page.
 */

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
        <div className="about-inquiry__field">
          <Label htmlFor="about-inquiry">How can we help</Label>
          <Input
            id="about-inquiry"
            name="inquiry"
            type="text"
            placeholder="Buying, selling, or a question"
            autoComplete="off"
          />
        </div>
        <Button type="submit" variant="outline">
          Send a message
        </Button>
      </div>
    </form>
  )
}
