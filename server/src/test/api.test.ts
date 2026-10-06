import './setup';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { app } from '../app';
import { db, purgeExpiredData } from '../db';
import { photoPath } from '../photos';
import { processOverdueCheckIns } from '../routes/checkins';
import { contactCode, processStaleRides } from '../routes/location';
import { formatAddress, parsePlaces } from '../geo';
import { keyedHash } from '../util';

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

async function userWithConfirmedContact(name = 'Nisha') {
  const { token } = await newUser(name);
  const c = await call('/contacts', { token, body: { name: 'Mom', phone: `+9193${String(Date.now()).slice(-8)}` } });
  await call(`/contact-invites/${c.data.inviteLink.split('/confirm-contact/')[1]}`, { body: { accept: true } });
  return { token, contactId: c.data.contact.id as number };
}

describe('contact acknowledgements', () => {
  test("\"I'm on my way\" from a personal link tells the user who is coming", async () => {
    const { token, contactId } = await userWithConfirmedContact();
    const sos = await call('/sos', { token, body: { coords: { lat: 28.6, lng: 77.2 } } });
    const shareToken = sos.data.share.url.split('/track/')[1];
    const code = contactCode(sos.data.share.id, contactId);

    assert.equal((await call(`/track/${shareToken}?c=${code}`)).data.acked, false);
    assert.equal((await call(`/track/${shareToken}/ack`, { body: { c: code } })).status, 200);
    assert.equal((await call(`/track/${shareToken}/ack`, { body: { c: code } })).status, 200, 'repeat is harmless');
    assert.equal((await call(`/track/${shareToken}?c=${code}`)).data.acked, true);

    const active = await call('/location-shares/active', { token });
    assert.deepEqual(active.data.share.acks.map((a: { name: string }) => a.name), ['Mom']);

    // A forged code doesn't impersonate a contact; it counts as an unnamed responder.
    await call(`/track/${shareToken}/ack`, { body: { c: 'aaaaaaaaaaaaaaaa' } });
    const after = await call('/location-shares/active', { token });
    assert.deepEqual(after.data.share.acks.map((a: { name: string | null }) => a.name), ['Mom', null]);

    await call(`/location-shares/${sos.data.share.id}/stop`, { token, method: 'POST' });
    assert.equal((await call(`/track/${shareToken}/ack`, { body: { c: code } })).status, 410);
  });
});

describe('setup checklist', () => {
  test('tracks contacts, confirmation and the test alert', async () => {
    const { token } = await userWithConfirmedContact();
    assert.deepEqual((await call('/account/setup', { token })).data, { contacts: 1, confirmed: 1, testSent: false });
    assert.equal((await call('/sos/test', { token, method: 'POST' })).status, 201);
    assert.equal((await call('/account/setup', { token })).data.testSent, true);
  });
});

describe('walk with me', () => {
  test('shares live location without an alert, and needs a confirmed contact', async () => {
    const lonely = await newUser();
    assert.equal((await call('/location-shares', { token: lonely.token, body: { minutes: 30 } })).status, 400);

    const { token } = await userWithConfirmedContact('Rhea');
    const walk = await call('/location-shares', { token, body: { minutes: 30, note: 'Metro to home', coords: { lat: 19.07, lng: 72.87 } } });
    assert.equal(walk.status, 201);
    assert.equal(walk.data.share.kind, 'walk');
    assert.equal(walk.data.total, 1);
    const view = await call(`/track/${walk.data.share.url.split('/track/')[1]}`);
    assert.equal(view.data.kind, 'walk');
    assert.equal(view.data.note, 'Metro to home');
    assert.equal(view.data.active, true);
    assert.equal((await call('/location-shares', { token, body: { minutes: 5 } })).status, 400, 'too short');
  });
});

