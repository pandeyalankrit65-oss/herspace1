import { emailConfigured, smsConfigured } from './messaging';

// What a real launch needs from server/.env. "blocker": people would be hurt or locked out
// (an SOS that never sends, nobody able to sign up). "warning": works, but worse or riskier.
// Run `npm run launch-check` in server/; the server also logs these when it starts in production.

export type Finding = { level: 'blocker' | 'warning' | 'ok'; setting: string; message: string };

const isHttps = (url: string | undefined) => Boolean(url && /^https:\/\//.test(url) && !/localhost|127\.0\.0\.1/.test(url));

export function configFindings(env: NodeJS.ProcessEnv = process.env): Finding[] {
  const f: Finding[] = [];
  const add = (ok: boolean, setting: string, problem: string, level: 'blocker' | 'warning' = 'blocker', good = 'set') =>
    f.push(ok ? { level: 'ok', setting, message: good } : { level, setting, message: problem });

  add(env.NODE_ENV === 'production', 'NODE_ENV', 'must be "production": it turns on secure cookies and turns off development shortcuts.', 'blocker', 'production');
  add(smsConfigured(), 'TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER', "missing: SOS alerts won't be sent by SMS, and contacts can't be invited.");
  add(emailConfigured(), 'RESEND_API_KEY, EMAIL_FROM', 'missing: nobody can sign up, and nobody can reset a password.');
  add(isHttps(env.APP_URL), 'APP_URL', 'must be the HTTPS address of the app: it goes into every link sent by SMS and email (live location, sign-up, password reset).', 'blocker', env.APP_URL);
  add(env.COOKIE_SECURE !== 'false', 'COOKIE_SECURE', 'is "false": session cookies would be sent over plain HTTP.', 'blocker', 'secure cookies');
  add(!env.MESSAGE_OUTBOX, 'MESSAGE_OUTBOX', 'is set: messages would go to a file instead of being sent. It is for tests only.', 'blocker', 'not set');
  add(isHttps(env.PUBLIC_API_URL), 'PUBLIC_API_URL', 'not an HTTPS address: SOS messages will show "sent" but never "delivered".', 'warning', env.PUBLIC_API_URL);
  add(Boolean(env.TRUST_PROXY), 'TRUST_PROXY', 'not set: behind a proxy, rate limits on SOS and logins would count everyone as one person. Set it to the number of proxies (usually 1).', 'warning', env.TRUST_PROXY);
  add(Boolean(env.ANTHROPIC_API_KEY), 'ANTHROPIC_API_KEY', 'not set: the support chat, the fake caller and report drafting use scripted replies.', 'warning');
  add(Boolean(env.HERSPACE_SECRET), 'HERSPACE_SECRET', 'not set: one is generated and kept in the database, which is fine as long as the database is backed up.', 'warning');
  add(!/localhost/.test(env.CORS_ORIGIN ?? 'http://localhost:8080'), 'CORS_ORIGIN', "allows requests from localhost. Set it to the app's address.", 'warning', env.CORS_ORIGIN);
  add(
    Boolean(env.NOMINATIM_URL && env.OVERPASS_URL),
    'NOMINATIM_URL, OVERPASS_URL',
    "use the public OpenStreetMap services, whose usage policy doesn't allow real app traffic. Use your own instance or a provider, or set them to off.",
    'warning'
  );
  add(Boolean(env.ADMIN_EMAILS) === false, 'ADMIN_EMAILS', 'is set but ignored in production. Grant moderators with npm run moderator -- add <email>.', 'warning', 'not set');
  return f;
}

// Checks the live site: what the web host must add (the page can't), and that the API answers.
export async function liveFindings(siteUrl: string): Promise<Finding[]> {
  const f: Finding[] = [];
  const base = siteUrl.replace(/\/$/, '');
  try {
    const res = await fetch(base, { redirect: 'follow' });
    const html = await res.text();
    const h = (name: string) => res.headers.get(name) ?? '';
    f.push(
      res.url.startsWith('https://')
        ? { level: 'ok', setting: 'HTTPS', message: res.url }
        : { level: 'blocker', setting: 'HTTPS', message: `the site is served from ${res.url}. Location and the microphone only work over HTTPS.` }
    );
    f.push(
      /max-age=\d{7,}/.test(h('strict-transport-security'))
        ? { level: 'ok', setting: 'Strict-Transport-Security', message: h('strict-transport-security') }
        : { level: 'warning', setting: 'Strict-Transport-Security', message: 'missing or under ~4 months: the web host should send it (see deploy/Caddyfile).' }
    );
    f.push(
      /frame-ancestors\s+'none'/.test(h('content-security-policy')) || /deny/i.test(h('x-frame-options'))
        ? { level: 'ok', setting: 'Framing', message: 'refused' }
        : { level: 'warning', setting: 'Framing', message: "other sites can embed HerSpace in a frame. The web host should send frame-ancestors 'none' or X-Frame-Options: DENY." }
    );
    f.push(
      html.includes('http-equiv="Content-Security-Policy"')
        ? { level: 'ok', setting: 'Content-Security-Policy', message: 'in the page' }
        : { level: 'blocker', setting: 'Content-Security-Policy', message: 'not in the page: this is not a production build of the web app (npm run build).' }
    );
  } catch (err) {
    f.push({ level: 'blocker', setting: 'Site', message: `couldn't open ${base}: ${(err as Error).message}` });
  }
  try {
    const res = await fetch(`${base}/api/health`);
    f.push(res.ok ? { level: 'ok', setting: 'API', message: `${base}/api/health answers` } : { level: 'blocker', setting: 'API', message: `${base}/api/health answered ${res.status}.` });
  } catch (err) {
    f.push({ level: 'blocker', setting: 'API', message: `couldn't reach ${base}/api/health: ${(err as Error).message}` });
  }
  return f;
}
