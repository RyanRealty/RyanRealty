# Design System Rules — MANDATORY

## shadcn/ui is the ONLY styling authority

Every UI element on this site MUST use shadcn/ui components from `@/components/ui/`. No exceptions.

### Component Mapping (use these, not raw HTML):
| Need | Use This | NOT This |
|------|----------|----------|
| Button | `<Button>` from `@/components/ui/button` | `<button>`, `<a className="btn-...">` |
| Card container | `<Card>` from `@/components/ui/card` | `<div className="rounded-... border...">` |
| Form select | `<Select>` from `@/components/ui/select` | `<select>` |
| Text input | `<Input>` from `@/components/ui/input` | `<input>` |
| Checkbox | `<Checkbox>` from `@/components/ui/checkbox` | `<input type="checkbox">` |
| Badge/tag | `<Badge>` from `@/components/ui/badge` | `<span className="rounded-full...">` |
| Dialog/modal | `<Dialog>` from `@/components/ui/dialog` | custom modal divs |
| Dropdown | `<DropdownMenu>` from `@/components/ui/dropdown-menu` | custom dropdown divs |
| Tabs | `<Tabs>` from `@/components/ui/tabs` | custom tab implementations |
| Tooltip | `<Tooltip>` from `@/components/ui/tooltip` | `title` attribute |
| Separator | `<Separator>` from `@/components/ui/separator` | `<hr>`, `<div className="border-t...">` |
| Label | `<Label>` from `@/components/ui/label` | `<label>` |
| Textarea | `<Textarea>` from `@/components/ui/textarea` | `<textarea>` |
| Switch/toggle | `<Switch>` from `@/components/ui/switch` | `<input type="checkbox">` styled as toggle |
| Avatar | `<Avatar>` from `@/components/ui/avatar` | `<img className="rounded-full...">` |
| Table | `<Table>` from `@/components/ui/table` | `<table>` |
| Accordion | `<Accordion>` from `@/components/ui/accordion` | custom expand/collapse |
| Alert | `<Alert>` from `@/components/ui/alert` | `<div className="bg-yellow...">` |
| Progress | `<Progress>` from `@/components/ui/progress` | custom progress bars |
| Skeleton | `<Skeleton>` from `@/components/ui/skeleton` | custom loading placeholders |
| Sheet (mobile menu) | `<Sheet>` from `@/components/ui/sheet` | custom slide-out panels |

### Color Tokens (use these, not hex/named colors):
| Need | Use | NOT |
|------|-----|-----|
| Primary action | `bg-primary text-primary-foreground` | `bg-blue-600`, `bg-[#102742]` |
| Secondary | `bg-secondary text-secondary-foreground` | `bg-gray-100` |
| Accent/CTA | `bg-accent text-accent-foreground` | `bg-gold`, `bg-amber-500` |
| Destructive | `bg-destructive text-destructive-foreground` | `bg-red-500 text-white` |
| Success | `bg-success text-success-foreground` | `bg-green-500 text-white` |
| Warning | `bg-warning text-warning-foreground` | `bg-yellow-500` |
| Muted text | `text-muted-foreground` | `text-gray-500` |
| Borders | `border-border` | `border-gray-200` |
| Card background | `bg-card` | `bg-white` |
| Page background | `bg-background` | `bg-white`, `bg-gray-50` |

### Utility Function:
Always use `cn()` from `@/lib/utils` for conditional/merged classes. Never string concatenate class names.

### Custom CSS Classes:
DO NOT use `card-base`, `btn-cta`, or any custom CSS class from globals.css. Use shadcn components directly.

### Legacy backup (do not use):
The `_style_backup/` directory contains retired styling artifacts and is excluded from the TypeScript build. Never import from `_style_backup/`; use only `@/components/ui/` and `app/globals.css`.

---

## Work Standards

- **No shortcuts, no assumptions.** When coding, implement the full solution from start to finish. Never stop halfway and present partial work as complete. When answering questions about the codebase, trace the logic all the way through to a confirmed answer — no surface-level glances, no guesses.
- **Always verify your own work.** Before saying something is done or something is true, confirm it. Run the code, check the output, read the actual files. Never assume. Every claim about code behavior must be verified by actually reading the relevant code. Every fix must be tested to confirm it works before reporting it's done.
- **Truthful and accurate, always.** If you're not sure, say so. Never state something as fact unless you've confirmed it. If you got something wrong, own it immediately.
- **No partial answers.** When asked about status, where things stand, or how something works, go all the way through to the end to figure out the exact answer. There are never any assumptions being made — always confirm.
- **Always push directly to main.** No worktrees, no feature branches unless explicitly asked.
- **Never ask Matt to run anything manually.** You handle ALL git operations, ALL terminal commands, ALL deployments, everything. Matt never touches the terminal. If something needs to be done, you do it.
- **Proactively clear git locks.** Before ANY git operation (commit, merge, rebase, pull, push), check for .git/index.lock and remove it if it's stale. Never let a lock file block progress. Never report a lock file to Matt as a blocker — just fix it.
- **No blocked builds or commits.** Builds must never back up. Commits must never be blocked. If something is in the way, fix it yourself. Exhaust every option before reporting an issue.
