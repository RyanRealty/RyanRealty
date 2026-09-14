/**
 * One-line inquiry on /about. GET to /contact — not a second form.
 *
 * G3 residual: the field is `inquiry`, the same search param ContactAsk
 * already reads as defaultInquiryType. Submit leaves this page.
 *
 * SITE-90 2026-09-13: the shadcn Input demo "with button" —
 * ui.shadcn.com/docs/components/input — one bordered field and one button
 * beside it (V3Input → ui/input, the house V3Button as the demo's outline
 * button), the visible label the eyebrow above. Not a joined group: the
 * demo's two objects with a gap. The field face is raised (white) over the
 * cream page, as the demo's field sits on its background. The full form
 * stays on /contact.
 */

import { cn } from '@/lib/utils'
import { V3_ROOT_CLASS, V3Button, V3Eyebrow } from '@/components/site/v3'
import { V3Input } from '@/components/site/v3/V3Input'

export function AboutInquiry({ id = 'write' }: { id?: string } = {}) {
  return (
    <form
      id={id}
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
          placeholder="Send us a message: buying, selling, or a question"
          className="about-inquiry__field"
        />
        <V3Button type="submit" variant="ghost" className="about-inquiry__send">
          Send
        </V3Button>
      </div>
    </form>
  )
}
