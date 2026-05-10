#!/usr/bin/env node
// Build a self-contained HTML version of docs/FACEBOOK_SELLER_GROWTH_PIPELINE.md
// so Matt can open it in a browser and see the Mermaid diagrams render natively.
//
// Why this exists:
//   - The pipeline doc has 9 Mermaid diagrams. They render in GitHub, Cursor's
//     markdown preview, and Obsidian, but a quick `open` of the .md file in
//     macOS just shows raw text. Matt asked for an HTML he can actually see.
//   - This script reads the markdown, escapes it safely, and embeds it inside
//     a single .html file that uses marked.js + mermaid.js from a CDN to render
//     everything client-side. No build step, no server, no dependencies.
//
// Run:
//   node scripts/build-pipeline-doc-html.mjs
//
// Outputs:
//   docs/FACEBOOK_SELLER_GROWTH_PIPELINE.html

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '..')
const MD_PATH = resolve(REPO_ROOT, 'docs/FACEBOOK_SELLER_GROWTH_PIPELINE.md')
const HTML_PATH = resolve(REPO_ROOT, 'docs/FACEBOOK_SELLER_GROWTH_PIPELINE.html')

const markdown = readFileSync(MD_PATH, 'utf8')

// Safely embed inside <script type="text/markdown"> by escaping the only
// substring that would close the script element early.
const safeMarkdown = markdown.replace(/<\/script>/gi, '<\\/script>')

