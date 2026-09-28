// Grants or removes the moderator role, run by whoever operates the server:
//   npm run moderator -- add someone@example.com
//   npm run moderator -- remove someone@example.com
//   npm run moderator -- list
// The account must already exist (the person signs up first).
import { db } from '../db';

const [command, rawEmail] = process.argv.slice(2);
const email = rawEmail?.trim().toLowerCase();

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

if (command === 'list') {
  const rows = db.prepare("SELECT email FROM users WHERE role = 'moderator' ORDER BY email").all() as Array<{ email: string }>;
  console.log(rows.length ? rows.map((r) => r.email).join('\n') : 'No moderators.');
} else if (command === 'add' || command === 'remove') {
  if (!email) fail(`Usage: npm run moderator -- ${command} <email>`);
  const result = db.prepare('UPDATE users SET role = ? WHERE lower(email) = ?').run(command === 'add' ? 'moderator' : 'user', email);
  if (result.changes === 0) fail(`No account with the email ${email}. They need to sign up first.`);
  console.log(command === 'add' ? `${email} is now a moderator.` : `${email} is no longer a moderator.`);
} else {
  fail('Usage: npm run moderator -- add|remove <email>, or npm run moderator -- list');
}
