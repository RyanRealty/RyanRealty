/**
 * One-line inquiry on /about. GET to /contact — not a second form.
 *
 * G3 residual: the field is `inquiry`, the same search param ContactAsk
 * already reads as defaultInquiryType. Submit leaves this page.
 */

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { V3_ROOT_CLASS, V3Eyebrow } from '@/components/site/v3'
import { V3Input } from '@/components/site/v3/V3Input'

export function AboutInquiry() {
  return (
    <form
      id="write"
      className={cn(V3_ROOT_CLASS, 'about-inquiry')}
      action="/contact"
      method="get"
    >
      <V3Eyebrow>Send a message</V3Eyebrow>
      <div className="about-inquiry__row">
        <V3Input
          id="about-inquiry"
          name="inquiry"
          label="How can we help"
          placeholder="Buying, selling, or a question"
        />
        <Button type="submit">Send a message</Button>
      </div>
    </form>
  )
}
