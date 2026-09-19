import { readFileSync } from 'node:fs';
import { parseEnv } from 'node:util';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Validate without printing any credential values or the expanded Compose file.
export function validateDeployment(config, app) {
const failures = [];
for (const field of ['RUBSTA_PROJECT', 'RUBSTA_ZONE', 'RUBSTA_HOST', 'RUBSTA_TLS_EMAIL', 'RUBSTA_ASSET_BUCKET', 'RUBSTA_RELEASE']) {
  if (!config[field]?.trim()) failures.push(`${field} is required`);
}
if (!/^[a-f0-9]{40}$/.test(config.RUBSTA_RELEASE ?? '')) failures.push('RUBSTA_RELEASE must be a full commit SHA');
if (!/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/i.test(config.RUBSTA_HOST ?? '')) failures.push('RUBSTA_HOST must be a hostname without a scheme or path');
if (!/^[a-z0-9][a-z0-9._-]{1,61}[a-z0-9]$/.test(config.RUBSTA_ASSET_BUCKET ?? '')) failures.push('RUBSTA_ASSET_BUCKET must be a bucket name, without gs://');
if ((app.AUTH_SECRET ?? '').length < 32) failures.push('Generate a new AUTH_SECRET of at least 32 characters');
if (config.RUBSTA_ACCESS_MODE === 'internal') {
  if (!/^[a-zA-Z0-9_-]+$/.test(config.RUBSTA_PREVIEW_USER ?? '')) failures.push('Set a valid preview username');
  if (!/^\$2[aby]\$\d{2}\$[./a-zA-Z0-9]{53}$/.test(config.RUBSTA_PREVIEW_PASSWORD_HASH ?? '')) failures.push('Set a bcrypt preview password hash');
  if (app.RAZORPAY_KEY_ID && !app.RAZORPAY_KEY_ID.startsWith('rzp_test_')) failures.push('Internal previews must use test payments or no payments');
} else if (config.RUBSTA_ACCESS_MODE === 'public') {
  if (app.DEMO_AUTH !== 'false') failures.push('Public deployments require DEMO_AUTH=false');
  if (!app.GOOGLE_CLIENT_ID || !app.GOOGLE_CLIENT_SECRET) failures.push('Configure Google sign-in before public deployment');
} else {
  failures.push('Choose RUBSTA_ACCESS_MODE=internal or public');
}
if (Boolean(app.RAZORPAY_KEY_ID) !== Boolean(app.RAZORPAY_KEY_SECRET)) failures.push('Set both Razorpay keys or neither');
if (app.RAZORPAY_KEY_ID?.startsWith('rzp_live_') && !app.RAZORPAY_WEBHOOK_SECRET) failures.push('Live payments require a configured webhook secret');
return failures;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const config = parseEnv(readFileSync(new URL('.env', import.meta.url), 'utf8'));
    const app = parseEnv(readFileSync(new URL('.env.app', import.meta.url), 'utf8'));
    const failures = validateDeployment(config, app);
    if (failures.length) {
      console.error(failures.join('\n'));
      process.exitCode = 1;
    } else {
      console.log(`Configuration valid for ${config.RUBSTA_ACCESS_MODE} deployment. No credentials displayed.`);
    }
  } catch {
    console.error('Cannot read deploy/.env and deploy/.env.app. Create them from the example files. No credentials displayed.');
    process.exitCode = 1;
  }
}
