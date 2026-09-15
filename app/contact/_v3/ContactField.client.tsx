'use client'

/**
 * Contact write-path field: the installed beui-input (shake + check) and
 * shadcn Input, restyled navy on cream. Validity drives `error` / `success`
 * so the demo interaction is the live control, not a CSS cream capsule.
 */
import { useEffect, useId, useRef, useState } from 'react'
import { animate } from 'motion/react'
import { BeuiInput } from './contact-catalog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { BROKERS, CONTACT } from '@/lib/brand/contact'
import type { V3InputProps } from '@/components/site/v3/V3Input'
import { useContactFieldDemo } from './contact-field-demo'

function humanMessage(el: HTMLInputElement | HTMLTextAreaElement, label: string): string {
  if (el.validity.valueMissing) return `Enter ${label.toLowerCase()}`
  if (el.validity.typeMismatch) return `Enter a valid ${label.toLowerCase()}`
  return el.validationMessage || `Enter ${label.toLowerCase()}`
}

function demoValue(kind: V3InputProps['kind'], label: string): string {
  if (kind === 'email') return CONTACT.email.primary
  if (kind === 'tel') return CONTACT.phoneDirect
  if (kind === 'textarea') return `A note about ${label.toLowerCase()}`
  return BROKERS.matt.nameShort
}

export function ContactField({
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
  const demo = useContactFieldDemo()
  const reactId = useId()
  const fieldId = id || reactId
  const area = kind === 'textarea'
  const [value, setValue] = useState(defaultValue ?? '')
  const [error, setError] = useState<string | boolean>(false)
  const [success, setSuccess] = useState(false)
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)
  const shakeRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (demo === 'error') {
      setError(`Enter ${label.toLowerCase()}`)
      setSuccess(false)
      return
    }
    if (demo === 'success') {
      setError(false)
      setSuccess(true)
      setValue((current) => current.trim() || demoValue(kind, label))
    }
  }, [demo, kind, label])

  useEffect(() => {
    const form = inputRef.current?.closest('form')
    if (!form) return
    const onSubmit = () => {
      const el = inputRef.current
      if (!el) return
      if (!el.checkValidity()) {
        setError(humanMessage(el, label))
        setSuccess(false)
      } else if (required && el.value.trim()) {
        setError(false)
        setSuccess(true)
      }
    }
    form.addEventListener('submit', onSubmit)
    return () => form.removeEventListener('submit', onSubmit)
  }, [label, required])

  useEffect(() => {
    if (!error || !shakeRef.current) return
    animate(shakeRef.current, { x: [0, -6, 6, -4, 4, -2, 0] }, { duration: 0.45 })
  }, [error])

  const applyValidity = (el: HTMLInputElement | HTMLTextAreaElement) => {
    if (!el.checkValidity()) {
      setError(humanMessage(el, label))
      setSuccess(false)
      return
    }
    setError(false)
    setSuccess(Boolean(required && el.value.trim()))
  }

  if (area) {
    const errorMessage = typeof error === 'string' ? error : null
    return (
      <div className={cn('contact-field', className)}>
        <Label htmlFor={fieldId} className="contact-field__label">
          {label}
          {required ? null : <span className="contact-field__optional"> optional</span>}
        </Label>
        {hint ? <span className="contact-field__hint">{hint}</span> : null}
        <div
          ref={shakeRef}
          data-state={error ? 'error' : success ? 'success' : 'idle'}
          className="contact-field__shell contact-field__shell--area"
        >
          <Textarea
            ref={(node) => {
              inputRef.current = node
            }}
            id={fieldId}
            name={name}
            className="contact-field__area"
            required={required}
            placeholder={placeholder}
            value={value}
            rows={rows}
            maxLength={maxLength}
            aria-invalid={error ? true : undefined}
            aria-describedby={errorMessage ? `${fieldId}-error` : undefined}
            onChange={(event) => {
              setValue(event.target.value)
              if (error || success) applyValidity(event.target)
            }}
            onBlur={(event) => applyValidity(event.target)}
          />
          {success ? (
            <span className="contact-field__check" aria-hidden="true">
              ✓
            </span>
          ) : null}
        </div>
        {errorMessage ? (
          <p id={`${fieldId}-error`} role="alert" className="contact-field__error">
            {errorMessage}
          </p>
        ) : null}
      </div>
    )
  }

  return (
    <div className={cn('contact-field', className)}>
      {hint ? <span className="contact-field__hint">{hint}</span> : null}
      <div ref={shakeRef}>
        <BeuiInput
          ref={(node) => {
            inputRef.current = node
          }}
          id={fieldId}
          name={name}
          label={label}
          type={kind === 'email' ? 'email' : kind === 'tel' ? 'tel' : 'text'}
          required={required}
          autoComplete={autoComplete}
          placeholder={placeholder}
          value={value}
          maxLength={maxLength}
          inputMode={kind === 'tel' ? 'tel' : kind === 'email' ? 'email' : undefined}
          error={error}
          success={success}
          reserveErrorLine
          onChange={(next) => {
            setValue(next)
            const el = inputRef.current
            if (el && (error || success)) applyValidity(el)
          }}
          onBlur={(event) => applyValidity(event.currentTarget)}
          classNames={{
            root: 'contact-field__beui',
            label: 'contact-field__label',
            field: 'contact-field__shell',
            input: 'contact-field__control',
            successIcon: 'contact-field__check',
            errorMessage: 'contact-field__error',
          }}
        />
      </div>
    </div>
  )
}
