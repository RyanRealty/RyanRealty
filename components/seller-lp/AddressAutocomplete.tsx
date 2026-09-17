'use client'

/**
 * AddressAutocomplete — Google Places address autocomplete for the seller LP.
 *
 * Real-address picker so leads submit a validated street address (clean data →
 * accurate CMA + geocoding + CRM) instead of free-typed text. Uses the repo's
 * Maps loader (GoogleMapsBootstrap + useGoogleMapsReady) — NOT @react-google-maps/api's
 * broken useJsApiLoader. Restricts to US addresses, biased to the Bend / Central
 * Oregon area. Degrades gracefully: if Places is unavailable the field is a plain
 * text input and the funnel never breaks.
 *
 * Input has no forwardRef, so we attach the Autocomplete widget to the DOM node
 * via a wrapper querySelector — robust regardless of React version.
 *
 * The suggestion list is position:absolute on document.body. While it is open
 * the wrapper reserves space so Value my home stays below .pac-item rows
 * (fleet /sell overlay). Bind once, destroy on unmount, and ignore a stale
 * empty input event right after place_changed so React cannot wipe a commit.
 * The empty-ignore is a ref flag, not Date.now(), so ci:hydration-safety stays quiet.
 */

import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { animate, AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Input } from '@/components/ui/input'
import { Input as MotionInput, type InputClassNames } from '@/components/motion/input'
import { InputGroup, InputGroupAddon } from '@/components/ui/input-group'
import { Label } from '@/components/ui/label'
import { useGoogleMapsReady } from '@/lib/use-google-maps-ready'
import { cn } from '@/lib/utils'

type Props = {
  id?: string
  /**
   * The form-control name. Required for a form that must submit WITHOUT
   * JavaScript — a nameless input is not in the submission (SITE-12: the
   * homepage hero's Sell panel is a real GET form). Omitted where the submit
   * is a server action reading React state (/sell).
   */
  name?: string
  value: string
  onChange: (value: string) => void
  onPlaceSelected?: (place: { formattedAddress: string; lat?: number; lng?: number }) => void
  placeholder?: string
  className?: string
  /** Classes for the positioning wrapper, so a caller can place it in a row. */
  wrapperClassName?: string
  autoFocus?: boolean
  invalid?: boolean
  /**
   * Which installed control renders the field.
   *
   * `ui` (default) is components/ui/input — the shadcn control every other
   * caller of this component already shows.
   *
   * `motion` is the beUI motion Input (components/motion/input, catalog id
   * beui-input): its own label slot, left affix, error shake, and the success
   * check whose path draws itself.
   *
   * `group` is that same beUI input composed inside shadcn InputGroup so the
   * pin is an InputGroupAddon and the group owns the catalog focus / invalid
   * rings. /sell runs this one. The Places widget binds to the first <input>
   * inside the wrapper either way.
   */
  variant?: 'ui' | 'motion' | 'group'
  /** motion only: the field's own label, rendered by the catalog control. */
  label?: string
  /** motion only: truthy shakes the field; a string also prints the message. */
  error?: string | boolean
  /** motion only: draws the success check. */
  success?: boolean
  /** motion only: the left affix (a pin on /sell). */
  leftIcon?: ReactNode
  /** motion only: per-slot classes so the demo is painted, not replaced. */
  motionClassNames?: InputClassNames
  /** motion / group: reserve the error row so validation does not shift the ask. */
  reserveErrorLine?: boolean
}

// Bias suggestions toward Bend / Central Oregon (not strict — still allows any US address).
const BEND = { lat: 44.0582, lng: -121.3153 }