const buildTimeIso = new Date().toISOString()

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Facebook Seller Growth Pipeline — Ryan Realty</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
  :root {
    --navy: #102742;
    --navy-light: #1d3a5c;
    --gold: #D4AF37;
    --gold-soft: #c8a864;
    --cream: #F2EBDD;
    --bg: #f8fafc;
    --bg-elev: #ffffff;
    --text: #0f172a;
    --text-muted: #475569;
    --text-soft: #64748b;
    --border: #e2e8f0;
    --border-strong: #cbd5e1;
    --code-bg: #f1f5f9;
    --pill-good: #16a34a;
    --pill-warn: #d97706;
    --pill-risk: #dc2626;
  }
  * { box-sizing: border-box; }
  html { scroll-behavior: smooth; }
  body {
    margin: 0;
    background: var(--bg);
    color: var(--text);
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    line-height: 1.6;
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
  }
  header.site {
    background: var(--navy);
    color: var(--cream);
    padding: 28px 48px;
    border-bottom: 4px solid var(--gold);
    position: sticky;
    top: 0;
    z-index: 100;
    box-shadow: 0 4px 12px rgba(15, 23, 42, 0.18);
  }
  header.site .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 16px;
    max-width: 1400px;
    margin: 0 auto;
  }
  header.site .brand {
    display: flex;
    align-items: center;
    gap: 16px;
  }
  header.site .brand-mark {
    width: 12px;
    height: 12px;
    background: var(--gold);
    transform: rotate(45deg);
  }
  header.site h1 {
    font-size: 18px;
    font-weight: 600;
    margin: 0;
    letter-spacing: 0.02em;
    color: var(--cream);
  }
  header.site h1 small {
    display: block;
    font-size: 12px;
    font-weight: 400;
    text-transform: uppercase;
    letter-spacing: 0.18em;
    color: var(--gold);
    margin-bottom: 4px;
  }
  header.site .meta {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 13px;
    color: rgba(242, 235, 221, 0.75);
  }
  header.site .meta .pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border: 1px solid rgba(212, 175, 55, 0.45);
    border-radius: 999px;
    background: rgba(212, 175, 55, 0.08);
    color: var(--cream);
    font-size: 12px;
    font-weight: 500;
  }
  header.site .meta .pill .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #4ade80;
    box-shadow: 0 0 8px rgba(74, 222, 128, 0.6);
  }
  .layout {
    display: grid;
    grid-template-columns: 280px 1fr;
    gap: 48px;
    max-width: 1400px;
    margin: 0 auto;
    padding: 32px 48px 80px;
  }
  aside.toc {
    position: sticky;
    top: 124px;
    align-self: start;
    max-height: calc(100vh - 144px);
    overflow-y: auto;
    padding-right: 8px;
  }
  aside.toc h2 {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.16em;
    color: var(--text-soft);
    margin: 0 0 12px;
  }
  aside.toc ol {
    list-style: none;
    padding: 0;
    margin: 0;
    counter-reset: toc;
  }
  aside.toc li {
    counter-increment: toc;
    margin-bottom: 4px;
  }
  aside.toc a {
    display: flex;
    align-items: baseline;
    gap: 10px;
    padding: 6px 10px;
    color: var(--text-muted);
    text-decoration: none;
    border-radius: 6px;
    font-size: 13px;
    line-height: 1.4;
    border-left: 2px solid transparent;
    transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
  }
  aside.toc a::before {
    content: counter(toc, decimal-leading-zero);
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    color: var(--gold-soft);
    font-weight: 500;
    flex-shrink: 0;
  }
  aside.toc a:hover {
    background: var(--bg-elev);
    color: var(--text);
    border-left-color: var(--gold);
  }
  aside.toc a.active {
    background: var(--bg-elev);
    color: var(--navy);
    border-left-color: var(--gold);
    font-weight: 600;
  }
  main.content {
    background: var(--bg-elev);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 48px 56px;
    box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
    min-width: 0; /* allow shrinking */
  }
  main.content > h1:first-child {
    margin-top: 0;
  }
  main.content h1 {
    font-size: 32px;
    font-weight: 700;
    color: var(--navy);
    margin: 48px 0 16px;
    letter-spacing: -0.01em;
  }
  main.content h2 {
    font-size: 24px;
    font-weight: 700;
    color: var(--navy);
    margin: 56px 0 16px;
    padding-bottom: 8px;
    border-bottom: 2px solid var(--gold);
    letter-spacing: -0.005em;
  }
  main.content h3 {
    font-size: 18px;
    font-weight: 600;
    color: var(--navy);
    margin: 32px 0 12px;
  }
  main.content p {
    margin: 0 0 16px;
    color: var(--text);
  }
  main.content blockquote {
    border-left: 4px solid var(--gold);
    background: var(--cream);
    padding: 16px 20px;
    margin: 20px 0;
    color: var(--navy);
    border-radius: 0 6px 6px 0;
  }
  main.content blockquote p { margin-bottom: 0; }
  main.content a {
    color: var(--navy);
    text-decoration: underline;
    text-underline-offset: 2px;
    text-decoration-color: var(--gold);
  }
  main.content a:hover { color: var(--navy-light); }
  main.content code {
    font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 13px;
    background: var(--code-bg);
    padding: 2px 6px;
    border-radius: 4px;
    color: var(--navy);
  }
  main.content pre {
    background: var(--navy);
    color: var(--cream);
    padding: 18px 22px;
    border-radius: 8px;
    overflow-x: auto;
    margin: 20px 0;
    font-size: 13px;
    line-height: 1.55;
    border: 1px solid #1d3a5c;
  }
  main.content pre code {
    background: transparent;
    color: inherit;
    padding: 0;
  }
  main.content table {
    width: 100%;
    border-collapse: collapse;
    margin: 20px 0;
    font-size: 14px;
    background: var(--bg-elev);
  }
  main.content th {
    background: var(--cream);
    color: var(--navy);
    text-align: left;
    padding: 10px 14px;
    border: 1px solid var(--border-strong);
    font-weight: 600;
    font-size: 13px;
  }
  main.content td {
    padding: 10px 14px;
    border: 1px solid var(--border);
    vertical-align: top;
  }
  main.content tr:nth-child(even) td { background: #fafbfc; }
  main.content ul, main.content ol {
    padding-left: 24px;
    margin: 0 0 16px;
  }
  main.content li {
    margin-bottom: 6px;
  }
  main.content hr {
    border: 0;
    border-top: 1px solid var(--border-strong);
    margin: 48px 0;
  }
  main.content .mermaid {
    background: var(--bg-elev);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 24px;
    margin: 20px 0;
    text-align: center;
    overflow-x: auto;
  }
  main.content .mermaid svg {
    max-width: 100%;
    height: auto !important;
  }
  /* Status pills used inline */
  main.content table td:has(+ td) {
    font-family: inherit;
  }
  /* Responsive */
  @media (max-width: 1024px) {
    .layout {
      grid-template-columns: 1fr;
      padding: 24px 20px 60px;
    }
    aside.toc {
      position: static;
      max-height: none;
    }
    main.content {
      padding: 32px 24px;
    }
    header.site {
      padding: 20px 24px;
    }
  }
  @media print {
    header.site, aside.toc { display: none; }
    .layout { display: block; padding: 0; }
    main.content { box-shadow: none; border: 0; padding: 0; }
    main.content h2 { page-break-before: auto; }
    main.content .mermaid { page-break-inside: avoid; }
  }
  /* Loading state */
  #loading {
    text-align: center;
    padding: 80px 0;
    color: var(--text-muted);
    font-size: 14px;
  }
  #loading .spinner {
    display: inline-block;
    width: 24px;
    height: 24px;
    border: 3px solid var(--border);
    border-top-color: var(--gold);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin-bottom: 12px;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
