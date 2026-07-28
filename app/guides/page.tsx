/**
 * /guides — permanently redirected to the blog content hub (IA plan).
 * next.config also 301s /guides → /blog. This page exists only so any
 * remaining internal imports resolve without emitting a /guides canonical.
 */
import { permanentRedirect } from 'next/navigation'

export default function GuidesIndexRedirect() {
  permanentRedirect('/blog')
}
