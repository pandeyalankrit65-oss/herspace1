import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import { z } from 'zod';
import { csrfGuard, loadUser } from './auth';
import { emailConfigured, smsConfigured, voiceCallsEnabled } from './messaging';
import { supportReply } from './chat';
import { rateLimit } from './rateLimit';
import { parse } from './util';
import { authRouter } from './routes/auth';
import { contactInvitesRouter, contactsRouter } from './routes/contacts';
import { sosRouter, twilioRouter } from './routes/sos';
import { reportsRouter } from './routes/reports';
import { accountRouter } from './routes/account';
import { locationSharesRouter, trackRouter } from './routes/location';

export const app = express();
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:8080').split(',').map((o) => o.trim());

// TRUST_PROXY: set to the number of proxies in front of the server in production (e.g. 1)
// so rate limits see the real client IP.
app.set('trust proxy', process.env.TRUST_PROXY ? Number(process.env.TRUST_PROXY) : 'loopback');
app.disable('x-powered-by');
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});
app.use(cors({ origin: allowedOrigins, credentials: true }));
// Twilio posts form-encoded callbacks; mount before the JSON parser.
app.use('/api/twilio', twilioRouter);
app.use(express.json({ limit: '100kb' }));
app.use(csrfGuard);
app.use(loadUser);

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'herspace-server',
    smsConfigured: smsConfigured(),
    voiceCalls: voiceCallsEnabled(),
    emailConfigured: emailConfigured(),
  });
});

app.use('/api/auth', authRouter);
app.use('/api/account', accountRouter);
app.use('/api/contacts', contactsRouter);
app.use('/api/contact-invites', contactInvitesRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/sos', sosRouter);
app.use('/api/location-shares', locationSharesRouter);
app.use('/api/track', trackRouter);

const chatLimiter = rateLimit({ windowMs: 60 * 1000, max: 15 });
const chatSchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().trim().min(1).max(4000) }))
    .min(1)
    .max(30),
});

app.post('/api/chat', chatLimiter, async (req, res) => {
  const body = parse(chatSchema, req, res);
  if (!body) return;
  const reply = await supportReply(body.messages);
  res.json({ message: { role: 'assistant', content: reply.content }, mode: reply.mode });
});

app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error & { type?: string }, _req: Request, res: Response, _next: NextFunction) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON body' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Request too large' });
  console.error(err);
  res.status(500).json({ error: 'Something went wrong' });
});
