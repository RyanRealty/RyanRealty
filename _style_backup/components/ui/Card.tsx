'use client'

import { forwardRef, type HTMLAttributes } from 'react'

export type CardVariant = 'default' | 'featured' | 'compact'

const variantClasses: Record<CardVariant, string> = {
  default: 'rounded-[var(--radius-card)]',
  featured: 'rounded-[var(--radius-card)]',
  compact: 'rounded-[var(--radius-card)]',
}

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant
  /** When true, the whole card is clickable (cursor-pointer, role="button" if onClick). */
  asButton?: boolean
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className = '', variant = 'default', asButton = false, ...props }, ref) => {
    const base =
      'bg-white shadow-[0_1px_3px_rgba(0,0,0,0.1)] transition-shadow duration-200 ease-out hover:shadow-[0_4px_12px_rgba(0,0,0,0.15)] overflow-hidden'
    const combined = [
      base,
      variantClasses[variant],
      asButton ? 'cursor-pointer' : '',
      className,
    ]
      .filter(Boolean)
      .join(' ')
    return <div ref={ref} className={combined} {...props} />
  }
)

Card.displayName = 'Card'

/** Content area with 16px padding (photo section bleeds to edges). */
export function CardContent({
  className = '',
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={`p-4 ${className}`} {...props} />
}

export default Card
