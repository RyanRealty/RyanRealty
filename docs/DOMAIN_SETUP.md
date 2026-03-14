# Custom domain setup (Ryan Realty)

**Production URL:** Ryan-Realty.com → `https://ryan-realty.com` (no trailing slash). Use this when pointing the production domain at the Vercel deployment.

**Note:** Steps below require you to log into Vercel, your DNS registrar, Supabase, and (if used) Google Cloud. The codebase is already configured for this domain; you only need to apply these settings in each dashboard.

---

## Copy-paste values

Use these exact values when configuring each service:

| Where | Name / field | Value to paste |
|-------|----------------|----------------|
| **Vercel** env (Production) | `NEXT_PUBLIC_SITE_URL` | `https://ryan-realty.com` |
| **Supabase** Auth → URL Configuration | Site URL | `https://ryan-realty.com` |
| **Supabase** Auth → Redirect URLs | (add each) | `https://ryan-realty.com/auth/callback` |
| | | `https://ryan-realty.com/api/auth/callback` |
| **Google** OAuth → Authorized redirect URIs | (add each) | `https://ryan-realty.com/auth/callback` |
| | | `https://ryan-realty.com/api/auth/callback` |
| **Vercel** Domains | Add domain | `ryan-realty.com` |
| | (optional) | `www.ryan-realty.com` |

---

## 1. Vercel domains

- In Vercel: **Settings → Domains → Add**
- Add: `ryan-realty.com` and `www.ryan-realty.com`
- Vercel will show the required DNS records (CNAME to `cname.vercel-dns.com` or A records to Vercel IPs)

## 2. DNS at registrar

- At your domain registrar, add the CNAME or A records as shown in Vercel
- For `www`: CNAME `www` → `cname.vercel-dns.com`
- For apex (`ryan-realty.com`): use Vercel’s recommended A records or CNAME flattening if supported

## 3. SSL

- Vercel provisions SSL automatically once DNS is correct
- Wait for “Valid” in Vercel → Domains

## 4. Environment

- In Vercel → Settings → Environment Variables, set:
  - `NEXT_PUBLIC_SITE_URL=https://ryan-realty.com` (no trailing slash)

## 5. Supabase Auth

- Supabase Dashboard → **Authentication → URL Configuration**
- **Site URL**: `https://ryan-realty.com`
- **Redirect URLs**: add `https://ryan-realty.com/auth/callback` and `https://ryan-realty.com/api/auth/callback`

## 6. Google OAuth (if used)

- Google Cloud Console → APIs & Services → Credentials → your OAuth client
- **Authorized redirect URIs**: add both `https://ryan-realty.com/auth/callback` and `https://ryan-realty.com/api/auth/callback`

## 7. Email (Resend)

- Resend → Domains → Add e.g. `mail.ryan-realty.com` or your chosen subdomain
- Add the DNS records Resend provides (SPF, DKIM, DMARC)
- Use this domain as “From” in Resend when sending transactional/marketing email

## 8. Post-setup checks

- Visit `https://ryan-realty.com` and confirm the site loads
- Test sign-in (Google or email) and confirm redirect back to the site
- Run `npx tsx scripts/pre-launch-check.ts` with `NEXT_PUBLIC_SITE_URL=https://ryan-realty.com` to verify pages, sitemap, and OG endpoint