describe('places', () => {
  test('nearby is disabled in tests and validates input', async () => {
    assert.equal((await call('/nearby')).status, 400);
    const res = await call('/nearby?lat=28.6&lng=77.2');
    assert.deepEqual(res.data, { available: false, radius: 3000, places: [] });
  });

  test('address formatting and place parsing', () => {
    assert.equal(formatAddress({ neighbourhood: 'Connaught Place', city: 'New Delhi', state: 'Delhi' }), 'Connaught Place, New Delhi');
    assert.equal(formatAddress({ road: 'MG Road', town: 'Gurugram' }), 'MG Road, Gurugram');
    assert.equal(formatAddress({ city: 'Mumbai' }), 'Mumbai');
    assert.equal(formatAddress({}), null);
    const places = parsePlaces([
      { type: 'node', id: 1, lat: 1, lon: 2, tags: { amenity: 'police', name: 'Thana', phone: '100' } },
      { type: 'way', id: 2, center: { lat: 3, lon: 4 }, tags: { amenity: 'hospital', 'name:en': 'City Hospital', name: 'शहर अस्पताल' } },
      { type: 'node', id: 3, lat: 5, lon: 6, tags: { amenity: 'school' } },
      { type: 'node', id: 4, tags: { amenity: 'pharmacy' } },
    ]);
    assert.deepEqual(
      places.map((p) => [p.id, p.type, p.name, p.lat, p.phone]),
      [
        ['node/1', 'police', 'Thana', 1, '100'],
        ['way/2', 'hospital', 'City Hospital', 3, null],
      ]
    );
  });
});

// A tiny JPEG-shaped file: JFIF header, an EXIF block with a "GPS" marker, a table and scan data.
function jpegWithExif() {
  const seg = (marker: number, payload: Buffer) => Buffer.concat([Buffer.from([0xff, marker, 0, payload.length + 2]), payload]);
  return Buffer.concat([
    Buffer.from([0xff, 0xd8]),
    seg(0xe0, Buffer.from('JFIF\0\x01\x01\0\0\x01\0\x01\0\0', 'binary')),
    seg(0xe1, Buffer.from('Exif\0\0GPS 28.6139N 77.2090E', 'binary')),
    seg(0xfe, Buffer.from('taken by Asha', 'binary')),
    seg(0xdb, Buffer.alloc(65, 1)),
    seg(0xda, Buffer.from([1, 1, 0, 0, 0x3f, 0])),
    Buffer.from([0x12, 0x34, 0xff, 0xd9]),
  ]);
}

async function upload(reportId: number, token: string, data: Buffer, type = 'image/jpeg') {
  const res = await fetch(`${base}/reports/${reportId}/photos`, { method: 'POST', headers: { 'Content-Type': type, 'X-Upload-Token': token }, body: new Uint8Array(data) });
  return { status: res.status, data: (await res.json()) as { id?: number; error?: string } };
}

describe('report photos', () => {
  test('are stripped of metadata and only visible to the owner', async () => {
    const { token } = await newUser('Kavya');
    const report = await call('/reports', { token, body: { incidentType: 'harassment', description: 'At the station' } });
    const { id, uploadToken } = report.data;

    assert.equal((await upload(id, 'wrong-token', jpegWithExif())).status, 404);
    assert.equal((await upload(id, uploadToken, Buffer.from('not an image'))).status, 415);
    assert.equal((await upload(id, uploadToken, Buffer.from('GIF89a'), 'image/gif')).status, 415);
    const photo = await upload(id, uploadToken, jpegWithExif());
    assert.equal(photo.status, 201);

    const mine = await call('/reports', { token });
    assert.deepEqual(mine.data.reports.find((r: { id: number }) => r.id === id).photos, [photo.data.id]);

    const res = await fetch(`${base}/reports/${id}/photos/${photo.data.id}`, { headers: { Cookie: `herspace_session=${token}` } });
    assert.equal(res.headers.get('content-type'), 'image/jpeg');
    const stored = Buffer.from(await res.arrayBuffer());
    assert.equal(stored.includes(Buffer.from('GPS')), false, 'EXIF removed');
    assert.equal(stored.includes(Buffer.from('taken by Asha')), false, 'comment removed');
    assert.equal(stored.includes(Buffer.from('JFIF')), true);
    assert.deepEqual([...stored.subarray(-4)], [0x12, 0x34, 0xff, 0xd9], 'image data kept');

    const other = await newUser('Other');
    assert.equal((await call(`/reports/${id}/photos/${photo.data.id}`, { token: other.token })).status, 404);
    assert.equal((await call(`/reports/${id}/photos/${photo.data.id}`)).status, 401);

    // Three at most; deleting the report removes them.
    await upload(id, uploadToken, jpegWithExif());
    await upload(id, uploadToken, jpegWithExif());
    assert.equal((await upload(id, uploadToken, jpegWithExif())).status, 409);
    assert.equal((await call(`/reports/${id}`, { token, method: 'DELETE' })).status, 200);
    assert.equal((db.prepare('SELECT COUNT(*) AS n FROM report_photos WHERE report_id = ?').get(id) as { n: number }).n, 0);
  });

  test('can be added to anonymous reports, but only right after submitting', async () => {
    const report = await call('/reports', { body: { incidentType: 'other', description: 'Anonymous', anonymous: true } });
    assert.equal((await upload(report.data.id, report.data.uploadToken, jpegWithExif())).status, 201);
    db.prepare("UPDATE reports SET upload_expires_at = '2000-01-01T00:00:00.000Z' WHERE id = ?").run(report.data.id);
    assert.equal((await upload(report.data.id, report.data.uploadToken, jpegWithExif())).status, 410);
  });
});

