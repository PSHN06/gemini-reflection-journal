#!/usr/bin/env bash
# Production Cloud Run Deployment Script
# Preserves required challenge verification label: dev-tutorial=cloud-run-ai-challenge

set -e

PROJECT_ID="${GCP_PROJECT:-gen-lang-client-0396596450}"
REGION="${REGION:-us-central1}"
SERVICE_NAME="gemini-reflection-journal"

echo "Deploying ${SERVICE_NAME} to Google Cloud Run in ${REGION} (Project: ${PROJECT_ID})..."

gcloud run deploy "${SERVICE_NAME}" \
  --source . \
  --project "${PROJECT_ID}" \
  --region "${REGION}" \
  --allow-unauthenticated \
  --set-secrets GEMINI_API_KEY=GEMINI_API_KEY:latest \
  --labels dev-tutorial=cloud-run-ai-challenge

echo "Deployment completed successfully with label dev-tutorial=cloud-run-ai-challenge."
