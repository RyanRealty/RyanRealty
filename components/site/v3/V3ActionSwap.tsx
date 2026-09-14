'use client'

/**
 * v3 ACTION SWAP — label change is motion, not a restyle.
 *
 * Adapted from beUI action-swap (blur). Used on listing Save / Share so
 * Save→Saved and Share→Shared are the same interaction as the catalog demo,
 * painted with house tokens via V3Button. Not a second kit.
 */
import { ActionSwapText } from '@/components/motion/action-swap'
import { cn } from '@/lib/utils'

export type V3ActionSwapTextProps = {
  value: string
  children: string
  className?: string
}

export function V3ActionSwapText({ value, children, className }: V3ActionSwapTextProps) {
  return (
    <ActionSwapText value={value} animation="blur" className={cn('v3-action-swap', className)}>
      {children}
    </ActionSwapText>
  )
}
