import './env';
import { app } from './app';
import { db, purgeExpiredData } from './db';
import { emailConfigured, smsConfigured, statusCallbackUrl, voiceCallsEnabled } from './messaging';
import { processOverdueCheckIns } from './routes/checkins';
import { processStaleRides } from './routes/location';
import { processMissedDailyCheckIns } from './routes/daily';
import { configFindings } from './launchCheck';

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;

purgeExpiredData();
setInterval(purgeExpiredData, 24 * 60 * 60 * 1000).unref();

// Safety timers are enforced here, on the server, so they work even if the phone is off.
const CHECK_IN_POLL_MS = Number(process.env.CHECK_IN_POLL_MS || 20_000);
let checking = false;
setInterval(async () => {
  if (checking) return;
  checking = true;
  try {
    await processOverdueCheckIns();
    await processStaleRides();
    await processMissedDailyCheckIns();
  } catch (err) {
    console.error('[check-in] Scheduler error:', err);
  } finally {
    checking = false;
  }
}, CHECK_IN_POLL_MS).unref();

const server = app.listen(PORT, () => {
  console.log(`HerSpace server listening on http://localhost:${PORT}`);
  if (!smsConfigured()) console.warn('[SOS] Twilio is not configured: SOS alerts will NOT be delivered by SMS.');
  else if (!statusCallbackUrl()) console.warn('[SOS] PUBLIC_API_URL is not set: SMS delivery confirmations are disabled.');
  if (smsConfigured()) console.log(`[SOS] Voice calls ${voiceCallsEnabled() ? 'enabled' : 'disabled'} (SOS_VOICE_CALLS).`);
  if (!emailConfigured()) console.warn('[auth] Email is not configured: sign-up and password reset links are only logged to the console in development.');
  // In production, say loudly what would stop HerSpace from working (npm run launch-check lists everything).
  if (process.env.NODE_ENV === 'production') {
    for (const f of configFindings()) if (f.level === 'blocker') console.error(`[launch] ${f.setting}: ${f.message}`);
  }
});

// Finish in-flight requests (an SOS may be mid-send) and close the database cleanly.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    console.log(`${signal} received, shutting down...`);
    server.close(() => {
      db.close();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  });
}
