/**
 * One-line inquiry on /about. GET to /contact — not a second form.
 *
 * Catalog Input + Button demo: flex row, gap-2, Input then submit Button.
 * Field `inquiry` is the same search param ContactAsk already reads.
 */

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function AboutInquiry({ id = 'write' }: { id?: string } = {}) {
  return (
    <section id={id} className="about-write" aria-labelledby="write-heading">
      <h2 id="write-heading" className="about-inquiry__heading">
        Send a message
      </h2>
      <p className="about-inquiry__hint">
        The full conversation continues on <a href="/contact">Contact</a>.
      </p>
      <form className="about-inquiry flex w-full items-center gap-2" action="/contact" method="get">
        <Input
          id="about-inquiry"
          name="inquiry"
          type="text"
          placeholder="Buying, selling, or a question"
          aria-label="How can we help"
          autoComplete="off"
        />
        <Button type="submit">Send a message</Button>
      </form>
    </section>
  )
}
