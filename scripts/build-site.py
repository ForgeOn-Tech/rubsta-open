"""Build only the public Rubsta Open assets; no source or Git metadata."""
from pathlib import Path
import re
import shutil

PAGES = (
    'index.html',
    'terms.html',
    'privacy.html',
    'refunds.html',
    'contact.html',
    'shipping.html',
)
PLACEHOLDER = re.compile(r'\{\{[A-Z_]+\}\}')

root = Path(__file__).resolve().parents[1]
out = root / 'dist'
if out.exists():
    shutil.rmtree(out)
out.mkdir()
for page in PAGES:
    shutil.copy2(root / page, out / page)
# club-court.png is a 2.9 MB source file; the site loads the JPEG instead.
shutil.copytree(root / 'assets', out / 'assets', ignore=shutil.ignore_patterns('club-court.png'))
shutil.copytree(root / 'design/screens', out / 'design/screens')
shutil.copytree(root / 'sponsor-a-player', out / 'sponsor-a-player')

unresolved = {
    page: sorted(set(PLACEHOLDER.findall((out / page).read_text(encoding='utf-8'))))
    for page in PAGES
}
unresolved = {page: tokens for page, tokens in unresolved.items() if tokens}
if unresolved:
    raise SystemExit(
        'Refusing to publish unresolved placeholders:\n'
        + '\n'.join(f'  {page}: {", ".join(tokens)}' for page, tokens in unresolved.items())
    )
