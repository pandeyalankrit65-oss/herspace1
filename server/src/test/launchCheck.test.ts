import './setup';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { configFindings, liveFindings } from '../launchCheck';

const blockers = (env: NodeJS.ProcessEnv) =>
  configFindings(env)
    .filter((f) => f.level === 'blocker')
    .map((f) => f.setting.split(',')[0]);

const READY: NodeJS.ProcessEnv = {
  NODE_ENV: 'production',
  APP_URL: 'https://herspace.example',
  PUBLIC_API_URL: 'https://herspace.example',
  TRUST_PROXY: '1',
  ANTHROPIC_API_KEY: 'x',
  HERSPACE_SECRET: 'x',
  CORS_ORIGIN: 'https://herspace.example',
  NOMINATIM_URL: 'off',
  OVERPASS_URL: 'off',
};

test('a server ready to launch has nothing to fix, and each missing piece is named', () => {
  const keys = ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM_NUMBER', 'RESEND_API_KEY', 'EMAIL_FROM'];
  // No SMS or email in the test environment: an SOS couldn't be sent, and nobody could sign up.
  assert.deepEqual(blockers(READY), ['TWILIO_ACCOUNT_SID', 'RESEND_API_KEY']);
  for (const k of keys) process.env[k] = 'x';
  try {
    assert.deepEqual(blockers(READY), []);
    assert.equal(configFindings(READY).filter((f) => f.level === 'warning').length, 0);
    assert.deepEqual(blockers({ ...READY, APP_URL: 'http://localhost:8080' }), ['APP_URL']);
    assert.deepEqual(blockers({ ...READY, COOKIE_SECURE: 'false' }), ['COOKIE_SECURE']);
    assert.deepEqual(blockers({ ...READY, NODE_ENV: 'development' }), ['NODE_ENV']);
    assert.ok(blockers({ ...READY, MESSAGE_OUTBOX: '/tmp/outbox' }).includes('MESSAGE_OUTBOX'));
  } finally {
    for (const k of keys) delete process.env[k];
  }
});

test('the live check reads what the web host sends', async () => {
  let headers: Record<string, string> = {};
  const server = http.createServer((req, res) => {
    if (req.url === '/api/health') return res.end('{"ok":true}');
    res.writeHead(200, { 'Content-Type': 'text/html', ...headers });
    res.end('<head><meta http-equiv="Content-Security-Policy" content="default-src \'self\'" /></head>');
  });
  server.listen(0);
  await new Promise((r) => server.once('listening', r));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    const level = async (setting: string) => (await liveFindings(url)).find((f) => f.setting === setting)?.level;
    assert.equal(await level('HTTPS'), 'blocker', 'plain HTTP');
    assert.equal(await level('Strict-Transport-Security'), 'warning');
    assert.equal(await level('Framing'), 'warning');
    assert.equal(await level('Content-Security-Policy'), 'ok');
    assert.equal(await level('API'), 'ok');
    headers = { 'Strict-Transport-Security': 'max-age=31536000', 'Content-Security-Policy': "frame-ancestors 'none'" };
    assert.equal(await level('Strict-Transport-Security'), 'ok');
    assert.equal(await level('Framing'), 'ok');
  } finally {
    server.close();
  }
});
