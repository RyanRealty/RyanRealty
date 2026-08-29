'use client'

/**
 * /sell/valuation capture. Address typeahead and email share the first face.
 * A matched confirm is required. Posts submitValuationRequest.
 */
import { useState } from 'react'
import { submitValuationRequest } from '@/app/home-valuation/actions'
import { trackEvent } from '@/lib/tracking'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import AddressAutocomplete from '@/components/seller-lp/AddressAutocomplete'
import { CONTACT } from '@/lib/brand/contact'

export function ValuationValueForm() {
  const [address, setAddress] = useState('')
  const [matchedAddress, setMatchedAddress] = useState('')
  const [state, setState] = useState<{
    error?: string
    success?: boolean
    cmaSent?: boolean
    eventId?: string
  }>({})
  const [loading, setLoading] = useState(false)

  const listMatch = matchedAddress.trim().length > 0 && matchedAddress.trim() === address.trim()
  const typedConfirm = address.trim().length >= 8
  const confirmed = listMatch || typedConfirm

  function handleAddressChange(next: string) {
    setAddress(next)
    if (matchedAddress && next.trim() !== matchedAddress.trim()) {
      setMatchedAddress('')
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const v = address.trim()
    if (v.length < 5) {
      setState({ error: 'Property address is required' })
      return
    }
    if (!confirmed) {
      setState({ error: 'Pick a matched address from the list to confirm it.' })
      return
    }
    const formData = new FormData(e.currentTarget)
    const email = formData.get('email')?.toString()?.trim() ?? ''
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setState({ error: 'Email is required' })
      return
    }
    setLoading(true)
    setState({})
    formData.set('address', v)
    formData.set('email', email)
    const result = await submitValuationRequest(formData)
    setLoading(false)
    setState(result)
    if (result.success && result.eventId) {
      if (typeof window !== 'undefined' && window.fbq) {
        window.fbq(
          'track',
          'Lead',
          { content_name: 'home_valuation' },
          { eventID: result.eventId },
        )
      }
      trackEvent('generate_lead', { source: 'home_valuation', cma_sent: result.cmaSent ?? false })
    }
  }

  if (state.success) {
    return (
      <div>
        <p className="valuation-confirm">
          {state.cmaSent
            ? 'Check your inbox for the comparative market analysis.'
            : 'We will email the written valuation to you.'}
        </p>
        <p className="valuation-note">
          Prefer to talk now? Call{' '}
          <a href={`tel:${CONTACT.phoneDirectTel}`}>{CONTACT.phoneDirect}</a>.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="valuation-address" id="home_valuation" noValidate>
      <Label htmlFor="val-address">Property address</Label>
      <AddressAutocomplete
        id="val-address"
        value={address}
        onChange={handleAddressChange}
        onPlaceSelected={(place) => {
          setAddress(place.formattedAddress)
          setMatchedAddress(place.formattedAddress)
          setState({})
        }}
        invalid={state.error != null}
      />
      {listMatch ? (
        <p className="valuation-match" data-address-match="confirmed">
          Matched: {matchedAddress}
        </p>
      ) : typedConfirm ? (
        <p className="valuation-match" data-address-match="confirmed">
          Using: {address.trim()}
        </p>
      ) : (
        <p className="valuation-note" data-address-match="pending">
          Pick an address from the list to confirm it.
        </p>
      )}
      <div>
        <Label htmlFor="val-email">Email</Label>
        <Input
          id="val-email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
        />
      </div>
      {state.error ? (
        <p className="valuation-error" role="alert">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? 'Sending' : 'Get my home’s value'}
      </Button>
    </form>
  )
}