describe('moderation', () => {
  test('moderators review flagged map points; others cannot', async () => {
    const reporter = await newUser('Reporter');
    const report = await call('/reports', {
      token: reporter.token,
      body: { incidentType: 'stalking', description: 'Followed near the park', coords: { lat: 12.9716, lng: 77.5946 } },
    });
    const id = report.data.id as number;
    await upload(id, report.data.uploadToken, jpegWithExif());
    const onMap = async () => (await call('/reports/map')).data.points.some((p: { id: number }) => p.id === id);

    // Three different people flag it: hidden pending review.
    for (let i = 0; i < 3; i++) await call(`/reports/${id}/flag`, { token: (await newUser('Flagger')).token, body: {} });
    assert.equal(await onMap(), false);

    assert.equal((await call('/moderation/reports', { token: reporter.token })).status, 403);
    assert.equal((await call('/moderation/reports')).status, 401);

    const signup = await call('/auth/signup', { body: { name: 'Mod', email: 'moderator@example.com', password: 'password123' } });
    assert.equal(signup.data.user.moderator, true);
    const mod = signup.token as string;
    const queue = await call('/moderation/reports', { token: mod });
    const item = queue.data.reports.find((r: { id: number }) => r.id === id);
    assert.equal(item.flags, 3);
    assert.equal(item.hidden, true);
    assert.equal(item.description, 'Followed near the park');
    assert.equal(item.lat, 12.97);
    assert.equal('userId' in item || 'email' in item, false, 'never who reported it');
    // Moderators can view the photos.
    const photo = await fetch(`${base}/reports/${id}/photos/${item.photos[0]}`, { headers: { Cookie: `herspace_session=${mod}` } });
    assert.equal(photo.status, 200);

    // Approving puts it back on the map despite the flags.
    await call(`/moderation/reports/${id}`, { token: mod, body: { action: 'approve' } });
    assert.equal(await onMap(), true);
    assert.equal((await call('/moderation/reports', { token: mod })).data.reports.some((r: { id: number }) => r.id === id), false);
    assert.equal((await call('/moderation/reports?queue=approved', { token: mod })).data.reports.some((r: { id: number }) => r.id === id), true);

    // Removing hides it for good, and it can't be flagged any more.
    await call(`/moderation/reports/${id}`, { token: mod, body: { action: 'remove' } });
    assert.equal(await onMap(), false);
    assert.equal((await call(`/reports/${id}/flag`, { body: {} })).status, 404);

    // Reopening clears the old flags.
    await call(`/moderation/reports/${id}`, { token: mod, body: { action: 'reopen' } });
    assert.equal(await onMap(), true);
    assert.equal((await call(`/moderation/reports/${id}`, { token: mod, body: { action: 'delete' } })).status, 400);
  });
});

