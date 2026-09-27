import './setup';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { app } from '../app';
import { db } from '../db';

let server: Server;
let base: string;

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
});
after(() => server.close());

async function call(path: string, { body, token, method }: { body?: unknown; token?: string; method?: string } = {}) {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(base + path, {
    method: method || (body !== undefined ? 'POST' : 'GET'),
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: (await res.json().catch(() => ({}))) as any }; // eslint-disable-line @typescript-eslint/no-explicit-any
}

let counter = 0;
async function newUser(name = 'Asha') {
  const email = `user${++counter}@example.com`;
  const res = await call('/auth/signup', { body: { name, email, password: 'password123' } });
  assert.equal(res.status, 201);
  return { token: res.data.token as string, email };
}

describe('auth', () => {
  test('rejects short passwords and duplicate emails', async () => {
    assert.equal((await call('/auth/signup', { body: { name: 'A', email: 'short@example.com', password: '123' } })).status, 400);
    const { email } = await newUser();
    assert.equal((await call('/auth/signup', { body: { name: 'B', email, password: 'password123' } })).status, 409);
  });

  test('login, me and logout', async () => {
    const { email } = await newUser();
    assert.equal((await call('/auth/login', { body: { email, password: 'wrong-password' } })).status, 401);
    const login = await call('/auth/login', { body: { email: email.toUpperCase(), password: 'password123' } });
    assert.equal(login.status, 200);
    assert.equal((await call('/auth/me', { token: login.data.token })).data.user.email, email);
    await call('/auth/logout', { method: 'POST', token: login.data.token });
    assert.equal((await call('/auth/me', { token: login.data.token })).status, 401);
  });

  test('password reset flow', async () => {
    const { email, token } = await newUser();
    assert.equal((await call('/auth/forgot', { body: { email: 'nobody@example.com' } })).status, 200);
    // Grab the token hash directly; the plaintext only exists in the (unsent) email.
    const log = console.log;
    let link = '';
    console.log = (msg: string) => (link = msg);
    await call('/auth/forgot', { body: { email } });
    console.log = log;
    const resetToken = link.split('/reset-password/')[1];
    assert.ok(resetToken, 'reset link logged in dev');

    assert.equal((await call('/auth/reset', { body: { token: 'x'.repeat(20), password: 'newpassword1' } })).status, 400);
    assert.equal((await call('/auth/reset', { body: { token: resetToken, password: 'newpassword1' } })).status, 200);
    // Old sessions are revoked and the token is single-use.
    assert.equal((await call('/auth/me', { token })).status, 401);
    assert.equal((await call('/auth/reset', { body: { token: resetToken, password: 'another-pass' } })).status, 400);
    assert.equal((await call('/auth/login', { body: { email, password: 'newpassword1' } })).status, 200);
  });
});

describe('contacts and SOS', () => {
  test('contacts require login and valid international numbers', async () => {
    assert.equal((await call('/contacts')).status, 401);
    const { token } = await newUser();
    assert.equal((await call('/contacts', { token, body: { name: 'Mom', phone: '12345' } })).status, 400);
  });

  test('only confirmed contacts are alerted', async () => {
    const { token } = await newUser('Priya');
    const mom = await call('/contacts', { token, body: { name: 'Mom', phone: '+91 98765-43210' } });
    assert.equal(mom.status, 201);
    assert.equal(mom.data.contact.phone, '+919876543210');
    assert.equal(mom.data.contact.status, 'pending');
    assert.equal(mom.data.inviteSms, 'not_configured');
    const dad = await call('/contacts', { token, body: { name: 'Dad', phone: '+919876543211' } });
    assert.equal((await call('/contacts', { token, body: { name: 'Dup', phone: '+919876543210' } })).status, 409);

    // Mom accepts through her invite link; Dad never responds.
    const momToken = mom.data.inviteLink.split('/confirm-contact/')[1];
    const invite = await call(`/contact-invites/${momToken}`);
    assert.equal(invite.data.userName, 'Priya');
    assert.equal((await call(`/contact-invites/${momToken}`, { body: { accept: true } })).data.status, 'confirmed');
    assert.ok(dad.data.inviteLink);

    const sos = await call('/sos', { token, body: { coords: { lat: 28.6139, lng: 77.209, accuracy: 20 } } });
    assert.equal(sos.status, 201);
    const byName = Object.fromEntries(sos.data.deliveries.map((d: { name: string; status: string }) => [d.name, d.status]));
    assert.deepEqual(byName, { Mom: 'not_configured', Dad: 'not_confirmed' });
    assert.match(sos.data.message, /maps\.google\.com\/\?q=28\.6139,77\.209/);

    // Status can be polled by the owner only.
    assert.equal((await call(`/sos/${sos.data.id}`, { token })).status, 200);
    const other = await newUser();
    assert.equal((await call(`/sos/${sos.data.id}`, { token: other.token })).status, 404);
  });

  test('changing a phone number requires fresh consent', async () => {
    const { token } = await newUser();
    const c = await call('/contacts', { token, body: { name: 'Sis', phone: '+919000000001' } });
    const t = c.data.inviteLink.split('/confirm-contact/')[1];
    await call(`/contact-invites/${t}`, { body: { accept: true } });
    const renamed = await call(`/contacts/${c.data.contact.id}`, { token, method: 'PUT', body: { name: 'Sister', phone: '+919000000001' } });
    assert.equal(renamed.data.contact.status, 'confirmed');
    const moved = await call(`/contacts/${c.data.contact.id}`, { token, method: 'PUT', body: { name: 'Sister', phone: '+919000000002' } });
    assert.equal(moved.data.contact.status, 'pending');
    assert.equal((await call(`/contact-invites/${t}`)).status, 404, 'old invite link no longer works');
  });

  test('anonymous SOS still works and test alerts are limited', async () => {
    const anon = await call('/sos', { body: {} });
    assert.equal(anon.status, 201);
    assert.deepEqual(anon.data.deliveries, []);

    const { token } = await newUser();
    for (let i = 0; i < 3; i++) assert.equal((await call('/sos/test', { token, method: 'POST' })).status, 201);
    assert.equal((await call('/sos/test', { token, method: 'POST' })).status, 429);
  });

  test('Twilio callbacks require a valid signature', async () => {
    const res = await fetch(`${base}/twilio/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'MessageSid=SM1&MessageStatus=delivered',
    });
    assert.equal(res.status, 403);
  });
});

describe('reports and map', () => {
  test('anonymous reports are not linked, map data is coarse, flags hide points', async () => {
    const { token } = await newUser();
    const anon = await call('/reports', {
      token,
      body: { incidentType: 'stalking', description: 'secret details', anonymous: true, coords: { lat: 28.61394, lng: 77.20902 } },
    });
    assert.equal(anon.data.linkedToAccount, false);
    await call('/reports', { token, body: { incidentType: 'harassment', description: 'mine' } });
    assert.equal((await call('/reports', { body: { incidentType: 'nope', description: 'x' } })).status, 400);

    const mine = await call('/reports', { token });
    assert.deepEqual(mine.data.reports.map((r: { description: string }) => r.description), ['mine']);
    assert.equal((await call('/reports')).status, 401);

    const point = (await call('/reports/map')).data.points.find((p: { id: number }) => p.id === anon.data.id);
    assert.deepEqual({ lat: point.lat, lng: point.lng }, { lat: 28.61, lng: 77.21 });
    assert.equal(point.description, undefined);

    // Three different people flag it; repeat flags from one person don't count.
    const flaggers = [await newUser(), await newUser(), await newUser()];
    await call(`/reports/${anon.data.id}/flag`, { token: flaggers[0].token, method: 'POST' });
    await call(`/reports/${anon.data.id}/flag`, { token: flaggers[0].token, method: 'POST' });
    await call(`/reports/${anon.data.id}/flag`, { token: flaggers[1].token, method: 'POST' });
    assert.ok((await call('/reports/map')).data.points.some((p: { id: number }) => p.id === anon.data.id));
    await call(`/reports/${anon.data.id}/flag`, { token: flaggers[2].token, method: 'POST' });
    assert.ok(!(await call('/reports/map')).data.points.some((p: { id: number }) => p.id === anon.data.id));
  });
});

describe('account', () => {
  test('export and delete', async () => {
    const { token, email } = await newUser();
    await call('/contacts', { token, body: { name: 'Mom', phone: '+919111111111' } });
    await call('/reports', { token, body: { incidentType: 'other', description: 'kept private' } });

    const exported = await call('/account/export', { token });
    assert.equal(exported.data.user.email, email);
    assert.equal(exported.data.contacts.length, 1);
    assert.equal(exported.data.reports.length, 1);

    assert.equal((await call('/account', { token, method: 'DELETE', body: { password: 'wrong' } })).status, 401);
    assert.equal((await call('/account', { token, method: 'DELETE', body: { password: 'password123' } })).status, 200);
    assert.equal((await call('/auth/login', { body: { email, password: 'password123' } })).status, 401);
    const left = db.prepare("SELECT COUNT(*) AS n FROM reports WHERE description = 'kept private'").get() as { n: number };
    assert.equal(left.n, 0);
  });

  test('changing password signs out other sessions', async () => {
    const { token, email } = await newUser();
    const other = (await call('/auth/login', { body: { email, password: 'password123' } })).data.token;
    assert.equal((await call('/account/password', { token, body: { currentPassword: 'nope', newPassword: 'newpassword1' } })).status, 401);
    const changed = await call('/account/password', { token, body: { currentPassword: 'password123', newPassword: 'newpassword1' } });
    assert.equal(changed.status, 200);
    assert.equal((await call('/auth/me', { token: other })).status, 401);
    assert.equal((await call('/auth/me', { token: changed.data.token })).status, 200);
  });
});

describe('chat', () => {
  test('validates input', async () => {
    assert.equal((await call('/chat', { body: { messages: [] } })).status, 400);
    assert.equal((await call('/chat', { body: { messages: [{ role: 'system', content: 'x' }] } })).status, 400);
  });
});
