/**
 * The final ask: the ONE primary action repeated once (Matt, 2026-09-28). It is
 * a link to the hero's value flow (#get-value), and SellClickTracker moves focus
 * into the address field, so it is the same flow and the same submission, not a
 * second form. Call and text stay small text links. One door to the full market
 * report replaces the market sections that used to sit on this page.
 */
import Link from 'next/link'
import { V3_ROOT_CLASS, V3Heading } from '@/components/site/v3'
import { FORM_ANCHOR } from './sell-constants'

type Props = {
  label: string
  tel: string | null
  phoneDisplay: string | null
  brokerFirstName: string
}

export function SellFinalAsk({ label, tel, phoneDisplay, brokerFirstName }: Props) {
  return (
    <section id="talk" className={`${V3_ROOT_CLASS} sell-final`} aria-labelledby="talk-title">
      <V3Heading level={2} id="talk-title">
        Talk to us before you decide anything
      </V3Heading>
      <p className="sell-final__sub">
        Start with your address. No contract, no pressure.
      </p>
      <a
        className="v3-btn v3-btn--primary sell-final__cta"
        href={FORM_ANCHOR}
        data-sell-cta="final-ask"
      >
        {label}
      </a>
      {tel ? (
        <p className="sell-final__reach">
          Prefer the phone?{' '}
          <a href={`tel:${tel}`} data-sell-cta="final-call">
            Call
          </a>{' '}
          or{' '}
          <a href={`sms:${tel}`} data-sell-cta="final-text">
            text
          </a>{' '}
          {brokerFirstName}
          {phoneDisplay ? ` at ${phoneDisplay}` : ''}.
        </p>
      ) : null}
      <p className="sell-final__report">
        <Link href="/housing-market/bend" data-sell-cta="market-report">
          Read the full Bend market report
        </Link>
      </p>
    </section>
  )
}
