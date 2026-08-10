import '@/components/site/kb/kb.css'

/**
 * Search layout — kb.css for any KB tokens used on search chrome.
 * Nav is global via PublicNav in root layout (Matt 2026-08-10 dual-chrome kill).
 * Do not mount a second KbNav here.
 */
export default function SearchLayout({ children }: { children: React.ReactNode }) {
  return children
}
