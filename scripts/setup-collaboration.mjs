import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createCollaboration } from '../server/collaboration.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const directory = path.resolve(process.env.COLLAB_DATA_DIR || path.join(root, '.local'));
const service = createCollaboration(directory);
try {
  if (service.userCount()) console.log('Existing accounts preserved. See the local accounts file; no passwords are printed.');
  else {
    const users = [
      { username: 'admin', name: '学院管理员', role: 'admin' },
      { username: 'teacher1', name: '林老师', role: 'member' },
      { username: 'teacher2', name: '周老师', role: 'member' },
    ];
    const accounts = [], ids = [];
    for (const user of users) {
      const password = randomBytes(12).toString('base64url');
      ids.push(await service.addUser({ ...user, password })); accounts.push({ ...user, password });
    }
    service.setupRoom('学院工作群', ids[0], ids);
    fs.writeFileSync(path.join(directory, 'accounts.json'), JSON.stringify({ note: 'Private local login credentials. Do not publish or commit.', accounts }, null, 2), { flag: 'wx', mode: 0o600 });
    console.log(`Created 3 independent accounts and one work group. Login credentials are in ${path.join(directory, 'accounts.json')}.`);
  }
} finally { service.close(); }
