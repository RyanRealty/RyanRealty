'use client'

import { forwardRef, type ButtonHTMLAttributes } from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost'
export type ButtonSize = 'sm' | 'md' | 'lg'

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-[var(--color-cta)] text-[var(--color-primary)] hover:shadow-[var(--shadow-medium)] active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none',
  secondary:
    'bg-[var(--color-primary)] text-white hover:shadow-[var(--shadow-medium)] active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none',
  outline:
    'border-2 border-[var(--color-primary)] text-[var(--color-primary)] bg-transparent hover:bg-[var(--color-primary)] hover:text-white hover:shadow-[var(--shadow-medium)] active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none',
  ghost:
    'bg-transparent text-[var(--color-primary)] hover:bg-[var(--gray-bg)] active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-9 min-h-[44px] sm:min-h-[44px] px-3 text-sm',
  md: 'h-11 min-h-[44px] sm:min-h-[48px] px-5 text-base',
  lg: 'h-14 min-h-[48px] px-7 text-base',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className = '',
      variant = 'primary',
      size = 'md',
      loading = false,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        type="button"
        disabled={disabled ?? loading}
        className={[
          'inline-flex items-center justify-center gap-2 rounded-[var(--radius-sm)] font-semibold transition-all duration-200 ease-out',
          variantClasses[variant],
          sizeClasses[size],
          className,
        ].join(' ')}
        {...props}
      >
        {loading ? (
          <>
            <span
              className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
              aria-hidden
            />
            <span className="sr-only">Loading</span>
          </>
        ) : (
          children
        )}
      </button>
    )
  }
)

Button.displayName = 'Button'

export default Button
