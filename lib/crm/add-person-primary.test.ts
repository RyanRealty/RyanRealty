import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('People new-contact primary path', () => {
  it('People page mounts the always-visible add form', () => {
    const src = readFileSync('app/admin/(protected)/people/page.tsx', 'utf8')
    expect(src).toContain('AddPersonCard')
  })

  it('CRM People page mounts the add form above the hanging list', () => {
    const src = readFileSync('app/admin/(protected)/crm/page.tsx', 'utf8')
    expect(src).toContain('AddPersonCard')
    expect(src).not.toContain('href="/admin/people?add=1"')
  })

  it('People FAB jumps to the form instead of Quick actions', () => {
    const src = readFileSync('components/console/ConsoleQuickAction.tsx', 'utf8')
    expect(src).toContain('href="#add-person"')
    expect(src).toContain('/admin/crm#add-person')
  })

  it('People loading paints New contact instead of a blank page', () => {
    const src = readFileSync('app/admin/(protected)/people/loading.tsx', 'utf8')
    expect(src).toContain('id="add-person"')
    expect(src).toContain('New contact')
  })

  it('list header labels New contact before New List', () => {
    const src = readFileSync('components/admin/shared/people-list/PeopleListView.tsx', 'utf8')
    expect(src).toMatch(/data-tour="crm-add-person"[\s\S]*New contact[\s\S]*New List/)
  })

  it('quick add collects structured address and not a note', () => {
    const src = readFileSync('components/admin/shared/people-list/AddPersonDialog.tsx', 'utf8')
    expect(src).toContain('label="Street"')
    expect(src).toContain('label="City"')
    expect(src).toContain('label="State"')
    expect(src).toContain('label="Zip"')
    expect(src).not.toMatch(/label="Note"/)
    expect(src).not.toMatch(/label="Tags"/)
    expect(src).not.toMatch(/label="Assign to"/)
    expect(src).not.toMatch(/label="Lead source"/)
  })

  it('create action writes addresses jsonb and never a note', () => {
    const src = readFileSync('app/actions/crm.ts', 'utf8')
    const persist = readFileSync('lib/crm/persist-created-contact.ts', 'utf8')
    expect(src).toContain('createContactAddress')
    expect(src).toContain('persistCreatedContactAddress')
    expect(persist).toContain('update({ addresses:')
    expect(src).not.toMatch(/message: note/)
    expect(src).not.toMatch(/Added manually in the CRM/)
  })

  it('create lands on person detail', () => {
    const dialog = readFileSync('components/admin/shared/people-list/AddPersonDialog.tsx', 'utf8')
    const crmNew = readFileSync('app/admin/(protected)/crm/new/page.tsx', 'utf8')
    expect(dialog).toContain('router.push(`/admin/people/${res.personId}`)')
    expect(dialog).toContain('Opening')
    expect(crmNew).toContain('redirect(`/admin/people/${r.personId}`)')
  })

  it('person detail first-paints identity then streams the workspace', () => {
    const page = readFileSync('app/admin/(protected)/people/[id]/page.tsx', 'utf8')
    expect(page).toContain('PersonAddressEditor')
    expect(page).toContain('PersonRelationships')
    expect(page).toContain('PersonNotesAdd')
    expect(page).toContain('FieldEditors')
    expect(page).toContain('getPersonNotes')
    expect(page).toContain('PersonWorkspace')
    expect(page).toContain('Suspense')
    const loading = readFileSync('app/admin/(protected)/people/[id]/loading.tsx', 'utf8')
    expect(loading).toContain('Opening this person')
  })

  it('notes save without waiting on the workspace', () => {
    const ui = readFileSync('app/admin/(protected)/people/[id]/PersonNotesAdd.tsx', 'utf8')
    expect(ui).toContain('savePersonNoteAction')
    expect(ui).toContain('Note saved')
    const action = readFileSync('app/admin/(protected)/people/actions.ts', 'utf8')
    expect(action).toContain('revalidatePerson(personId)')
    expect(action).not.toMatch(/savePersonNoteAction[\s\S]*revalidatePath\('\/admin\/crm'\)/)
  })

  it('relationship add searches an existing person and writes both sides', () => {
    const ui = readFileSync('app/admin/(protected)/people/[id]/PersonRelationships.tsx', 'utf8')
    const action = readFileSync('app/actions/crm-relationships.ts', 'utf8')
    expect(ui).toContain('Search an existing person')
    expect(ui).toContain('SIMPLE_RELATIONSHIP_TYPES')
    expect(ui).toContain('useState(true)')
    expect(ui).toContain('linkExistingRelationshipAction')
    expect(action).toContain('reciprocalType')
    expect(action).toContain('crm_relationships')
  })
})