describe('phone verification', () => {
  test('a code proves the number; wrong codes are limited; alerts then show it', async () => {
    const { token } = await newUser('Kiran');
    const me = (await call('/auth/me', { token })).data.user;
    assert.equal(me.phone, null);

    // No SMS provider in tests: the server says so instead of pretending.
    const send = await call('/account/phone', { token, body: { phone: '+91 98765 43210' } });
    assert.equal(send.status, 503);
    assert.equal((await call('/account/phone', { token, body: { phone: '12345' } })).status, 400);

    // Plant a code as if it had been texted.
    const plant = () =>
      db.prepare('INSERT OR REPLACE INTO phone_codes (user_id, phone, code_hash, expires_at, attempts) VALUES (?, ?, ?, ?, 0)').run(
        me.id,
        '+919876543210',
        keyedHash(`phone:${me.id}:123456`),
        new Date(Date.now() + 60_000).toISOString()
      );
    plant();
    assert.equal((await call('/account/phone/verify', { token, body: { code: '12345' } })).status, 400, 'not 6 digits');
    for (let i = 0; i < 5; i++) assert.equal((await call('/account/phone/verify', { token, body: { code: '000000' } })).status, 400);
    assert.equal((await call('/account/phone/verify', { token, body: { code: '123456' } })).status, 410, 'locked after 5 wrong tries');

    plant();
    const ok = await call('/account/phone/verify', { token, body: { code: '123456' } });
    assert.equal(ok.status, 200);
    assert.equal((await call('/auth/me', { token })).data.user.phone, '+919876543210');
    assert.equal((await call('/account/phone/verify', { token, body: { code: '123456' } })).status, 410, 'codes are single-use');

    // The test alert names the verified number.
    const contact = await call('/contacts', { token, body: { name: 'Mom', phone: `+9194${String(Date.now()).slice(-8)}` } });
    await call(`/contact-invites/${contact.data.inviteLink.split('/confirm-contact/')[1]}`, { body: { accept: true } });
    const test = await call('/sos/test', { token, method: 'POST' });
    assert.match(test.data.message, /Kiran \(\+919876543210\)/);

    assert.equal((await call('/account/phone', { token, method: 'DELETE' })).status, 200);
    assert.equal((await call('/auth/me', { token })).data.user.phone, null);
  });
});

