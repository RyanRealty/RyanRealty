# Build Steps — How To Use

Put this entire `build-steps/` folder into your project at `docs/build-steps/`.

Then instead of copy-pasting from Claude, tell Cursor Agent:

```
Read docs/build-steps/step-10-broker-pages.md and execute all tasks.
```

Work through them in order. Each step builds on the previous ones.

## Completed Steps (built during setup session)
- Steps 1-7: Scaffolding, schema, auth, design system, sync engine, listing page, search, homepage

## Remaining Steps
| Step | File | What It Builds |
|------|------|---------------|
| 8 | (already sent to Cursor) | Community pages |
| 9 | (already sent to Cursor) | City & neighborhood pages |
| 10 | step-10-broker-pages.md | Broker landing pages, profiles, reviews |
| 11 | step-11-user-dashboard.md | User dashboard, saved homes, saved searches, auth |
| 12 | step-12-admin-backend.md | Full admin backend, CRUD, sync dashboard, user management |
| 13 | step-13-email-system.md | Resend templates, notification processor, email compose |
| 14 | step-14-cma-pdf.md | CMA engine, all PDF generation (listing, CMA, report, comparison) |
| 15 | step-15-reporting.md | Market reporting engine, charts, broker performance |
| 16 | step-16-blog-content.md | Blog, about page, contact page, sell page, AI content |
| 17 | step-17-openhouse-compare-video.md | Open houses, home comparison tool, video feed |
| 18 | step-18-fub-lead-scoring.md | FUB lead scoring, behavioral tracking, lead workflows |
| 19 | step-19-analytics.md | GA4/GTM/Meta Pixel, cookie consent, AI analytics agent |
| 20 | step-20-seo.md | Sitemaps, structured data, OG images, meta tags |
| 21 | step-21-legal.md | Privacy, terms, fair housing, DMCA, MLS attribution |
| 22 | step-22-pwa-a11y-performance.md | PWA, accessibility, performance optimization |
| 23 | step-23-testing-launch.md | Testing, seed data, CI/CD, launch checklist |

## Tips
- Let the agent complete each step before starting the next
- Run `npm run dev` after each step to verify nothing is broken
- Commit after each step: `git add . && git commit -m "Build step X: description"`
- If the agent hits errors, paste the error and let it fix before continuing
- Each step takes 10-25 minutes for the agent to build
