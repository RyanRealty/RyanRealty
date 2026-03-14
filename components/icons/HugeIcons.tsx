'use client'

/**
 * Client-side wrappers around Hugeicons so server-component pages
 * can render them without adding 'use client' to the page itself.
 */

import { HugeiconsIcon } from '@hugeicons/react'
import {
  ArrowRight01Icon,
  Home01Icon,
  Location01Icon,
  CustomerSupportIcon,
  LinkSquare02Icon,
  BedIcon,
  Bathtub01Icon,
  ArrowExpandDiagonal01Icon,
  EarthIcon,
  Building01Icon,
  Calendar01Icon,
  Cancel01Icon,
} from '@hugeicons/core-free-icons'

type IconProps = { className?: string }

export function ArrowRightHugeIcon({ className = 'h-5 w-5' }: IconProps) {
  return <HugeiconsIcon icon={ArrowRight01Icon} className={className} />
}

export function HomeHugeIcon({ className = 'h-6 w-6' }: IconProps) {
  return <HugeiconsIcon icon={Home01Icon} className={className} />
}

export function LocationHugeIcon({ className = 'h-6 w-6' }: IconProps) {
  return <HugeiconsIcon icon={Location01Icon} className={className} />
}

export function SupportHugeIcon({ className = 'h-6 w-6' }: IconProps) {
  return <HugeiconsIcon icon={CustomerSupportIcon} className={className} />
}

export function ExternalLinkHugeIcon({ className = 'h-5 w-5' }: IconProps) {
  return <HugeiconsIcon icon={LinkSquare02Icon} className={className} />
}

export function BedHugeIcon({ className = 'h-5 w-5' }: IconProps) {
  return <HugeiconsIcon icon={BedIcon} className={className} />
}

export function BathHugeIcon({ className = 'h-5 w-5' }: IconProps) {
  return <HugeiconsIcon icon={Bathtub01Icon} className={className} />
}

export function ResizeHugeIcon({ className = 'h-5 w-5' }: IconProps) {
  return <HugeiconsIcon icon={ArrowExpandDiagonal01Icon} className={className} />
}

export function GlobeHugeIcon({ className = 'h-5 w-5' }: IconProps) {
  return <HugeiconsIcon icon={EarthIcon} className={className} />
}

export function BuildingHugeIcon({ className = 'h-5 w-5' }: IconProps) {
  return <HugeiconsIcon icon={Building01Icon} className={className} />
}

export function CalendarHugeIcon({ className = 'h-5 w-5' }: IconProps) {
  return <HugeiconsIcon icon={Calendar01Icon} className={className} />
}

export function CloseHugeIcon({ className = 'h-5 w-5' }: IconProps) {
  return <HugeiconsIcon icon={Cancel01Icon} className={className} />
}