describe('protection at home', () => {
  test('a silent SOS asks contacts not to call', async () => {
    const { token } = await userWithConfirmedContact('Rani');
    const loud = await call('/sos', { token, body: {} });
    assert.match(loud.data.message, /Please call them now/);
    const silent = await call('/sos', { token, body: { silent: true } });
    assert.match(silent.data.message, /DON'T call them first/);
    assert.doesNotMatch(silent.data.message, /Please call them now/);
  });

  test('a code phrase is saved, validated and can be cleared', async () => {
    const { token } = await userWithConfirmedContact('Devi');
    assert.equal((await call('/account/code-phrase', { token })).data.phrase, null);
    assert.equal((await call('/account/code-phrase', { token, method: 'PUT', body: { phrase: 'ok' } })).status, 400, 'too short');
    const set = await call('/account/code-phrase', { token, method: 'PUT', body: { phrase: 'Did you buy the red umbrella?' } });
    assert.equal(set.status, 200);
    assert.equal((await call('/account/code-phrase', { token })).data.phrase, 'Did you buy the red umbrella?');
    assert.equal((await call('/account/code-phrase', { token, method: 'PUT', body: { phrase: null } })).data.phrase, null);
  });
});

describe('SOS audio recordings', () => {
  const put = (token: string, sosId: number, body: Uint8Array<ArrayBuffer>, type = 'audio/webm') =>
    fetch(`${base}/sos/${sosId}/recordings`, {
      method: 'POST',
      headers: { 'Content-Type': type, Cookie: `herspace_session=${token}`, 'X-Requested-With': 'HerSpace' },
      body,
    });

  test('pieces upload during an SOS and only the owner can play them', async () => {
    const { token } = await userWithConfirmedContact('Mira');
    const sos = await call('/sos', { token, body: {} });
    const audio = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 1, 2, 3, 4]);
    assert.equal((await put(token, sos.data.id, audio)).status, 201);
    assert.equal((await put(token, sos.data.id, audio)).status, 201);
    assert.equal((await put(token, sos.data.id, audio, 'image/png')).status, 415);

    const test = await call('/sos/test', { token, method: 'POST' });
    assert.equal((await put(token, test.data.id, audio)).status, 404, 'not for test alerts');

    const list = await call('/sos/recordings', { token });
    const event = list.data.events.find((e: { id: number }) => e.id === sos.data.id);
    assert.equal(event.pieces.length, 2);

    const res = await fetch(`${base}/sos/${sos.data.id}/recordings/${event.pieces[0].id}`, { headers: { Cookie: `herspace_session=${token}` } });
    assert.equal(res.headers.get('content-type'), 'audio/webm');
    assert.deepEqual(new Uint8Array(await res.arrayBuffer()), audio);

    const other = await newUser('Other');
    assert.equal((await call(`/sos/${sos.data.id}/recordings/${event.pieces[0].id}`, { token: other.token })).status, 404);
    assert.equal((await put(other.token, sos.data.id, audio)).status, 404);
  });

  // The Privacy Policy promises recordings are deleted with the alert after 90 days, and with the
  // account: the audio files on disk, not just the database rows.
  const recordingFiles = (sosId: number) =>
    (db.prepare('SELECT file FROM sos_recordings WHERE sos_id = ?').all(sosId) as Array<{ file: string }>).map((r) => photoPath(r.file)!);
  const audio = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 9, 9]);

  test('audio files are deleted from disk when the alert expires', async () => {
    const { token } = await userWithConfirmedContact('Noor');
    const sos = await call('/sos', { token, body: {} });
    await put(token, sos.data.id, audio);
    const files = recordingFiles(sos.data.id);
    assert.equal(files.length, 1);
    assert.ok(fs.existsSync(files[0]));
    db.prepare("UPDATE sos_events SET created_at = '2020-01-01T00:00:00.000Z' WHERE id = ?").run(sos.data.id);
    purgeExpiredData();
    assert.equal(fs.existsSync(files[0]), false, 'file removed');
    assert.equal(recordingFiles(sos.data.id).length, 0);
  });

  test('audio files are deleted from disk with the account', async () => {
    const { token } = await userWithConfirmedContact('Ojas');
    const sos = await call('/sos', { token, body: {} });
    await put(token, sos.data.id, audio);
    const [file] = recordingFiles(sos.data.id);
    assert.ok(fs.existsSync(file));
    assert.equal((await call('/account', { token, method: 'DELETE', body: { password: 'password123' } })).status, 200);
    assert.equal(fs.existsSync(file), false);
  });
});

describe('journeys', () => {
  test('a ride needs a vehicle, starts a timer, and arriving ends both', async () => {
    const { token } = await userWithConfirmedContact('Anu');
    assert.equal((await call('/location-shares', { token, body: { kind: 'ride', minutes: 60, details: {} } })).status, 400);

    const ride = await call('/location-shares', {
      token,
      body: { kind: 'ride', minutes: 60, checkInMinutes: 45, details: { vehicle: 'DL01AB1234', vehicleType: 'Cab', app: 'Uber', driver: 'Ramesh', destination: 'Saket' } },
    });
    assert.equal(ride.status, 201);
    assert.equal(ride.data.share.note, 'Cab DL01AB1234 (Uber, driver Ramesh) to Saket');
    assert.ok(ride.data.checkIn.dueAt);
    assert.equal((await call('/check-ins/current', { token })).data.checkIn.note, 'Cab DL01AB1234 (Uber, driver Ramesh) to Saket');

    await call(`/location-shares/${ride.data.share.id}/stop`, { token, body: {} });
    assert.equal((await call('/check-ins/current', { token })).data.checkIn, null, 'arriving completes the timer');
  });

  test('a meeting needs a person; a missed check-in alerts contacts', async () => {
    const { token } = await userWithConfirmedContact('Bina');
    assert.equal((await call('/location-shares', { token, body: { kind: 'meeting', minutes: 60, details: {} } })).status, 400);
    const meet = await call('/location-shares', { token, body: { kind: 'meeting', minutes: 60, checkInMinutes: 30, details: { person: 'Rahul', place: 'Cafe Blue' } } });
    assert.equal(meet.data.share.note, 'Meeting Rahul at Cafe Blue');
    const alerted = await processOverdueCheckIns(new Date(Date.now() + 31 * 60_000));
    assert.ok(alerted >= 1);
    assert.equal((await call('/check-ins/current', { token })).data.checkIn.status, 'alerted');
  });

  test('a ride whose location stops updating warns contacts once', async () => {
    const { token } = await userWithConfirmedContact('Chitra');
    const ride = await call('/location-shares', { token, body: { kind: 'ride', minutes: 60, details: { vehicle: 'KA05MN4321' } } });
    const later = new Date(Date.now() + 11 * 60_000);
    assert.ok((await processStaleRides(later)) >= 1);
    const row = db.prepare('SELECT stale_alerted_at FROM location_shares WHERE id = ?').get(ride.data.share.id) as { stale_alerted_at: string | null };
    assert.ok(row.stale_alerted_at);
    const again = db.prepare('SELECT COUNT(*) AS n FROM location_shares WHERE id = ? AND stale_alerted_at IS NULL').get(ride.data.share.id) as { n: number };
    assert.equal(again.n, 0);
    // A new position re-arms the warning.
    await call(`/location-shares/${ride.data.share.id}/location`, { token, body: { coords: { lat: 12.9, lng: 77.6 } } });
    assert.equal((db.prepare('SELECT stale_alerted_at FROM location_shares WHERE id = ?').get(ride.data.share.id) as { stale_alerted_at: string | null }).stale_alerted_at, null);
  });
});

