import fs from 'fs';
import path from 'path';

// Load server/.env if present (must be imported before anything that reads process.env).
// Tests set HERSPACE_SKIP_ENV_FILE so real credentials can never be used by accident.
const envFile = path.resolve(__dirname, '..', '.env');
if (process.env.HERSPACE_SKIP_ENV_FILE !== '1' && fs.existsSync(envFile)) process.loadEnvFile(envFile);
