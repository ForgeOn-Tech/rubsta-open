/* Published photos only. Use text nodes so captions cannot insert HTML. */
(() => {
  const grid = document.getElementById('tournament-gallery-photos');
  const status = document.getElementById('tournament-gallery-status');
  if (!grid || !status) return;
  const labels = { winner: 'Winner', 'runner-up': 'Runner-up', standout: 'Standout player', gallery: 'Gallery' };
  function node(tag, className, text) {
    const element = document.createElement(tag);
    element.className = className;
    if (text) element.textContent = text;
    return element;
  }
  async function refresh() {
    try {
      const response = await fetch('/api/gallery', { cache: 'no-store' });
      if (!response.ok) throw new Error('Gallery unavailable');
      const { photos } = await response.json();
      const fragment = document.createDocumentFragment();
      for (const photo of photos) {
        const card = node('article', 'tournament-photo');
        const imageLink = node('a', 'tournament-photo-image');
        imageLink.href = photo.imageUrl;
        imageLink.target = '_blank';
        imageLink.rel = 'noreferrer';
        imageLink.setAttribute('aria-label', `View photo: ${photo.title}`);
        const image = node('img', '');
        image.src = photo.imageUrl;
        image.alt = photo.title;
        image.loading = 'lazy';
        imageLink.append(image);
        card.append(imageLink);
        const copy = node('div', 'tournament-photo-copy');
        copy.append(node('p', 'tournament-photo-label', [labels[photo.kind], photo.event].filter(Boolean).join(' · ')));
        copy.append(node('h3', '', photo.title));
        copy.append(node('p', 'tournament-photo-players', photo.players.join(' & ')));
        if (photo.caption) copy.append(node('p', 'tournament-photo-caption', photo.caption));
        card.append(copy);
        fragment.append(card);
      }
      grid.replaceChildren(fragment);
      status.hidden = photos.length > 0;
      status.textContent = 'Tournament photos are on their way.';
    } catch {
      if (!grid.children.length) status.textContent = 'Photos could not load. Open the gallery to try again.';
    }
  }
  void refresh();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) void refresh(); });
})();
