'use client'

/**
 * Write-path field: the installed beui-input demo (shake + check + error
 * line) and shadcn Input / Select. Interaction stays; chrome is navy/cream.
 */
import { useEffect, useId, useRef, useState } from 'react'
import { Input as BeuiInput } from '@/components/motion/input'
import { Input as ShadcnInput } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  rows = 4,
  className,
  options,
}: V3InputProps) {
  const demo = useContactFieldDemo()
  const reactId = useId()
  const fieldId = id || reactId
  const area = kind === 'textarea'
  const select = kind === 'select'
  const [value, setValue] = useState(defaultValue ?? '')
  const [error, setError] = useState<string | boolean>(false)
  const [success, setSuccess] = useState(false)
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)

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

  const applyValidity = (el: HTMLInputElement | HTMLTextAreaElement) => {
    if (!el.checkValidity()) {
      setError(humanMessage(el, label))
      setSuccess(false)
      return
    }
    setError(false)
    setSuccess(Boolean(required && el.value.trim()))
  }

  if (select) {
    return (
      <div className={cn('contact-field', className)}>
        <Label htmlFor={fieldId}>{label}</Label>
        {hint ? <span className="contact-field__hint">{hint}</span> : null}
        <ShadcnInput type="hidden" name={name} value={value} tabIndex={-1} aria-hidden />
        <Select
          value={value || undefined}
          onValueChange={(next) => {
            setValue(next)
            setError(false)
            setSuccess(Boolean(required && next.trim()))
          }}
        >
          <SelectTrigger id={fieldId} className="w-full">
            <SelectValue placeholder={placeholder ?? label} />
          </SelectTrigger>
          <SelectContent>
            {(options ?? []).map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    )
  }

  if (area) {
    const errorMessage = typeof error === 'string' ? error : null
    return (
      <div className={cn('contact-field', className)}>
        <Label htmlFor={fieldId}>{label}</Label>
        {hint ? <span className="contact-field__hint">{hint}</span> : null}
        <Textarea
          ref={(node) => {
            inputRef.current = node
          }}
          id={fieldId}
          name={name}
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
        {errorMessage ? (
          <p id={`${fieldId}-error`} role="alert" className="text-xs text-foreground">
            {errorMessage}
          </p>
        ) : null}
      </div>
    )
  }

  return (
    <div className={cn('contact-field', className)}>
      {hint ? <span className="contact-field__hint">{hint}</span> : null}
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
        reserveErrorLine={Boolean(error)}
        classNames={{
          field: 'border-foreground',
          successIcon: 'text-foreground',
          errorMessage: 'text-foreground',
        }}
        onChange={(next) => {
          setValue(next)
          const el = inputRef.current
          if (el && (error || success)) applyValidity(el)
        }}
        onBlur={(event) => applyValidity(event.currentTarget)}
      />
    </div>
  )
}
