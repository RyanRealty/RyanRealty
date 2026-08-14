import { cn } from '@/lib/utils'
import { Body, Price } from '@/components/site/primitives'
import type { ListingPricingReadRow } from '@/lib/data/pricing/reads'
import { CMA_DOCUMENT_TERMS, CMA_DOCUMENT_TERMS_VERSION } from '@/lib/data/cma/getPublishedCma'
import {
  PUBLIC_READ_DISCLAIMER,
  PUBLIC_READ_EYEBROW,
  PUBLIC_READ_TITLE,
  PUBLIC_READ_TITLE_REFUSE,
  PUBLIC_READ_TITLE_UNLISTED,
  evidenceLine,
  listedReadSentence,
  refuseCopy,
  unlistedReadSentence,
} from '@/lib/pricing/public-read-copy'
import { PublishedCmaDownload } from './PublishedCmaDownload.client'

type Props = {
  read: ListingPricingReadRow | null
  listPrice: number | null
  listingKey: string
  subjectAddress: string
  className?: string
}

export function LivePricingRead({ read, listPrice, listingKey, subjectAddress, className }: Props) {
  if (!read) return null
  if (read.kind === 'refuse') {
    const copy = read.refuseReason ? refuseCopy(read.refuseReason) : null
    if (!copy) return null
    return (
      <section className={cn('section', className)} data-testid="live-pricing-read">
        <div className="sec-head">
          <div>
            <div className="eyebrow sec-index">{PUBLIC_READ_EYEBROW}</div>
            <h2 className="sec-title display">{PUBLIC_READ_TITLE_REFUSE}</h2>
          </div>
        </div>
        <div className="mt-6 flex flex-col gap-7">
          <Body size="small">{copy}</Body>
          <PublishedCmaDownload
            listingKey={listingKey}
            subjectAddress={subjectAddress}
            terms={CMA_DOCUMENT_TERMS}
            termsVersion={CMA_DOCUMENT_TERMS_VERSION}
            mode="request"
          />
          <Body size="small" tone="muted">
            {PUBLIC_READ_DISCLAIMER}
          </Body>
        </div>
      </section>
    )
  }

  if (read.listPrice != null && listPrice != null && Math.round(read.listPrice) !== Math.round(listPrice)) {
    return null
  }
  if (read.rangeLow == null || read.rangeHigh == null) return null

  const title = read.kind === 'unlisted-range' ? PUBLIC_READ_TITLE_UNLISTED : PUBLIC_READ_TITLE
  const lead =
    read.kind === 'listed-over-under' && read.deltaPct != null
      ? listedReadSentence(read.n, read.deltaPct)
      : unlistedReadSentence(read.n)

  return (
    <section className={cn('section', className)} data-testid="live-pricing-read">
      <div className="sec-head">
        <div>
          <div className="eyebrow sec-index">{PUBLIC_READ_EYEBROW}</div>
          <h2 className="sec-title display">{title}</h2>
        </div>
      </div>
      <div className="mt-6 flex flex-col gap-7">
        <div>
          <div className="flex flex-wrap items-baseline gap-2.5 tabular-nums">
            <Price value={read.rangeLow} className="display text-3xl leading-none md:text-4xl" />
            <span className="display text-lg opacity-70 md:text-2xl">to</span>
            <Price value={read.rangeHigh} className="display text-3xl leading-none md:text-4xl" />
          </div>
          <Body size="small" className="mt-2">
            {lead}
          </Body>
        </div>
        <div>
          <h3 className="display mb-2.5 text-lg md:text-xl">How we got there</h3>
          <Body size="small">{evidenceLine(read.n)}</Body>
        </div>
        <PublishedCmaDownload
          listingKey={listingKey}
          subjectAddress={subjectAddress}
          terms={CMA_DOCUMENT_TERMS}
          termsVersion={CMA_DOCUMENT_TERMS_VERSION}
          mode="request"
        />
        <Body size="small" tone="muted">
          {PUBLIC_READ_DISCLAIMER} See our <a href="/terms">terms</a>.
        </Body>
      </div>
    </section>
  )
}

export default LivePricingRead
