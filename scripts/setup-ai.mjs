import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const destination = new URL('../.env', import.meta.url);
if (existsSync(destination)) {
  console.log('Existing .env preserved. Edit AI_API_KEY locally; secrets are not displayed.');
} else {
  const template = readFileSync(new URL('../.env.example', import.meta.url), 'utf8');
  writeFileSync(destination, template.replace('AI_ACCESS_TOKEN=', `AI_ACCESS_TOKEN=${randomBytes(24).toString('hex')}`), { flag: 'wx', mode: 0o600 });
  console.log(`Created ${fileURLToPath(destination)} with a random service access code. Fill AI_API_KEY locally, then run npm run start.`);
}
