'use client'

import { Badge } from '@/components/ui/badge'
import { getPropertyTypeLabel } from '@/lib/property-type'

type Props = {
  /** Raw PropertyType from DB (e.g. "Residential", "Condo/Townhouse"). */
  value: string | null | undefined
  className?: string
}

/** Badge showing property type using site-wide labels. Use on listings and in reports. */
export default function PropertyTypeBadge({ value, className = '' }: Props) {
  const label = getPropertyTypeLabel(value)
  return (
    <Badge variant="outline" className={className}>
      {label}
    </Badge>
  )
}
