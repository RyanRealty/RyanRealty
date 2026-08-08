'use client'

import './admin-v2.css'
import type { InputHTMLAttributes } from 'react'

/**
 * Switch — an immediate on/off control (11F).
 *
 * A native checkbox carrying role="switch", not a div with click handlers: the
 * platform gives keyboard operation, form participation and the checked state
 * to assistive tech for free, and APG lists exactly this as a valid switch
 * implementation. The visual track/thumb is drawn by CSS on ::before/::after,
 * so nothing here re-implements focus or activation.
 *
 * A switch takes effect the moment it moves — it never waits for a Save. Use
 * a Checkbox when the value is part of a form the user submits.
 *
 * `label` is required and is the ACCESSIBLE name. Pass `labelHidden` when the
 * surrounding row already names the thing (a table row whose first cell is the
 * label); the text still reaches screen readers.
 */
export interface AdminSwitchProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'role'> {
  label: string
  /** Visible text beside the track. Omit to show the label itself. */
  stateText?: string
  labelHidden?: boolean
}

export function Switch({ label, stateText, labelHidden = false, className, ...rest }: AdminSwitchProps) {
  return (
    <label className={['av2-switch', className ?? ''].filter(Boolean).join(' ')}>
      <input type="checkbox" role="switch" aria-label={labelHidden ? label : undefined} {...rest} />
      <span className="av2-switch__track" aria-hidden="true" />
      {labelHidden ? (
        stateText ? (
          <span className="av2-switch__text" aria-hidden="true">
            {stateText}
          </span>
        ) : null
      ) : (
        <span className="av2-switch__text">{stateText ?? label}</span>
      )}
    </label>
  )
}
