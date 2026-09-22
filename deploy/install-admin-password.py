"""Install generated password hashes and an already-built release; never print secrets."""
import os
import re
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

deployment = Path('/home/devansh/rubsta-release/deploy')
credential_file = Path(sys.argv[1])
release = sys.argv[2]
if not re.fullmatch(r'[a-f0-9]{40}', release):
    raise SystemExit('Expected a full release SHA')
updates = dict(line.split('=', 1) for line in credential_file.read_text().splitlines() if '=' in line)
if set(updates) != {'ADMIN_USERNAME', 'ADMIN_PASSWORD_HASH', 'ADMIN_PASSWORD_VERSION'}:
    raise SystemExit('Unexpected credential fields')
if not re.fullmatch(r'scrypt:[a-f0-9]{32}:[a-f0-9]{128}', updates['ADMIN_PASSWORD_HASH']):
    raise SystemExit('Invalid password hash')
if not re.fullmatch(r'[a-zA-Z0-9_-]{3,100}', updates['ADMIN_USERNAME']):
    raise SystemExit('Invalid username')
if not re.fullmatch(r'[a-f0-9-]{36}', updates['ADMIN_PASSWORD_VERSION']):
    raise SystemExit('Invalid session version')

stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
def replace_values(path, values):
    text = path.read_text()
    backup = path.with_name(path.name + '.before-admin-password-' + stamp)
    shutil.copy2(path, backup)
    os.chmod(backup, 0o600)
    lines = text.splitlines()
    for key, value in values.items():
        lines = [line for line in lines if not line.startswith(key + '=')]
        lines.append(key + '=' + value)
    temporary = path.with_name(path.name + '.admin-password-new')
    temporary.write_text('\n'.join(lines) + '\n')
    os.chmod(temporary, 0o600)
    os.replace(temporary, path)
    print('Backed up', path.name, 'to', backup.name)

app_file = deployment / '.env.app'
current = dict(line.split('=', 1) for line in app_file.read_text().splitlines() if '=' in line and not line.startswith('#'))
admins = [email.strip() for email in current.get('ADMIN_EMAILS', '').strip("'\"").split(',') if email.strip()]
if 'admin-password@rubstaopen.invalid' not in admins:
    admins.append('admin-password@rubstaopen.invalid')
updates['ADMIN_EMAILS'] = ','.join(admins)
replace_values(app_file, updates)
replace_values(deployment / '.env', {'RUBSTA_RELEASE': release})
print('Installed admin hash and release configuration. Existing Google admins retained.')
