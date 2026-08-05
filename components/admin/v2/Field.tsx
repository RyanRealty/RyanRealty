import './admin-v2.css'
import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { useId } from 'react'

interface FieldShellProps {
  label: string
  hint?: string
  error?: string
  children: (ids: { inputId: string; describedBy?: string }) => React.ReactNode
}

/** Pattern 6 — config form field: label above, single column, inline validation. */
function FieldShell({ label, hint, error, children }: FieldShellProps) {
  const inputId = useId()
  const hintId = useId()
  const errorId = useId()
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined
  return (
    <div className="av2-field">
      <label className="av2-field__label" htmlFor={inputId}>
        {label}
      </label>
      {hint ? (
        <span className="av2-field__hint" id={hintId}>
          {hint}
        </span>
      ) : null}
      {children({ inputId, describedBy })}
      {error ? (
        <span className="av2-field__error" id={errorId}>
          {error}
        </span>
      ) : null}
    </div>
  )
}

type BaseProps = { label: string; hint?: string; error?: string }

export function TextField({ label, hint, error, ...rest }: BaseProps & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <FieldShell label={label} hint={hint} error={error}>
      {({ inputId, describedBy }) => (
        <input
          id={inputId}
          className="av2-input"
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...rest}
        />
      )}
    </FieldShell>
  )
}

export function TextAreaField({
  label,
  hint,
  error,
  ...rest
}: BaseProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <FieldShell label={label} hint={hint} error={error}>
      {({ inputId, describedBy }) => (
        <textarea
          id={inputId}
          className="av2-input"
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...rest}
        />
      )}
    </FieldShell>
  )
}

export function SelectField({
  label,
  hint,
  error,
  children,
  ...rest
}: BaseProps & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <FieldShell label={label} hint={hint} error={error}>
      {({ inputId, describedBy }) => (
        <select
          id={inputId}
          className="av2-input"
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...rest}
        >
          {children}
        </select>
      )}
    </FieldShell>
  )
}
