import { Button, SectionHead, TextAreaField } from '@/components/admin/v2'

export function PersonNotesAdd({
  addNote,
}: {
  addNote: (formData: FormData) => Promise<void>
}) {
  return (
    <section aria-label="Add a note" style={{ margin: '0 0 20px' }}>
      <SectionHead>Notes</SectionHead>
      <form action={addNote} style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 640 }}>
        <TextAreaField label="Add a note" name="body" rows={3} required placeholder="What happened?" />
        <div>
          <Button type="submit" variant="quiet">
            Save note
          </Button>
        </div>
      </form>
    </section>
  )
}
