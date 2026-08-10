/**
 * Mid-page free listing_alerts capture for regional SFR (Central Oregon).
 * Same product as homepage / buy / cities index — not an LP hop.
 * LP stays optional secondary text for ad landing URLs.
 */
import { KbCommunityAlerts } from '@/components/site/kb/KbCommunityAlerts.client'

type Props = {
  /** Anchor id for hero chips (e.g. get-alerts). Default get-alerts. */
  id?: string
  /** Show quiet LP secondary link under the form. */
  showLpSecondary?: boolean
  /** Optional second quiet link (e.g. contact). */
  secondaryExtra?: { href: string; label: string }
}

export function RegionalSfrAlertsBand({
  id = 'get-alerts',
  showLpSecondary = true,
  secondaryExtra,
}: Props) {
  return (
    <>
      <div id={id}>
        <KbCommunityAlerts
          communityName="Central Oregon"
          city=""
          extraFilters={{ propertyType: 'A' }}
          headline="Central Oregon"
          body="Enter your email. When a single-family home hits the market in Bend, Redmond, Sisters, Sunriver, or nearby, you hear first."
        />
      </div>
      {showLpSecondary || secondaryExtra ? (
        <p
          className="wrap"
          style={{
            textAlign: 'center',
            margin: 0,
            padding: '0 0 clamp(28px,4vw,40px)',
            fontSize: '0.875rem',
            fontWeight: 500,
            color: 'var(--navy-70)',
          }}
        >
          {showLpSecondary ? (
            <a
              href="/lp/buyer-listing-alerts"
              className="underline underline-offset-2 hover:text-foreground"
            >
              Prefer a longer form
            </a>
          ) : null}
          {showLpSecondary && secondaryExtra ? ' · ' : null}
          {secondaryExtra ? (
            <a
              href={secondaryExtra.href}
              className="underline underline-offset-2 hover:text-foreground"
            >
              {secondaryExtra.label}
            </a>
          ) : null}
        </p>
      ) : null}
    </>
  )
}
