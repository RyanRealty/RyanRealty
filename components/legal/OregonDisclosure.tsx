/**
 * Oregon real estate agency disclosure and brokerage licensing.
 * Display in footer or on about/contact pages.
 */

export interface OregonDisclosureProps {
  /** Broker license number (e.g. from brokerage settings) */
  licenseNumber?: string | null
  /** Brokerage name */
  brokerageName?: string
  className?: string
}

export default function OregonDisclosure({
  licenseNumber,
  brokerageName = 'Ryan Realty',
  className = '',
}: OregonDisclosureProps) {
  return (
    <div className={`text-xs text-muted-foreground ${className}`}>
      <p>
        {brokerageName} is licensed in the State of Oregon.
        {licenseNumber?.trim() && (
          <span> License # {licenseNumber.trim()}.</span>
        )}
      </p>
      <p className="mt-1">
        This is not intended as a solicitation of listings currently under contract with another broker.
      </p>
    </div>
  )
}
