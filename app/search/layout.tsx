import './search-frame.css'

/**
 * Search layout. Nav is global via V3Chrome in root layout (sticky, in flow).
 * Do not mount a second header here. Search belongs to the Homes Field.
 * search-frame.css retargets the app-frame height off the sticky chrome.
 */
export default function SearchLayout({ children }: { children: React.ReactNode }) {
  return children
}
