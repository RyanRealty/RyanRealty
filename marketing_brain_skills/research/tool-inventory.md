# Tool inventory: Ryan Realty autonomous marketing pipeline

**Phase 1 research bible.** Every tool, API, model, helper, and package the pipeline can call.

**Last verified:** 2026-05-16 against repo source files, `.env.local`, and package.json manifests.
**Source of truth for keys:** `/Users/matthewryan/RyanRealty/.env.local` (gitignored). Never hard-code values from this file.
**Cross-reference:** `/Users/matthewryan/RyanRealty/video_production_skills/API_INVENTORY.md` (verification log from 2026-04-27).

Status legend used throughout:
- Active: key or credential present and verified working.
- Configured: credentials present, not re-tested in this session.
- Sandbox: key present but access restricted to sandbox tier.
- Unset: env var name known, value missing from `.env.local`.
- Expired: token present but confirmed stale or decrypted-error.
- Exhausted: quota or balance consumed.

---

## Table of contents

1. [MCP servers](#1-mcp-servers)
   - 1.1 Figma
   - 1.2 Gmail
   - 1.3 Calendar (Google)
   - 1.4 Supabase
   - 1.5 Google Drive / Sheets
   - 1.6 Apify
   - 1.7 Slack
   - 1.8 Canva (21ea7614)
   - 1.9 Airtable (26a459ce)
   - 1.10 Vercel (da9a2bb6)
   - 1.11 ElevenLabs Player
   - 1.12 Computer-use
   - 1.13 Read and Send iMessages
   - 1.14 PDF Tools
   - 1.15 PowerPoint
   - 1.16 Claude Preview
   - 1.17 Claude in Chrome
   - 1.18 Control Chrome
   - 1.19 Apollo / Predictleads (2c777f40)
   - 1.20 Enterprise Search
   - 1.21 MCP Registry
   - 1.22 ccd-directory
   - 1.23 ccd-session-mgmt
   - 1.24 Scheduled Tasks
   - 1.25 PDF Viewer (plugin)
   - 1.26 Figma (0b840869)
2. [lib/* helpers](#2-lib-helpers)
3. [npm and python packages](#3-npm-and-python-packages)
4. [API keys in .env.local](#4-api-keys-in-envlocal)
5. [Replicate model registry](#5-replicate-model-registry)
6. [Google Maps API surface](#6-google-maps-api-surface)
7. [AI providers](#7-ai-providers)
8. [Marketing and communications APIs](#8-marketing-and-communications-apis)

---

## 1. MCP servers

The Claude desktop config at `~/Library/Application Support/Claude/claude_desktop_config.json` contains preference keys only (no `mcpServers` block). All MCP servers are loaded via the system reminder in this agent's context. Each server is documented below with its namespace ID, every sub-tool name, parameters, and operational status.

### 1.1 Figma (0b840869-a8b4-4435-91f3-1169da195e05)

**Purpose.** Read Figma files, extract design context, link code components to Figma frames, upload assets, and generate diagrams. Positioned for the design system and brand asset workflow.

**Status.** Configured. No API key stored in `.env.local`; Figma MCP authenticates via the Claude desktop OAuth flow.

**Sub-tools (17 total):**

| Tool name | What it does | Key parameters |
|---|---|---|
| `whoami` | Returns the authenticated Figma user | none |
| `get_metadata` | Returns file metadata (name, last modified, owner) | `fileKey` |
| `get_design_context` | Returns node tree, styles, constraints from a file or specific node | `fileKey`, `nodeId` |
| `get_variable_defs` | Returns variable sets and modes | `fileKey` |
| `get_libraries` | Lists shared libraries accessible to the team | none |
| `search_design_system` | Full-text search across a Figma file's components | `fileKey`, `query` |
| `get_screenshot` | Returns a PNG export of a specific node | `fileKey`, `nodeId`, `scale` |
| `get_figjam` | Returns content of a FigJam file | `fileKey` |
| `get_code_connect_map` | Returns existing code-connect mappings for a file | `fileKey` |
| `get_code_connect_suggestions` | AI-generated suggestions for connecting components to code | `fileKey` |
| `get_context_for_code_connect` | Returns the design context for a specific component | `fileKey`, `nodeId` |
| `add_code_connect_map` | Adds a component-to-code mapping | `fileKey`, `nodeId`, `componentPath` |
| `send_code_connect_mappings` | Publishes code-connect mappings to Figma | `fileKey`, mappings array |
| `create_new_file` | Creates a new Figma file | `name`, `teamId` |
| `generate_diagram` | Generates a diagram from a description | `description`, `fileKey` |
| `upload_assets` | Uploads image assets to Figma | `fileKey`, `images` array |
| `use_figma` | General-purpose Figma action dispatcher | `action`, `params` |

**Rate limits.** Figma REST API: 100 requests per 15 minutes per token. `get_screenshot` generates an export which counts toward rate limits. Source: [https://www.figma.com/developers/api#rate-limits](https://www.figma.com/developers/api#rate-limits).

**Gotchas.** `get_design_context` on a large file with thousands of nodes can time out. Use `nodeId` to narrow scope. The code-connect tools require the Figma Dev Mode seat on the team.

**Producers that use it.** Any producer that generates visual assets for social or print, the design-system skill.

---

### 1.2 Gmail (dadfc8c5-6217-4ea3-b175-5d354dfa9c55)

**Purpose.** Read, search, label, and draft Gmail messages. Used by the marketing brain's inbox-parse loop to detect inbound leads, seller inquiries, and competitor activity.

**Status.** Configured. Authenticates via Google OAuth bound to `matt@ryan-realty.com`.

**Sub-tools (11 total):**

| Tool name | What it does | Key parameters |
|---|---|---|
| `search_threads` | Full-text or query-syntax search of Gmail threads | `query` (Gmail query string), `maxResults` |
| `get_thread` | Returns a full thread with all messages and headers | `threadId` |
| `create_draft` | Creates a draft message (not sent) | `to`, `subject`, `body`, `inReplyTo` |
| `list_drafts` | Returns current drafts | `maxResults` |
| `list_labels` | Returns all Gmail labels | none |
| `create_label` | Creates a new label | `name`, `visibility` |
| `delete_label` | Removes a label | `labelId` |
| `update_label` | Renames or changes color of a label | `labelId`, `name`, `color` |
| `label_thread` | Applies a label to a thread | `threadId`, `labelId` |
| `label_message` | Applies a label to a single message | `messageId`, `labelId` |
| `unlabel_thread` | Removes a label from a thread | `threadId`, `labelId` |
| `unlabel_message` | Removes a label from a message | `messageId`, `labelId` |

**Rate limits.** Gmail API: 250 quota units per user per second; 1 billion quota units per day. Reading a thread costs 5 units; sending costs 100 units. Source: [https://developers.google.com/gmail/api/reference/quota](https://developers.google.com/gmail/api/reference/quota).

**Gotchas.** Drafts are not sent automatically. Sending requires a separate Gmail API `users.messages.send` call not exposed through this MCP. Use for parsing and drafting only; actual send happens via `lib/resend.ts` or the Gmail API route.

**Producers that use it.** `inbox-poll` and `inbox-dispatcher` in `lib/marketing-brain/`.

---

### 1.3 Calendar (Google) (1783c99a-a45a-4c0c-8bc1-87a65e27be3f)

**Purpose.** Read and write Google Calendar events. Used by the content calendar producer to block publish slots and check for scheduling conflicts before queuing posts.

**Status.** Configured. Google OAuth on the same account as Gmail.

**Sub-tools (8 total):**

| Tool name | What it does | Key parameters |
|---|---|---|
| `list_calendars` | Returns all accessible calendars | none |
| `list_events` | Returns events in a date range | `calendarId`, `timeMin`, `timeMax`, `maxResults` |
| `get_event` | Returns a single event by ID | `calendarId`, `eventId` |
| `create_event` | Creates a new event | `calendarId`, `summary`, `start`, `end`, `description` |
| `update_event` | Modifies an existing event | `calendarId`, `eventId`, fields to update |
| `delete_event` | Deletes an event | `calendarId`, `eventId` |
| `respond_to_event` | RSVP as accepted, declined, or tentative | `calendarId`, `eventId`, `response` |
| `suggest_time` | Finds open slots for a meeting duration | `calendarId`, `duration`, `timeMin`, `timeMax` |

**Rate limits.** Google Calendar API: 1 million queries per day per project; 500 per 100 seconds per user. Source: [https://developers.google.com/calendar/api/limits](https://developers.google.com/calendar/api/limits).

**Gotchas.** `suggest_time` only reads the primary calendar by default. For the content calendar use case, pass the content-calendar `calendarId` explicitly.

---

### 1.4 Supabase (5adfee1a-82b2-4661-a931-e7bf6763a9c9)

**Purpose.** Project management for the Supabase hosted database. Distinct from the programmatic Supabase JS client in `lib/supabase/`. This MCP is used to run migrations, inspect schemas, read logs, and deploy edge functions from the agent context.

**Status.** Configured. Authenticates via Supabase personal access token (PAT).

**Sub-tools (27 total):**

| Tool name | What it does |
|---|---|
| `list_organizations` | Lists Supabase orgs the PAT belongs to |
| `get_organization` | Returns org details |
| `list_projects` | Lists all projects in an org |
| `get_project` | Returns a project's status and region |
| `get_project_url` | Returns the public URL for a project |
| `get_publishable_keys` | Returns the anon and service-role keys |
| `create_project` | Creates a new Supabase project |
| `pause_project` | Pauses a free-tier project |
| `restore_project` | Restores a paused project |
| `list_tables` | Lists tables in a schema |
| `execute_sql` | Runs arbitrary SQL against a project's database |
| `apply_migration` | Applies a SQL migration string to the project |
| `list_migrations` | Lists applied migrations |
| `list_extensions` | Lists installed Postgres extensions |
| `list_branches` | Lists database branches (branching enabled projects) |
| `create_branch` | Creates a new database branch |
| `delete_branch` | Deletes a branch |
| `merge_branch` | Merges a branch into main |
| `reset_branch` | Resets a branch to a prior state |
| `rebase_branch` | Rebases a branch onto the latest migration set |
| `get_advisors` | Returns performance advisor recommendations |
| `get_cost` | Returns estimated cost for a project tier |
| `confirm_cost` | Confirms a cost estimate before applying |
| `list_edge_functions` | Lists deployed edge functions |
| `get_edge_function` | Returns an edge function's config |
| `deploy_edge_function` | Deploys or updates an edge function |
| `get_logs` | Returns recent log lines for a project or edge function |
| `generate_typescript_types` | Generates TypeScript types from the current schema |
| `search_docs` | Searches the Supabase docs |

**Rate limits.** `execute_sql` is rate-limited by Supabase's connection pooler (PgBouncer). The `ryan-realty-platform` project is on the Pro plan; connection limit is 60 concurrent. Source: [https://supabase.com/docs/guides/platform/database-usage](https://supabase.com/docs/guides/platform/database-usage).

**Gotchas.** `execute_sql` runs with the service role, bypassing RLS. Never use it for user-facing reads. Use the anon key via `lib/supabase/client.ts` for those.

---

### 1.5 Google Drive / Sheets (fc2c4cfc-8049-4b10-8490-d814b7bc116c)

**Purpose.** Read, search, and download files from Google Drive. Used to pull market data spreadsheets and brand asset files.

**Status.** Configured. Authenticates via the `viewer@ryanrealty.iam.gserviceaccount.com` service account with domain-wide delegation to `matt@ryan-realty.com`.

**Sub-tools (8 total):**

| Tool name | What it does |
|---|---|
| `list_recent_files` | Returns recently modified files |
| `search_files` | Full-text and metadata search across Drive |
| `get_file_metadata` | Returns name, MIME type, modified date, owner |
| `get_file_permissions` | Returns who has access to a file |
| `read_file_content` | Returns file content (Docs as text, Sheets as CSV, PDFs as text) |
| `download_file_content` | Downloads binary content |
| `create_file` | Creates a new file (Docs, Sheets, Slides, or upload) |
| `copy_file` | Copies an existing file |

**Rate limits.** Drive API: 20,000 queries per 100 seconds per user; 1 billion per day per project. Source: [https://developers.google.com/drive/api/limits](https://developers.google.com/drive/api/limits).

---

### 1.6 Apify (mcp__Apify)

**Purpose.** Run Apify web-scraping actors for competitive intelligence, social listening, real estate data extraction, and lead enrichment. The `APIFY_API_TOKEN` is set in `.env.local` (added 2026-05-15).

**Status.** Active. Token lives in `.env.local` as `APIFY_API_TOKEN` (never commit the literal value).

**Sub-tools (7 total):**

| Tool name | What it does |
|---|---|
| `call-actor` | Runs any Apify actor by ID with input params |
| `get-actor-run` | Returns status and output metadata for a completed run |
| `get-actor-output` | Downloads the actor output dataset |
| `search-actors` | Finds actors by keyword in the Apify store |
| `fetch-actor-details` | Returns actor README, pricing, and schema |
| `fetch-apify-docs` | Returns Apify docs pages |
| `apify--rag-web-browser` | Headless browser actor for scraping with RAG context |

**Real-estate actors of interest:**

| Actor | Apify store slug | What it does | Approx cost |
|---|---|---|---|
| Zillow scraper | `maxcopell/zillow-scraper` | Property listings, price history, Zestimate | $0.50 per 1,000 results |
| Realtor.com scraper | `compass/realtor-scraper` | Active and sold listings from realtor.com | $0.40 per 1,000 |
| Instagram scraper | `apify/instagram-scraper` | Public posts, followers, engagement from any IG account | $1.00 per 1,000 posts |
| Google Maps scraper | `apify/google-maps-scraper` | Business listings, reviews, ratings from Google Maps | $1.00 per 1,000 places |
| TikTok scraper | `clockworks/tiktok-scraper` | Public TikTok videos, engagement data | $0.50 per 1,000 videos |

**Rate limits.** Concurrent actor runs: 25 (free tier) to 1,000+ (enterprise). Default timeout: 3,600 seconds. Source: [https://docs.apify.com/platform/actors/running/resource-limits](https://docs.apify.com/platform/actors/running/resource-limits).

**Producers that use it.** `competitor-recon`, `audit-ads`, `platform-trends`.

---

### 1.7 Slack (slack-by-salesforce)

**Purpose.** Read channel history, post messages, find discussions, and draft announcements in Slack. Used for internal team alerts and approval notifications.

**Status.** Configured via Claude desktop OAuth.

**Sub-tools (6 total):**

| Tool name | What it does |
|---|---|
| `standup` | Posts a formatted standup message to a channel |
| `find-discussions` | Searches for threads and messages matching a query |
| `summarize-channel` | Returns a summary of recent channel activity |
| `draft-announcement` | Drafts an announcement for review |
| `channel-digest` | Returns recent messages from a channel as a digest |
| `slack-messaging` | Sends a direct message or channel message |
| `slack-search` | Searches across all accessible workspaces |

**Rate limits.** Slack API Tier 3: 50+ requests per minute for most endpoints. Message posting: 1 per second. Source: [https://api.slack.com/docs/rate-limits](https://api.slack.com/docs/rate-limits).

---

### 1.8 Canva (21ea7614-4004-42e2-8a20-e59504c79b78)

**Purpose.** Generate, edit, and export Canva designs. Used by producers that need quick graphics without a Remotion render (social thumbnails, flyers, print-ready PDFs).

**Status.** Configured via Canva OAuth.

**Sub-tools (28 total):**

| Tool name | What it does |
|---|---|
| `help` | Returns documentation for Canva MCP capabilities |
| `search-designs` | Finds existing designs by keyword |
| `get-design` | Returns metadata for a design |
| `get-design-content` | Returns design content (elements, text, images) |
| `get-design-pages` | Returns all pages in a multi-page design |
| `get-design-thumbnail` | Returns a thumbnail image URL |
| `get-presenter-notes` | Returns slide presenter notes |
| `get-export-formats` | Returns supported export formats for a design |
| `export-design` | Exports a design as PDF, PNG, MP4, or GIF |
| `copy-design` | Duplicates a design for editing |
| `resize-design` | Changes canvas dimensions |
| `create-design-from-brand-template` | Instantiates a template with brand variables |
| `create-design-from-candidate` | Creates a design from a candidate spec |
| `generate-design` | Text-to-design AI generation |
| `generate-design-structured` | Structured design generation with explicit element specs |
| `merge-designs` | Combines two designs into one |
| `import-design-from-url` | Imports a Canva share link |
| `start-editing-transaction` | Opens an edit session |
| `perform-editing-operations` | Applies element edits, text changes, color swaps |
| `commit-editing-transaction` | Saves the edit session |
| `cancel-editing-transaction` | Discards the edit session |
| `get-assets` | Lists brand assets in the Canva team library |
| `upload-asset-from-url` | Uploads a remote image/video as a brand asset |
| `list-brand-kits` | Returns all configured brand kits |
| `get-brand-template-dataset` | Returns template variable fields |
| `search-brand-templates` | Searches brand templates by keyword |
| `list-folder-items` | Lists items in a Canva folder |
| `create-folder` | Creates a new folder |
| `move-item-to-folder` | Organizes a design into a folder |
| `list-comments` | Returns design comments |
| `comment-on-design` | Posts a comment on a design |
| `list-replies` | Returns replies on a comment thread |
| `reply-to-comment` | Replies to a comment |
| `resolve-shortlink` | Resolves a Canva short URL to a full design ID |
| `request-outline-review` | Triggers a content review for an outline |

**Rate limits.** Canva API: 500 requests per minute per app. Export operations count more heavily. Source: [https://www.canva.dev/docs/connect/rate-limiting/](https://www.canva.dev/docs/connect/rate-limiting/).

**Gotchas.** `generate-design` can produce off-brand results if the prompt doesn't constrain color palette. Always verify against the Ryan Realty design system before exporting. The `commit-editing-transaction` is required after any `perform-editing-operations` call or changes are lost.

---

### 1.9 Airtable (26a459ce-932f-4cbb-a193-39c53ea324f3)

**Purpose.** Read and write Airtable bases and records. Potential integration for content calendar sync or asset tracking if an Airtable base is wired.

**Status.** Configured via Airtable personal access token.

**Sub-tools (18 total):**

| Tool name | What it does |
|---|---|
| `list_workspaces` | Lists all accessible Airtable workspaces |
| `list_bases` | Lists bases in a workspace |
| `search_bases` | Searches for bases by name |
| `get_table_schema` | Returns column definitions for a table |
| `list_tables_for_base` | Lists all tables in a base |
| `list_records_for_table` | Paginates records from a table |
| `list_records_for_page` | Returns a specific page of records |
| `search_records` | Filters records by field values |
| `create_records_for_table` | Creates one or more records |
| `update_records_for_table` | Updates existing records |
| `delete_records_for_table` | Deletes records |
| `create_table` | Creates a new table |
| `create_field` | Adds a column to a table |
| `update_field` | Modifies a column definition |
| `update_table` | Renames or modifies a table |
| `create_base` | Creates a new base |
| `get_record_for_page` | Returns a single record by ID |
| `list_pages_for_base` | Lists page interfaces on a base |
| `list_record_comments` | Returns comments on a record |
| `create_record_comment` | Adds a comment to a record |
| `ping` | Tests connectivity |

**Rate limits.** Airtable API: 5 requests per second per base. Source: [https://airtable.com/developers/web/api/rate-limits](https://airtable.com/developers/web/api/rate-limits).

---

### 1.10 Vercel (da9a2bb6-d48e-4f3b-881a-8315256db337)

**Purpose.** Deploy, inspect logs, and manage Vercel projects. The Ryan Realty site runs on Vercel at `ryanrealty.vercel.app` (production target: `ryan-realty.com`).

**Status.** Configured via Vercel team token.

**Sub-tools (17 total):**

| Tool name | What it does |
|---|---|
| `list_teams` | Lists Vercel teams |
| `list_projects` | Lists all Vercel projects |
| `get_project` | Returns project config, env var names, and git integration |
| `list_deployments` | Lists recent deployments |
| `get_deployment` | Returns deployment status and metadata |
| `get_deployment_build_logs` | Returns the full build log for a deployment |
| `get_runtime_logs` | Returns runtime (serverless function) log lines |
| `check_domain_availability_and_price` | Checks if a domain is available to register |
| `deploy_to_vercel` | Triggers a new deployment from the connected git repo |
| `get_access_to_vercel_url` | Returns a signed URL with temporary access to a protected deployment |
| `web_fetch_vercel_url` | Fetches a Vercel deployment URL (bypasses password protection) |
| `search_vercel_documentation` | Searches the Vercel docs |
| `list_toolbar_threads` | Lists Vercel Toolbar comment threads on a deployment |
| `get_toolbar_thread` | Returns messages in a toolbar thread |
| `reply_to_toolbar_thread` | Replies to a toolbar comment |
| `add_toolbar_reaction` | Adds an emoji reaction to a toolbar comment |
| `edit_toolbar_message` | Edits a toolbar comment |
| `change_toolbar_thread_resolve_status` | Marks a toolbar thread as resolved |

**Rate limits.** Vercel REST API: 3,000 requests per minute for pro teams. Source: [https://vercel.com/docs/rest-api/rate-limiting](https://vercel.com/docs/rest-api/rate-limiting).

**Gotchas.** `deploy_to_vercel` does not wait for the deployment to complete. Poll `get_deployment` in a loop checking for status `READY` or `ERROR`. Build-log fetching only works after the build phase starts.

---

### 1.11 ElevenLabs Player (mcp__ElevenLabs_Player)

**Purpose.** Generate text-to-speech audio, music, and sound effects from within the agent context. Used by video producers for on-the-fly VO generation.

**Status.** Configured. Uses `ELEVENLABS_API_KEY` from `.env.local`.

**Sub-tools (5 total):**

| Tool name | What it does |
|---|---|
| `generate_tts` | Generates speech for a text input using a specified voice ID and model | `text`, `voice_id`, `model_id`, `voice_settings` |
| `generate_music` | Generates background music from a prompt | `prompt`, `duration_seconds` |
| `generate_sound_effect` | Generates a sound effect from a description | `text`, `duration_seconds`, `prompt_influence` |
| `load_audio` | Loads a local or remote audio file for use in the session | `path_or_url` |
| `play_audio` | Plays audio through the system speaker | `audio_data` |

**Canonical settings (locked 2026-05-07):** voice `qSeXEcewz7tA0Q0qk9fH` (Victoria), model `eleven_turbo_v2_5`, stability `0.40`, similarity_boost `0.80`, style `0.50`, `use_speaker_boost: true`. Source: `video_production_skills/elevenlabs_voice/SKILL.md`.

**Cost.** Approximately $0.18 per 1,000 characters at Creator tier. One 45-second VO script is roughly 600 characters, costing approximately $0.11. Monthly budget headroom as of 2026-04-27: ~99,000 characters remaining.

**Rate limits.** ElevenLabs API: depends on tier. Creator tier allows up to 3 concurrent requests. Source: [https://elevenlabs.io/docs/api-reference/text-to-speech](https://elevenlabs.io/docs/api-reference/text-to-speech).

---

### 1.12 Computer-use (mcp__computer-use)

**Purpose.** Control the macOS desktop: take screenshots, click, type, scroll, and open applications. Used for any task that requires interacting with native apps (Preview, Finder, native video players) or for tasks where no dedicated MCP or browser-level tool is available.

**Status.** Available. Access must be requested per application via `request_access` before first use.

**Sub-tools (25 total):**

| Tool name | What it does |
|---|---|
| `screenshot` | Captures the current desktop state |
| `cursor_position` | Returns current mouse X,Y |
| `left_click` | Clicks at coordinates |
| `right_click` | Right-clicks at coordinates |
| `middle_click` | Middle-clicks at coordinates |
| `double_click` | Double-clicks at coordinates |
| `left_click_drag` | Drags from one point to another |
| `left_mouse_down` | Holds the left mouse button |
| `left_mouse_up` | Releases the left mouse button |
| `mouse_move` | Moves the cursor without clicking |
| `scroll` | Scrolls in a direction at coordinates |
| `type` | Types text |
| `key` | Presses a key or key combo |
| `hold_key` | Holds a key down |
| `open_application` | Opens a macOS application by name |
| `switch_display` | Switches active display |
| `zoom` | Zooms in or out |
| `read_clipboard` | Returns clipboard content |
| `write_clipboard` | Sets clipboard content |
| `request_access` | Requests permission to control listed applications |
| `request_teach_access` | Requests teach-mode access |
| `list_granted_applications` | Lists applications with current permission level |
| `teach_step` | Records a single step during teach mode |
| `teach_batch` | Submits a batch of recorded steps |
| `computer_batch` | Executes a batch of computer-use actions atomically |
| `wait` | Waits a specified number of milliseconds |

**Access tiers.** Browsers (Safari, Chrome, etc.) are granted at "read" tier. Terminals and IDEs are granted at "click" tier. All other apps are "full" tier.

**Gotchas.** Clicks in "read" tier apps return an error. Use `claude-in-chrome` MCP for browser interactions. Never use computer-use to fill forms or submit real financial transactions.

---

### 1.13 Read and Send iMessages (mcp__Read_and_Send_iMessages)

**Purpose.** Read incoming iMessages and send outbound messages. Used for Matt's approval-notification flow and seller-lead follow-up sequences.

**Status.** Configured on the local Mac.

**Sub-tools (4 total):**

| Tool name | What it does |
|---|---|
| `get_unread_imessages` | Returns unread messages across all conversations |
| `read_imessages` | Returns messages from a specific conversation |
| `search_contacts` | Finds contact handles by name or phone |
| `send_imessage` | Sends a message to a phone number or Apple ID |

**Gotchas.** Only works on the Mac mini where Messages is authenticated. Not available in headless or cloud agent runs.

---

### 1.14 PDF Tools (mcp__PDF_Tools_-_View__Fill__Merge__Split__Manage_Pages__Extract)

**Purpose.** Read, fill, merge, split, and extract content from PDFs. Used for CMA delivery, listing agreement packets, and disclosure document processing.

**Status.** Available locally.

**Sub-tools (20 total):**

| Tool name | What it does |
|---|---|
| `list_pdfs` | Lists available PDFs in the working directory |
| `get_pdf_info` | Returns page count, metadata, and form fields |
| `display_pdf` | Renders a PDF for visual inspection |
| `read_pdf_content` | Extracts text content |
| `read_pdf_fields` | Returns fillable form field names and values |
| `fill_pdf` | Fills form fields and returns a new file |
| `fill_with_profile` | Fills a PDF using a saved profile |
| `bulk_fill_from_csv` | Bulk-fills a template from a CSV |
| `extract_to_csv` | Extracts table data to CSV |
| `validate_pdf` | Checks for errors or corruption |
| `split_pdf` | Splits into individual pages or ranges |
| `merge_pdfs` | Combines multiple PDFs |
| `reorder_pdf_pages` | Reorders pages |
| `rotate_pdf_pages` | Rotates pages |
| `apply_page_plan` | Applies a page operation plan |
| `get_page_analysis` | Returns layout analysis for a page |
| `save_profile` | Saves a fill profile for repeated use |
| `load_profile` | Loads a saved fill profile |
| `list_profiles` | Lists available fill profiles |
| `get_pdf_resource_uri` | Returns a URI for embedding |

---

### 1.15 PowerPoint (mcp__PowerPoint__By_Anthropic)

**Purpose.** Create, edit, and export PowerPoint presentations. Used for listing presentations and investor reports.

**Status.** Available locally.

**Sub-tools (10 total):**

| Tool name | What it does |
|---|---|
| `create_presentation` | Creates a new .pptx file |
| `open_presentation` | Opens an existing .pptx |
| `close_presentation` | Closes without saving |
| `save_presentation` | Saves to disk |
| `add_slide` | Appends a new slide |
| `delete_slide` | Removes a slide by index |
| `set_slide_title` | Sets the title text on a slide |
| `add_text_to_slide` | Adds a text box at specified position |
| `insert_image` | Inserts an image on a slide |
| `get_slide_content` | Returns text and layout info for a slide |
| `export_pdf` | Exports the presentation as PDF |

---

### 1.16 Claude Preview (mcp__Claude_Preview)

**Purpose.** Launch and interact with an in-session web preview. Used to QA Next.js pages before commit.

**Status.** Available.

**Sub-tools (13 total):**

| Tool name | What it does |
|---|---|
| `preview_start` | Starts a local preview server |
| `preview_stop` | Stops the preview server |
| `preview_list` | Lists active preview sessions |
| `preview_screenshot` | Takes a screenshot of the preview |
| `preview_click` | Clicks an element in the preview |
| `preview_fill` | Fills an input field |
| `preview_eval` | Evaluates JavaScript in the preview context |
| `preview_inspect` | Returns DOM info for an element |
| `preview_snapshot` | Takes a full-page snapshot |
| `preview_network` | Returns network request logs |
| `preview_logs` | Returns console log output |
| `preview_console_logs` | Returns structured console output |
| `preview_resize` | Resizes the viewport |

---

### 1.17 Claude in Chrome (mcp__Claude_in_Chrome)

**Purpose.** Control a paired Chrome browser via the Claude Chrome extension. DOM-aware: can read page content, click links, fill forms, and upload files. Faster and more precise than computer-use for web tasks.

**Status.** Available. Extension paired to device ID `49334b39-131b-4475-b439-32d302f4a40f`.

**Sub-tools (22 total):**

| Tool name | What it does |
|---|---|
| `navigate` | Navigates to a URL |
| `read_page` | Returns the page DOM as structured text |
| `get_page_text` | Returns visible text content |
| `find` | Finds elements by CSS selector or text |
| `form_input` | Fills form fields |
| `javascript_tool` | Executes JavaScript |
| `read_console_messages` | Returns browser console output |
| `read_network_requests` | Returns XHR / Fetch request logs |
| `file_upload` | Uploads a local file via a file input |
| `upload_image` | Uploads an image |
| `list_connected_browsers` | Lists connected browser instances |
| `select_browser` | Selects an active browser instance |
| `switch_browser` | Switches to a different browser |
| `tabs_create_mcp` | Opens a new tab |
| `tabs_close_mcp` | Closes a tab |
| `tabs_context_mcp` | Returns context for the current tab |
| `resize_window` | Resizes the browser window |
| `shortcuts_list` | Lists available keyboard shortcuts |
| `shortcuts_execute` | Executes a keyboard shortcut |
| `gif_creator` | Records a GIF of browser actions |
| `computer_batch` | Executes batched browser actions |
| `browser_batch` | Executes batched browser commands |

**Gotchas.** Only works when Chrome is open with the extension active. Use `list_connected_browsers` before any action to confirm connectivity.

---

### 1.18 Control Chrome (mcp__Control_Chrome)

**Purpose.** Alternative Chrome control MCP with tab management and JavaScript execution. Lighter weight than `Claude in Chrome` for simple navigation tasks.

**Status.** Available.

**Sub-tools (10 total):**

| Tool name | What it does |
|---|---|
| `list_tabs` | Returns all open tabs |
| `get_current_tab` | Returns the active tab URL and title |
| `open_url` | Opens a URL in the current tab |
| `get_page_content` | Returns the current page content |
| `execute_javascript` | Runs JavaScript on the current page |
| `go_back` | Navigates back |
| `go_forward` | Navigates forward |
| `reload_tab` | Reloads the current page |
| `switch_to_tab` | Focuses a tab by ID |
| `close_tab` | Closes a tab |

---

### 1.19 Apollo / Predictleads (2c777f40-c4e7-4f42-8abf-81d05e5afeab)

**Purpose.** B2B prospecting, lead enrichment, and company intelligence. The namespace `2c777f40` corresponds to the Predictleads data platform.

**Status.** Configured.

**Sub-tools (12 total):**

| Tool name | What it does |
|---|---|
| `autocomplete` | Suggests company names as user types |
| `enrich-business` | Returns firmographic data for a company domain |
| `enrich-prospects` | Enriches a list of contacts with LinkedIn data |
| `estimate-cost` | Returns credit cost before running a large query |
| `export-to-csv` | Exports a result set to CSV |
| `fetch-businesses-events` | Returns business event signals (hiring, funding, etc.) |
| `fetch-entities` | Returns enriched entity records |
| `fetch-entities-statistics` | Returns aggregate stats on a set of entities |
| `fetch-prospects-events` | Returns job-change or LinkedIn signals for prospects |
| `get-dataset` | Retrieves a stored dataset |
| `match-business` | Matches a company name/domain to a canonical entity |
| `match-prospects` | Matches contacts to LinkedIn profiles |

**Use case for Ryan Realty.** Agent-to-agent B2B outreach (finding real estate attorneys, title companies, builders) rather than residential consumer lead gen.

---

### 1.20 Enterprise Search (enterprise-search)

**Purpose.** Semantic search across connected knowledge sources. Useful for surfacing relevant documents, past decisions, and prior research before producing new content.

**Status.** Configured.

**Sub-tools (4 total):**

| Tool name | What it does |
|---|---|
| `search` | Semantic search across all connected sources |
| `source-management` | Add, remove, or reconfigure search sources |
| `digest` | Synthesizes search results into a structured summary |
| `search-strategy` | Returns a recommended search plan for a complex query |
| `knowledge-synthesis` | Combines multiple search results into a coherent brief |

---

### 1.21 MCP Registry (mcp__mcp-registry)

**Purpose.** Discover new MCP servers and check which connectors are available for a given task.

**Sub-tools (3 total):** `list_connectors`, `search_mcp_registry`, `suggest_connectors`.

---

### 1.22 ccd-directory

**Purpose.** Directory of Claude Code agent sessions and capabilities.

**Sub-tools (1):** `request_directory`.

---

### 1.23 ccd-session-mgmt

**Purpose.** Archive, list, and search past Claude Code sessions. Used by the orchestrator to retrieve prior research runs.

**Sub-tools (3 total):** `archive_session`, `list_sessions`, `search_session_transcripts`.

---

### 1.24 Scheduled Tasks (mcp__scheduled-tasks)

**Purpose.** Create, update, and list scheduled remote agent runs (routines on a cron schedule).

**Sub-tools (3 total):** `create_scheduled_task`, `list_scheduled_tasks`, `update_scheduled_task`.

**Use case.** Scheduling the weekly brain cycle and daily channel snapshot runs without relying solely on Vercel crons.

---

### 1.25 PDF Viewer (mcp__plugin_pdf-viewer_pdf and mcp__pdf-viewer)

**Purpose.** View and interact with PDFs in the agent context.

**Sub-tools (multiple):** `display_pdf`, `interact`, `list_pdfs`, `poll_pdf_commands`, `read_pdf_bytes`, `save_pdf`, `submit_page_data`, `submit_save_data`, `submit_viewer_state`.

---

### 1.26 Figma alternate namespace (0b840869)

This is the same server as §1.1 with an alternate namespace used in some skill invocations. Same sub-tool set applies. No separate documentation needed; treat as identical.

---

**Section A citations:**

| Reference | URL | Notes |
|---|---|---|
| Figma REST API rate limits | https://www.figma.com/developers/api#rate-limits | As of 2025 docs |
| Gmail quota | https://developers.google.com/gmail/api/reference/quota | Per-user quota table |
| Google Calendar API limits | https://developers.google.com/calendar/api/limits | 2025 docs |
| Supabase database usage | https://supabase.com/docs/guides/platform/database-usage | Pro plan connection limit |
| Google Drive API limits | https://developers.google.com/drive/api/limits | 2025 docs |
| Apify resource limits | https://docs.apify.com/platform/actors/running/resource-limits | Actor concurrency |
| Slack rate limits | https://api.slack.com/docs/rate-limits | Tier 3 specs |
| Canva rate limiting | https://www.canva.dev/docs/connect/rate-limiting/ | Per-minute limits |
| Airtable rate limits | https://airtable.com/developers/web/api/rate-limits | 5 req/sec per base |
| Vercel REST API rate limiting | https://vercel.com/docs/rest-api/rate-limiting | Pro tier |
| ElevenLabs TTS reference | https://elevenlabs.io/docs/api-reference/text-to-speech | Creator tier |
| xAI API endpoint reference | https://docs.x.ai/api | Models and pricing |

---

## 2. lib/* helpers

Every file in `/Users/matthewryan/RyanRealty/lib/` that the pipeline reads from. Verified by direct file inspection on 2026-05-16.

### 2.1 meta-graph.ts

**Exports:** `publishImage`, `publishReel`, `publishStory`, `publishCarousel`, `publishFacebookPost`, `publishFacebookPhoto`, `publishFacebookVideo`, `publishFacebookReel`, `getPageInsights`, `getPagePostsWithInsights`, `getIGAccountInsights`, `getIGMediaWithInsights`, `getMetaAdsInsights`, `checkContainerStatus`, `waitForContainer`, `getPublishingLimit`, `MetaGraphError`.

**API wrapped.** Meta Graph API v25.0 (`https://graph.facebook.com/v25.0`).

**Known gotchas.**
- `publishReel` polls `waitForContainer` (3-second intervals, 60-second default timeout) before calling `media_publish`. If the video is longer than 60 seconds this polling will time out and the reel will not publish. Increase `maxWaitMs` in the caller.
- All publishing functions require `META_PAGE_ACCESS_TOKEN`. As of 2026-04-14 that token carries `data_access_expires_at: 2026-07-13`. If the token is not refreshed before that date, all publishing stops.
- `publishFacebookReel` buffers the entire video into memory (`arrayBuffer()`) before POSTing. Videos over 500 MB will cause OOM on the serverless function.
- The IG publishing quota is 25 posts per 24 hours. Use `getPublishingLimit` before any bulk publish run.

**Consumers.** `automation_skills/automation/publish/`, social media producers.

---

### 2.2 linkedin.ts

**Exports.** Token management, `getLinkedInOAuthEnv`, `publishLinkedInPost`, `publishLinkedInVideo`, `publishLinkedInImage`, stored-token helpers.

**API wrapped.** LinkedIn UGC Posts API (`https://api.linkedin.com/v2/ugcPosts`), LinkedIn REST Posts API v202602 (`https://api.linkedin.com/rest/posts`).

**OAuth scopes.** `openid profile email w_member_social rw_organization_admin r_organization_social`.

**Gotchas.** LinkedIn requires the `Community Management API` product to be enabled in the developer app for `rw_organization_admin` and `r_organization_social`. Without it, company page posts fail with a 403. The `rest/posts` endpoint requires API version header `202602`; older UGC endpoint works without a version header but is deprecated.

---

### 2.3 x.ts

**Exports.** Token management, `getXOAuthEnv`, `postTweet`, `postTweetWithMedia`, `uploadMedia`, stored-token helpers.

**API wrapped.** Twitter v2 Tweets API (`https://api.twitter.com/2/tweets`), Twitter v1.1 Media Upload (`https://upload.twitter.com/1.1/media/upload.json`).

**OAuth scopes.** `tweet.write tweet.read users.read media.write offline.access`.

**Gotchas.** The `media.write` scope requires X Basic tier ($100/month) or higher. Without it, image and video attachment fails. Tokens are stored in Supabase `x_auth` table. The Redis cache at Upstash is used for token state management.

---

### 2.4 google-business-profile.ts

**Exports.** `getGBPDailyMetrics`, GBP OAuth helpers, performance metric types.

**API wrapped.** Business Profile Performance API (`https://businessprofileperformance.googleapis.com/v1`), My Business Account Management API (`https://mybusinessaccountmanagement.googleapis.com/v1/accounts`).

**Metrics available.** `BUSINESS_IMPRESSIONS_DESKTOP_MAPS`, `BUSINESS_IMPRESSIONS_DESKTOP_SEARCH`, `BUSINESS_IMPRESSIONS_MOBILE_MAPS`, `BUSINESS_IMPRESSIONS_MOBILE_SEARCH`, `CALL_CLICKS`, `WEBSITE_CLICKS`, `BUSINESS_DIRECTION_REQUESTS`, `BUSINESS_CONVERSATIONS`, `BUSINESS_BOOKINGS`.

**Gotchas.** GBP allowlist request (case ID 7-6192000040405) was submitted 2026-04-15. Production API access requires allowlist approval from Google. Without approval, requests return 403.

---

### 2.5 resend.ts

**Exports.** `sendEmail`, `getResendClient`, `SendEmailOptions`.

**API wrapped.** Resend API (`https://api.resend.com/emails`).

**Default FROM address.** `Ryan Realty <onboarding@resend.dev>` until `mail.ryan-realty.com` is verified in the Resend dashboard. Override via `RESEND_FROM` env var.

**Gotchas.** The `RESEND_FROM` env var is not set in `.env.local`. The `DEFAULT_FROM` fallback is the Resend sandbox address (`onboarding@resend.dev`), which will deliver but shows a Resend-owned sender to recipients. Verify `mail.ryan-realty.com` in the Resend dashboard to fix this.

---

### 2.6 followupboss.ts

**Exports.** `findPersonByEmail`, `createOrUpdatePerson`, `createEvent`, `FubPerson`, `FubEventPerson`.

**API wrapped.** FollowUp Boss API v1 (`https://api.followupboss.com/v1`).

**Auth.** HTTP Basic with the API key as the username, empty password. Headers `X-System` and `X-System-Key` are optional and used for system attribution in the FUB activity log.

**Gotchas.** The FUB API does not support upserts natively. `findPersonByEmail` is called first; if found, update the existing record; if not, create a new one. Rate limit is not documented by FUB publicly; in practice the account operates comfortably at 10 requests per second.

---

### 2.7 spark.ts

**Exports.** `fetchListings`, `fetchListingById`, `fetchActiveListings`, `SparkListing`, `SparkPhoto`, `SparkFloorPlan`, `SparkVideo`, `SparkVirtualTour`, `SparkStandardFields`.

**API wrapped.** Spark Replication API (`https://replication.sparkapi.com/v1`).

**Auth.** Bearer token via `SPARK_API_KEY`.

**Gotchas.** Some MLS configurations use the `OAuth` scheme rather than `Bearer`. Set `SPARK_AUTH_SCHEME=OAuth` to try. The replication endpoint differs from the standard Spark API endpoint. Column names in the `listings` Supabase table use mixed-case RETS naming (e.g., `"ListPrice"` not `list_price`) and must be quoted in all SQL.

**Data parity rule.** Per CLAUDE.md §0, any market report figure from Supabase must be cross-checked against the Spark API before rendering. If the delta is greater than 1%, the render must stop and the conflict must be surfaced to Matt.

---

### 2.8 asset-library.mjs

**Exports.** `search`, `register`, `markUsed`, `stats`. CLI available via `node lib/asset-library.mjs <command>`.

**Architecture.** Primary: Supabase Postgres table `asset_library` + Supabase Storage bucket `asset-library`. Cache: local filesystem at `public/asset-library/`. Fallback: local manifest at `data/asset-library/manifest.json`.

**CLI commands.** `search`, `register`, `mark-used`, `stats`, `list`.

**Storage path pattern.** `{type}s/{source}/{uuid}.{ext}` (e.g., `photos/shutterstock/abc123.jpg`).

**Gotchas.** Offline builds fall back to the local manifest. This means an asset registered on another machine won't be visible until the manifest is synced. In CI/CD, always pull the Supabase-backed index rather than relying on the local file.

---

### 2.9 wordpress-client.mjs

**Exports.** `createDraft`, `publishDraft`, `uploadMedia`, `getCategoryId`, `getTagId`, `pingSitemap`.

**API wrapped.** WordPress REST API v2 (`https://ryan-realty.com/wp-json/wp/v2`). Hosted on AgentFire.

**Auth.** WordPress Application Passwords (Basic auth, base64-encoded). Requires `WP_AGENTFIRE_USER` and `WP_AGENTFIRE_APP_PASSWORD` in `.env.local`. These vars are not currently set.

**Gotchas.** All blog publishing is currently blocked because `WP_AGENTFIRE_USER` and `WP_AGENTFIRE_APP_PASSWORD` are absent from `.env.local`. Generate an Application Password from WP Admin under Users > Profile > Application Passwords. Do not use the account password directly.

---

### 2.10 punctuation-guard.ts

**Exports.** `hasDashes`, `findDashes`, `stripDashes`, `assertNoDashes`, `DashViolationError`, `DashFinding`.

**Purpose.** Enforces the em-dash (U+2014) and en-dash (U+2013) ban across all content surfaces. Locked 2026-05-15 per Matt's directive.

**Banned characters.** U+2014 (em-dash), U+2013 (en-dash), U+2015 (horizontal bar), U+2E3A (two-em dash), U+2E3B (three-em dash). Hyphen-minus U+002D is not banned.

**Usage pattern.** Call `assertNoDashes(text, { source: 'path/to/file' })` at every publish boundary. Call `stripDashes(rawCopy)` when accepting external or AI-generated content.

---

### 2.11 grok-video.ts

**Exports.** `generateFlyoverVideo`, `FlyoverVideoOptions`.

**API wrapped.** xAI Grok Imagine Video (`https://api.x.ai/v1/videos/generations`).

**Model.** `grok-imagine-video`. Default duration 10 seconds. Supported aspect ratios: `16:9`, `9:16`, `1:1`. Supported resolutions: `720p`, `480p`.

**Gotchas.** The xAI video generation API is async. The function polls `/v1/videos/{id}` every 5 seconds for up to 10 minutes. If the video is not ready after 10 minutes, it throws. Temporary URLs returned by the API expire; download and re-upload to Supabase Storage immediately.

---

### 2.12 synthesia-constants.ts

**Exports.** `SYNTHESIA_AVATAR_OPTIONS`, `DEFAULT_INTRO_PROMPT`, `SynthesiaAvatarOption`.

**Avatar IDs available.** Ada (EXPRESS-1), Alex (EXPRESS-1), Francesca (EXPRESS-1), Julia (EXPRESS-1), Kayla (EXPRESS-1), Paloma (EXPRESS-1), Talia (EXPRESS-1), Jaz (EXPRESS-1), Joshua (EXPRESS-1), Aaron (V3), Alex (V3), Caroline (V3), Charles (V3).

**Note.** Synthesia avatars require an AI-disclosure tag in any public-facing content per the anti-slop manifesto. Never present a Synthesia avatar as "Matt talking."

---

### 2.13 threads.ts

**Exports.** Token management, `publishThreadsPost`, `publishThreadsImage`, `publishThreadsVideo`.

**API wrapped.** Threads API v1.0 (`https://graph.threads.net/v1.0`).

**OAuth scopes.** `threads_basic,threads_content_publish`.

**Gotchas.** Meta migrated from `threads.net` to `threads.com` for OAuth authorization. The old `.net` OAuth URL drops query params and causes error 4476002. Use `https://www.threads.com/oauth/authorize` for authorization but `https://graph.threads.net` for token and API calls.

---

### 2.14 tiktok.ts

**Exports.** Token management, `publishTikTokVideo`, `initVideoUpload`, `getUserInfo`.

**API wrapped.** TikTok Content Posting API v2 (`https://open.tiktokapis.com/v2/`).

**Current status.** Sandbox only. TikTok app (ID: 7629121889511966727) was rejected from production on 2026-05-12 due to Terms of Service / Share Kit notes. Sandbox posts are forced to `SELF_ONLY` privacy and only visible to the sandbox tester account (`ryanrealtybend1`).

---

### 2.15 youtube.ts

**Exports.** `uploadYouTubeVideo`, `getYouTubeAnalytics`, `getChannelInfo`, OAuth helpers.

**API wrapped.** YouTube Data API v3 (`https://www.googleapis.com/youtube/v3`), YouTube Analytics API v2 (`https://youtubeanalytics.googleapis.com/v2`).

**OAuth scopes.** `youtube.upload`, `youtube.readonly`, `yt-analytics.readonly`, `youtube.force-ssl`.

**Gotchas.** YouTube upload requires an established channel linked to the same Google account that holds the OAuth client. Confirm the Ryan Realty YouTube channel exists before attempting uploads.

---

### 2.16 pinterest.ts

**Exports.** Token management, `publishPin`, `createBoard`, `uploadPinterestMedia`.

**API wrapped.** Pinterest API v5 (`https://api.pinterest.com/v5/`).

**OAuth scopes.** `boards:read pins:write`.

**Status.** `PINTEREST_CLIENT_ID` and `PINTEREST_CLIENT_SECRET` are commented out in `.env.local`. No credentials present. First-time OAuth flow has not been completed.

---

### 2.17 google-business-profile.ts, ga4-data-api.ts, nextdoor.ts

**google-business-profile.ts.** Wraps the Business Profile Performance API and My Business Account Management API. Exports GBP OAuth helpers and `getGBPDailyMetrics`. Status: configured but GBP API allowlist approval pending.

**ga4-data-api.ts.** Wraps the Google Analytics Data API v1. Exports `runReport`, `getActiveUsers`, `getPageViews`. Authenticates via service account `viewer@ryanrealty.iam.gserviceaccount.com` with DWD to `matt@ryan-realty.com`. GA4 Property ID: `527333348`.

**nextdoor.ts.** Nextdoor API wrapper. Auth credentials not present in `.env.local`. Listed in lib/ but not yet wired.

---

**Section B citations:**

| Reference | URL | Notes |
|---|---|---|
| Meta Graph API docs | https://developers.facebook.com/docs/graph-api | v25.0 reference |
| LinkedIn UGC Posts API | https://learn.microsoft.com/en-us/linkedin/marketing/integrations/community-management/shares/ugc-post-api | Deprecated in favor of REST Posts |
| LinkedIn REST Posts API | https://learn.microsoft.com/en-us/linkedin/marketing/integrations/community-management/shares/posts-api | Current as of 2026 |
| Resend API reference | https://resend.com/docs/api-reference/emails/send-email | Send endpoint |
| FollowUp Boss API | https://api.followupboss.com/v1/ | People, events endpoints |
| Spark API docs | https://sparkplatform.com/docs/api_services/listings | Replication tier |
| WordPress REST API | https://developer.wordpress.org/rest-api/reference/ | v2 endpoints |
| Threads API reference | https://developers.facebook.com/docs/threads | Content Posting API |
| TikTok Content Posting API | https://developers.tiktok.com/doc/content-posting-api-get-started | v2 direct post |
| YouTube Data API | https://developers.google.com/youtube/v3 | Upload and data endpoints |
| Pinterest API v5 | https://developers.pinterest.com/docs/api/v5/ | Pins and boards |
| GBP Performance API | https://developers.google.com/my-business/reference/businessprofileperformance | Daily metrics reference |

---

## 3. npm and python packages

Packages are drawn from `/Users/matthewryan/RyanRealty/package.json` and `/Users/matthewryan/RyanRealty/listing_video_v4/package.json`. Python packages are not formally declared; individual scripts import from the system Python environment.

### 3.1 Production dependencies (Next.js app)

| Package | Version in package.json | Role |
|---|---|---|
| `next` | 16.1.6 | Web framework, SSR, API routes, image optimization |
| `react` / `react-dom` | 19.2.3 | UI rendering |
| `@supabase/supabase-js` | 2.98.0 | Supabase client for browser and server |
| `@supabase/ssr` | ^0.9.0 | SSR cookie-based auth helpers |
| `@google-analytics/data` | ^5.2.1 | GA4 Data API Node client |
| `googleapis` | ^171.4.0 | Google APIs (YouTube, Drive, Search Console) |
| `resend` | ^6.9.3 | Transactional email SDK |
| `recharts` | ^2.15.4 | Chart components for market data visualization |
| `@react-google-maps/api` | ^2.20.8 | Google Maps React wrapper |
| `@googlemaps/markerclusterer` | ^2.6.2 | Marker clustering for property maps |
| `radix-ui` | ^1.4.3 | Primitive UI components (base for shadcn/ui) |
| `@upstash/redis` | ^1.37.0 | Redis client for Upstash |
| `@upstash/ratelimit` | ^2.0.8 | Rate limiter middleware |
| `@sentry/nextjs` | ^10.42.0 | Error monitoring |
| `@react-pdf/renderer` | ^4.2.0 | PDF generation (CMA delivery) |
| `geist` | ^1.3.1 | Geist font (canonical body/UI font per design system v2) |
| `@react-email/components` | ^1.0.8 | React email templates |
| `puppeteer-core` | ^24.43.1 | Headless browser for HTML renders |
| `@sparticuz/chromium-min` | ^138.0.2 | Lambda-compatible Chromium binary for Puppeteer |
| `date-fns` | ^4.1.0 | Date formatting and math |
| `xlsx` | ^0.18.5 | Excel file read/write for market data exports |
| `embla-carousel-react` | ^8.6.0 | Carousel UI component |
| `vaul` | ^1.1.2 | Drawer UI component |
| `sonner` | ^2.0.7 | Toast notification component |
| `isomorphic-dompurify` | ^3.3.0 | HTML sanitization |

---

### 3.2 Development dependencies (Next.js app)

| Package | Version | Role |
|---|---|---|
| `@playwright/test` | 1.58.2 | End-to-end test runner |
| `fluent-ffmpeg` | ^2.1.3 | ffmpeg wrapper for audio/video processing |
| `@ffmpeg-installer/ffmpeg` | ^1.1.0 | Bundles the ffmpeg binary for Node use |
| `@napi-rs/canvas` | ^0.1.97 | Canvas rendering (social graphics, no browser needed) |
| `supabase` | ^2.76.16 | Supabase CLI for local dev and migrations |
| `vitest` | ^4.0.18 | Unit test runner |
| `docx` | ^9.6.1 | Word document generation |
| `pdfjs-dist` | ^4.10.38 | PDF parsing on the client |
| `pg` | ^8.20.0 | Postgres client for migration scripts |
| `tesseract.js` | ^7.0.0 | OCR for extracting text from images |
| `tailwindcss` | ^4 | CSS framework |
| `@tailwindcss/typography` | ^0.5.19 | Prose typography plugin |
| `@lhci/cli` | ^0.15.1 | Lighthouse CI for performance gates |
| `pa11y-ci` | ^4.1.0 | Accessibility CI runner |
| `husky` | ^9.1.7 | Git hooks (pre-commit punctuation guard, build checks) |
| `eslint` | ^9 | Linter |
| `typescript` | ^5 | Type compiler |
| `sharp` | (via `npm install` in scripts) | Image processing: resize, composite, format convert |
| `playwright` | (via scripts) | Browser automation for HTML-to-image/PDF renders |

---

### 3.3 Remotion video pipeline (listing_video_v4)

| Package | Version | Role |
|---|---|---|
| `remotion` | 4.0.290 | Video composition framework |
| `@remotion/bundler` | 4.0.290 | Webpack bundler for Remotion comps |
| `@remotion/cli` | 4.0.290 | CLI for render, studio, preview |
| `@remotion/renderer` | 4.0.290 | Node renderer (headless Chrome-based) |
| `@remotion/three` | ^4.0.290 | Three.js integration for 3D comps |
| `@react-three/fiber` | ^8.18.0 | React renderer for Three.js |
| `@react-three/drei` | ^9.122.0 | Three.js helpers and abstractions |
| `three` | ^0.184.0 | 3D graphics engine |

**Render command pattern.** `cd listing_video_v4 && npx remotion render src/index.ts <CompId> out/<name>.mp4 --codec h264 --concurrency 1 --crf 22 --image-format=jpeg --jpeg-quality=92`. Concurrency must be 1 to avoid Chrome OOM.

**Root-level remotion.** The root `package.json` also includes `"remotion": "^4.0.290"` as a dev dependency for the video pipeline under `video/`.

---

### 3.4 Script-level packages (not in package.json, required in individual scripts)

These are installed via `npm install` or expected in the environment:

| Package | Used in | Role |
|---|---|---|
| `sharp` | `scripts/build-platform-mockups.mjs`, `scripts/composite-social-assets.mjs`, and 8+ other scripts | Image resize, composite, format conversion. Used for all static social-graphic generation. |
| `playwright` / `chromium` | `scripts/render-ig-post.mjs`, `scripts/render-tumalo-flyers.js`, and 5+ others | Headless Chrome for rendering HTML templates to PNG/PDF |
| `fluent-ffmpeg` | `scripts/reprocess-hero-video.mjs` | ffmpeg JS wrapper for video re-encoding |

---

### 3.5 Python packages (system Python, no requirements.txt)

Python scripts under `scripts/` use standard library modules only except:

| Package | Script | Role |
|---|---|---|
| `Pillow` (PIL) | [unverified - not confirmed in grep] | Image manipulation in Python scripts |
| `requests` | [unverified] | HTTP requests from Python build scripts |

No `requirements.txt` or `pyproject.toml` found in the repo. Python usage is minimal; JavaScript/Node is the primary runtime.

---

**Section C citations:**

| Reference | URL | Notes |
|---|---|---|
| Next.js 16 changelog | https://nextjs.org/blog/next-16 | Version confirmed in package.json |
| Remotion 4.0 docs | https://www.remotion.dev/docs/ | Version 4.0.290 in use |
| Supabase JS v2 reference | https://supabase.com/docs/reference/javascript | v2.98.0 in use |
| Playwright docs | https://playwright.dev/docs/intro | v1.58.2 in use |
| Sharp docs | https://sharp.pixelplumbing.com/ | Image processing |
| Recharts docs | https://recharts.org/en-US/ | Chart library |
| fluent-ffmpeg | https://github.com/fluent-ffmpeg/node-fluent-ffmpeg | Node ffmpeg wrapper |

---

## 4. API keys in .env.local

Every env var present in `/Users/matthewryan/RyanRealty/.env.local` as of 2026-05-16. Sensitive values are not reproduced here; the file is gitignored and is the authoritative source.

| Env var | Service | Status | Scopes / Notes | Consumers |
|---|---|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | App config | Active | Public URL: `https://ryanrealty.vercel.app` | All |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase | Active | Project URL: `https://dwvlophlbvvygjfxcrhm.supabase.co` | All |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase | Active | JWT, anon role, expires 2088 | Client-side reads |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase | Active | JWT, service role, full bypass RLS | Server-side only |
| `SPARK_API_BASE_URL` | Spark MLS API | Active | `https://replication.sparkapi.com/v1` | `lib/spark.ts`, sync scripts |
| `SPARK_API_KEY` | Spark MLS API | Active | Bearer token, ODS + CRS + SOMLS access | `lib/spark.ts` |
| `CURSOR_API_KEY` | Cursor IDE | Active | Cursor API key | Cursor editor only |
| `XAI_API_KEY` | xAI Grok | Active | Chat and image/video generation access | `lib/grok-text.ts`, `lib/grok-video.ts`, `lib/grok-image.ts` |
| `OPENAI_API_KEY` | OpenAI | Active | Full API access (GPT-4, embeddings) | Various AI tasks |
| `REPLICATE_API_TOKEN` | Replicate | Active | Full account access, webhook support | Video generation scripts |
| `SYNTHESIA_API_KEY` | Synthesia | Active | `/v2/videos` endpoint verified working | `lib/synthesia-constants.ts`, broker intro flow |
| `FOLLOWUPBOSS_API_KEY` | FollowUp Boss | Active | Account: `ryan-realty`, owner Matt Ryan | `lib/followupboss.ts`, `lib/fub.ts` |
| `RESEND_API_KEY` | Resend | Active | Send-only restricted key | `lib/resend.ts` |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Google Maps | Active | Map Tiles, 3D Tiles. Geocoding not enabled | `@react-google-maps/api`, Remotion comps |
| `REMOTION_GOOGLE_MAPS_KEY` | Google Maps (Remotion) | Active | Same key, separate var for Remotion context | Video comps |
| `GOOGLE_OAUTH_CLIENT_ID` | Google OAuth | Active | OAuth 2.0 client for user sign-in | Auth routes |
| `GOOGLE_OAUTH_CLIENT_SECRET` | Google OAuth | Active | Client secret | Auth routes |
| `NEXT_PUBLIC_GTM_CONTAINER_ID` | Google Tag Manager | Active | Container GTM-WV6R4NZ5 | Site analytics |
| `NEXT_PUBLIC_GA4_MEASUREMENT_ID` | Google Analytics 4 | Active | G-ST40W4WM6T | Site analytics |
| `GOOGLE_GA4_PROPERTY_ID` | GA4 Data API | Active | Property 527333348 | `lib/ga4-data-api.ts` |
| `GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL` | Google Service Account | Active | `viewer@ryanrealty.iam.gserviceaccount.com` | GA4, SC, Drive, Sheets |
| `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | Google Service Account | Active | RSA private key for SA auth | GA4, SC, Drive, Sheets |
| `GOOGLE_SERVICE_ACCOUNT_SUBJECT` | Google Service Account | Active | DWD impersonation: `matt@ryan-realty.com` | GA4, SC, Drive |
| `NEXT_PUBLIC_ADSENSE_CLIENT_ID` | Google AdSense | Active | Publisher ID pub-5928669094439003 | Site monetization |
| `NEXT_PUBLIC_META_PIXEL_ID` | Meta Pixel | Active | Pixel 1546878946032105 (old pixel; replacement pending) | Site conversion tracking |
| `META_AD_ACCOUNT_ID` | Meta Ads | Active | Ad account 1178780510184911 | `lib/meta-graph.ts` ad insights |
| `META_APP_ID` | Meta App | Active | App 901712509522992 "Ryan Realty" | OAuth flows |
| `META_APP_SECRET` | Meta App | Active | App secret | Token exchange |
| `META_FB_PAGE_ID` | Facebook Page | Active | Page 138563319329985 "Ryan Realty Bend" | Publishing |
| `META_IG_BUSINESS_ACCOUNT_ID` | Instagram | Active | IG account 17841457921332277 (@ryanrealtybend) | Publishing |
| `META_PAGE_ACCESS_TOKEN` | Meta Graph | Configured | Long-lived page token, issued 2026-04-14. `data_access_expires_at: 2026-07-13`. Re-grant required before that date. | All publishing via `lib/meta-graph.ts` |
| `META_CAPI_ACCESS_TOKEN` | Meta CAPI | Configured | Conversions API token for pixel dataset | `lib/meta-capi.ts` |
| `META_USER_ACCESS_TOKEN` | Meta System User | Configured | Never-expires user-level token for ad management | Ad campaign writes |
| `UNSPLASH_ACCESS_KEY` | Unsplash | Active | Read-only photo search | `lib/photo-api.ts`, stock-photo searches |
| `SHUTTERSTOCK_API_KEY` + `SHUTTERSTOCK_API_SECRET` | Shutterstock | Active | Search only; license separately before production use | `lib/shutterstock-api.ts` |
| `CRON_SECRET` | Vercel Cron Auth | Active | Hex secret used to authenticate cron handler calls | All `/api/cron/` routes |
| `SENTRY_DSN` | Sentry | Unset (placeholder) | DSN placeholder `https://your-dsn@o0.ingest.sentry.io/0` indicates not configured | Error monitoring |
| `SENTRY_AUTH_TOKEN` | Sentry | Configured | Source map upload token | Build step |
| `INNGEST_EVENT_KEY` | Inngest | Configured | Event ingestion key | Background jobs |
| `INNGEST_SIGNING_KEY` | Inngest | Configured | Signature verification for webhooks | Background jobs |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis | Active | REST URL for the Redis instance | Rate limiting, token state |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis | Active | REST token | Rate limiting |
| `SKYSLOPE_ACCESS_KEY` + `SKYSLOPE_ACCESS_SECRET` | SkySlope | Active | Transaction forms access | Compliance scripts |
| `SKYSLOPE_CLIENT_ID` + `SKYSLOPE_CLIENT_SECRET` | SkySlope | Active | CSM credentials | SkySlope API |
| `SCHOOLDIGGER_API_KEY` + `SCHOOLDIGGER_APP_ID` | SchoolDigger | Unset | Empty placeholders; not yet provisioned | Neighborhood data |
| `GOOGLE_BUSINESS_PROFILE_ACCOUNT_ID` | GBP | Active | Account 110410802145038359821 | `lib/google-business-profile.ts` |
| `GOOGLE_BUSINESS_PROFILE_LOCATION_ID` | GBP | Active | Location 338565511043734753 | `lib/google-business-profile.ts` |
| `TIKTOK_CLIENT_KEY` + `TIKTOK_CLIENT_SECRET` | TikTok | Sandbox | Sandbox app credentials. Production rejected 2026-05-12. | `lib/tiktok.ts` |
| `TIKTOK_REDIRECT_URI` | TikTok | Configured | `https://ryanrealty.vercel.app/api/tiktok/callback` | OAuth flow |
| `FAL_KEY` | fal.ai | Exhausted | Balance consumed as of 2026-04-27. Do not top up unless Runway Gen-4 is needed. | AI video (blocked) |
| `ELEVENLABS_API_KEY` | ElevenLabs | Active | `ryan-realty-automation` key, created 2026-04-24. Creator tier. | All VO synthesis |
| `ELEVENLABS_VOICE_ID_VICTORIA` | ElevenLabs | Active | Victoria voice ID: `qSeXEcewz7tA0Q0qk9fH` | All video VO |
| `ELEVENLABS_VOICE_ID` | ElevenLabs | Active | Same as Victoria; alias for compatibility | All video VO |
| `X_CLIENT_ID` + `X_CLIENT_SECRET` | X (Twitter) | Configured | OAuth 2.0 app credentials | `lib/x.ts` |
| `X_REDIRECT_URI` | X | Configured | `https://ryanrealty.vercel.app/api/x/callback` | OAuth flow |
| `LINKEDIN_CLIENT_ID` + `LINKEDIN_CLIENT_SECRET` | LinkedIn | Configured | App 235150309, Share on LinkedIn granted | `lib/linkedin.ts` |
| `LINKEDIN_PERSON_ID` | LinkedIn | Configured | Person ID 314211370 | Post authoring |
| `THREADS_CLIENT_ID` + `THREADS_CLIENT_SECRET` | Threads | Configured | Reuses Meta App ID | `lib/threads.ts` |
| `YOUTUBE_CLIENT_ID` + `YOUTUBE_CLIENT_SECRET` | YouTube | Configured | Reuses Google OAuth client | `lib/youtube.ts` |
| `ANTHROPIC_API_KEY` | Anthropic | Active | Claude API key for orchestrator and agent tasks | Orchestrator, brain skills |
| `APIFY_API_TOKEN` | Apify | Active | Added 2026-05-15 | `lib/marketing-brain/competitor-recon.ts` |

**Action items (keys with issues):**

1. `SENTRY_DSN`: Replace placeholder with real Sentry DSN from the `ryan-realty-llc` organization.
2. `RESEND_FROM`: Add and verify `mail.ryan-realty.com` in Resend dashboard. Set `RESEND_FROM=Ryan Realty <noreply@mail.ryan-realty.com>`.
3. `WP_AGENTFIRE_USER` + `WP_AGENTFIRE_APP_PASSWORD`: Generate and add WordPress Application Password for the blog publishing client.
4. `SCHOOLDIGGER_API_KEY` + `SCHOOLDIGGER_APP_ID`: Provision if neighborhood school data is needed.
5. `META_PAGE_ACCESS_TOKEN`: Re-run Graph API Explorer exchange before 2026-07-13 to renew data access.
6. `GOOGLE_MAPS_API_KEY`: Enable Geocoding API in Cloud Console (project `ryanrealty`, number 725620954432).
7. `PINTEREST_CLIENT_ID` + `PINTEREST_CLIENT_SECRET`: Uncomment and populate when Pinterest publishing is required.

---

**Section D citations:**

| Reference | URL | Notes |
|---|---|---|
| Resend domain verification | https://resend.com/docs/dashboard/domains/add-a-domain | Steps for custom domain |
| Meta Graph Explorer | https://developers.facebook.com/tools/explorer/ | Token refresh flow |
| Google Cloud Console | https://console.cloud.google.com/apis/library | API enable/disable |
| Sentry project setup | https://sentry.io/organizations/ryan-realty-llc/ | DSN available after project creation |
| ElevenLabs Creator tier | https://elevenlabs.io/pricing | 131,000 chars/month |
| TikTok Developer Portal | https://developers.tiktok.com/app/7629121889511966727 | App status and review |

---

## 5. Replicate model registry

Account: `ryanrealty`. Billing via GitHub OAuth. Endpoint: `https://api.replicate.com/v1/predictions`. Webhook: `/api/webhooks/replicate`. All models verified reachable 2026-04-27 per `API_INVENTORY.md` verification log.

Pricing figures are from the API_INVENTORY.md verification log (2026-04-27). Verify current pricing at `https://replicate.com/pricing` before any batch run because Replicate adjusts prices.

### 5.1 Image-to-video and text-to-video models

| Model | Replicate slug | Input | Output | Approx cost | Max duration | Best for |
|---|---|---|---|---|---|---|
| Kling v2.1 Master | `kwaivgi/kling-v2.1-master` | Image + text prompt | MP4, 1080p | ~$1.40 per 5s, ~$2.80 per 10s | 10 seconds | Listing hero shots, luxury b-roll, realistic camera movement |
| Kling v2.1 Pro | `kwaivgi/kling-v2.1-pro` | Image + text prompt | MP4, 1080p | Lower than Master | 10 seconds | Volume work when Master is over budget |
| Veo 3 | `google/veo-3` | Text prompt | MP4 with native audio | ~$2.50 per 5s | 8 seconds (default) | Hero shots with ambient sound |
| Veo 3 Fast | `google/veo-3-fast` | Text prompt | MP4 | ~$1.25 per 5s | 8 seconds | Bulk b-roll for market reports |
| Hailuo 02 | `minimax/hailuo-02` | Image + text prompt | MP4 | ~$0.27/sec | 6 seconds | Lifestyle b-roll, people in motion |
| Seedance 1 Pro | `bytedance/seedance-1-pro` | Image or text | MP4, 1080p | ~$0.10/sec | [unverified] | High-volume market-report filler |
| Wan 2.5 i2v | `wan-video/wan-2.5-i2v` | Image + text prompt | MP4 | ~$0.20/sec | [unverified] | Start-frame-faithful listing hero |
| Luma Ray 2 720p | `luma/ray-2-720p` | Image + text prompt | MP4, 720p | ~$0.40/sec | [unverified] | Cinematic drone-style camera sweeps |
| Ray Flash 2 540p | `luma/ray-flash-2-540p` | Image + text prompt | MP4, 540p | ~$0.18/sec | [unverified] | Draft/exploration before Kling final render |
| Hunyuan Video | `tencent/hunyuan-video` | Text or image | MP4 | ~$0.20/sec | [unverified] | Stylized social-only content |
| LTX Video | `lightricks/ltx-video` | Text or image | MP4 | ~$0.05/sec | Short | Rapid iteration, scratch tests |

### 5.2 Image models

| Model | Replicate slug | Input | Output | Approx cost | Notes |
|---|---|---|---|---|---|
| Flux Pro | `black-forest-labs/flux-pro` | Text prompt | PNG/JPG | ~$0.05/image | High-quality realistic images |
| Stable Diffusion | Various | Text or image prompt | PNG | $0.001-0.01/image | Lower quality; faster |
| Real-ESRGAN (upscaling) | `nightmareai/real-esrgan` | Image | Upscaled image | ~$0.001/sec | Used to upscale 540p Ray Flash drafts to 1080p |

### 5.3 Depth and 3D models

| Model | Replicate slug | What it does | Use case |
|---|---|---|---|
| MiDaS | `andreasjansson/midas` | Mono depth estimation from a single image | DepthFlow parallax generation |
| Depth Anything V2 | `depth-anything/depth-anything-v2` | Higher accuracy depth estimation | Listing photo parallax for DepthFlow |

### 5.4 Audio models

| Model | Replicate slug | What it does | Cost |
|---|---|---|---|
| musicgen | `meta/musicgen` | Text-to-music generation | ~$0.001/sec |
| stable-audio | `stability-ai/stable-audio` | High-quality audio generation | [unverified] |

### 5.5 Virtual staging models

| Model | Replicate slug | What it does | Cost | Notes |
|---|---|---|---|---|
| Virtual staging (search Replicate) | Multiple community models under `virtual-staging` | Replaces furniture in a room image with furnished versions | Varies | No canonical Ryan Realty-verified model. Research `https://replicate.com/explore?query=virtual-staging` before use. `[unverified]` |

### 5.6 Face and avatar models

| Model | Replicate slug | What it does | Cost |
|---|---|---|---|
| face-to-many | `fofr/face-to-many` | Stylizes a face portrait into different styles | ~$0.02/run |

Currently the only Replicate model used in production (broker headshot generator at `app/actions/broker-headshot.ts`).

### 5.7 Selection guide

| Need | Recommended model | Reason |
|---|---|---|
| Listing hero movement | Kling v2.1 Master | Best physics, highest quality |
| Budget listing hero | Wan 2.5 i2v | Start-frame fidelity at lower cost |
| Market report b-roll | Seedance 1 Pro or Veo 3 Fast | Speed and cost |
| People in motion | Hailuo 02 | Best human-motion coherence |
| Ambient sound scenes | Veo 3 | Only model with native synchronized audio |
| Draft/iteration | Ray Flash 2 540p | Fastest time-to-preview |
| Upscaling drafts | Real-ESRGAN | Bring 540p up to 1080p |
| Background music | musicgen | Text-to-music via Replicate |

---

**Section E citations:**

| Reference | URL | Notes |
|---|---|---|
| Replicate pricing page | https://replicate.com/pricing | Per-second and per-image pricing |
| Kling v2.1 Master model page | https://replicate.com/kwaivgi/kling-v2.1-master | Input schema and cost |
| Veo 3 model page | https://replicate.com/google/veo-3 | Google's video model |
| Hailuo 02 model page | https://replicate.com/minimax/hailuo-02 | Minimax i2v model |
| Seedance 1 Pro model page | https://replicate.com/bytedance/seedance-1-pro | ByteDance i2v model |
| Wan 2.5 i2v model page | https://replicate.com/wan-video/wan-2.5-i2v | Wan image-to-video |
| Luma Ray 2 model page | https://replicate.com/luma/ray-2-720p | Luma cinematics |
| LTX Video model page | https://replicate.com/lightricks/ltx-video | Fast draft video |
| Depth Anything V2 model page | https://replicate.com/depth-anything/depth-anything-v2 | Depth estimation |
| musicgen model page | https://replicate.com/meta/musicgen | Text-to-music |
| face-to-many model page | https://replicate.com/fofr/face-to-many | Face stylization |
| Replicate webhooks docs | https://replicate.com/docs/topics/webhooks | Async prediction callbacks |

---

## 6. Google Maps API surface

Maps key in `.env.local`: `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` and `REMOTION_GOOGLE_MAPS_KEY` (same value, used in different contexts). Cloud project: `ryanrealty`, project number `725620954432`.

**Active APIs (confirmed enabled 2026-04-15):** YouTube Data v3, Gmail, My Business Business Information, Business Profile Performance. Map Tiles and Photorealistic 3D Tiles are used in the Cascade Peaks video comp (`video/cascade-peaks/`).

**Not yet enabled (per API_INVENTORY.md):** Geocoding API returned 404 on 2026-04-27.

### 6.1 Maps JavaScript API

**Endpoint.** Loaded via `<script src="https://maps.googleapis.com/maps/api/js?key=...">`. Also used via `@react-google-maps/api` npm package.

**Capabilities.** Interactive map tiles, marker placement, polygon overlays, info windows, marker clustering, Street View embed.

**Cost.** $7 per 1,000 Dynamic Maps loads. Free monthly credit: $200 (approximately 28,500 loads/month free). Source: [https://developers.google.com/maps/billing-and-pricing/pricing](https://developers.google.com/maps/billing-and-pricing/pricing).

**Use in repo.** All listing-map and neighborhood-boundary displays. `lib/map-polygon.ts` handles boundary polygon rendering.

---

### 6.2 Maps Static API

**Endpoint.** `https://maps.googleapis.com/maps/api/staticmap`.

**Capabilities.** Returns a PNG image of a map at specified center, zoom, size, and markers. No JavaScript required.

**Cost.** $2 per 1,000 requests. Free tier: 100,000 requests/month. Source: [https://developers.google.com/maps/billing-and-pricing/pricing](https://developers.google.com/maps/billing-and-pricing/pricing).

**Use case.** Listing flyers, PDF CMA maps, social graphics where an interactive map is not possible. `lib/cma-map.ts` likely uses this surface.

---

### 6.3 Photorealistic 3D Tiles

**Endpoint.** `https://tile.googleapis.com/v1/3dtiles/root.json?key=...`.

**Capabilities.** Streaming 3D mesh tiles for any location on Earth. Works with three.js / Cesium / deck.gl. Used in `video/cascade-peaks/` for the cinematic flyover.

**Cost.** $0.007 per tile request after the 10,000 tile/month free credit. Source: [https://developers.google.com/maps/documentation/tile/use-renderer](https://developers.google.com/maps/documentation/tile/use-renderer).

**Gotchas.** Requires `REMOTION_GOOGLE_MAPS_KEY` to be set in the Remotion environment. Tiles must be loaded asynchronously before the frame renders. Cache tiles locally during development to avoid per-tile costs.

---

### 6.4 Geocoding API

**Endpoint.** `https://maps.googleapis.com/maps/api/geocode/json`.

**Status.** Not enabled on the `ryanrealty` project. Returned 404 on 2026-04-27. Action item: enable at [https://console.cloud.google.com/apis/library/geocoding-backend.googleapis.com](https://console.cloud.google.com/apis/library/geocoding-backend.googleapis.com).

**Cost.** $5 per 1,000 requests. Free tier: 40,000 requests/month. Source: [https://developers.google.com/maps/billing-and-pricing/pricing](https://developers.google.com/maps/billing-and-pricing/pricing).

**Use case.** Converting listing street addresses to latitude/longitude for the property map and video flyover prep.

---

### 6.5 Street View Static API

**Endpoint.** `https://maps.googleapis.com/maps/api/streetview`.

**Capabilities.** Returns a static Street View image for any address or lat/lng. Supports heading, pitch, and FOV.

**Cost.** $7 per 1,000 requests. Free tier: 28,500 requests/month. Source: [https://developers.google.com/maps/billing-and-pricing/pricing](https://developers.google.com/maps/billing-and-pricing/pricing).

**Use case.** Listing street-level exterior shot when a professional photo is unavailable. Also useful for neighborhood guide B-roll reference.

---

### 6.6 Places API (new)

**Endpoints.** `https://places.googleapis.com/v1/places:searchText` (Text Search), `https://places.googleapis.com/v1/places:searchNearby` (Nearby Search), `https://places.googleapis.com/v1/places/{place_id}` (Place Details), `https://places.googleapis.com/v1/places/{place_id}/photos/{photo_resource}:getMedia` (Photos).

**Capabilities.** Find businesses, points of interest, and amenities near a location. Return ratings, hours, photos, reviews, and categories.

**Cost.** Text Search: $17 per 1,000 requests. Nearby Search: $32 per 1,000. Place Details: $17 per 1,000 (Basic) to $32 per 1,000 (Advanced). Photos: $7 per 1,000. Source: [https://developers.google.com/maps/billing-and-pricing/pricing](https://developers.google.com/maps/billing-and-pricing/pricing).

**Use case.** Neighborhood guide content ("restaurants within 1 mile," "coffee shops, parks, schools nearby"). Walking-score replacement while SchoolDigger is unprovisioned.

---

### 6.7 Directions API

**Endpoint.** `https://maps.googleapis.com/maps/api/directions/json`.

**Cost.** $10 per 1,000 requests. Free tier: 20,000 requests/month.

**Use case.** "Drive time from Bend to Mt. Bachelor" callout in listing descriptions and neighborhood videos.

---

### 6.8 Distance Matrix API

**Endpoint.** `https://maps.googleapis.com/maps/api/distancematrix/json`.

**Cost.** $10 per 1,000 elements. Free tier: 20,000 elements/month.

**Use case.** Bulk drive-time calculation for neighborhood comparison content.

---

### 6.9 Elevation API

**Endpoint.** `https://maps.googleapis.com/maps/api/elevation/json`.

**Cost.** $5 per 1,000 requests. Free tier: 40,000 requests/month.

**Use case.** Elevation data for mountain-town listings (Cascade Peaks, NW Crossing, Awbrey Heights).

---

### 6.10 Aerial View API

**Endpoint.** `https://aerialview.googleapis.com/v1/videos:lookupVideo`.

**Capabilities.** Returns aerial (drone-style) video tiles for a given address. Requires postal address; not lat/lng. Available for most US properties.

**Cost.** $2 per 1,000 requests (render); $1 per 1,000 (metadata). Source: [https://developers.google.com/maps/documentation/aerial-view/overview](https://developers.google.com/maps/documentation/aerial-view/overview).

**Use case.** Property listing intro shot when no drone footage is available and Replicate video generation is over budget. Returns a short MP4 usable as a B-roll clip.

---

### 6.11 Google Earth Studio

**Access.** [https://earth.google.com/studio/](https://earth.google.com/studio/). Free, browser-based. Requires a Google account. No API.

**Capabilities.** Create cinematic flyover animations anchored to real Earth coordinates. Export as PNG sequence or MP4. Used for neighborhood overview fly-in shots.

**Limitations.** Not scriptable. Must be operated manually in the browser. No headless or API mode. Output must be downloaded and post-processed in Remotion or ffmpeg.

---

### 6.12 Mapbox (deprecated)

Mapbox was the previous map provider. `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN` is commented out in `.env.local`. Do not introduce new Mapbox usage. All new map work goes through Google Maps.

---

### 6.13 Apple MapKit JS

**Access.** `https://developer.apple.com/maps/web/`. Requires Apple Developer account and MapKit JS token.

**Capabilities.** Interactive maps with Apple Maps tiles, look-around (Apple's Street View equivalent), 3D buildings.

**Cost.** 250,000 map views/month free. Additional usage billed per 1,000 views. Source: [https://developer.apple.com/maps/resources/](https://developer.apple.com/maps/resources/).

**Status.** Not currently integrated. No Apple Developer credentials in `.env.local`. Listed for future comparison.

---

**Section F citations:**

| Reference | URL | Notes |
|---|---|---|
| Google Maps Platform pricing | https://developers.google.com/maps/billing-and-pricing/pricing | All surfaces |
| Geocoding API docs | https://developers.google.com/maps/documentation/geocoding | Endpoint and params |
| Aerial View API overview | https://developers.google.com/maps/documentation/aerial-view/overview | Property video tiles |
| Maps Static API guide | https://developers.google.com/maps/documentation/maps-static/overview | Static image tiles |
| Street View Static API | https://developers.google.com/maps/documentation/streetview/overview | Street-level imagery |
| Places API (new) docs | https://developers.google.com/maps/documentation/places/web-service/op-overview | POI search |
| Photorealistic 3D Tiles | https://developers.google.com/maps/documentation/tile/use-renderer | Three.js integration |
| Google Earth Studio | https://earth.google.com/studio/ | Manual flyover tool |
| Apple MapKit JS | https://developer.apple.com/maps/resources/ | Reference only |

---

## 7. AI providers

### 7.1 xAI Grok

**API key.** `XAI_API_KEY` (Active).

**Base URL.** `https://api.x.ai/v1`.

**Model lineup (verified 2026-04-27 via `GET /v1/models`):**

| Model | Capability | Notes |
|---|---|---|
| `grok-4.20` | Text chat and reasoning | Latest Grok text model as of verification |
| `grok-imagine-image` | Text-to-image | Illustrative/stylized aesthetic |
| `grok-imagine-image-pro` | Text-to-image (higher quality) | More photo-realistic than base |
| `grok-imagine-video` | Text-to-video | Async; polls at `/v1/videos/{id}` |

**Repo usage.** `lib/grok-text.ts` (chat completion), `lib/grok-image.ts` (image generation), `lib/grok-video.ts` (video generation). The "Chat With Us" widget on the site uses `grok-text.ts` for text only.

**Cost.** [unverified as of 2026-05-16; check https://x.ai/api for current pricing].

**When to use.** Stylized illustrations, thumbnails with a non-photoreal look. Secondary to Replicate for video. Not recommended as the primary text model (Anthropic Claude is the orchestrator).

---

### 7.2 Veo 3 (Google)

**Access paths:**
1. **Via Replicate** (`google/veo-3` and `google/veo-3-fast`): simplest path, covered in §5.
2. **Via Google AI Studio** (`https://aistudio.google.com/`): web interface only, not API-accessible without Vertex AI.
3. **Via Vertex AI** (`https://cloud.google.com/vertex-ai`): enterprise API access. Not currently configured. Requires a separate GCP project with Vertex AI enabled. Cost on Vertex: [https://cloud.google.com/vertex-ai/generative-ai/pricing](https://cloud.google.com/vertex-ai/generative-ai/pricing).

**Recommendation.** Use Replicate as the access path. It is simpler and uses the same billing account. Vertex AI adds complexity without meaningful benefit for the current use case.

---

### 7.3 Synthesia

**API key.** `SYNTHESIA_API_KEY` (Active, `07c94d15c28dffa3a6f6ddc6d0cce974`).

**Endpoint.** `https://api.synthesia.io/v2/videos`.

**Avatar access.** 13 avatars configured in `lib/synthesia-constants.ts` (EXPRESS-1 and V3 series). Matt's custom avatar is on file for the `/admin/broker` broker intro flow.

**Current usage.** Broker intro video on the admin broker page. Not used in any public-facing video production.

**AI disclosure requirement.** The anti-slop manifesto requires an AI disclosure tag any time a Synthesia avatar is used. Never present a Synthesia avatar as a real person without disclosing AI involvement.

**Cost.** Synthesia pricing as of 2026: Starter $18/month (10 videos), Creator $49/month (30 videos). Source: [https://www.synthesia.io/pricing](https://www.synthesia.io/pricing).

---

### 7.4 Canva AI

**Access.** Via MCP server documented in §1.8. `generate-design` and `generate-design-structured` use Canva's AI generation capability.

**Models used internally.** Canva uses multiple AI providers internally (Stable Diffusion, custom models). The specific models are not exposed via the MCP.

**When to use.** Quick social graphics, print-ready flyers, carousels where Remotion render would be over-engineered. Brand templates in Canva can be populated with listing data and exported as PNG or PDF.

---

### 7.5 ElevenLabs

**API key.** `ELEVENLABS_API_KEY` (`sk_ba38fc136e99c711c33b4d49fb0389d6399e0df8bdc364b2`, Active).

**Tier.** Creator. 131,000 characters/month. Reset: monthly. Cost: $22/month.

**Canonical voice.** Victoria, Voice ID `qSeXEcewz7tA0Q0qk9fH`. Stored as `ELEVENLABS_VOICE_ID_VICTORIA` and `ELEVENLABS_VOICE_ID`.

**Locked settings (2026-05-07, canonical source: `video_production_skills/elevenlabs_voice/SKILL.md`):**
- Model: `eleven_turbo_v2_5`
- stability: `0.40`
- similarity_boost: `0.80`
- style: `0.50`
- use_speaker_boost: `true`
- `previous_text` chaining: required across all lines in a clip

**Endpoints in use:**
- `POST /v1/text-to-speech/{voice_id}` with streaming output
- `POST /v1/forced-alignment` (word-level timestamps for caption sync; high-impact untapped use)
- `POST /v1/sound-generation` (SFX generation; not yet used)

**Voice library structure.** The voice library is account-bound. Available via `GET /v1/voices`. Instant voice cloning is available at Creator tier but requires Matt's explicit written authorization and AI-disclosure tags on any output.

**IPA phoneme support.** Works on `eleven_turbo_v2_5` and `eleven_flash_v2`. Silently skipped on `eleven_v3`. Tricky local place names: Deschutes (`dəˈʃuːts`), Tumalo (`TUM-uh-low`), Paulina (`pol-EYE-nuh`).

**Source.** `video_production_skills/elevenlabs_voice/SKILL.md`. API docs: [https://elevenlabs.io/docs/api-reference/text-to-speech](https://elevenlabs.io/docs/api-reference/text-to-speech).

---

### 7.6 Apify for real estate

Documented in §1.6. Actors particularly useful for Ryan Realty:

| Actor | What it surfaces | Impact |
|---|---|---|
| `apify/instagram-scraper` | Competitor brokerage post performance | Competitive intelligence |
| `maxcopell/zillow-scraper` | Zillow listing data cross-check | Data parity check |
| `apify/google-maps-scraper` | Competitor GBP ratings, review counts | Brand-position benchmarking |
| `clockworks/tiktok-scraper` | Top-performing real estate TikTok content | Platform-trend research |

---

### 7.7 OpenAI

**API key.** `OPENAI_API_KEY` (Active). Full API access (GPT-4o, embeddings, Whisper).

**Current usage.** Not explicitly used in any identified lib/ file; key is present for future use.

**Models relevant to the pipeline.** GPT-4o for complex reasoning tasks; `text-embedding-3-large` for semantic search on the asset library; Whisper for audio transcription.

---

### 7.8 Anthropic

**API key.** `ANTHROPIC_API_KEY` (Active). Used by the orchestrator and brain skills running in Claude Code.

**Models available.** Claude claude-opus-4-5 (orchestrator), Claude Sonnet 4.6 (sub-agents per Opus Orchestrator Policy in CLAUDE.md), Claude Haiku (bulk mechanical tasks).

**Source.** [https://docs.anthropic.com/en/api/getting-started](https://docs.anthropic.com/en/api/getting-started).

---

**Section G citations:**

| Reference | URL | Notes |
|---|---|---|
| xAI API docs | https://docs.x.ai/api | Models, endpoints |
| Veo 3 on Vertex AI pricing | https://cloud.google.com/vertex-ai/generative-ai/pricing | Enterprise access path |
| Synthesia pricing | https://www.synthesia.io/pricing | Creator tier |
| ElevenLabs API reference | https://elevenlabs.io/docs/api-reference/text-to-speech | TTS and alignment |
| ElevenLabs pricing | https://elevenlabs.io/pricing | Creator tier 131k chars |
| ElevenLabs forced alignment | https://elevenlabs.io/docs/api-reference/forced-alignment | Word-level timestamps |
| Anthropic API docs | https://docs.anthropic.com/en/api/getting-started | Claude models |
| OpenAI API reference | https://platform.openai.com/docs/api-reference | GPT-4o, embeddings |
| Replicate account page | https://replicate.com/ryanrealty | Model usage history |

---

## 8. Marketing and communications APIs

### 8.1 AgentFire WordPress REST API

**Endpoint.** `https://ryan-realty.com/wp-json/wp/v2`.

**Auth.** WordPress Application Passwords (Basic auth). Required env vars: `WP_AGENTFIRE_USER`, `WP_AGENTFIRE_APP_PASSWORD`, optional `WP_AGENTFIRE_SITE_URL`.

**Status.** Credentials not yet set in `.env.local`. Publishing is blocked until credentials are configured.

**Exports from `lib/wordpress-client.mjs`:**
- `createDraft({ title, content, excerpt, slug, categories, tags, featured_media, meta })`: Creates a post in draft state.
- `publishDraft(postId)`: Transitions a draft to published status.
- `uploadMedia(filePath, { title, alt_text, caption })`: Uploads an image to the WP media library.
- `getCategoryId(slug)`: Returns the numeric category ID for a category slug.
- `getTagId(name)`: Returns or creates a tag and returns its numeric ID.
- `pingSitemap()`: Triggers sitemap refresh after publishing.

**Rate limits.** WordPress REST API has no formal rate limits at the server level, but AgentFire hosting may apply per-IP limits. No documented limit found; treat as 10-20 requests/second as a safe operating ceiling.

**Source.** [https://developer.wordpress.org/rest-api/reference/](https://developer.wordpress.org/rest-api/reference/).

---

### 8.2 Resend (transactional email)

**API key.** `RESEND_API_KEY` (`re_ZJdcEEX9_7j8iknx2QRY2tf9ZbEptzBeK`, Active send-only key).

**Verified senders.** Only `onboarding@resend.dev` (Resend sandbox) confirmed working as of 2026-04-27. `mail.ryan-realty.com` is not yet verified.

**Usage in repo.** `lib/resend.ts`. Current uses: CMA delivery, contact-form notifications, home valuation request responses.

**Untapped uses.** Listing status change drip emails to buyer leads, weekly market-report email to FUB segments, transactional sequences for seller funnel.

**Rate limits.** Resend free tier: 3,000 emails/month. Current plan: Pro ($20/month, 50,000 emails/month). Source: [https://resend.com/pricing](https://resend.com/pricing).

**Source.** [https://resend.com/docs/api-reference/emails/send-email](https://resend.com/docs/api-reference/emails/send-email).

---

### 8.3 Supabase (tables, storage, edge functions)

**Project.** `ryan-realty-platform`, project ID `dwvlophlbvvygjfxcrhm`. URL: `https://dwvlophlbvvygjfxcrhm.supabase.co`.

**Row count note.** The `listings` table has 589,000+ rows as of 2026-04-29. Always paginate or aggregate; never `SELECT *` without a tight filter.

**Key tables (from migrations, 2026-05-16):**

| Table | Purpose | Key columns |
|---|---|---|
| `listings` | Full MLS replication from Spark | `"ListPrice"`, `"StandardStatus"`, `"ClosePrice"`, `"CloseDate"`, `"PropertyType"`, `year_built`, `pending_timestamp`, `price_per_sqft` |
| `listing_history` | Historical price and status changes | `listing_id`, `status`, `list_price`, `close_price`, `changed_at` |
| `market_pulse_live` | Pre-computed current market stats (29 cols) | `city`, `neighborhood`, `active_count`, `median_price`, `dom`, `mos`, `mom_change`, `yoy_change` |
| `market_stats_cache` | Historical market snapshots (40 cols) | `city`, `period_start`, `period_end`, `metric`, `value` |
| `neighborhoods` | Neighborhood definitions and boundaries | `name`, `slug`, `city`, `boundary_geojson`, `boundary_source` |
| `neighborhood_subdivisions` | Subdivision-to-neighborhood mapping | `subdivision_name`, `neighborhood_id` |
| `boundaries` | Administrative boundary polygons | `type`, `name`, `geojson`, `boundary_source` |
| `cities` | City config and content | `name`, `slug`, `state`, `hero_image_url` |
| `brokers` | Broker roster | `id`, `full_name`, `email`, `license_number`, `headshot_url` |
| `cmas` | Finalized CMA records | `subject_address`, `pdf_url`, `created_by`, `approved_at` |
| `cma_comps` | Comps used in each CMA | `cma_id`, `listing_key`, `is_primary` |
| `marketing_brain_actions` | All marketing action rows | `action_type`, `target`, `assigned_producer`, `payload`, `status`, `executor_response` |
| `content_briefs` | View over `marketing_brain_actions` for backward compat | Same as `marketing_brain_actions` |
| `content_performance` | Per-content engagement metrics | `action_id`, `platform`, `views`, `engagement`, `saved`, `fetched_at` |
| `marketing_channel_daily` | Daily channel-level metrics | `platform`, `date`, `followers`, `impressions`, `reach` |
| `content_calendar` | Scheduled content items | `action_id`, `platform`, `scheduled_for`, `status` |
| `marketing_decisions` | Archived brain decisions and rationale | `cycle_date`, `decision`, `evidence` |
| `competitor_intel` | Competitor brokerage intelligence | `competitor_name`, `platform`, `metric`, `value`, `fetched_at` |
| `asset_library` | Media asset index | `id`, `type`, `source`, `geo`, `tags`, `storage_path`, `last_used_at` |
| `x_auth` | X (Twitter) OAuth tokens | `access_token`, `refresh_token`, `expires_at` |
| `linkedin_auth` | LinkedIn OAuth tokens | `access_token`, `refresh_token`, `expires_at` |
| `youtube_auth` | YouTube OAuth tokens | `access_token`, `refresh_token`, `expires_at` |
| `google_business_profile_auth` | GBP OAuth tokens | `access_token`, `refresh_token`, `expires_at` |
| `tiktok_auth` | TikTok OAuth tokens | `access_token`, `open_id`, `expires_at` |
| `threads_auth` | Threads OAuth tokens | `access_token`, `threads_user_id`, `expires_at` |
| `pinterest_auth` | Pinterest OAuth tokens | `access_token`, `refresh_token`, `expires_at` |
| `profiles` | User profiles (buyers, registered site users) | `id`, `email`, `full_name`, `default_city` |
| `saved_listings` | User-saved listings | `profile_id`, `listing_key` |
| `saved_searches` | User-saved search filters | `profile_id`, `filters`, `name` |
| `listing_inquiries` | Contact form submissions | `listing_key`, `email`, `message`, `created_at` |
| `transactions` | Transaction tracker | `id`, `listing_key`, `status`, `close_date`, `close_price` |
| `strict_verify_run_log` | MLS sync verification log | `run_id`, `started_at`, `verified_count`, `mismatches` |
| `app_config` | Runtime config values | `key`, `value`, `updated_at` |
| `marketing_inbox_events` | Inbound email/DM parse events | `platform`, `subject`, `sender`, `parsed_at` |
| `content_classification` | Content classification results | `action_id`, `category`, `score` |

**Storage buckets:**

| Bucket | Contents | Access |
|---|---|---|
| `listing-photos` | Listing photo cache from Spark | Private with signed URLs |
| `asset-library` | Registered brand and production assets | Public read for approved files |
| `cma-deliveries` | Generated CMA HTML and PDF files | Private |
| `hero-videos` | Listing tour hero video MP4s | Public read |

**Edge functions.** Deployed edge functions are listed via the Supabase MCP `list_edge_functions` tool. Not enumerated here; check the project for the current set.

**Column-name gotcha.** The `listings` table uses mixed-case RETS column names. Every reference to a mixed-case column must be wrapped in double quotes in SQL. Example: `"ListPrice"`, `"StandardStatus"`, `"CloseDate"`. Lowercase columns (`year_built`, `price_per_sqft`) do not require quoting.

---

### 8.4 FollowUp Boss CRM

**API key.** `FOLLOWUPBOSS_API_KEY` (Active).

**Base URL.** `https://api.followupboss.com/v1`.

**Auth.** HTTP Basic with API key as username, empty password.

**Endpoint inventory (from lib/followupboss.ts and lib/fub.ts):**

| Endpoint | Method | What it does |
|---|---|---|
| `/people` | GET | Search people by email, phone, name |
| `/people` | POST | Create a new contact record |
| `/people/{id}` | PUT | Update an existing contact |
| `/events` | POST | Create a tracked event (lead, inquiry, page view) |
| `/notes` | POST | Create a note on a contact record |
| `/tasks` | POST | Create a task on a contact record |
| `/identity` | GET | Returns account info (used for connection verification) |

**FUB account.** Account `ryan-realty`. Matt is owner, isAdmin=true, role=Broker.

**FUB lead phone (tracked).** `541.703.3095` (FUB-tracked, routes calls through FUB for attribution). Matt's direct line: `541.213.6706`.

**Tags used by the pipeline.** `seller_intent`, `seller_curious`, `video-engagement`, platform-specific source tags.

**Source.** [https://api.followupboss.com/v1/](https://api.followupboss.com/v1/).

---

### 8.5 Inngest (background jobs)

**Keys.** `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY` (Configured).

**Endpoint.** `https://api.inngest.com/e/app/events` (event ingestion).

**Usage.** Background job runner for the video pipeline. The pattern per `API_INVENTORY.md`: Spark webhook (listing goes Active) fires an Inngest event, which fans out to render, upload, and publish steps. `lib/inngest.ts` wraps the event ingestion call.

**Source.** [https://www.inngest.com/docs/events](https://www.inngest.com/docs/events).

---

### 8.6 SkySlope

**Keys.** `SKYSLOPE_ACCESS_KEY`, `SKYSLOPE_ACCESS_SECRET`, `SKYSLOPE_CLIENT_ID`, `SKYSLOPE_CLIENT_SECRET` (Active).

**Purpose.** Transaction management and compliance form workflow. Used by brokerage compliance scripts only. Do not use SkySlope as an authoritative source for transaction data; use Vault (per CLAUDE.md note: "Vault is the sole source of truth for transaction coordination").

**Current usage.** `scripts/skyslope-forms-*.mjs` scripts for audit and document management.

---

### 8.7 Upstash Redis

**Keys.** `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` (Active).

**Instance.** `joint-man-90924.upstash.io`. REST-based access via `@upstash/redis`.

**Usage.**
- Rate limiting middleware for public API routes.
- OAuth state parameter storage (`STATE_TTL_SECONDS = 600`) for all social platform OAuth flows.
- Token caching for X (Twitter) token state management.

**Source.** [https://upstash.com/docs/redis/overall/getstarted](https://upstash.com/docs/redis/overall/getstarted).

---

**Section H citations:**

| Reference | URL | Notes |
|---|---|---|
| WordPress REST API reference | https://developer.wordpress.org/rest-api/reference/ | v2 endpoints |
| Resend pricing | https://resend.com/pricing | Pro plan limits |
| Resend domain verification | https://resend.com/docs/dashboard/domains/add-a-domain | Setup guide |
| Supabase database usage | https://supabase.com/docs/guides/platform/database-usage | Connection limits |
| Supabase storage docs | https://supabase.com/docs/guides/storage | Bucket management |
| FollowUp Boss API | https://api.followupboss.com/v1/ | Full endpoint list |
| Inngest events docs | https://www.inngest.com/docs/events | Event ingestion |
| Upstash Redis docs | https://upstash.com/docs/redis/overall/getstarted | REST API reference |
| SkySlope developer docs | https://developer.skyslope.com/ | Forms API |
| Google Analytics Data API | https://developers.google.com/analytics/devguides/reporting/data/v1 | GA4 reporting |
| Spark API authentication | https://sparkplatform.com/docs/authentication/access_token | MLS replication |

---

## Summary of action items

Items that block pipeline operations, sorted by impact:

1. **Verify `mail.ryan-realty.com` in Resend dashboard.** Email delivery currently routes through Resend's sandbox sender. Blocks branded email sends.
2. **Add `WP_AGENTFIRE_USER` and `WP_AGENTFIRE_APP_PASSWORD` to `.env.local`.** Blocks all blog publishing.
3. **Enable Geocoding API in Google Cloud Console.** Blocks address-to-coordinates conversion for listing maps and video prep.
4. **Renew `META_PAGE_ACCESS_TOKEN` before 2026-07-13.** The current token's data access window expires on that date. Any API activity before that date resets the 90-day window; confirm last activity date.
5. **Replace `SENTRY_DSN` placeholder.** Error monitoring is not active. Build and render failures will not alert.
6. **Provision `SCHOOLDIGGER_API_KEY`.** Blocks school-rating data in neighborhood videos.
7. **Resolve TikTok production rejection.** Sandbox-only access limits TikTok posts to a test account. Address the Terms of Service notes flagged in the 2026-05-12 rejection.
8. **Top up fal.ai balance only if Runway Gen-4 is specifically needed.** Replicate covers all other video models.
9. **Confirm Ryan Realty YouTube channel exists.** `lib/youtube.ts` is wired but an active channel is required before any upload.
10. **Set `PINTEREST_CLIENT_ID` and `PINTEREST_CLIENT_SECRET`.** Pinterest OAuth has not been initiated.

---

*End of tool-inventory.md. Word count estimate: 9,800+. Citation count: 55+. Prepared by Phase 1 research agent on 2026-05-16.*
