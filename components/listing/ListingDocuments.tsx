import type { SparkDocument } from '../../lib/spark'

type Props = {
  documents: SparkDocument[]
}

export default function ListingDocuments({ documents }: Props) {
  if (!documents?.length) return null

  return (
    <section className="mb-10">
      <h2 className="mb-4 text-lg font-semibold">Documents</h2>
      <ul className="space-y-2 rounded-lg border border-border bg-card p-4 shadow-sm">
        {documents.map((doc, i) => {
          const name = doc.Name || `Document ${i + 1}`
          const uri = doc.Uri
          return (
            <li key={doc.Id ?? i}>
              {uri ? (
                <a
                  href={uri}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  {name}
                </a>
              ) : (
                <span className="text-muted-foreground">{name}</span>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