describe('emergency info and battery', () => {
  const info = { bloodGroup: 'O-', allergies: 'Penicillin', medications: '', conditions: 'Asthma', notes: '' };

  test('private until sharing is on, then shown only on an active SOS', async () => {
    const { token, contactId } = await userWithConfirmedContact('Ira');
    assert.deepEqual((await call('/account/emergency-info', { token })).data, { info: null, share: false });
    assert.equal((await call('/account/emergency-info', { token, method: 'PUT', body: { info: { ...info, bloodGroup: 'Z+' }, share: true } })).status, 400);

    await call('/account/emergency-info', { token, method: 'PUT', body: { info, share: false } });
    const sos = await call('/sos', { token, body: {} });
    // The contact's personal link (as in their SMS) and the plain link (which can be forwarded).
    const shareToken = sos.data.share.url.split('/track/')[1];
    const track = () => call(`/track/${shareToken}?c=${contactCode(sos.data.share.id, contactId)}`);
    const plain = () => call(`/track/${shareToken}`);
    assert.equal((await track()).data.emergencyInfo, null, 'not shared');

    const saved = await call('/account/emergency-info', { token, method: 'PUT', body: { info, share: true } });
    assert.deepEqual(saved.data, { info, share: true });
    assert.deepEqual((await track()).data.emergencyInfo, info);
    assert.equal((await plain()).data.emergencyInfo, null, 'never on the plain link');
    assert.ok((await plain()).data.battery !== undefined, 'the plain link still works');
    assert.deepEqual((await call('/account/export', { token })).data.user.emergencyInfo, info);

    // A contact who withdraws stops seeing it.
    db.prepare("UPDATE contacts SET status = 'declined' WHERE id = ?").run(contactId);
    assert.equal((await track()).data.emergencyInfo, null, 'withdrawn contact');
    db.prepare("UPDATE contacts SET status = 'confirmed' WHERE id = ?").run(contactId);

    await call(`/location-shares/${sos.data.share.id}/stop`, { token, body: {} });
    assert.equal((await track()).data.emergencyInfo, null, 'gone once she is safe');
  });

  test('never shown on a walk', async () => {
    const { token } = await userWithConfirmedContact('Jaya');
    await call('/account/emergency-info', { token, method: 'PUT', body: { info, share: true } });
    const walk = await call('/location-shares', { token, body: { minutes: 30 } });
    assert.equal((await call(`/track/${walk.data.share.url.split('/track/')[1]}`)).data.emergencyInfo, null);
  });

  test('clearing every field removes it and turns sharing off', async () => {
    const { token } = await newUser('Kiran');
    await call('/account/emergency-info', { token, method: 'PUT', body: { info, share: true } });
    const cleared = await call('/account/emergency-info', { token, method: 'PUT', body: { info: {}, share: true } });
    assert.deepEqual(cleared.data, { info: null, share: false });
  });

  test('contacts see the battery level sent with the location', async () => {
    const { token } = await userWithConfirmedContact('Lata');
    const walk = await call('/location-shares', { token, body: { minutes: 30 } });
    const track = () => call(`/track/${walk.data.share.url.split('/track/')[1]}`);
    assert.equal((await track()).data.battery, null);
    const coords = { lat: 28.6, lng: 77.2 };
    await call(`/location-shares/${walk.data.share.id}/location`, { token, body: { coords, battery: { level: 0.08, charging: false } } });
    assert.deepEqual((await track()).data.battery, { level: 0.08, charging: false });
    assert.equal((await call(`/location-shares/${walk.data.share.id}/location`, { token, body: { coords, battery: { level: 3, charging: false } } })).status, 400);
    // Browsers without the Battery API send none: the last known level is cleared rather than kept stale.
    await call(`/location-shares/${walk.data.share.id}/location`, { token, body: { coords } });
    assert.equal((await track()).data.battery, null);
  });
});

