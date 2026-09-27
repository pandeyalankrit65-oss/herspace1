// Imported first by every test file: isolated in-memory database, no real credentials.
process.env.HERSPACE_SKIP_ENV_FILE = '1';
process.env.DATABASE_PATH = ':memory:';
process.env.NODE_ENV = 'test';
process.env.DISABLE_IP_RATE_LIMIT = '1';
// No calls to public OpenStreetMap services from tests.
process.env.NOMINATIM_URL = 'off';
process.env.OVERPASS_URL = 'off';
for (const key of ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM_NUMBER', 'RESEND_API_KEY', 'EMAIL_FROM', 'PUBLIC_API_URL']) {
  delete process.env[key];
}
