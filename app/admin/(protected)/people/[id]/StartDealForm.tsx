import { Button, HiddenField, SelectField, TextField, ToolbarCheck } from '@/components/admin/v2'
import { DEAL_PERSON_ROLE_LABEL, type DealPersonRole } from '@/lib/tc/deal-people'
import { startDealFromPerson } from '../actions'

type Related = {
  personId: number
  name: string
  label: string
  role: DealPersonRole
}

export function StartDealForm({
  personId,
  defaultAddress,
  defaultRole,
  related,
}: {
  personId: number
  defaultAddress: string
  defaultRole: DealPersonRole
  related: Related[]
}) {
  return (
    <section aria-label="Start a deal" className="av2-pane" style={{ marginBottom: 20 }}>
      {/* Closed until asked for (Matt 2026-08-25). Starting a deal happens once
          in a contact's life, and the expanded form — address, role, party
          checkboxes, submit — sat open on every contact forever. `details` is
          the disclosure here rather than a client toggle: this is a server
          component, and the native element needs no JS, which is what you want
          on a phone. */}
      <details>
        <summary style={{ cursor: 'pointer', fontSize: 'var(--a-text-md)', fontWeight: 500 }}>
          Start a deal
        </summary>
        <p style={{ margin: '8px 0 12px', fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
          Accepted offer. This person is one party. Add the others now or on the file.
        </p>
      <form action={startDealFromPerson} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <HiddenField name="personId" value={personId} />
        <TextField
          label="Property address"
          name="address"
          required
          defaultValue={defaultAddress || undefined}
          placeholder="123 NW Bond St, Bend"
        />
        <SelectField label="This person is" name="role" defaultValue={defaultRole}>
          <option value="buyer">{DEAL_PERSON_ROLE_LABEL.buyer}</option>
          <option value="seller">{DEAL_PERSON_ROLE_LABEL.seller}</option>
          <option value="other">{DEAL_PERSON_ROLE_LABEL.other}</option>
        </SelectField>
        {related.length > 0 ? (
          <fieldset style={{ border: 0, margin: 0, padding: 0 }}>
            <legend style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)', marginBottom: 6 }}>
              Also on this file
            </legend>
            {related.map((r) => (
              <ToolbarCheck
                key={r.personId}
                name="also"
                value={`${r.personId}:${r.role}`}
                defaultChecked
                label={`${r.name} · ${r.label} · ${DEAL_PERSON_ROLE_LABEL[r.role]}`}
              />
            ))}
          </fieldset>
        ) : null}
        <Button type="submit">Start deal</Button>
      </form>
      </details>
    </section>
  )
}
