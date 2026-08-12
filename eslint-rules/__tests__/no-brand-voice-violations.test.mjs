import { RuleTester } from 'eslint'
import tsParser from '@typescript-eslint/parser'
import { describe, it } from 'vitest'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const plugin = require('../no-brand-voice-violations.js')
const rule = plugin.rules['no-violations']

RuleTester.describe = describe
RuleTester.it = it

const ruleTester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    parserOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      ecmaFeatures: { jsx: true },
    },
  },
})

ruleTester.run('rr-brand-voice/no-violations', rule, {
  valid: [
    {
      name: 'plain JSX text passes',
      code: `const x = () => <p>Find a home in Bend.</p>`,
    },
    {
      name: 'standalone em-dash as data placeholder is allowed',
      code: `const x = () => <td>—</td>`,
    },
    {
      name: 'banned-word substring inside a longer identifier does not trigger (only word-boundary matches)',
      code: `const x = () => <p>Inside our nesteddata loop the matchers run.</p>`,
    },
    {
      name: 'em-dashes in JS comments and identifiers do not trigger (rule scopes to JSX text + JSX attrs only)',
      code: [
        '// component for the — section header — internal note',
        'const nestled_internal = 1',
        'const x = () => <p>Local team in Central Oregon.</p>',
      ].join('\\n'),
    },
    {
      name: 'compound hyphens in JSX text pass (e.g. single-family, 30-year)',
      code: `const x = () => <p>Single-family homes on a 30-year fixed loan.</p>`,
    },
    {
      name: 'aria-label with clean prose passes',
      code: `const x = () => <button aria-label="Open menu">Menu</button>`,
    },
    {
      name: 'className with Tailwind !important modifiers is not flagged (code, not prose)',
      code: `const x = () => <div className="!px-1 !py-0 !text-[9px]">x</div>`,
    },
    {
      name: 'iframe allow attribute with semicolons is not flagged (code, not prose)',
      code: `const x = () => <iframe allow="accelerometer; autoplay; encrypted-media" />`,
    },
    {
      name: 'href / src / id / type attributes are not scanned (code, not prose)',
      code: `const x = () => <a href="/buy?x=1;y=2" id="cta-link" type="button">Buy</a>`,
    },
    {
      name: 'JavaScript inside a <script> child is not flagged (analytics pixel syntax)',
      code: 'const x = () => <script>{`!function(f,b){f.fbq||(f.fbq=function(){}); })();`}</script>',
    },
    {
      name: 'JS inside a Next <Script> child is not flagged',
      code: 'const x = () => <Script>{`window.dataLayer = window.dataLayer || []; gtag("js");`}</Script>',
    },
    {
      name: 'CSS inside a <style> child is not flagged (semicolons + custom props are code)',
      code: 'const x = () => <style>{`:root { --tw-cream: #faf8f4; } @keyframes pop { 0% { opacity: 0; } }`}</style>',
    },
    {
      name: 'HTML entity apostrophe in JSX text is not flagged as a semicolon (structural, not prose punctuation)',
      code: `const x = () => <p>Get your home&apos;s value.</p>`,
    },
    {
      name: 'numeric HTML entity is not flagged as a semicolon',
      code: `const x = () => <p>Get your home&#39;s value.</p>`,
    },
  ],
  invalid: [
    {
      name: 'em-dash in JSX text is flagged',
      code: `const x = () => <p>Local team — honest guidance.</p>`,
      errors: [{ messageId: 'punctuation' }],
    },
    {
      name: 'en-dash in JSX text is flagged',
      code: `const x = () => <p>Hours: 9–5 daily.</p>`,
      errors: [{ messageId: 'punctuation' }],
    },
    {
      name: 'semicolon in JSX text is flagged',
      code: `const x = () => <p>Honest; transparent.</p>`,
      errors: [{ messageId: 'punctuation' }],
    },
    {
      name: 'exclamation mark in JSX text is flagged',
      code: `const x = () => <p>Welcome home!</p>`,
      errors: [{ messageId: 'punctuation' }],
    },
    {
      name: 'worth CTA in JSX text is flagged',
      code: `const x = () => <p>What's my home worth in Bend.</p>`,
      errors: [{ messageId: 'bannedWord' }],
    },
    {
      name: 'worth CTA variant is flagged (what is your home worth)',
      code: `const x = () => <p>What is your home worth this week.</p>`,
      errors: [{ messageId: 'bannedWord' }],
    },
    {
      name: 'multi-word worth phrase is flagged',
      code: `const x = () => <a>What is my home worth</a>`,
      errors: [{ messageId: 'bannedWord' }],
    },
    {
      name: 'banned word in a string-literal JSX attribute is flagged (placeholder)',
      code: `const x = () => <input placeholder="What's my home worth" />`,
      errors: [{ messageId: 'bannedWord' }],
    },
    {
      name: 'banned text in {"…"} JSX expression container is flagged',
      code: `const x = () => <p>{"What is your home worth today."}</p>`,
      errors: [
        { messageId: 'bannedWord' },
      ],
    },
    {
      name: 'em-dash that is NOT the sole text content is still flagged',
      code: `const x = () => <td>Value — 3 bedrooms</td>`,
      errors: [{ messageId: 'punctuation' }],
    },
    {
      name: 'a real semicolon next to an HTML entity is still flagged (entity-stripping does not blind the whole string)',
      code: `const x = () => <p>Tom &amp; Jerry; a classic show.</p>`,
      errors: [{ messageId: 'punctuation' }],
    },
  ],
})
