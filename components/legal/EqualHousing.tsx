/**
 * Equal Housing Opportunity logo/text. Footer on every page and in email templates.
 * Use size="large" on Fair Housing page.
 */

export interface EqualHousingProps {
  size?: 'small' | 'large'
  className?: string
}

const LOGO_SVG = (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    className="inline-block"
    aria-hidden
  >
    <path d="M12 2L2 7v10h2v-8.5l8 4.5 8-4.5V17h2V7L12 2zm0 11l-6-3.5v7l6 3.5 6-3.5v-7L12 13z" />
  </svg>
)

export default function EqualHousing({ size = 'small', className = '' }: EqualHousingProps) {
  const isLarge = size === 'large'
  return (
    <span
      className={className}
      title="Equal Housing Opportunity"
    >
      {isLarge ? (
        <span className="inline-flex items-center gap-2 text-base font-medium">
          <span className="text-[1.5em]" aria-hidden>{LOGO_SVG}</span>
          Equal Housing Opportunity
        </span>
      ) : (
        <span className="inline-flex items-center gap-1.5 text-xs">
          <span className="text-[1em]" aria-hidden>{LOGO_SVG}</span>
          Equal Housing Opportunity
        </span>
      )}
    </span>
  )
}
