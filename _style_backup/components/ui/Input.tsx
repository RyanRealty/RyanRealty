'use client'

import { forwardRef, useState, useId, type InputHTMLAttributes } from 'react'

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'placeholder'> {
  label: string
  error?: string
  /** When true, show green check next to field. */
  valid?: boolean
  /** Optional placeholder when floating label is shown (e.g. hint). */
  placeholder?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      id: idProp,
      label,
      error,
      valid = false,
      className = '',
      value,
      defaultValue,
      onFocus,
      onBlur,
      ...props
    },
    ref
  ) => {
    const generatedId = useId()
    const id = idProp ?? generatedId
    const [focused, setFocused] = useState(false)
    const raw = value ?? defaultValue ?? ''
    const filled = typeof raw === 'string' ? raw.length > 0 : raw !== undefined && raw !== null
    const floatLabel = focused || filled

    return (
      <div className="relative">
        <input
          ref={ref}
          id={id}
          value={value}
          defaultValue={defaultValue}
          onFocus={(e) => {
            setFocused(true)
            onFocus?.(e)
          }}
          onBlur={(e) => {
            setFocused(false)
            onBlur?.(e)
          }}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          className={[
            'w-full rounded-[6px] border bg-white px-3 pt-5 pb-2 text-[var(--gray-dark)] outline-none transition-colors duration-200',
            'min-h-[44px] sm:min-h-[48px]',
            error
              ? 'border-[var(--urgent)] focus:ring-2 focus:ring-[var(--urgent)] focus:ring-offset-0'
              : 'border-[var(--gray-border)] focus:border-[var(--color-cta)] focus:ring-2 focus:ring-[var(--color-cta)] focus:ring-offset-0',
            className,
          ].join(' ')}
          placeholder={floatLabel ? undefined : label}
          {...props}
        />
        <label
          htmlFor={id}
          className={[
            'pointer-events-none absolute left-3 transition-all duration-200 ease-out',
            floatLabel
              ? 'top-1.5 text-xs font-medium text-[var(--gray-secondary)]'
              : 'top-1/2 -translate-y-1/2 text-base text-[var(--gray-muted)]',
          ].join(' ')}
        >
          {label}
        </label>
        {valid && !error && (
          <span
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--success)]"
            aria-hidden
          >
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
          </span>
        )}
        {error && (
          <p id={`${id}-error`} className="mt-1 text-sm text-[var(--urgent)]" role="alert">
            {error}
          </p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'

export default Input
