import './admin-v2.css'
import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { forwardRef, useId } from 'react'

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

/** forwardRef so a caller can focus the field — see the note on Button. */
export const TextField = forwardRef<
  HTMLInputElement,
  BaseProps & InputHTMLAttributes<HTMLInputElement>
>(function TextField({ label, hint, error, ...rest }, ref) {
  return (
    <FieldShell label={label} hint={hint} error={error}>
      {({ inputId, describedBy }) => (
        <input
          ref={ref}
          id={inputId}
          className="av2-input"
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...rest}
        />
      )}
    </FieldShell>
  )
})

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

/**
 * Toolbar variants (11F). Pattern 6's labelled fields are for config forms;
 * report toolbars need the same controls compact and label-free. The primitive
 * owns the raw element (ci:admin-ui rule A) and the aria-label is REQUIRED —
 * dropping the visible label never drops the accessible one.
 */
export function ToolbarSelect({
  'aria-label': ariaLabel,
  children,
  className,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { 'aria-label': string }) {
  return (
    <select className={['av2-input', 'av2-input--bar', className ?? ''].filter(Boolean).join(' ')} aria-label={ariaLabel} {...rest}>
      {children}
    </select>
  )
}

/** Inline checkbox + caption for toolbars (the label element wraps the input). */
export function ToolbarCheck({
  label,
  labelStyle,
  ...rest
}: {
  label: React.ReactNode
  /** Style for the wrapping <label> itself (e.g. dimming a disabled row). */
  labelStyle?: React.CSSProperties
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  return (
    <label className="av2-check" style={labelStyle}>
      <input type="checkbox" {...rest} />
      {label}
    </label>
  )
}

/** Inline radio + caption for hand-built radio groups (mirrors ToolbarCheck —
 *  the v2 barrel has no Radio primitive yet; native radios styled with the
 *  same `av2-check` token class). */
export function ToolbarRadio({
  label,
  labelStyle,
  ...rest
}: {
  label: React.ReactNode
  /** Style for the wrapping <label> itself (e.g. a disabled option's cursor). */
  labelStyle?: React.CSSProperties
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  return (
    <label className="av2-check" style={labelStyle}>
      <input type="radio" {...rest} />
      {label}
    </label>
  )
}

/**
 * SearchField — an unlabelled input for a toolbar or a list header (11F).
 *
 * The labelled TextField is pattern 6's config-form control; a search box in a
 * thread list has no room for a label above it. `aria-label` is REQUIRED in the
 * type for the same reason ToolbarSelect requires one: dropping the visible
 * label must never drop the accessible one.
 */
export function SearchField({
  'aria-label': ariaLabel,
  className,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'aria-label'> & { 'aria-label': string }) {
  return (
    <input
      type={rest.type ?? 'search'}
      className={['av2-input', 'av2-input--bar', className ?? ''].filter(Boolean).join(' ')}
      aria-label={ariaLabel}
      {...rest}
    />
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

/** Server-action form id. The primitive owns the raw input (ci:admin-ui rule A). */
export function HiddenField({ name, value }: { name: string; value: string | number }) {
  return <input type="hidden" name={name} value={String(value)} />
}
