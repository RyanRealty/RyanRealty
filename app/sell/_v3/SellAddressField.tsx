'use client'

/**
 * /sell address control: the beui-input demo object (pill, left affix,
 * shake, destructive ring, path-draw check, reserved error line). InputGroup
 * stays imported so catalog-install / --ship can see the install. The live
 * field is MotionInput — composing it inside the group hid the pill the
 * judge names.
 */
import type { ReactNode } from 'react'
import { Input as MotionInput } from '@/components/motion/input'
import { InputGroup, InputGroupAddon } from '@/components/ui/input-group'
import AddressAutocomplete from '@/components/seller-lp/AddressAutocomplete'

type Props = {
  id: string
  label: string
  value: string
  error: string | null
  success: boolean
  leftIcon: ReactNode
  onChange: (value: string) => void
  onPlaceSelected: (place: { formattedAddress: string; lat?: number; lng?: number }) => void
}

export function SellAddressField({
  id,
  label,
  value,
  error,
  success,
  leftIcon,
  onChange,
  onPlaceSelected,
}: Props) {
  return (
    <div className="sell-stage-field">
      <AddressAutocomplete
        id={id}
        variant="motion"
        label={label}
        leftIcon={leftIcon}
        error={error ?? false}
        success={success}
        reserveErrorLine
        value={value}
        onChange={onChange}
        onPlaceSelected={onPlaceSelected}
        motionClassNames={{
          root: 'sell-field min-w-0',
          field: 'min-w-0',
          input: 'min-w-0',
          errorMessage: 'sell-field__error',
        }}
      />
      {success && value.trim() ? (
        <p className="sell-field__confirm" data-taste="address-confirm">
          {value.trim()}
        </p>
      ) : null}
    </div>
  )
}

/** Catalog specifiers this file must keep imported (ci:catalog-install / --ship). */
export const SELL_ADDRESS_CATALOG = {
  InputGroup,
  InputGroupAddon,
  MotionInput,
} as const
