# Agent Skills (Ryan Realty)

This project includes:

| Folder | Skill `name` | When it applies |
|--------|----------------|-----------------|
| `oregon-real-estate-oref/` | `oregon-real-estate-oref` | Oregon transactions, OREF forms, compliance checklists |
| `oregon-orea-principal-broker/` | `oregon-orea-principal-broker` | Educated first-pass file review: OREA + OAR 863 (you remain final say) |
| `skyslope-api/` | `skyslope-api` | SkySlope APIs, env vars, auditing files via API |

## Turn on / see them in Cursor

1. Use **Cursor 2.4+** (check **Cursor → About**).
2. **Cursor Settings**: **Cmd+Shift+J** (Mac) or **Ctrl+Shift+J** (Windows/Linux) → **Rules** → look for skills under **Agent Decides** (wording may vary by version).
3. If they are missing after a git pull: **Command Palette** → **Developer: Reload Window**.

## Invoke

- In **Agent** chat, type **`/`** and choose e.g. **`oregon-real-estate-oref`**, **`oregon-orea-principal-broker`**, or **`skyslope-api`**, or describe the task and let the agent match the skill description.

## Global skills

Personal skills for all repos: `~/.cursor/skills/` (see `README.md` there if present).
