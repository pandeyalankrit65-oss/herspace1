// Checks this server's settings, and optionally the live site, before launch:
//   npm run launch-check
//   npm run launch-check -- --url https://herspace.example
// Exits with 1 if anything would stop HerSpace from keeping people safe.
import '../env';
import { configFindings, liveFindings, type Finding } from '../launchCheck';

const MARK = { ok: '  ok ', warning: ' warn', blocker: '  NO ' } as const;

async function main() {
  const urlFlag = process.argv.indexOf('--url');
  const url = urlFlag > -1 ? process.argv[urlFlag + 1] : undefined;
  const sections: Array<[string, Finding[]]> = [['Settings (server/.env)', configFindings()]];
  if (url) sections.push([`Live site (${url})`, await liveFindings(url)]);

  for (const [title, findings] of sections) {
    console.log(`\n${title}`);
    for (const f of findings) console.log(`${MARK[f.level]}  ${f.setting}: ${f.message}`);
  }
  const all = sections.flatMap(([, f]) => f);
  const blockers = all.filter((f) => f.level === 'blocker').length;
  const warnings = all.filter((f) => f.level === 'warning').length;
  console.log(`\n${blockers} to fix before launch, ${warnings} to look at.${url ? '' : ' Add --url <your site> to check the live site too.'}`);
  process.exit(blockers ? 1 : 0);
}

void main();