describe('arriving at a saved place', () => {
  test('contacts see where she is heading, and that she arrived', async () => {
    const { token } = await userWithConfirmedContact('Meera');
    const walk = await call('/location-shares', { token, body: { minutes: 30, destination: 'Home' } });
    assert.equal(walk.data.share.destination, 'Home');
    const track = () => call(`/track/${walk.data.share.url.split('/track/')[1]}`);
    assert.equal((await track()).data.destination, 'Home');
    assert.equal((await call('/location-shares/active', { token })).data.share.destination, 'Home', 'survives a reload');
    assert.equal((await call('/location-shares', { token, body: { minutes: 30, destination: 'x'.repeat(41) } })).status, 400);

    const stop = await call(`/location-shares/${walk.data.share.id}/stop`, { token, body: { arrived: true } });
    assert.equal(stop.status, 200);
    const ended = (await track()).data;
    assert.equal(ended.active, false);
    assert.equal(ended.arrived, true);
    assert.equal(ended.destination, 'Home');
  });

  test('an SOS never counts as arriving, and a stop without a body still works', async () => {
    const { token } = await userWithConfirmedContact('Neha');
    const sos = await call('/sos', { token, body: {} });
    await call(`/location-shares/${sos.data.share.id}/stop`, { token, body: { arrived: true } });
    const view = (await call(`/track/${sos.data.share.url.split('/track/')[1]}`)).data;
    assert.equal(view.arrived, false);
    assert.equal(view.destination, null);

    const walk = await call('/location-shares', { token, body: { minutes: 30 } });
    assert.equal((await call(`/location-shares/${walk.data.share.id}/stop`, { token, method: 'POST' })).status, 200);
  });
});

describe('evidence pack', () => {
  test("collects the report and the alerts around it, for its author only", async () => {
    const { token } = await userWithConfirmedContact('Oviya');
    const today = new Date().toISOString().slice(0, 10);
    const report = await call('/reports', { token, body: { incidentType: 'harassment', description: 'Followed home', date: today } });
    const old = await call('/reports', { token, body: { incidentType: 'harassment', description: 'Years ago', date: '2020-01-01' } });
    await call('/sos/test', { token, body: {} });
    const sos = await call('/sos', { token, body: { coords: { lat: 28.6, lng: 77.2, accuracy: 15 } } });
    await call(`/track/${sos.data.share.url.split('/track/')[1]}/ack`, { body: {} });

    const pack = await call(`/reports/${report.data.id}/evidence`, { token });
    assert.equal(pack.status, 200);
    assert.equal(pack.data.user.name, 'Oviya');
    assert.equal(pack.data.report.description, 'Followed home');
    assert.deepEqual(pack.data.report.photos, []);
    assert.equal(pack.data.sosEvents.length, 1, 'the real alert, not the test one');
    const [event] = pack.data.sosEvents;
    assert.equal(event.lat, 28.6);
    assert.equal(event.alerted.length, 1);
    assert.equal(event.alerted[0].name, 'Mom');
    assert.equal(event.responses.length, 1);
    assert.deepEqual({ ...event.recordings, first: null, last: null }, { pieces: 0, bytes: 0, first: null, last: null });

    assert.equal((await call(`/reports/${old.data.id}/evidence`, { token })).data.sosEvents.length, 0, 'nothing from other days');
    const stranger = await newUser('Stranger');
    assert.equal((await call(`/reports/${report.data.id}/evidence`, { token: stranger.token })).status, 404);
    assert.equal((await call(`/reports/${report.data.id}/evidence`)).status, 401);
  });
});

