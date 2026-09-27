import crypto from 'crypto';
import fs from 'fs';

// Outbound SMS and voice calls go through Twilio's REST API; email goes through Resend.
// Everything is optional: without credentials each function reports "not_configured"
// so callers can tell the user honestly that nothing was sent.

export type SendResult = { status: 'sent' | 'failed' | 'not_configured'; sid?: string; error?: string };

// Test mode: with MESSAGE_OUTBOX set, messages are appended to that file (one JSON object per
// line) instead of being sent, and reported as sent. Used by the end-to-end tests.
const outboxPath = process.env.MESSAGE_OUTBOX;
if (outboxPath && process.env.NODE_ENV === 'production') {
  throw new Error('MESSAGE_OUTBOX must not be set in production: it would swallow real SOS messages.');
}
let outboxCount = 0;
function toOutbox(entry: Record<string, string>): SendResult {
  const sid = `outbox-${++outboxCount}`;
  fs.appendFileSync(outboxPath!, `${JSON.stringify({ ...entry, sid, at: new Date().toISOString() })}\n`);
  return { status: 'sent', sid };
}

const twilio = () => ({
  sid: process.env.TWILIO_ACCOUNT_SID,
  token: process.env.TWILIO_AUTH_TOKEN,
  from: process.env.TWILIO_FROM_NUMBER,
});

export const smsConfigured = () => {
  const t = twilio();
  return Boolean(outboxPath || (t.sid && t.token && t.from));
};

export const voiceCallsEnabled = () => smsConfigured() && process.env.SOS_VOICE_CALLS === 'true';

// Public base URL of this API (e.g. https://api.example.com). Needed for delivery-status callbacks.
const publicApiUrl = () => process.env.PUBLIC_API_URL?.replace(/\/$/, '');
export const statusCallbackUrl = () => (publicApiUrl() ? `${publicApiUrl()}/api/twilio/status` : undefined);

async function twilioPost(resource: 'Messages' | 'Calls', params: Record<string, string>): Promise<SendResult> {
  if (!smsConfigured()) return { status: 'not_configured' };
  if (outboxPath) return toOutbox({ channel: resource === 'Messages' ? 'sms' : 'call', to: params.To, body: params.Body ?? params.Twiml });
  const t = twilio();
  const callback = statusCallbackUrl();
  if (callback) params.StatusCallback = callback;
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${t.sid}/${resource}.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${t.sid}:${t.token}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ ...params, From: t.from! }),
      signal: AbortSignal.timeout(15000),
    });
    const data = (await res.json().catch(() => ({}))) as { sid?: string; message?: string };
    if (!res.ok) return { status: 'failed', error: data.message || `Twilio returned ${res.status}` };
    return { status: 'sent', sid: data.sid };
  } catch (err) {
    return { status: 'failed', error: err instanceof Error ? err.message : 'Network error' };
  }
}

export const sendSms = (to: string, body: string) => twilioPost('Messages', { To: to, Body: body });

const escapeXml = (s: string) =>
  s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!);

// Rings the contact and reads the message aloud twice. A ringing phone is much harder
// to miss than an SMS, especially at night.
export const placeCall = (to: string, spoken: string) =>
  twilioPost('Calls', {
    To: to,
    Twiml: `<Response><Say>${escapeXml(spoken)}</Say><Pause length="1"/><Say>${escapeXml(spoken)}</Say></Response>`,
  });

// https://www.twilio.com/docs/usage/security#validating-requests
export function validTwilioSignature(signature: string | undefined, url: string, params: Record<string, string>) {
  const token = twilio().token;
  if (!token || !signature) return false;
  const data = url + Object.keys(params).sort().map((k) => k + params[k]).join('');
  const expected = crypto.createHmac('sha1', token).update(data).digest('base64');
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export const emailConfigured = () => Boolean(outboxPath || (process.env.RESEND_API_KEY && process.env.EMAIL_FROM));

export async function sendEmail(to: string, subject: string, text: string): Promise<SendResult> {
  if (!emailConfigured()) return { status: 'not_configured' };
  if (outboxPath) return toOutbox({ channel: 'email', to, subject, body: text });
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, to, subject, text }),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return { status: 'failed', error: `Resend returned ${res.status}` };
    return { status: 'sent' };
  } catch (err) {
    return { status: 'failed', error: err instanceof Error ? err.message : 'Network error' };
  }
}
