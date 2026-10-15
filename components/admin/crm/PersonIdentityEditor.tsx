'use client'

/**
 * Inline first/last name + lead type on the person profile (v2 header and
 * lead-page-v3 header). Posts to updateIdentityFromPerson. Never sends.
 */
import { Button, HiddenField, SelectField, TextField } from '@/components/admin/v2'
import { PERSON_LEAD_TYPES, type PersonLeadType } from '@/lib/crm/person-identity-edit'

type FormAction = (formData: FormData) => Promise<void>

const LEAD_LABEL: Record<PersonLeadType, string> = {
  buyer: 'Buyer',
  seller: 'Seller',
  other: 'Other',
}

export function PersonIdentityEditor(props: {
  firstName: string
  lastName: string
  leadType: PersonLeadType
  layout: '2' | '3'
  action: FormAction
}) {
  return (
    <form
      action={props.action}
      aria-label="Edit name and lead type"
      className="av2-inline-form"
      style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end', margin: '8px 0 4px' }}
    >
      <HiddenField name="layout" value={props.layout} />
      <TextField
        label="First name"
        name="firstName"
        defaultValue={props.firstName}
        autoComplete="given-name"
        maxLength={80}
      />
      <TextField
        label="Last name"
        name="lastName"
        defaultValue={props.lastName}
        autoComplete="family-name"
        maxLength={80}
      />
      <SelectField label="Lead type" name="leadType" defaultValue={props.leadType}>
        {PERSON_LEAD_TYPES.map((value) => (
          <option key={value} value={value}>
            {LEAD_LABEL[value]}
          </option>
        ))}
      </SelectField>
      <Button type="submit" variant="quiet">
        Save name
      </Button>
    </form>
  )
}
