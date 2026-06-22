import app, { initializeApp } from '../server';

let initialized: Promise<void> | null = null;

export default async function handler(req: any, res: any) {
  if (!initialized) {
    initialized = initializeApp();
  }

  await initialized;
  return app(req, res);
}
