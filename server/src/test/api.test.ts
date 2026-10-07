import './setup';
import crypto from 'crypto';
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
// Stands in for clicking the emailed link (the test server sends no email).
const verifyEmail = (email: string) => db.prepare('UPDATE users SET email_verified_at = ? WHERE email = ?').run(new Date().toISOString(), email);

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
    // Tamil, Bengali and Marathi have their own replies, picked by the same distress lists as the app.
    assert.match(fallbackReply(say('யாரோ என்னைப் பின்தொடர்கிறான்'), 'ta'), /SOS/);
    assert.match(fallbackReply(say('আমি মরে যেতে চাই'), 'bn'), /14416/);
    assert.match(fallbackReply(say('मला जगायचं नाही'), 'mr'), /14416/);
    assert.match(fallbackReply(say('I want to die'), 'mr'), /14416/, 'the person may write in English with the app in Marathi');
  });

  test('answers in every app language (Tamil, Bengali and Marathi used to be rejected)', async () => {
    for (const lang of ['en', 'hi', 'ta', 'bn', 'mr']) {
      const res = await call('/chat', { body: { messages: [{ role: 'user', content: 'hello' }], lang } });
      assert.equal(res.status, 200, lang);
    }
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

describe('Corporate Connect', () => {
  const report = (token: string, extra: Record<string, unknown> = {}) =>
    call('/workplace/reports', { token, body: { category: 'harassment', description: 'My manager keeps commenting on how I dress.', ...extra } });

  async function workplace() {
    const hr = await newUser('Hema');
    verifyEmail(hr.email);
    // Test accounts are userN@example.com, so example.com is HR's own domain.
    const created = await call('/workplace/orgs', { token: hr.token, body: { name: 'Acme', emailDomain: 'example.com' } });
    assert.equal(created.status, 201);
    const employee = await newUser('Esha');
    verifyEmail(employee.email);
    const typed = created.data.joinCode.toLowerCase().replace(/(.{4})/, '$1 ');
    assert.equal((await call('/workplace/join', { token: employee.token, body: { code: typed } })).status, 201);
    return { hr, employee, code: created.data.joinCode as string };
  }

  test('HR sets up a workplace; employees join with its code and are verified by email domain', async () => {
    const someone = await newUser('Sona');
    const bad = await call('/workplace/orgs', { token: someone.token, body: { name: 'Fake Corp', emailDomain: 'acme-real.com' } });
    assert.equal(bad.status, 400, 'cannot claim a domain that is not your own email domain');

    const { hr, employee, code } = await workplace();
    assert.match(code, /^[A-HJ-NP-Z2-9]{8}$/);
    assert.equal((await call('/workplace/orgs', { token: hr.token, body: { name: 'Second' } })).status, 409, 'one workplace per account');
    const mine = await call('/workplace', { token: employee.token });
    assert.deepEqual(mine.data.org, { id: mine.data.org.id, name: 'Acme', emailDomain: 'example.com', role: 'member', verified: true });
    assert.equal((await call('/workplace/join', { token: someone.token, body: { code: 'WRONGCODE' } })).status, 404);
    assert.equal((await call('/workplace/reports', { token: someone.token, body: {} })).status, 403, 'not a member');
  });

  test('reports are anonymous to HR unless the employee shares who they are', async () => {
    const { hr, employee } = await workplace();
    assert.equal((await report(employee.token, { category: 'gossip' })).status, 400);
    assert.equal((await report(employee.token)).status, 201);
    assert.equal((await report(employee.token, { category: 'bullying', shareIdentity: true })).status, 201);

    const list = (await call('/workplace/hr/reports', { token: hr.token })).data.reports;
    assert.equal(list.length, 2);
    const anonymous = list.find((r: { category: string }) => r.category === 'harassment');
    const named = list.find((r: { category: string }) => r.category === 'bullying');
    assert.equal(anonymous.reporter, null);
    assert.equal(JSON.stringify(anonymous).includes('Esha'), false, 'nothing identifying anywhere in it');
    assert.equal(named.reporter.name, 'Esha');
    assert.equal((await call('/workplace/hr/reports', { token: employee.token })).status, 403, 'employees are not HR');
  });

  test('HR and the reporter talk through the report; nobody else can', async () => {
    const { hr, employee } = await workplace();
    const { data } = await report(employee.token);
    const reply = await call(`/workplace/reports/${data.id}/messages`, { token: hr.token, body: { body: 'Thank you for telling us. Can you say which meeting?' } });
    assert.equal(reply.status, 201);
    await call(`/workplace/reports/${data.id}/messages`, { token: employee.token, body: { body: 'The Monday stand-up.' } });

    const mine = (await call('/workplace/reports/mine', { token: employee.token })).data.reports[0];
    assert.equal(mine.status, 'reviewing', 'a reply moves it to reviewing');
    assert.deepEqual(
      mine.messages.map((m: { fromHr: boolean; body: string }) => [m.fromHr, m.body]),
      [
        [true, 'Thank you for telling us. Can you say which meeting?'],
        [false, 'The Monday stand-up.'],
      ]
    );

    // HR of another workplace can't read or change it.
    const other = await newUser('Olga');
    await call('/workplace/orgs', { token: other.token, body: { name: 'Other Ltd' } });
    assert.equal((await call(`/workplace/reports/${data.id}/messages`, { token: other.token, body: { body: 'hi' } })).status, 404);
    assert.equal((await call(`/workplace/hr/reports/${data.id}`, { token: other.token, method: 'PATCH', body: { status: 'closed' } })).status, 404);
    assert.equal((await call('/workplace/hr/reports', { token: other.token })).data.reports.length, 0);

    assert.equal((await call(`/workplace/hr/reports/${data.id}`, { token: hr.token, method: 'PATCH', body: { status: 'done' } })).status, 400);
    assert.equal((await call(`/workplace/hr/reports/${data.id}`, { token: hr.token, method: 'PATCH', body: { status: 'resolved' } })).status, 200);
    assert.equal((await call('/workplace/reports/mine', { token: employee.token })).data.reports[0].status, 'resolved');
  });

  test('insights hide small groups that could point to a person', async () => {
    const { hr, employee } = await workplace();
    await report(employee.token);
    await report(employee.token);
    let insights = (await call('/workplace/hr/insights', { token: hr.token })).data;
    assert.equal(insights.total, 2);
    assert.equal(insights.byCategory, null, 'fewer than 3 reports: no breakdown');
    assert.equal(insights.members, 2);
    assert.equal(insights.verifiedMembers, 2);
    await report(employee.token);
    await report(employee.token, { category: 'discrimination' });
    insights = (await call('/workplace/hr/insights', { token: hr.token })).data;
    assert.deepEqual(insights.byCategory, { harassment: 3, other: 1 }, 'the single discrimination report is folded into other');
    assert.equal(insights.open, 4);
    assert.equal(insights.months.length, 6);
    assert.equal(insights.months.at(-1).count, 4);
  });

  test('settings only accept real Slack and Teams webhooks; a new join code replaces the old one', async () => {
    const { hr, code } = await workplace();
    for (const bad of ['http://hooks.slack.com/services/x', 'https://evil.example.com/hook', 'https://hooks.slack.com.evil.com/x', 'https://169.254.169.254/latest']) {
      assert.equal((await call('/workplace/hr/settings', { token: hr.token, method: 'PUT', body: { slackWebhook: bad } })).status, 400, bad);
    }
    const ok = await call('/workplace/hr/settings', {
      token: hr.token,
      method: 'PUT',
      body: { slackWebhook: 'https://hooks.slack.com/services/T0/B0/x', teamsWebhook: 'https://acme.webhook.office.com/webhookb2/abc', notifyEmail: 'hr@example.com' },
    });
    assert.equal(ok.status, 200);
    assert.equal((await call('/workplace/hr/settings', { token: hr.token })).data.slackWebhook, 'https://hooks.slack.com/services/T0/B0/x');

    const fresh = await call('/workplace/hr/join-code', { token: hr.token, method: 'POST' });
    const late = await newUser('Lata');
    assert.equal((await call('/workplace/join', { token: late.token, body: { code } })).status, 404, 'old code no longer works');
    assert.equal((await call('/workplace/join', { token: late.token, body: { code: fresh.data.joinCode } })).status, 201);
  });

  test('HR can add a colleague to the HR team; the last HR person cannot leave the team empty', async () => {
    const { hr, employee } = await workplace();
    assert.equal((await call('/workplace/leave', { token: hr.token, method: 'POST' })).status, 409);
    const email = (await call('/auth/me', { token: employee.token })).data.user.email;
    assert.equal((await call('/workplace/hr/team', { token: hr.token, body: { email: 'nobody@example.com' } })).status, 404);
    assert.equal((await call('/workplace/hr/team', { token: hr.token, body: { email } })).status, 200);
    assert.equal((await call('/workplace', { token: employee.token })).data.org.role, 'hr');
    assert.equal((await call('/workplace/leave', { token: hr.token, method: 'POST' })).status, 200);
    assert.equal((await call('/workplace', { token: hr.token })).data.org, null);
  });

  test('an employee report is in their data export and goes with their account', async () => {
    const { hr, employee } = await workplace();
    await report(employee.token);
    const exported = (await call('/account/export', { token: employee.token })).data;
    assert.equal(exported.workplace.name, 'Acme');
    assert.equal(exported.workplaceReports.length, 1);
    await call('/account', { token: employee.token, method: 'DELETE', body: { password: 'password123' } });
    assert.equal((await call('/workplace/hr/reports', { token: hr.token })).data.reports.length, 0);
  });
});

describe('Safe Circles', () => {
  const circleBody = { name: 'IIT Hostel Women', description: 'Safety updates and support for hostel residents.', kind: 'college' };

  async function circle(extra: Record<string, unknown> = {}) {
    const owner = await newUser('Oorja');
    const created = await call('/circles', { token: owner.token, body: { ...circleBody, ...extra } });
    assert.equal(created.status, 201);
    const member = await newUser('Mira');
    assert.equal((await call('/circles/join', { token: member.token, body: { code: created.data.joinCode } })).status, 201);
    return { owner, member, id: created.data.id as number, code: created.data.joinCode as string };
  }
  const post = (token: string, id: number, extra: Record<string, unknown> = {}) =>
    call(`/circles/${id}/posts`, { token, body: { kind: 'alert', body: 'Streetlights out on the back gate road tonight.', ...extra } });

  test('members join with a code; only members can see inside', async () => {
    const { owner, member, id } = await circle();
    const outsider = await newUser('Usha');
    assert.equal((await call(`/circles/${id}`, { token: outsider.token })).status, 404);
    assert.equal((await post(outsider.token, id)).status, 404);
    assert.equal((await call('/circles/join', { token: outsider.token, body: { code: 'NOTACODE' } })).status, 404);

    assert.equal((await post(member.token, id)).status, 201);
    // The owner sees a new post waiting; opening the circle marks it read.
    assert.equal((await call('/circles', { token: owner.token })).data.circles[0].newPosts, 1);
    const view = (await call(`/circles/${id}`, { token: owner.token })).data;
    assert.equal(view.circle.members, 2);
    assert.equal(view.circle.role, 'owner');
    assert.equal(view.posts[0].author, 'Mira');
    assert.equal(view.posts[0].mine, false);
    assert.equal((await call('/circles', { token: owner.token })).data.circles[0].newPosts, 0);
    const mine = (await call('/circles', { token: member.token })).data.circles[0];
    assert.equal(mine.role, 'member');
    assert.equal(mine.newPosts, 0, 'your own posts are not new to you');
  });

  test('anonymous posts and comments hide the author from everyone, moderators included', async () => {
    const { owner, member, id } = await circle();
    await post(member.token, id, { anonymous: true });
    const view = (await call(`/circles/${id}`, { token: owner.token })).data;
    const p = view.posts[0];
    assert.equal(p.author, null);
    assert.equal(JSON.stringify(view).includes('Mira'), false);
    assert.equal((await call(`/circles/${id}`, { token: member.token })).data.posts[0].mine, true, 'the author still knows it is theirs');

    await call(`/circles/${id}/posts/${p.id}/comments`, { token: member.token, body: { body: 'I saw it too.', anonymous: true } });
    const comment = (await call(`/circles/${id}`, { token: owner.token })).data.posts[0].comments[0];
    assert.equal(comment.author, null);

    // Flagged, it reaches the moderation queue still anonymous.
    const third = await newUser('Tara');
    await call('/circles/join', { token: third.token, body: { code: (await call(`/circles/${id}/join-code`, { token: owner.token, method: 'POST' })).data.joinCode } });
    await call(`/circles/${id}/flag`, { token: third.token, body: { target: 'post', id: p.id, reason: 'false' } });
    const queue = (await call(`/circles/${id}/moderation`, { token: owner.token })).data;
    assert.equal(queue.flagged[0].author, null);
    assert.equal(JSON.stringify(queue.flagged).includes('Mira'), false);
  });

  test('three flags hide a post; a moderator can remove it and ban the anonymous author without learning who it is', async () => {
    const { owner, member, id, code } = await circle();
    const { data } = await post(member.token, id, { anonymous: true, body: 'Spreading a rumour about a named person.' });
    assert.equal((await call(`/circles/${id}/flag`, { token: member.token, body: { target: 'post', id: data.id, reason: 'spam' } })).status, 400, 'not your own');
    const flaggers = [owner];
    for (const name of ['Fiza', 'Gita']) {
      const u = await newUser(name);
      await call('/circles/join', { token: u.token, body: { code } });
      flaggers.push(u);
    }
    for (const u of flaggers) await call(`/circles/${id}/flag`, { token: u.token, body: { target: 'post', id: data.id, reason: 'personal_info' } });
    assert.equal((await call(`/circles/${id}`, { token: flaggers[1].token })).data.posts.length, 0, 'hidden from members');
    assert.equal((await call(`/circles/${id}`, { token: member.token })).data.posts[0].hidden, true, 'the author sees it is hidden');

    const queue = (await call(`/circles/${id}/moderation`, { token: owner.token })).data;
    assert.equal(queue.flagged[0].flags, 3);
    assert.deepEqual(queue.flagged[0].reasons, ['personal_info']);
    const removed = await call(`/circles/${id}/moderation/items`, { token: owner.token, body: { target: 'post', id: data.id, action: 'remove', ban: true } });
    assert.equal(removed.status, 200);
    assert.equal((await call(`/circles/${id}`, { token: member.token })).status, 404, 'the author is out');
    assert.equal((await call('/circles/join', { token: member.token, body: { code } })).status, 403, 'and cannot rejoin');
  });

  test('listed circles can be found and asked to join; a domain limit keeps others out', async () => {
    const owner = await newUser('Kavya');
    verifyEmail(owner.email);
    // Test accounts are @example.com.
    const created = await call('/circles', {
      token: owner.token,
      body: { ...circleBody, name: 'Example College Women', emailDomain: 'example.com', requireDomain: true, listed: true },
    });
    assert.equal(created.status, 201);
    assert.equal((await call('/circles', { token: owner.token, body: { ...circleBody, emailDomain: 'iitd.ac.in' } })).status, 400, 'not your domain');

    const student = await newUser('Sana');
    verifyEmail(student.email);
    const found = (await call('/circles/directory?q=Example%20College', { token: student.token })).data.circles;
    assert.equal(found.length, 1);
    assert.equal(found[0].requireDomain, true);
    assert.equal((await call(`/circles/${created.data.id}/request`, { token: student.token, method: 'POST' })).status, 201);
    assert.equal((await call(`/circles/${created.data.id}`, { token: student.token })).status, 404, 'not in until approved');
    assert.equal((await call('/circles/directory?q=Example%20College', { token: student.token })).data.circles[0].requested, true);

    const queue = (await call(`/circles/${created.data.id}/moderation`, { token: owner.token })).data;
    assert.equal(queue.requests[0].name, 'Sana');
    assert.equal(queue.requests[0].verified, true);
    await call(`/circles/${created.data.id}/moderation/requests/${queue.requests[0].id}`, { token: owner.token, body: { approve: true } });
    assert.equal((await call(`/circles/${created.data.id}`, { token: student.token })).status, 200);

    // An unlisted circle never shows in the directory.
    const hidden = await circle({ name: 'Unlisted Example Group' });
    assert.equal((await call('/circles/directory?q=Unlisted', { token: student.token })).data.circles.length, 0);
    assert.equal((await call(`/circles/${hidden.id}/request`, { token: student.token, method: 'POST' })).status, 404);
  });

  test('roles: the owner makes moderators; moderators cannot touch each other; the circle passes on when the owner leaves', async () => {
    const { owner, member, id, code } = await circle();
    const mod = await newUser('Neha');
    await call('/circles/join', { token: mod.token, body: { code } });
    const members = (await call(`/circles/${id}/moderation`, { token: owner.token })).data.members;
    const modId = members.find((m: { name: string }) => m.name === 'Neha').id;
    const memberId = members.find((m: { name: string }) => m.name === 'Mira').id;
    const ownerId = members.find((m: { name: string }) => m.name === 'Oorja').id;
    assert.equal((await call(`/circles/${id}/moderation`, { token: member.token })).status, 403);
    assert.equal((await call(`/circles/${id}/moderation/members/${modId}`, { token: owner.token, body: { action: 'moderator' } })).status, 200);
    assert.equal((await call(`/circles/${id}/moderation/members/${ownerId}`, { token: mod.token, body: { action: 'ban' } })).status, 403);
    assert.equal((await call(`/circles/${id}/moderation/members/${memberId}`, { token: mod.token, body: { action: 'moderator' } })).status, 403, 'only the owner sets roles');

    // Moderators remove anyone's posts; members only their own.
    const { data } = await post(owner.token, id);
    assert.equal((await call(`/circles/${id}/posts/${data.id}`, { token: member.token, method: 'DELETE' })).status, 404);
    assert.equal((await call(`/circles/${id}/posts/${data.id}`, { token: mod.token, method: 'DELETE' })).status, 200);

    await call(`/circles/${id}/leave`, { token: owner.token, method: 'POST' });
    assert.equal((await call(`/circles/${id}`, { token: mod.token })).data.circle.role, 'owner', 'the moderator takes over');
    await call(`/circles/${id}/leave`, { token: member.token, method: 'POST' });
    await call(`/circles/${id}/leave`, { token: mod.token, method: 'POST' });
    assert.equal((await call('/circles/join', { token: member.token, body: { code } })).status, 404, 'the last one out deletes it');
  });

  test("an owner deleting their account hands the circle on; their posts go with them and are in their export", async () => {
    const { owner, member, id } = await circle();
    await post(owner.token, id);
    const exported = (await call('/account/export', { token: owner.token })).data;
    assert.equal(exported.circles[0].name, 'IIT Hostel Women');
    assert.equal(exported.circlePosts.length, 1);
    await call('/account', { token: owner.token, method: 'DELETE', body: { password: 'password123' } });
    const view = (await call(`/circles/${id}`, { token: member.token })).data;
    assert.equal(view.circle.role, 'owner');
    assert.equal(view.posts.length, 0);
  });
});

describe('partner network', () => {
  const application = {
    name: 'Dr. Meena Rao, Counselling',
    kind: 'counsellor',
    city: 'Pune',
    languages: ['en', 'mr', 'hi'],
    description: 'Trauma-informed counselling for women, online and at my clinic in Kothrud. First session free.',
    credentials: 'RCI registration CRR/12345, M.Phil Clinical Psychology',
    fees: 'sliding',
    feeNote: 'First session free',
    online: true,
    inPerson: true,
    email: 'meena@example.com',
    phone: '+91 98765 43210',
    website: 'https://meena.example.com',
  };

  async function moderator() {
    const mod = await newUser('Mod');
    db.prepare("UPDATE users SET role = 'moderator' WHERE email = ?").run(mod.email);
    return mod;
  }

  test('nobody is listed until a moderator checks them; contact details stay private', async () => {
    const partner = await newUser('Meena');
    assert.equal((await call('/partners/mine', { token: partner.token, method: 'PUT', body: { ...application, online: false, inPerson: false } })).status, 400);
    assert.equal((await call('/partners/mine', { token: partner.token, method: 'PUT', body: { ...application, website: 'javascript:alert(1)' } })).status, 400);
    const applied = await call('/partners/mine', { token: partner.token, method: 'PUT', body: application });
    assert.equal(applied.status, 201);
    assert.equal(applied.data.partner.status, 'pending');
    const listed = () => call('/partners?city=Pune').then((r) => r.data.partners.filter((x: { name: string }) => x.name === application.name));
    assert.equal((await listed()).length, 0, 'not listed while pending');

    const mod = await moderator();
    assert.equal((await call('/moderation/partners', { token: partner.token })).status, 403);
    const queue = (await call('/moderation/partners', { token: mod.token })).data.partners;
    const item = queue.find((x: { name: string }) => x.name === application.name);
    assert.equal(item.credentials, application.credentials, 'moderators see the credentials to check');
    assert.equal((await call(`/moderation/partners/${item.id}`, { token: mod.token, body: { action: 'reject' } })).status, 400, 'a rejection needs a reason');
    assert.equal((await call(`/moderation/partners/${item.id}`, { token: mod.token, body: { action: 'approve' } })).status, 200);

    const [shown] = await listed();
    assert.ok(shown.verifiedAt);
    assert.deepEqual(shown.languages, ['en', 'mr', 'hi']);
    for (const secret of ['meena@example.com', '98765', 'CRR/12345']) assert.equal(JSON.stringify(shown).includes(secret), false, secret);
    assert.equal((await call('/partners?lang=ta&city=Pune')).data.partners.some((x: { name: string }) => x.name === application.name), false);
    assert.equal((await call('/partners?kind=lawyer')).data.partners.some((x: { name: string }) => x.name === application.name), false);

    // Editing sends it back for checking.
    await call('/partners/mine', { token: partner.token, method: 'PUT', body: { ...application, description: `${application.description} Evenings too.` } });
    assert.equal((await listed()).length, 0);
  });

  test('session requests need an account, consent and a working email service', async () => {
    const partner = await newUser('Ritu');
    const { data } = await call('/partners/mine', { token: partner.token, method: 'PUT', body: { ...application, name: 'Ritu Legal Aid', kind: 'lawyer' } });
    const mod = await moderator();
    await call(`/moderation/partners/${data.partner.id}`, { token: mod.token, body: { action: 'approve' } });

    const user = await newUser('Asha');
    const request = { contactMethod: 'phone', contactValue: '+91 91234 56789', preferredTime: 'Weekday evenings', message: 'About a POSH complaint.', consent: true };
    assert.equal((await call(`/partners/${data.partner.id}/request`, { body: request })).status, 401);
    assert.equal((await call(`/partners/${data.partner.id}/request`, { token: user.token, body: { ...request, consent: false } })).status, 400);
    assert.equal((await call(`/partners/${data.partner.id}/request`, { token: user.token, body: { ...request, contactValue: 'call me' } })).status, 400);
    // The test server has no email service, so nothing is sent or stored.
    assert.equal((await call(`/partners/${data.partner.id}/request`, { token: user.token, body: request })).status, 503);
    assert.equal((await call('/partners/requests/mine', { token: user.token })).data.requests.length, 0);

    // A hidden partner can't be reached.
    await call(`/moderation/partners/${data.partner.id}`, { token: mod.token, body: { action: 'hide', note: 'Registration could not be confirmed.' } });
    assert.equal((await call(`/partners/${data.partner.id}/request`, { token: user.token, body: request })).status, 404);
    const own = (await call('/partners/mine', { token: partner.token })).data.partner;
    assert.equal(own.status, 'hidden');
    assert.equal(own.reviewNote, 'Registration could not be confirmed.');
  });

  test("a partner's listing is in their export and goes with their account", async () => {
    const partner = await newUser('Lata');
    await call('/partners/mine', { token: partner.token, method: 'PUT', body: { ...application, name: 'Lata Self-Defence' } });
    assert.equal((await call('/account/export', { token: partner.token })).data.partnerListing.name, 'Lata Self-Defence');
    await call('/account', { token: partner.token, method: 'DELETE', body: { password: 'password123' } });
    const mod = await moderator();
    const queue = (await call('/moderation/partners', { token: mod.token })).data.partners;
    assert.equal(queue.some((x: { name: string }) => x.name === 'Lata Self-Defence'), false);
  });
});

describe('verified community reporting', () => {
  const at = { lat: 18.52, lng: 73.85 };
  const mapReport = (token: string | undefined, extra: Record<string, unknown> = {}) =>
    call('/reports', { token, body: { incidentType: 'harassment', description: `Men following women near the bus stop ${Math.random()}`, coords: at, ...extra } });
  const onMap = async (id: number, token?: string) => (await call('/reports/map', { token })).data.points.find((p: { id: number }) => p.id === id);

  test('email verification: a link proves the address, and makes domain memberships verified', async () => {
    const user = await newUser('Vani');
    assert.equal((await call('/auth/me', { token: user.token })).data.user.emailVerified, false);
    // Without a confirmed email, a domain can't be claimed and the member isn't verified.
    assert.equal((await call('/workplace/orgs', { token: user.token, body: { name: 'Vani Co', emailDomain: 'example.com' } })).status, 403);
    const hr = await newUser('Hira');
    verifyEmail(hr.email);
    const { data } = await call('/workplace/orgs', { token: hr.token, body: { name: 'Hira Co', emailDomain: 'example.com' } });
    await call('/workplace/join', { token: user.token, body: { code: data.joinCode } });
    assert.equal((await call('/workplace', { token: user.token })).data.org.verified, false);

    assert.equal((await call('/auth/verify-email', { body: { token: 'not-a-real-token-at-all' } })).status, 400);
    const token = 'a-known-test-token-123456';
    const userId = (db.prepare('SELECT id FROM users WHERE email = ?').get(user.email) as { id: number }).id;
    db.prepare('INSERT INTO email_verifications (token_hash, user_id, expires_at) VALUES (?, ?, ?)').run(
      crypto.createHash('sha256').update(token).digest('hex'),
      userId,
      new Date(Date.now() + 60_000).toISOString()
    );
    assert.equal((await call('/auth/verify-email', { body: { token } })).status, 200);
    assert.equal((await call('/auth/verify-email', { body: { token } })).status, 400, 'used once');
    assert.equal((await call('/auth/me', { token: user.token })).data.user.emailVerified, true);
    assert.equal((await call('/workplace', { token: user.token })).data.org.verified, true, 'membership upgraded on verification');
  });

  test('map points say who they came from; confirmations need a confirmed email and are one per person', async () => {
    const anon = await mapReport(undefined, { anonymous: true });
    assert.equal((await onMap(anon.data.id)).trust, 'anonymous');

    const reporter = await newUser('Rekha');
    const fromAccount = await mapReport(reporter.token);
    assert.equal((await onMap(fromAccount.data.id)).trust, 'account');
    assert.equal((await onMap(fromAccount.data.id, reporter.token)).mine, true, 'your own point is marked as yours');
    assert.equal((await onMap(fromAccount.data.id)).mine, false);
    verifyEmail(reporter.email);
    db.prepare("UPDATE users SET phone = '+919800000001' WHERE email = ?").run(reporter.email);
    const verified = await mapReport(reporter.token);
    assert.equal((await onMap(verified.data.id)).trust, 'verified');

    assert.equal((await call(`/reports/${verified.data.id}/confirm`, { token: reporter.token, method: 'POST' })).status, 400, 'not your own');
    const witness = await newUser('Wafa');
    assert.equal((await call(`/reports/${verified.data.id}/confirm`, { token: witness.token, method: 'POST' })).status, 403, 'email not confirmed');
    verifyEmail(witness.email);
    assert.equal((await call(`/reports/${verified.data.id}/confirm`, { token: witness.token, method: 'POST' })).data.confirmations, 1);
    assert.equal((await call(`/reports/${verified.data.id}/confirm`, { token: witness.token, method: 'POST' })).data.confirmations, 1, 'once each');
    const point = await onMap(verified.data.id, witness.token);
    assert.equal(point.confirmations, 1);
    assert.equal(point.confirmedByMe, true);
  });

  test('copied text, bursts and impossible distances are held for a moderator, with the reasons', async () => {
    const text = 'A man on a bike snatched a phone near the metro gate at 9 pm.';
    const first = await mapReport(undefined, { anonymous: true, description: text });
    assert.equal(first.data.held, false);
    const copy = await mapReport(undefined, { anonymous: true, description: `${text.toUpperCase()}!!` });
    assert.equal(copy.data.held, true, 'same text, different case and punctuation');
    assert.equal(await onMap(copy.data.id), undefined, 'not on the map');

    const fast = await newUser('Farah');
    await mapReport(fast.token, { coords: { lat: 28.61, lng: 77.2 } });
    const far = await mapReport(fast.token, { coords: { lat: 19.07, lng: 72.87 } });
    assert.equal(far.data.held, true, 'Delhi then Mumbai within the hour');

    const burst = await newUser('Bina');
    verifyEmail(burst.email);
    const results = [];
    for (let i = 0; i < 5; i++) results.push((await mapReport(burst.token)).data.held);
    assert.deepEqual(results, [false, false, false, false, true], 'the fifth in an hour is held');

    const mod = await newUser('Mod');
    db.prepare("UPDATE users SET role = 'moderator' WHERE email = ?").run(mod.email);
    const held = (await call('/moderation/reports?queue=held', { token: mod.token })).data.reports;
    assert.deepEqual(held.find((r: { id: number }) => r.id === copy.data.id).holdReasons, ['duplicate']);
    assert.ok(held.find((r: { id: number }) => r.id === far.data.id).holdReasons.includes('far_apart'));
    await call(`/moderation/reports/${far.data.id}`, { token: mod.token, body: { action: 'approve' } });
    assert.ok(await onMap(far.data.id), 'approved: on the map');
  });

  test('a new unverified throwaway account is held; moderators review accounts by pseudonym and can pause them from the map only', async () => {
    const res = await call('/auth/signup', { body: { name: 'Temp', email: `fake${Date.now()}@mailinator.com`, password: 'password123' } });
    const throwaway = res.token as string;
    const held = await mapReport(throwaway);
    assert.equal(held.data.held, true);

    const mod = await newUser('Mod');
    db.prepare("UPDATE users SET role = 'moderator' WHERE email = ?").run(mod.email);
    const queue = (await call('/moderation/accounts', { token: mod.token })).data.accounts;
    const entry = queue.find((a: { signals: string[]; stats: { held: number } }) => a.signals.includes('disposable_email') && a.stats.held === 1);
    assert.ok(entry);
    assert.match(entry.name, /^#[0-9A-F]{6}$/);
    assert.equal(JSON.stringify(queue).includes('mailinator'), false, 'no email shown');
    assert.equal(JSON.stringify(queue).includes('Temp'), false, 'no name shown');

    assert.equal((await call(`/moderation/accounts/${entry.id}`, { token: mod.token, body: { action: 'suspend' } })).status, 400, 'needs a reason');
    await call(`/moderation/accounts/${entry.id}`, { token: mod.token, body: { action: 'suspend', reason: 'Posting copied reports.' } });
    assert.equal((await mapReport(throwaway)).status, 403);
    assert.equal((await call(`/reports/${held.data.id}/flag`, { token: throwaway, method: 'POST' })).status, 403);
    // Everything else still works: SOS is never paused.
    assert.equal((await call('/auth/me', { token: throwaway })).data.user.mapSuspended, true);
    assert.notEqual((await call('/sos', { token: throwaway, body: { coords: at } })).status, 403);
    const suspended = (await call('/moderation/accounts?view=suspended', { token: mod.token })).data.accounts;
    assert.equal(suspended.find((a: { id: number }) => a.id === entry.id).suspendedReason, 'Posting copied reports.');
    await call(`/moderation/accounts/${entry.id}`, { token: mod.token, body: { action: 'unsuspend' } });
    assert.equal((await mapReport(throwaway)).status, 201);

    assert.equal((await call('/moderation/accounts', { token: throwaway })).status, 403, 'moderators only');
  });

  test("a suspended account's points leave the map", async () => {
    const user = await newUser('Sima');
    verifyEmail(user.email);
    const { data } = await mapReport(user.token);
    assert.ok(await onMap(data.id));
    db.prepare('UPDATE users SET suspended_at = ? WHERE email = ?').run(new Date().toISOString(), user.email);
    assert.equal(await onMap(data.id), undefined);
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
