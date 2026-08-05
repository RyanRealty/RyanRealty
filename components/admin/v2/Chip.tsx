'use client'

import './admin-v2.css'
import type { ButtonHTMLAttributes } from 'react'

export interface FilterChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  pressed: boolean
}

/** Filter chip — the only pill in the language (pills filter, chips label). */
export function FilterChip({ pressed, className, ...rest }: FilterChipProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      {...rest}
      className={['av2-chip', className ?? ''].filter(Boolean).join(' ')}
    />
  )
}