</head>
<body>
<header class="site">
  <div class="row">
    <div class="brand">
      <div class="brand-mark"></div>
      <h1>
        <small>Ryan Realty</small>
        Facebook Seller Growth Pipeline
      </h1>
    </div>
    <div class="meta">
      <span class="pill"><span class="dot"></span> Production live</span>
      <span>Built ${buildTimeIso}</span>
    </div>
  </div>
</header>

<div class="layout">
  <aside class="toc" aria-label="Table of contents">
    <h2>Sections</h2>
    <ol id="toc-list"></ol>
  </aside>
  <main class="content" id="content">
    <div id="loading">
      <div class="spinner"></div>
      <div>Rendering markdown and 9 mermaid diagrams…</div>
    </div>
  </main>
</div>

<script type="text/markdown" id="md-source">
${safeMarkdown}
</script>

<script src="https://cdn.jsdelivr.net/npm/marked@15.0.7/marked.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.min.js"></script>
<script>
  (async function () {
    const mdSource = document.getElementById('md-source').textContent.trim()

    // Strip the duplicate H1 + table-of-contents block from the markdown so
    // they don't visually clash with the page header and sidebar TOC.
    let trimmed = mdSource
    // Drop the leading H1 ("# Facebook Seller Growth Pipeline").
    trimmed = trimmed.replace(/^#\\s+Facebook Seller Growth Pipeline\\s*\\n+/m, '')
    // Drop the markdown TOC section (## Table of contents through the next ---).
    trimmed = trimmed.replace(/##\\s+Table of contents[\\s\\S]*?\\n---\\n/m, '')

    // Custom renderer to wrap mermaid code blocks in <div class="mermaid">.
    const renderer = new marked.Renderer()
    const baseCode = renderer.code.bind(renderer)
    renderer.code = function (token) {
      const code = typeof token === 'object' && token !== null && 'text' in token ? token.text : token
      const lang = typeof token === 'object' && token !== null && 'lang' in token ? token.lang : arguments[1]
      if ((lang || '').toLowerCase() === 'mermaid') {
        return '<div class="mermaid">' + code + '</div>'
      }
      return baseCode.apply(this, arguments)
    }
    marked.setOptions({ renderer, gfm: true, breaks: false })

    const html = marked.parse(trimmed)
    const container = document.getElementById('content')
    container.innerHTML = html

    // Build the sidebar TOC from H2 headings.
    const tocList = document.getElementById('toc-list')
    const headings = container.querySelectorAll('h2')
    headings.forEach((h, idx) => {
      const text = h.textContent.replace(/^\\d+\\.\\s*/, '').trim()
      const id = 'sec-' + idx + '-' + text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      h.id = id
      const li = document.createElement('li')
      const a = document.createElement('a')
      a.href = '#' + id
      a.textContent = text
      li.appendChild(a)
      tocList.appendChild(li)
    })

    // Active section highlighting in the TOC.
    const tocLinks = Array.from(tocList.querySelectorAll('a'))
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.id
            tocLinks.forEach((link) => {
              link.classList.toggle('active', link.getAttribute('href') === '#' + id)
            })
          }
        })
      },
      { rootMargin: '-30% 0px -60% 0px' }
    )
    headings.forEach((h) => observer.observe(h))

    // Initialize mermaid with brand-aware theme.
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'loose',
      theme: 'base',
      themeVariables: {
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
        primaryColor: '#102742',
        primaryTextColor: '#F2EBDD',
        primaryBorderColor: '#0a1c30',
        lineColor: '#475569',
        secondaryColor: '#D4AF37',
        tertiaryColor: '#F2EBDD',
        background: '#ffffff',
        mainBkg: '#102742',
        secondBkg: '#D4AF37',
        textColor: '#0f172a',
      },
      flowchart: { htmlLabels: true, curve: 'basis' },
      sequence: { actorMargin: 60, mirrorActors: false },
      gantt: { fontSize: 12 },
    })

    try {
      await mermaid.run({ querySelector: '.mermaid' })
    } catch (err) {
      console.error('Mermaid rendering error:', err)
    }
  })()
</script>
</body>
</html>
`

writeFileSync(HTML_PATH, html, 'utf8')
console.log('Wrote ' + HTML_PATH)
console.log('Open with: open ' + HTML_PATH)
