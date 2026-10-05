// POC: the part of `firebase-admin/app` that api/_lib/firebase.ts uses. An "app" is just its
// options; getFirestore() (firestore-rest.ts) builds the REST client from them.
import type { ServiceAccount } from './google-auth';
export interface App { name: string; options: { projectId?: string; credential?: ServiceAccount } }
const apps: App[] = [];
export const cert = (sa: ServiceAccount) => sa;
export const getApps = () => apps;
export function initializeApp(options: { projectId?: string; credential?: ServiceAccount }) {
  const app = { name: '[DEFAULT]', options: { projectId: options.projectId ?? options.credential?.project_id, credential: options.credential } };
  apps.push(app);
  return app;
}
