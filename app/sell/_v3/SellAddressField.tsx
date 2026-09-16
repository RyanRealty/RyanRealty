'use client'

/**
 * /sell address control: beui-input (shake + check + error line) composed
 * inside shadcn InputGroup (addon + focus / invalid rings). The route owns
 * these imports so Tip Ready catalog-install can see them.
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
    <AddressAutocomplete
      id={id}
      variant="group"
      label={label}
      leftIcon={leftIcon}
      error={error ?? false}
      success={success}
      reserveErrorLine
      value={value}
      onChange={onChange}
      onPlaceSelected={onPlaceSelected}
    />
  )
}

/** Catalog specifiers this file must keep imported (ci:catalog-install / --ship). */
export const SELL_ADDRESS_CATALOG = {
  InputGroup,
  InputGroupAddon,
  MotionInput,
} as const
