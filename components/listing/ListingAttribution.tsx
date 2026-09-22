import Image from 'next/image'
import { Separator } from '@/components/ui/separator'
import { Body, Caption, Stack } from '@/components/site/primitives'

/**
 * ListingAttribution — IDX compliance block for every listing detail page.
 *
 * Oregon Data Share (ODS/ORMLS) IDX Display Requirements
 * Source: ODS Rules and Regulations (April 2024), Section 5-3 (IDX Policy),
 * and oregondatashare.com/datafeeds logo + disclaimer requirements.
 *
 * Required elements on each IDX listing detail page:
 *   (a) Listing brokerage attribution — "Listing courtesy of <Listing Office>".
 *       The line is the brokerage name. Another listing broker's phone, email,
 *       and name stay off this page (Matt 2026-09-22). ODS §5-3 still requires
 *       the listing firm in a reasonably prominent location.
 *   (b) Data source line — identifies Oregon Data Share as the data provider.
 *       ODS requires the ODS logo on all IDX displays per the Data Licensing
 *       Agreement and oregondatashare.com/datafeeds logo policy.
 *   (c) Standard IDX reliability disclaimer — "Based on information from Oregon
 *       Data Share. All information provided is deemed reliable but is not
 *       guaranteed and should be independently verified."
 *
 * The component is intentionally minimal. It omits fields rather than
 * fabricating values. If the brokerage name is missing, the courtesy line
 * is omitted and only the ODS logo + disclaimer render.
 *
 * Design token compliance:
 *   - No raw hex colors in JSX className (design tokens only).
 *   - No arbitrary tracking or text-size utilities.
 *   - shadcn Separator for the horizontal rule.
 *   - primitives Caption / Body / Stack for text.
 */

type Props = {
  /** Listing office / brokerage name from MLS data. */
  listOfficeName: string | null
  /**
   * ISO timestamp when this listing was last refreshed from the MLS feed.
   * Renders as "Data last updated <date>" for ODS transparency.
   */
  refreshedAt: string | null
  className?: string
}

function formatRefreshedAt(iso: string | null): string | null {
  if (!iso) return null
  try {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return null
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  } catch {
    return null
  }
}

export function ListingAttribution({
  listOfficeName,
  refreshedAt,
  className,
}: Props) {
  const courtesyLine = listOfficeName?.trim() || null
  const refreshedFormatted = formatRefreshedAt(refreshedAt)

  return (
    <div className={className}>
      <Separator className="mb-4" />
      <Stack gap="tight">
        {/* (a) Listing brokerage name. No other broker's phone. */}
        {courtesyLine ? (
          <Body size="small" tone="muted">
            Listing courtesy of{' '}
            <span className="text-foreground font-medium">{courtesyLine}</span>
          </Body>
        ) : null}

        {/* (b) ODS logo + data source — oregondatashare.com/datafeeds logo policy */}
        <div className="flex items-center gap-2">
          <Image
            src="/images/oregon-data-share-logo.svg"
            alt="Oregon Data Share"
            width={120}
            height={28}
            className="shrink-0"
            unoptimized
          />
          {refreshedFormatted ? (
            <Caption tone="muted">Data last updated {refreshedFormatted}</Caption>
          ) : null}
        </div>

        {/* (c) Required IDX reliability disclaimer */}
        <Caption tone="muted" className="max-w-prose">
          Based on information from Oregon Data Share. All information provided is deemed reliable
          but is not guaranteed and should be independently verified. Listing information is for
          consumers personal, non-commercial use only.
        </Caption>
      </Stack>
    </div>
  )
}
