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
 *   (a) Listing brokerage attribution — "Listing courtesy of <Listing Office>"
 *       or the listing agent name when no office is available. ODS Section 5-3
 *       mandates that the listing firm be identified in a reasonably prominent
 *       location (per NAR Handbook on MLS Policy §7.58, which ODS incorporates).
 *   (b) Data source line — identifies Oregon Data Share as the data provider.
 *       ODS requires the ODS logo on all IDX displays per the Data Licensing
 *       Agreement and oregondatashare.com/datafeeds logo policy.
 *   (c) Standard IDX reliability disclaimer — "Based on information from Oregon
 *       Data Share. All information provided is deemed reliable but is not
 *       guaranteed and should be independently verified."
 *
 * The component is intentionally minimal. It omits fields rather than
 * fabricating values. If both listAgentName and listOfficeName are null
 * the courtesy line is omitted and only the ODS logo + disclaimer render.
 *
 * Design token compliance:
 *   - No raw hex colors in JSX className (design tokens only).
 *   - No arbitrary tracking or text-size utilities.
 *   - shadcn Separator for the horizontal rule.
 *   - primitives Caption / Body / Stack for text.
 */

type Props = {
  /** Listing agent full name from MLS data. */
  listAgentName: string | null
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
  listAgentName,
  listOfficeName,
  refreshedAt,
  className,
}: Props) {
  const courtesyLine = listOfficeName ?? listAgentName ?? null
  const refreshedFormatted = formatRefreshedAt(refreshedAt)

  return (
    <div className={className}>
      <Separator className="mb-4" />
      <Stack gap="tight">
        {/* (a) Listing brokerage courtesy — ODS Section 5-3 */}
        {courtesyLine ? (
          <Body size="small" tone="muted">
            Listing courtesy of{' '}
            <span className="text-foreground font-medium">{courtesyLine}</span>
            {listOfficeName && listAgentName ? (
              <>, agent {listAgentName}</>
            ) : null}
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
