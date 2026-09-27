import crypto from 'crypto';
import { Request, Response } from 'express';
import { z } from 'zod';
import { db } from './db';

export const now = () => new Date().toISOString();

export const sha256 = (value: string) => crypto.createHash('sha256').update(value).digest('hex');

export const randomToken = () => crypto.randomBytes(32).toString('base64url');

// Secret for keyed hashes (e.g. anonymising IP addresses). Set HERSPACE_SECRET, or one is
// generated on first start and kept in the database.
let secret: string | undefined;
export function serverSecret(): string {
  if (secret) return secret;
  if (process.env.HERSPACE_SECRET) return (secret = process.env.HERSPACE_SECRET);
  const row = db.prepare("SELECT value FROM settings WHERE key = 'secret'").get() as { value: string } | undefined;
  if (row) return (secret = row.value);
  secret = crypto.randomBytes(32).toString('hex');
  db.prepare("INSERT INTO settings (key, value) VALUES ('secret', ?)").run(secret);
  return secret;
}

// Unlike a plain hash, this can't be reversed by hashing every possible IP address.
export const keyedHash = (value: string) => crypto.createHmac('sha256', serverSecret()).update(value).digest('hex');

// Frontend base URL, used in links sent by SMS and email.
export const appUrl = () => (process.env.APP_URL || 'http://localhost:8080').replace(/\/$/, '');

// Parses the body with a zod schema, replying 400 with the first issue on failure.
export function parse<T extends z.ZodTypeAny>(schema: T, req: Request, res: Response): z.infer<T> | undefined {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const issue = result.error.issues[0];
    res.status(400).json({ error: `${issue.path.join('.') || 'body'}: ${issue.message}` });
    return undefined;
  }
  return result.data;
}

// Accepts "+91 98765-43210" style input and normalises to E.164 (what SMS providers need).
export const phoneSchema = z
  .string()
  .transform((v) => v.replace(/[\s\-().]/g, ''))
  .refine((v) => /^\+[1-9]\d{7,14}$/.test(v), 'Use international format with country code, e.g. +91 98765 43210');

export const passwordSchema = z.string().min(8, 'Password must be at least 8 characters').max(200);

export const coordsSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracy: z.number().nonnegative().optional(),
});
