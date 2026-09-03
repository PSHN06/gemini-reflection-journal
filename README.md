# Gemini Reflection Journal

A secure, multi-tenant reflection journaling application powered by **Gemini 3.6 Flash** and **Google Cloud Firestore**. The application allows authenticated users to write multi-turn reflections, receive structured insights, brainstorm action steps, and persist their interaction histories with owner-bound data isolation.

---

## Architecture & Security Highlights

1. **User Identity & Federated Auth**: Secure login via Firebase Authentication with Google Sign-In. No passwords or plaintext credentials are stored in application code.
2. **User-Isolated Database**: Multi-turn reflections and interaction records are stored in Cloud Firestore under owner-locked document paths (`/users/{userId}/entries/*` and `/users/{userId}/interactions/*`).
3. **Resilient Gemini AI Engine**: Multi-turn reasoning utilizing a model fallback ladder (`gemini-3.6-flash` -> `gemini-3.1-flash-lite` -> `gemini-flash-latest` -> `gemini-3.7-flash`).
4. **Zero-Hardcoding & Secret Proxy**: The Gemini API key is managed via Google Cloud Secret Manager and accessed strictly on the server-side Express proxy.

---

## 1. Prerequisites & Environment Setup

Ensure the following Google Cloud services are enabled in your GCP project:

```bash
gcloud services enable \
  run.googleapis.com \
  secretmanager.googleapis.com \
  firestore.googleapis.com \
  identitytoolkit.googleapis.com
```

---

## 2. Google Cloud Secret Manager Setup

Store your Gemini API key in Secret Manager and grant access to your Cloud Run service account:

```bash
# Create and populate the secret
gcloud secrets create GEMINI_API_KEY --replication-policy="automatic"
echo -n "YOUR_API_KEY" | gcloud secrets versions add GEMINI_API_KEY --data-file=-

# Grant the default Cloud Run service account access to read the secret
gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
  --member="serviceAccount:YOUR_PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

---

## 3. Firestore Security Rules Configuration

Deploy the following security rules (`firestore.rules`) to enforce multi-tenant owner-bound document isolation:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;

      match /entries/{entryId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
      
      match /interactions/{interactionId} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
}
```

To deploy the rules using the Firebase CLI:
```bash
firebase deploy --only firestore:rules
```

---

## 4. Cloud Run Deployment Flow

Build and deploy the application to Google Cloud Run with the Secret Manager binding:

```bash
gcloud run deploy gemini-reflection-journal \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-secrets GEMINI_API_KEY=GEMINI_API_KEY:latest
```

---

## 5. Automated Challenge Verification Binding

Apply the mandatory resource label to register the service for automated challenge verification:

```bash
gcloud run services update <SERVICE_NAME> \
  --update-labels=dev-tutorial=cloud-run-ai-challenge \
  --region=<REGION>
```

---

## 6. Local Development

```bash
# Install dependencies
npm install

# Run full-stack dev server (Express + Vite)
npm run dev

# Build production bundle
npm run build

# Start production server
npm run start
```
