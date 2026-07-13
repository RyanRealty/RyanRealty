'use client'

/**
 * Client-side wrappers around Hugeicons so server-component pages
 * can render them without adding 'use client' to the page itself.
 */

import { HugeiconsIcon } from '@hugeicons/react'
import {
  ArrowRight01Icon,
  LinkSquare02Icon,
} from '@hugeicons/core-free-icons'

type IconProps = { className?: string }

export function ArrowRightHugeIcon({ className = 'h-5 w-5' }: IconProps) {
  return <HugeiconsIcon icon={ArrowRight01Icon} className={className} />
}

export function ExternalLinkHugeIcon({ className = 'h-5 w-5' }: IconProps) {
  return <HugeiconsIcon icon={LinkSquare02Icon} className={className} />
}
