import type { ButtonHTMLAttributes, ReactNode } from 'react'
import Link from 'next/link'

type Variant = 'primary' | 'secondary' | 'ghost'

type Common = {
  variant?: Variant
  children: ReactNode
  className?: string
}

type AsButton = Common &
  ButtonHTMLAttributes<HTMLButtonElement> & {
    href?: undefined
  }

type AsLink = Common & {
  href: string
  type?: undefined
  disabled?: boolean
}

export type V2ButtonProps = AsButton | AsLink

/**
 * Public v2 button. Convention: at most one `primary` per viewport.
 */
export function V2Button(props: V2ButtonProps) {
  const variant = props.variant ?? 'primary'
  const className = ['p2-btn', `p2-btn--${variant}`, props.className].filter(Boolean).join(' ')

  if (props.href) {
    const { href, children, disabled } = props
    if (disabled) {
      return (
        <span className={className} aria-disabled="true">
          {children}
        </span>
      )
    }
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    )
  }

  const { children, type = 'button', ...rest } = props
  return (
    <button type={type} className={className} {...rest}>
      {children}
    </button>
  )
}
