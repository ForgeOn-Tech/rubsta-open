import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateDeployment } from './preflight.mjs';

const config = {
  RUBSTA_PROJECT: 'example-project', RUBSTA_ZONE: 'asia-south1-a',
  RUBSTA_HOST: 'example.com', RUBSTA_TLS_EMAIL: 'test@example.com',
  RUBSTA_ASSET_BUCKET: 'example-assets', RUBSTA_RELEASE: 'a'.repeat(40),
  RUBSTA_ACCESS_MODE: 'public',
};
const app = {
  AUTH_SECRET: 'test-only-placeholder-secret-not-a-real-credential', DEMO_AUTH: 'false',
  GOOGLE_CLIENT_ID: 'test-client', GOOGLE_CLIENT_SECRET: 'test-secret',
};

test('public deployments reject shared demo sign-in', () => {
  assert.ok(validateDeployment(config, { ...app, DEMO_AUTH: 'true' }).includes('Public deployments require DEMO_AUTH=false'));
});
test('public deployments need working sign-in configuration', () => {
  assert.ok(validateDeployment(config, { ...app, GOOGLE_CLIENT_SECRET: '' }).some(message => message.includes('Google sign-in')));
});
test('internal previews cannot omit the password gate', () => {
  const errors = validateDeployment({ ...config, RUBSTA_ACCESS_MODE: 'internal' }, app);
  assert.ok(errors.some(message => message.includes('preview username')));
  assert.ok(errors.some(message => message.includes('password hash')));
});
test('internal previews reject live payment keys even with a password gate', () => {
  const errors = validateDeployment({ ...config, RUBSTA_ACCESS_MODE: 'internal' }, {
    ...app, RAZORPAY_KEY_ID: 'rzp_live_testfixture', RAZORPAY_KEY_SECRET: 'fixture', RAZORPAY_WEBHOOK_SECRET: 'fixture',
  });
  assert.ok(errors.some(message => message.includes('test payments')));
});
test('public live payment configuration requires the webhook secret', () => {
  const errors = validateDeployment(config, { ...app, RAZORPAY_KEY_ID: 'rzp_live_testfixture', RAZORPAY_KEY_SECRET: 'fixture' });
  assert.ok(errors.some(message => message.includes('webhook secret')));
});
test('valid public configuration passes without needing payment keys', () => {
  assert.deepEqual(validateDeployment(config, app), []);
});
