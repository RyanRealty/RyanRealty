# Paste this entire block into Google Cloud Shell (https://shell.cloud.google.com)
# Creates a key for the service account with unique ID 116585568564644399058

export PROJECT_ID=ryanrealty
export SA_UNIQUE_ID=116585568564644399058

gcloud config set project $PROJECT_ID
SA_EMAIL=$(gcloud iam service-accounts list --project=$PROJECT_ID --filter="uniqueId=$SA_UNIQUE_ID" --format="value(email)" --limit=1)
gcloud iam service-accounts keys create sa-key.json --iam-account=$SA_EMAIL

echo "Done. Service account: $SA_EMAIL — key saved to sa-key.json. Download via Cloud Shell menu → Download file."
