import { randomBytes, randomUUID, scryptSync } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const destination = process.argv[2];
if (!destination) throw new Error('Usage: node scripts/create-admin-login.mjs OUTPUT_DIRECTORY');
mkdirSync(destination, { recursive: true, mode: 0o700 });
const username = 'rubsta-admin';
const password = randomBytes(24).toString('base64url');
const salt = randomBytes(16).toString('hex');
const hash = `scrypt:${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
writeFileSync(resolve(destination, 'admin.env'), `ADMIN_USERNAME=${username}\nADMIN_PASSWORD_HASH=${hash}\nADMIN_PASSWORD_VERSION=${randomUUID()}\n`, { flag: 'wx', mode: 0o600 });
writeFileSync(resolve(destination, 'login.txt'), `URL: https://www.rubstaopen.com/admin-login\nUsername: ${username}\nPassword: ${password}\n`, { flag: 'wx', mode: 0o600 });
console.log('Created protected admin.env and login.txt in', resolve(destination));
