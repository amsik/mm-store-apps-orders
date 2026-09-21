import { execFileSync } from 'node:child_process';
import { E2E_DATABASE_URL } from '../playwright.config.js';

// Employees are reference data the UI needs to start an order. The seed is idempotent, so reruns are safe.
export default function globalSetup() {
  execFileSync('yarn', ['workspace', '@app/api', 'seed'], {
    env: { ...process.env, DATABASE_URL: E2E_DATABASE_URL },
    stdio: 'inherit',
  });
}