export default function AddressAutocomplete({
  id,
  name,
  value,
  onChange,
  onPlaceSelected,
  placeholder,
  className,
  wrapperClassName,
  autoFocus,
  invalid,
  variant = 'ui',
  label,
  error,
  success,
  leftIcon,
  motionClassNames,
  reserveErrorLine,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const onChangeRef = useRef(onChange)
  const onPlaceSelectedRef = useRef(onPlaceSelected)
  const ignoreEmptyRef = useRef(false)
  const acRef = useRef<{ unbind: () => void } | null>(null)
  const [suggesting, setSuggesting] = useState(false)
  const { ready } = useGoogleMapsReady({ libraries: ['places'] })
  const reduce = useReducedMotion()
  const groupRef = useRef<HTMLDivElement>(null)
  const hasError = Boolean(error)
  const errorMessage = typeof error === 'string' ? error : null
  onChangeRef.current = onChange
  onPlaceSelectedRef.current = onPlaceSelected

  useEffect(() => {
    if (variant !== 'group' || !groupRef.current || reduce || !hasError) return
    animate(groupRef.current, { x: [0, -6, 6, -4, 4, -2, 0] }, { duration: 0.45 })
  }, [hasError, reduce, variant])

  useEffect(() => {
    if (!ready || acRef.current) return
    const inputEl = wrapRef.current?.querySelector('input')
    if (!inputEl) return
    let active = true
    ;(async () => {
      try {
        // google.maps is loosely typed in this repo (no @types/google.maps).
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const g: any = (window as unknown as { google?: any }).google
        if (!g?.maps?.importLibrary) return
        const places = await g.maps.importLibrary('places')
        if (!active || acRef.current) return
        const before = new Set(document.querySelectorAll('.pac-container'))
        const ac = new places.Autocomplete(inputEl, {
          types: ['address'],
          componentRestrictions: { country: 'us' },
          fields: ['formatted_address', 'geometry'],
          bounds: new g.maps.LatLngBounds(
            new g.maps.LatLng(BEND.lat - 0.7, BEND.lng - 0.9),
            new g.maps.LatLng(BEND.lat + 0.7, BEND.lng + 0.9),
          ),
        })
        const mine = [...document.querySelectorAll('.pac-container')].filter(
          (el) => !before.has(el),
        ) as HTMLElement[]
        const hideMine = () => {
          for (const el of mine) el.style.display = 'none'
        }
        const listener = ac.addListener('place_changed', () => {
          const place = ac.getPlace()
          const formatted = typeof place?.formatted_address === 'string' ? place.formatted_address : ''
          if (formatted) {
            ignoreEmptyRef.current = true
            inputEl.value = formatted
            onChangeRef.current(formatted)
            onPlaceSelectedRef.current?.({
              formattedAddress: formatted,
              lat: place.geometry?.location?.lat?.(),
              lng: place.geometry?.location?.lng?.(),
            })
          }
          setSuggesting(false)
          hideMine()
        })
        acRef.current = {
          unbind: () => {
            try {
              listener?.remove?.()
              g.maps?.event?.clearInstanceListeners?.(ac)
            } catch {
              // widget already gone
            }
            for (const el of mine) el.remove()
          },
        }
      } catch {
        // Places unavailable — plain text input still works; funnel never breaks.
      }
    })()
    return () => {
      active = false
      acRef.current?.unbind()
      acRef.current = null
    }
  }, [ready])

  // One commit path for both controls: the widget writes the formatted address
  // straight onto the DOM node, and React can follow with an empty change that
  // would wipe it. The ref flag swallows exactly that one event.
  const commit = (next: string) => {
    if (!next && ignoreEmptyRef.current) {
      ignoreEmptyRef.current = false
      return
    }
    ignoreEmptyRef.current = false
    setSuggesting(next.trim().length > 0)
    onChange(next)
  }

  return (
    <div
      ref={wrapRef}
      className={cn(wrapperClassName, suggesting && 'pb-48')}
      onFocusCapture={() => {
        if (value.trim()) setSuggesting(true)
      }}
      onBlurCapture={() => {
        window.setTimeout(() => setSuggesting(false), 200)
      }}
    >
      {variant === 'group' ? (
        <div className="flex flex-col gap-1.5">
          {label ? (
            <Label htmlFor={id} className="px-1 text-sm font-medium text-foreground">
              {label}
            </Label>
          ) : null}
          <div ref={groupRef}>
            <InputGroup
              className={cn(
                'h-auto min-h-11 w-full',
                // Catalog InputGroup rings use :focus-visible. A pointer click
                // (take-route-shots, real mouse) focuses without :focus-visible,
                // so the same ring tokens also bind to :focus. Not a house border.
                'has-[[data-slot=input-group-control]:focus]:border-ring',
                'has-[[data-slot=input-group-control]:focus]:ring-3',
                'has-[[data-slot=input-group-control]:focus]:ring-ring/50',
                hasError && 'border-destructive ring-3 ring-destructive/25',
              )}
            >
              <MotionInput
                id={id}
                name={name}
                type="text"
                autoComplete="off"
                value={value}
                onChange={commit}
                placeholder={placeholder}
                className={cn('min-w-0 flex-1', className)}
                classNames={{
                  root: 'min-w-0 flex-1 gap-0',
                  field:
                    'h-auto min-h-11 rounded-none border-0 bg-transparent shadow-none overflow-visible',
                  ...motionClassNames,
                }}
                error={hasError}
                success={success}
                autoFocus={autoFocus}
                aria-invalid={hasError || invalid ? true : undefined}
                data-slot="input-group-control"
                inputMode="text"
              />
              {leftIcon ? (
                <InputGroupAddon align="inline-start">{leftIcon}</InputGroupAddon>
              ) : null}
            </InputGroup>
          </div>
          <div className={reserveErrorLine ? 'min-h-4' : 'contents'}>
            <AnimatePresence initial={false}>
              {errorMessage ? (
                <motion.p
                  id={id ? `${id}-error` : undefined}
                  role="alert"
                  initial={reduce ? { opacity: 0 } : { opacity: 0, y: -4, filter: 'blur(4px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4, filter: 'blur(4px)' }}
                  transition={{ duration: 0.2 }}
                  className="sell-field__error px-1 text-xs text-destructive"
                >
                  {errorMessage}
                </motion.p>
              ) : null}
            </AnimatePresence>
          </div>
        </div>
      ) : variant === 'motion' ? (
        <MotionInput
          id={id}
          name={name}
          type="text"
          label={label}
          autoComplete="off"
          value={value}
          onChange={commit}
          placeholder={placeholder}
          className={className}
          classNames={motionClassNames}
          error={error}
          success={success}
          leftIcon={leftIcon}
          reserveErrorLine={reserveErrorLine}
          autoFocus={autoFocus}
          aria-invalid={invalid ? 'true' : undefined}
          inputMode="text"
        />
      ) : (
        <Input
          id={id}
          name={name}
          type="text"
          autoComplete="off"
          value={value}
          onChange={(e) => commit(e.target.value)}
          placeholder={placeholder}
          className={className}
          autoFocus={autoFocus}
          aria-invalid={invalid ? 'true' : undefined}
          inputMode="text"
        />
      )}
    </div>
  )
}
