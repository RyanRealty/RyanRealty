/**
 * V3 INPUT. The house field: label, control, native validity.
 *
 * Adapted from beui-input (error shake + success check) and shadcn-input
 * (labelled control, focus ring, invalid weight) into navy-on-cream tokens.
 * No second hue: invalid is a heavier navy border, not red; the check is a
 * navy stroke, not green. Pill radii and purple rings stay with the catalogs.
 *
 * Validity is the browser's (`:user-invalid` / `:user-valid`), which is also
 * the accessible one. Motion reads --v3-travel and --v3-dur-*, so reduced
 * motion collapses the shake to nothing.
 */
import { cn } from '@/lib/utils'
import './tokens.css'
import './V3Input.css'

export type V3InputKind = 'text' | 'email' | 'tel' | 'textarea'

export type V3InputProps = {
  id: string
  name: string
  label: string
  kind?: V3InputKind
  required?: boolean
  autoComplete?: string
  placeholder?: string
  defaultValue?: string
  maxLength?: number
  hint?: string
  rows?: number
  className?: string
}

function SuccessCheck() {
  return (
    <svg
      className="v3-input__check"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M5 12.5l4.5 4.5L19 7.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function V3Input({
  id,
  name,
  label,
  kind = 'text',
  required,
  autoComplete,
  placeholder,
  defaultValue,
  maxLength,
  hint,
  rows = 5,
  className,
}: V3InputProps) {
  const area = kind === 'textarea'
  const controlClass = cn('v3-input__control', area && 'v3-input__control--area')

  return (
    <div className={cn('v3-input', className)}>
      <label htmlFor={id} className="v3-input__label">
        {label}
        {required ? null : <span className="v3-input__optional"> optional</span>}
      </label>
      {hint ? <span className="v3-input__hint">{hint}</span> : null}
      <div className="v3-input__field">
        {area ? (
          <textarea
            id={id}
            name={name}
            className={controlClass}
            required={required}
            placeholder={placeholder}
            defaultValue={defaultValue}
            rows={rows}
            maxLength={maxLength}
          />
        ) : (
          <input
            id={id}
            name={name}
            type={kind}
            className={controlClass}
            required={required}
            autoComplete={autoComplete}
            placeholder={placeholder}
            defaultValue={defaultValue}
            maxLength={maxLength}
            inputMode={kind === 'tel' ? 'tel' : kind === 'email' ? 'email' : undefined}
          />
        )}
        {required ? <SuccessCheck /> : null}
      </div>
    </div>
  )
}
