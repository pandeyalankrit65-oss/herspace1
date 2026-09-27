import './setup';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { app } from '../app';
import { db } from '../db';
import { processOverdueCheckIns } from '../routes/checkins';

let server: Server;
let base: string;

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
});
after(() => server.close());

// Sessions live in an HttpOnly cookie; `token` is that cookie's value. The CSRF header is sent
// by default, as the real frontend does.
async function call(
  path: string,
  { body, token, method, csrf = true }: { body?: unknown; token?: string; method?: string; csrf?: boolean } = {}
) {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Cookie = `herspace_session=${token}`;
  if (csrf) headers['X-Requested-With'] = 'HerSpace';
  const res = await fetch(base + path, {
    method: method || (body !== undefined ? 'POST' : 'GET'),
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const setCookie = res.headers.getSetCookie().find((c) => c.startsWith('herspace_session='));
  const cookieToken = setCookie ? decodeURIComponent(setCookie.split(';')[0].split('=')[1]) : undefined;
  return { status: res.status, data: (await res.json().catch(() => ({}))) as any, token: cookieToken || undefined, setCookie }; // eslint-disable-line @typescript-eslint/no-explicit-any
}

let counter = 0;
async function newUser(name = 'Asha') {
  const email = `user${++counter}@example.com`;
  const res = await call('/auth/signup', { body: { name, email, password: 'password123' } });
  assert.equal(res.status, 201);
  return { token: res.token as string, email };
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
    assert.equal((await call('/auth/me', { token: login.token })).data.user.email, email);
    assert.equal(login.data.token, undefined, 'session token is never exposed to page scripts');
    const logout = await call('/auth/logout', { method: 'POST', token: login.token });
    assert.match(logout.setCookie ?? '', /herspace_session=;/, 'logout clears the cookie');
    assert.equal((await call('/auth/me', { token: login.token })).status, 401);
  });

  test('session cookie is HttpOnly and SameSite', async () => {
    const res = await call('/auth/signup', { body: { name: 'C', email: 'cookie@example.com', password: 'password123' } });
    assert.match(res.setCookie!, /HttpOnly/);
    assert.match(res.setCookie!, /SameSite=Lax/);
    assert.match(res.setCookie!, /Path=\//);
  });

  test('cookie-authenticated writes require the CSRF header', async () => {
    const { token } = await newUser();
    const blocked = await call('/contacts', { token, csrf: false, body: { name: 'Mom', phone: '+919876500000' } });
    assert.equal(blocked.status, 403);
    assert.equal((await call('/contacts', { token, csrf: false })).status, 200, 'reads are allowed');
    assert.equal((await call('/sos', { csrf: false, body: {} })).status, 201, 'anonymous SOS never needs it');
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

describe('hardening', () => {
  test('password guessing is limited per account, even across IP addresses', async () => {
    const { email } = await newUser();
    for (let i = 0; i < 10; i++) assert.equal((await call('/auth/login', { body: { email, password: 'wrong-guess' } })).status, 401);
    const blocked = await call('/auth/login', { body: { email, password: 'password123' } });
    assert.equal(blocked.status, 429, 'the 11th attempt is refused, even with the right password');
  });

  test('unknown emails take as long to reject as wrong passwords', async () => {
    const { email } = await newUser();
    const time = async (e: string) => {
      const start = performance.now();
      await call('/auth/login', { body: { email: e, password: 'wrong-guess' } });
      return performance.now() - start;
    };
    const known = await time(email);
    const unknown = await time('nobody-here@example.com');
    assert.ok(unknown > known * 0.5, `unknown email answered in ${unknown.toFixed(1)}ms vs ${known.toFixed(1)}ms`);
  });

  test('API responses are never cached', async () => {
    const res = await fetch(`${base}/health`);
    assert.equal(res.headers.get('cache-control'), 'no-store');
  });

  test('oversized chat requests are rejected', async () => {
    const long = 'a'.repeat(3_999);
    const messages = Array.from({ length: 5 }, () => ({ role: 'user', content: long }));
    assert.equal((await call('/chat', { body: { messages } })).status, 400);
  });

  test("logged-out map flags don't store a reversible IP hash", async () => {
    const { token } = await newUser();
    const r = await call('/reports', { token, body: { incidentType: 'other', description: 'x', coords: { lat: 1.5, lng: 1.5 } } });
    await call(`/reports/${r.data.id}/flag`, { method: 'POST' });
    const row = db.prepare('SELECT flagger FROM report_flags WHERE report_id = ?').get(r.data.id) as { flagger: string };
    const { createHash } = await import('node:crypto');
    for (const ip of ['127.0.0.1', '::1', '::ffff:127.0.0.1']) {
      assert.notEqual(row.flagger, `ip:${createHash('sha256').update(ip).digest('hex')}`);
    }
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
    const other = (await call('/auth/login', { body: { email, password: 'password123' } })).token;
    assert.equal((await call('/account/password', { token, body: { currentPassword: 'nope', newPassword: 'newpassword1' } })).status, 401);
    const changed = await call('/account/password', { token, body: { currentPassword: 'password123', newPassword: 'newpassword1' } });
    assert.equal(changed.status, 200);
    assert.equal((await call('/auth/me', { token: other })).status, 401);
    assert.equal((await call('/auth/me', { token: changed.token })).status, 200);
  });
});

describe('chat', () => {
  test('fallback replies put self-harm first and follow the language', async () => {
    const { fallbackReply } = await import('../chat');
    const say = (content: string) => [{ role: 'user' as const, content }];
    assert.match(fallbackReply(say('I want to kill myself')), /crisis line/, 'self-harm is not treated as outside danger');
    assert.match(fallbackReply(say('someone is following me')), /SOS/);
    assert.match(fallbackReply(say('मुझे बहुत घबराहट हो रही है'), 'hi'), /ग्राउंडिंग/);
    assert.match(fallbackReply(say('कोई मेरा पीछा कर रहा है'), 'hi'), /SOS/);
  });

  test('validates input', async () => {
    assert.equal((await call('/chat', { body: { messages: [] } })).status, 400);
    assert.equal((await call('/chat', { body: { messages: [{ role: 'system', content: 'x' }] } })).status, 400);
  });
});

describe('live location', () => {
  test('SOS creates a share; contacts can follow it until the user is safe', async () => {
    const { token } = await newUser('Kavya');
    const sos = await call('/sos', { token, body: { coords: { lat: 12.9716, lng: 77.5946, accuracy: 15 } } });
    assert.ok(sos.data.share, 'logged-in SOS starts a live share');
    assert.ok(sos.data.message.includes(sos.data.share.url), 'the SOS text includes the live link');
    const trackToken = sos.data.share.url.split('/track/')[1];

    let view = await call(`/track/${trackToken}`);
    assert.equal(view.data.name, 'Kavya');
    assert.equal(view.data.active, true);
    assert.deepEqual([view.data.position.lat, view.data.position.lng], [12.9716, 77.5946]);

    assert.equal((await call(`/location-shares/${sos.data.share.id}/location`, { token, body: { coords: { lat: 12.98, lng: 77.6 } } })).status, 200);
    view = await call(`/track/${trackToken}`);
    assert.deepEqual([view.data.position.lat, view.data.position.lng], [12.98, 77.6]);

    // Only the owner can move or stop it.
    const other = await newUser();
    assert.equal((await call(`/location-shares/${sos.data.share.id}/location`, { token: other.token, body: { coords: { lat: 0, lng: 0 } } })).status, 404);
    assert.equal((await call('/location-shares/active', { token })).data.share.id, sos.data.share.id);

    assert.equal((await call(`/location-shares/${sos.data.share.id}/stop`, { token, method: 'POST' })).status, 200);
    view = await call(`/track/${trackToken}`);
    assert.equal(view.data.active, false);
    assert.equal(view.data.position, null, 'position is hidden once safe');
    assert.equal((await call(`/location-shares/${sos.data.share.id}/location`, { token, body: { coords: { lat: 1, lng: 1 } } })).status, 410);
    assert.equal((await call('/location-shares/active', { token })).data.share, null);
  });

  test('a new SOS replaces the previous share; anonymous and test alerts share nothing', async () => {
    const { token } = await newUser();
    const first = await call('/sos', { token, body: {} });
    const second = await call('/sos', { token, body: {} });
    assert.equal((await call(`/track/${first.data.share.url.split('/track/')[1]}`)).data.active, false);
    assert.equal((await call(`/track/${second.data.share.url.split('/track/')[1]}`)).data.active, true);
    assert.equal((await call('/sos', { body: {} })).data.share, null);
    assert.equal((await call('/sos/test', { token, method: 'POST' })).data.share, null);
    assert.equal((await call('/track/not-a-real-token')).status, 404);
  });
});

describe('safety timer', () => {
  test('alerts contacts when the timer runs out, once, with the last location', async () => {
    const { token } = await newUser('Isha');
    const c = await call('/contacts', { token, body: { name: 'Mom', phone: '+919222222222' } });
    await call(`/contact-invites/${c.data.inviteLink.split('/confirm-contact/')[1]}`, { body: { accept: true } });

    const started = await call('/check-ins', { token, body: { minutes: 30, note: 'Walking home', coords: { lat: 18.52, lng: 73.85 } } });
    assert.equal(started.status, 201);
    const id = started.data.checkIn.id;
    await call(`/check-ins/${id}/location`, { token, body: { coords: { lat: 18.53, lng: 73.86 } } });

    // Nothing happens before the deadline.
    assert.equal(await processOverdueCheckIns(new Date(Date.now() + 29 * 60_000)), 0);
    // Extending moves the deadline.
    await call(`/check-ins/${id}/extend`, { token, body: { minutes: 15 } });
    assert.equal(await processOverdueCheckIns(new Date(Date.now() + 40 * 60_000)), 0);

    const alerted = await processOverdueCheckIns(new Date(Date.now() + 46 * 60_000));
    assert.equal(alerted, 1);
    assert.equal(await processOverdueCheckIns(new Date(Date.now() + 60 * 60_000)), 0, 'never alerted twice');

    const current = await call('/check-ins/current', { token });
    assert.equal(current.data.checkIn.status, 'alerted');
    const sos = db.prepare('SELECT lat, lng FROM sos_events WHERE id = (SELECT sos_id FROM check_ins WHERE id = ?)').get(id) as { lat: number; lng: number };
    assert.deepEqual([sos.lat, sos.lng], [18.53, 73.86], 'uses the latest location');
    const delivery = db.prepare('SELECT contact_name FROM sos_deliveries WHERE sos_id = (SELECT sos_id FROM check_ins WHERE id = ?)').get(id) as { contact_name: string };
    assert.equal(delivery.contact_name, 'Mom');

    // "I'm safe" resolves the alert and stops the live link it started.
    assert.equal((await call(`/check-ins/${id}/complete`, { token, method: 'POST' })).data.wasAlerted, true);
    assert.equal((await call('/check-ins/current', { token })).data.checkIn, null);
    assert.equal((await call('/location-shares/active', { token })).data.share, null);
  });

  test('checking in on time sends nothing; a new timer replaces the old one', async () => {
    const { token } = await newUser();
    const first = await call('/check-ins', { token, body: { minutes: 10 } });
    const second = await call('/check-ins', { token, body: { minutes: 20 } });
    assert.equal((await call('/check-ins/current', { token })).data.checkIn.id, second.data.checkIn.id);
    await call(`/check-ins/${second.data.checkIn.id}/complete`, { token, method: 'POST' });
    assert.equal(await processOverdueCheckIns(new Date(Date.now() + 60 * 60_000)), 0);
    assert.equal((await call(`/check-ins/${first.data.checkIn.id}/extend`, { token, body: { minutes: 5 } })).status, 409);
    const other = await newUser();
    assert.equal((await call(`/check-ins/${second.data.checkIn.id}/complete`, { token: other.token, method: 'POST' })).status, 404);
    assert.equal((await call('/check-ins', { token, body: { minutes: 0 } })).status, 400);
  });
});
