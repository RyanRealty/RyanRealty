/**
 * FSBO and expired leaves: same shop as /sell. Stage + address + Value my home,
 * then 3% plan, proof, our listings, questions.
 */
import type { ReactNode } from 'react'
import {
  V3_ROOT_CLASS,
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3Stage,
  V3SectionTracker,
} from '@/components/site/v3'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import type { SchemaInput } from '@/lib/site/json-ld'
import { SellCapture } from './SellCapture'
import { SellValueForm } from './SellValueForm'
import { SellShop } from './SellShop'
import { SELL_STAGE_EYEBROW } from './sell-constants'
import './sell-stage.css'
import type { V3LedgerFigureRow, V3ProofQuote, V3QuietItem } from '@/components/site/v3'

type Props = {
  path: string
  headline: string
  posterSrc: string
  listingRows: readonly V3LedgerFigureRow[]
  quietItems: V3QuietItem[]
  reviewQuotes: readonly V3ProofQuote[]
  reviewCount: number
  reviewAverage: number
  newestReview: string | null
  schemas: SchemaInput[]
  children?: ReactNode
}

export function SellLeafView({
  path,
  headline,
  posterSrc,
  listingRows,
  quietItems,
  reviewQuotes,
  reviewCount,
  reviewAverage,
  newestReview,
  schemas,
  children,
}: Props) {
  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <V3SectionTracker />
        <MetadataBlock schemas={schemas} />
        {children}
        <V3Stage
          headingLevel={1}
          height="tall"
          className="sell-stage-poster"
          eyebrow={SELL_STAGE_EYEBROW}
          headline={headline}
          posterSrc={posterSrc}
          action={{ label: 'Value my home', href: '#get-value', variant: 'ghost' }}
        >
          <SellCapture eyebrow="Free. No listing agreement." placement="stage">
            <SellValueForm pagePath={path} />
          </SellCapture>
        </V3Stage>
        <SellShop
          reviewQuotes={reviewQuotes}
          reviewCount={reviewCount}
          reviewAverage={reviewAverage}
          newestReview={newestReview}
          listingRows={listingRows}
          quietItems={quietItems}
        />
      </main>
      <V3Footer columns={V3_FOOTER_COLUMNS} />
    </>
  )
}
