/** Lightweight article metadata shared between the server loader and the client help UI. */
export type HelpArticleMeta = {
  slug: string
  title: string
  area: string
  routes: string[]
  summary: string
}
