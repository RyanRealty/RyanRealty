import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('People new-contact primary path', () => {
  // Matt 2026-09-01: the always-visible add form is out — the list surface
  // leads with search, and the form lives in AddPersonDialog behind one
  // compact opener (same collapse rule as relationships, Matt 2026-08-25).
  it('People page leads with search and a compact New contact opener', () => {
    const src = readFileSync('app/admin/(protected)/people/page.tsx', 'utf8')
    expect(src).toContain('NewContactButton')
    expect(src).not.toContain('AddPersonCard')
  })

  it('CRM People page has no inline add form; the toolbar opens the dialog', () => {
    const src = readFileSync('app/admin/(protected)/crm/page.tsx', 'utf8')
    expect(src).not.toContain('AddPersonCard')
    expect(src).not.toContain('href="/admin/people?add=1"')
    const list = readFileSync('components/admin/shared/people-list/PeopleListView.tsx', 'utf8')
    expect(list).toContain('onClick={() => setAddOpen(true)}')
  })

  it('People FAB opens the add dialog via the #add-person deep link', () => {
    const src = readFileSync('components/console/ConsoleQuickAction.tsx', 'utf8')
    expect(src).toContain('/admin/crm#add-person')
    // The anchor no longer scrolls to an inline card — PeopleListView reads the
    // hash and opens AddPersonDialog instead.
    const list = readFileSync('components/admin/shared/people-list/PeopleListView.tsx', 'utf8')
    expect(list).toMatch(/#add-person/)
  })

  it('People loading paints the search row + New contact instead of a blank page', () => {
    const src = readFileSync('app/admin/(protected)/people/loading.tsx', 'utf8')
    expect(src).toContain('New contact')
    expect(src).toContain('av2-input')
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
    // /admin/crm/new was an orphaned duplicate of the dialog and is deleted
    // (2026-09-01); the dialog is the one create path.
    const dialog = readFileSync('components/admin/shared/people-list/AddPersonDialog.tsx', 'utf8')
    expect(dialog).toContain('router.push(`/admin/people/${res.personId}`)')
  })

  it('person detail first-paints identity then streams the workspace', () => {
    const page = readFileSync('app/admin/(protected)/people/[id]/page.tsx', 'utf8')
    expect(page).toContain('PersonAddressEditor')
    expect(page).toContain('PersonRelationships')
    expect(page).toContain('PersonNotesAdd')
    expect(page).toContain('FieldEditors')
    expect(page).toContain('getPersonNotes')
    expect(page).toContain('getPersonGlance')
    expect(page).toContain('nextLine')
    expect(page).toContain('PersonWorkspace')
    expect(page).toContain('Suspense')
    const loading = readFileSync('app/admin/(protected)/people/[id]/loading.tsx', 'utf8')
    expect(loading).toContain('Opening this person')
  })

  it('notes save without waiting on the workspace', () => {
    const ui = readFileSync('app/admin/(protected)/people/[id]/PersonNotesAdd.tsx', 'utf8')
    expect(ui).toContain('savePersonNoteAction')
    expect(ui).toContain('Note saved')
    expect(ui).toContain("timeZone: 'America/Los_Angeles'")
    const action = readFileSync('app/admin/(protected)/people/actions.ts', 'utf8')
    expect(action).toContain('revalidatePerson(personId)')
    expect(action).not.toMatch(/savePersonNoteAction[\s\S]*revalidatePath\('\/admin\/crm'\)/)
  })

  it('relationship add searches an existing person and writes both sides', () => {
    const ui = readFileSync('app/admin/(protected)/people/[id]/PersonRelationships.tsx', 'utf8')
    const action = readFileSync('app/actions/crm-relationships.ts', 'utf8')
    expect(ui).toContain('Search an existing person')
    expect(ui).toContain('SIMPLE_RELATIONSHIP_TYPES')
    // Closed on first paint (Matt 2026-08-25) — the open form was most of the
    // contact page's controls for a once-per-contact task. What must hold is
    // that it is one click away, which the Add trigger below covers.
    expect(ui).toContain('useState(false)')
    expect(ui).toContain('setOpen(true)')
    expect(ui).toContain('linkExistingRelationshipAction')
    expect(ui).toContain("useState<(typeof SIMPLE_RELATIONSHIP_TYPES)[number]>('spouse')")
    expect(ui).toContain('saveHit')
    expect(action).toContain('reciprocalType')
    expect(action).toContain('crm_relationships')
  })
})
