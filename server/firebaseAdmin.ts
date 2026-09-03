import { initializeApp, getApps, App } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';

let adminApp: App | null = null;
let adminAuth: Auth | null = null;
let adminDb: Firestore | null = null;

interface ConfigPayload {
  projectId?: string;
  firestoreDatabaseId?: string;
}

function loadConfig(): ConfigPayload {
  try {
    const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }
  } catch (err) {
    console.warn('[Firebase Admin] Failed to parse firebase-applet-config.json:', err);
  }
  return {};
}

function getOrInitApp(): App {
  if (!adminApp) {
    const existingApps = getApps();
    if (existingApps.length > 0) {
      adminApp = existingApps[0];
    } else {
      const config = loadConfig();
      const projectId = process.env.FIREBASE_PROJECT_ID || config.projectId || 'gen-lang-client-0396596450';
      adminApp = initializeApp({ projectId });
    }
  }
  return adminApp;
}

export function getAdminAuth(): Auth {
  if (!adminAuth) {
    const app = getOrInitApp();
    adminAuth = getAuth(app);
  }
  return adminAuth;
}

export function getAdminDb(): Firestore {
  if (!adminDb) {
    const app = getOrInitApp();
    const config = loadConfig();
    const databaseId = config.firestoreDatabaseId || '(default)';
    adminDb = getFirestore(app, databaseId);
  }
  return adminDb;
}
