# GA4 Data API: Service Account Setup

So the Super Admin dashboard can show live GA4 metrics (sessions, users, etc.) without opening Google Analytics.

You need three env vars: **GOOGLE_GA4_PROPERTY_ID**, **GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL**, **GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY**. **GOOGLE_GA4_PROPERTY_ID** is often already set (e.g. from GA4/GTM setup); if so, you only need to add the two service account vars. To get those you need a service account **JSON key**. Some organizations disable key creation; if that’s your case, use a **different GCP project** (below).

---

## Option A: Key creation allowed (main project)

If your main Google Cloud project allows creating service account keys:

1. **Console:** https://console.cloud.google.com → select your project.
2. **Enable API:** APIs and Services → Library → search **Google Analytics Data API** → Enable.
3. **Create service account:** Credentials → Create credentials → Service account. Name e.g. `ga4-dashboard-reader` → Create → Done. Open it → Keys → Add key → Create new key → JSON → Create (downloads JSON).
4. **GA4:** https://analytics.google.com → Admin → Property access management → Add users → paste the **service account email** from the JSON (`client_email`) → Role **Viewer** → Save.
5. **Property ID:** GA4 Admin → Property settings → copy the **Property ID** (numeric, e.g. `527333348`). Not the Measurement ID (G-XXXX).
6. **Env:** From the JSON set the three vars in `.env.local` and Vercel (see “Env vars” below). Restart the app.

---

## Option B: Key creation disabled (use another project)

If you see **“Key creation is not allowed”** (org policy `iam.disableServiceAccountKeyCreation`), create the service account and key in a **different** GCP project that allows keys (e.g. “My First Project” or a new project).

### 1. Create the service account and key in Cloud Shell

Open [Google Cloud Shell](https://shell.cloud.google.com). Paste and run this **entire block** (it uses project `genuine-amulet-489414-a9`; if you prefer another project, change the first line).

```bash
export PROJECT_ID=genuine-amulet-489414-a9
export SA_NAME=ga4-dashboard-reader
export SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

gcloud config set project $PROJECT_ID
gcloud services enable analyticsdata.googleapis.com --project=$PROJECT_ID
gcloud iam service-accounts create $SA_NAME --display-name "GA4 Dashboard Reader" --project=$PROJECT_ID
gcloud iam service-accounts keys create sa-key.json --iam-account=$SA_EMAIL --project=$PROJECT_ID

echo "---"
echo "Service account email (add this in GA4 Property access management as Viewer):"
echo "$SA_EMAIL"
echo "---"
echo "Key saved to sa-key.json. Download it: Cloud Shell menu (⋮) → Download file → sa-key.json"
```

If `genuine-amulet-489414-a9` also blocks key creation, try another project (e.g. `opportune-epoch-458413-r7`) by changing `PROJECT_ID` in the first line.

### 2. Grant the service account access in GA4

- Open https://analytics.google.com → Admin → **Property access management**.
- Add users → paste the **service account email** from the script output (e.g. `ga4-dashboard-reader@genuine-amulet-489414-a9.iam.gserviceaccount.com`).
- Role: **Viewer** → Save.

### 3. Get your GA4 Property ID

- GA4 Admin → **Property settings** → copy the **Property ID** (numeric, e.g. `527333348`). Not the Measurement ID (G-XXXX).

### 4. Set env vars from the downloaded JSON

Open the downloaded `sa-key.json`. In **`.env.local`** (and in Vercel for production) add:

- **GOOGLE_GA4_PROPERTY_ID** = the numeric Property ID from step 3 (if not already set).
- **GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL** = the value of `client_email` in the JSON.
- **GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY** = the value of `private_key` from the JSON.  
  In `.env` you must keep the newlines as literal backslash-n. Either paste the key in quotes and replace each real newline with `\n`, or use one line like:
  `"-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n"`

Example (fake values). If **GOOGLE_GA4_PROPERTY_ID** is already set, only add the last two:

```env
# If not already set:
# GOOGLE_GA4_PROPERTY_ID=527333348
GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL=ga4-dashboard-reader@genuine-amulet-489414-a9.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANB...(rest of key)...\n-----END PRIVATE KEY-----\n"
```

Do not commit the JSON file or the private key. Restart the app; the GA4 panel at `/admin` will show live metrics.

---

## Option C: Org policy blocks key creation (allow it first)

If you see **"Key creation is not allowed"** and you are an **org owner**, you can allow key creation for the organization once, then use Option A in your main project (e.g. ryanrealty).

1. Open **Organization policies**: **https://console.cloud.google.com/iam-admin/orgpolicies** (or Cloud Console → IAM & Admin → Organization policies).
2. **Select your organization** (not a project) at the top.
3. Find the policy: search/filter for **`iam.disableServiceAccountKeyCreation`** and open **Disable service account key creation**.
4. Click **Manage policy** → **Override parent's policy** → turn **off** enforcement → **Set policy**.

Key creation is now allowed for projects in the org. Create the service account and key in your main project (Option A) or use Cloud Shell with `PROJECT_ID=ryanrealty` (same script as Option B). You can re-enable the policy later if you want to lock it down again.

---

## Option D: Use a personal Google account (no org change)

Use a **personal Google account** (e.g. Gmail) so you can create a key without changing org policies.

1. Sign in at **https://console.cloud.google.com** with the personal account.
2. Create or select a project; note the **Project ID**.
3. Open **https://shell.cloud.google.com**, select that project, and run the same script as Option B but set `export PROJECT_ID=YOUR_PROJECT_ID` (your actual ID).
4. Download the key: in Cloud Shell run `cat sa-key.json`, copy the full output, and save as `sa-key.json` locally (or use Cloud Shell menu → Download file).
5. In **GA4** (analytics.google.com): Admin → Property access management → Add users → paste the **service account email** from the script output → Role **Viewer** → Save.
6. Set env vars from the JSON as in Option B (step 4). Restart the app.

For production, add the same three variables in Vercel (Settings → Environment Variables) and redeploy.

---

## Env vars summary

| Env var | Where to get it |
|--------|------------------|
| `GOOGLE_GA4_PROPERTY_ID` | GA4 Admin → Property settings → Property ID (numeric). Often already set. |
| `GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL` | From the service account JSON: `client_email`. |
| `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | From the JSON: `private_key`, with newlines as `\n` in the env value. |