describe('security review 2', () => {
  test('report dates must be real calendar dates', async () => {
    const { token } = await newUser('Ritu');
    for (const date of ['2026-13-45', '2026-02-30', '2026-00-10']) {
      assert.equal((await call('/reports', { token, body: { incidentType: 'other', description: 'x', date } })).status, 400, date);
    }
    assert.equal((await call('/reports', { token, body: { incidentType: 'other', description: 'x', date: '2024-02-29' } })).status, 201, 'leap day');
  });

  test('an evidence pack still opens for a report saved with an impossible date', async () => {
    const { token } = await newUser('Sana');
    const report = await call('/reports', { token, body: { incidentType: 'other', description: 'old one' } });
    db.prepare("UPDATE reports SET incident_date = '2026-13-45' WHERE id = ?").run(report.data.id);
    const pack = await call(`/reports/${report.data.id}/evidence`, { token });
    assert.equal(pack.status, 200);
    assert.deepEqual(pack.data.sosEvents, []);
  });
});

describe('security fixes', () => {
  test('SOS recordings must really be audio', async () => {
    const { token } = await userWithConfirmedContact('Gita');
    const sos = await call('/sos', { token, body: {} });
    const res = await fetch(`${base}/sos/${sos.data.id}/recordings`, {
      method: 'POST',
      headers: { 'Content-Type': 'audio/webm', Cookie: `herspace_session=${token}`, 'X-Requested-With': 'HerSpace' },
      body: new TextEncoder().encode('<script>not audio</script>'),
    });
    assert.equal(res.status, 415);
  });

  test('verification codes are limited per phone number, across accounts', async () => {
    const phone = `+9197${String(Date.now()).slice(-8)}`;
    const statuses: number[] = [];
    for (let i = 0; i < 4; i++) {
      const { token } = await newUser(`Caller${i}`);
      statuses.push((await call('/account/phone', { token, body: { phone } })).status);
    }
    assert.deepEqual(statuses, [503, 503, 503, 429]);
  });

  test('only one unnamed "on my way" per alert', async () => {
    const { token } = await userWithConfirmedContact('Hema');
    const sos = await call('/sos', { token, body: {} });
    const shareToken = sos.data.share.url.split('/track/')[1];
    for (let i = 0; i < 3; i++) await call(`/track/${shareToken}/ack`, { body: { c: 'not-a-real-code!' } });
    const acks = (await call('/location-shares/active', { token })).data.share.acks;
    assert.equal(acks.length, 1);
  });

  test('ADMIN_EMAILS grants nothing in production', async () => {
    const signup = await call('/auth/signup', { body: { name: 'Admin', email: 'moderator@example.com', password: 'password123' } });
    const token = signup.token ?? (await call('/auth/login', { body: { email: 'moderator@example.com', password: 'password123' } })).token;
    assert.equal((await call('/auth/me', { token })).data.user.moderator, true, 'dev/test: granted');
    const before = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      assert.equal((await call('/auth/me', { token })).data.user.moderator, false);
      assert.equal((await call('/moderation/reports', { token })).status, 403);
    } finally {
      process.env.NODE_ENV = before;
    }
    // The database role still works in production.
    db.prepare("UPDATE users SET role = 'moderator' WHERE email = 'moderator@example.com'").run();
    process.env.NODE_ENV = 'production';
    try {
      assert.equal((await call('/auth/me', { token })).data.user.moderator, true);
    } finally {
      process.env.NODE_ENV = before;
    }
  });
});
