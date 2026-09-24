"""Build only the public Rubsta Open assets; no source or Git metadata."""
from pathlib import Path
import shutil
root = Path(__file__).resolve().parents[1]
out = root / 'dist'
if out.exists():
    shutil.rmtree(out)
out.mkdir()
shutil.copy2(root / 'index.html', out / 'index.html')
shutil.copytree(root / 'preview', out / 'preview')
shutil.copytree(root / 'waitlist', out / 'waitlist')
shutil.copytree(root / 'sponsor-a-player', out / 'sponsor-a-player')
shutil.copytree(root / 'assets', out / 'assets', ignore=shutil.ignore_patterns('club-court.png'))
shutil.copytree(root / 'design/screens', out / 'design/screens')

for page in ('terms', 'privacy', 'refunds', 'contact', 'shipping'):
    if (root / page / 'index.html').exists():
        shutil.copytree(root / page, out / page)
