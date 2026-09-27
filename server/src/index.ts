import './env';
import { app } from './app';
import { purgeExpiredData } from './db';
import { emailConfigured, smsConfigured, statusCallbackUrl, voiceCallsEnabled } from './messaging';

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;

purgeExpiredData();
setInterval(purgeExpiredData, 24 * 60 * 60 * 1000).unref();

app.listen(PORT, () => {
  console.log(`HerSpace server listening on http://localhost:${PORT}`);
  if (!smsConfigured()) console.warn('[SOS] Twilio is not configured: SOS alerts will NOT be delivered by SMS.');
  else if (!statusCallbackUrl()) console.warn('[SOS] PUBLIC_API_URL is not set: SMS delivery confirmations are disabled.');
  if (smsConfigured()) console.log(`[SOS] Voice calls ${voiceCallsEnabled() ? 'enabled' : 'disabled'} (SOS_VOICE_CALLS).`);
  if (!emailConfigured()) console.warn('[auth] Email is not configured: password reset links are only logged to the console in development.');
});
