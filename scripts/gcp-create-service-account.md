# Create a Google Cloud Service Account

Use **either** your local terminal (if gcloud is installed) **or** Google Cloud Shell in the browser.

---

## 1. Set your project ID

Replace `YOUR_PROJECT_ID` with your actual GCP project ID (e.g. from [Google Cloud Console](https://console.cloud.google.com) → project dropdown, or `gcloud projects list`).

```bash
set PROJECT_ID=YOUR_PROJECT_ID
```

**PowerShell:**
```powershell
$env:PROJECT_ID = "YOUR_PROJECT_ID"
```

**Bash / Cloud Shell:**
```bash
export PROJECT_ID=YOUR_PROJECT_ID
```

---

## 2. Use project for this session

```bash
gcloud config set project %PROJECT_ID%
```

**PowerShell:**
```powershell
gcloud config set project $env:PROJECT_ID
```

**Bash / Cloud Shell:**
```bash
gcloud config set project $PROJECT_ID
```

---

## 3. (Optional) Fix quota project so Org Policy / key creation works

If you hit "quota project not set" or need to create keys for the service account:

```bash
gcloud auth application-default login
gcloud auth application-default set-quota-project %PROJECT_ID%
```

**PowerShell:**
```powershell
gcloud auth application-default login
gcloud auth application-default set-quota-project $env:PROJECT_ID
```

**Bash / Cloud Shell:**
```bash
gcloud auth application-default login
gcloud auth application-default set-quota-project $PROJECT_ID
```

---

## 4. Create the service account

Pick a short name (e.g. `ryan-realty-app`). This creates the account in your project.

```bash
set SA_NAME=ryan-realty-app
set SA_EMAIL=%SA_NAME%@%PROJECT_ID%.iam.gserviceaccount.com
gcloud iam service-accounts create %SA_NAME% --display-name "Ryan Realty App"
```

**PowerShell:**
```powershell
$env:SA_NAME = "ryan-realty-app"
$env:SA_EMAIL = "$env:SA_NAME@$env:PROJECT_ID.iam.gserviceaccount.com"
gcloud iam service-accounts create $env:SA_NAME --display-name "Ryan Realty App"
```

**Bash / Cloud Shell:**
```bash
SA_NAME=ryan-realty-app
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
gcloud iam service-accounts create $SA_NAME --display-name "Ryan Realty App"
```

---

## 5. (Optional) Create a JSON key file

Only if you need a key (e.g. for local dev or a server). Saves to current directory.

```bash
gcloud iam service-accounts keys create sa-key.json --iam-account=%SA_EMAIL%
```

**PowerShell:**
```powershell
gcloud iam service-accounts keys create sa-key.json --iam-account=$env:SA_EMAIL
```

**Bash / Cloud Shell:**
```bash
gcloud iam service-accounts keys create sa-key.json --iam-account=$SA_EMAIL
```

If you get **PERMISSION_DENIED** or "Service account key creation is disabled", your org has the `iam.disableServiceAccountKeyCreation` policy. Then you must either:
- Remove that org policy (needs org admin), or
- Use Workload Identity / no key (e.g. on GKE/Cloud Run).

---

## 6. Grant roles to the service account (as needed)

Examples: read BigQuery, call Cloud APIs, etc. Add only what the app needs.

```bash
gcloud projects add-iam-policy-binding %PROJECT_ID% --member="serviceAccount:%SA_EMAIL%" --role="roles/bigquery.dataViewer"
```

**PowerShell:**
```powershell
gcloud projects add-iam-policy-binding $env:PROJECT_ID --member="serviceAccount:$env:SA_EMAIL" --role="roles/bigquery.dataViewer"
```

**Bash / Cloud Shell:**
```bash
gcloud projects add-iam-policy-binding $PROJECT_ID --member="serviceAccount:$SA_EMAIL" --role="roles/bigquery.dataViewer"
```

Change `roles/bigquery.dataViewer` to whatever role you need (e.g. `roles/analyticsadmin`, `roles/run.invoker`).

---

## Can you run this in this terminal?

- **Yes**, if the **Google Cloud SDK (gcloud)** is installed. Check with:
  ```bash
  gcloud version
  ```
- If that fails, install: https://cloud.google.com/sdk/docs/install
- **Or** use **Google Cloud Shell**: https://shell.cloud.google.com — same commands, use the **Bash** versions; no local install.

---

## One-shot copy-paste (Cloud Shell or Bash)

Replace `YOUR_PROJECT_ID` and optionally `ryan-realty-app` and the role.

```bash
export PROJECT_ID=YOUR_PROJECT_ID
export SA_NAME=ryan-realty-app
export SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

gcloud config set project $PROJECT_ID
gcloud auth application-default set-quota-project $PROJECT_ID
gcloud iam service-accounts create $SA_NAME --display-name "Ryan Realty App"
gcloud iam service-accounts keys create sa-key.json --iam-account=$SA_EMAIL
# Optional: grant a role
# gcloud projects add-iam-policy-binding $PROJECT_ID --member="serviceAccount:$SA_EMAIL" --role="roles/bigquery.dataViewer"
```
