const phases = {
  before: { time: 'T−7 / THE BUILD-UP', title: 'The first rally starts before the first serve.', description: 'Introduce the players, share their stories and give your community a reason to follow along.', items: ['Player announcements & profiles', 'Tournament stories & countdowns', 'Entries, draws & schedules'] },
  during: { time: 'MATCH DAY / IN THE MOMENT', title: 'Every court. Every point. Everyone involved.', description: 'Keep players informed and fans close to the action, from the morning update to the final match of the day.', items: ['Morning updates & order of play', 'Court-side scores & venue boards', 'End-of-day highlights & stories'] },
  after: { time: 'POST TOURNAMENT / THE NEXT CHAPTER', title: 'The final score is only the beginning.', description: 'Celebrate the champions and give players, coaches and fans a record of the moments that mattered.', items: ['Results, champions & match statistics', 'Player interviews & tournament recap', 'Player records & participation certificates'] }
};
const tabs = [...document.querySelectorAll('[data-phase]')];
function selectPhase(tab) {
  const phase = phases[tab.dataset.phase];
  tabs.forEach(item => { item.setAttribute('aria-selected', String(item === tab)); item.tabIndex = item === tab ? 0 : -1; });
  document.querySelector('#phase-panel').setAttribute('aria-labelledby', tab.id);
  document.querySelector('#phase-time').textContent = phase.time;
  document.querySelector('#phase-title').textContent = phase.title;
  document.querySelector('#phase-description').textContent = phase.description;
  document.querySelector('#phase-list').replaceChildren(...phase.items.map(text => { const li = document.createElement('li'); li.textContent = text; return li; }));
}
tabs.forEach((tab, index) => {
  tab.addEventListener('click', () => selectPhase(tab));
  tab.addEventListener('keydown', event => {
    let next;
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = tabs.length - 1;
    if (next !== undefined) { event.preventDefault(); tabs[next].focus(); selectPhase(tabs[next]); }
  });
});
const dialog = document.querySelector('#preview');
const frame = document.querySelector('#preview-frame');
const screens = {
  'Main.dc.html': ['Tournament draw', 1440, 900],
  'Registration.dc.html': ['Player registration', 390, 844],
  'Scoring.dc.html': ['Match scoring', 390, 844],
  'PlayerCard.dc.html': ['Player card', 390, 844],
  'LiveBoard.dc.html': ['Venue scoreboard', 1280, 720],
  'ChallengeKit.dc.html': ['Challenge Kit', 390, 844],
  'FanZone.dc.html': ['Fan Zone', 390, 844]
};
// Resolve from this script's own URL so previews load from any page folder.
const screensBase = new URL('../design/screens/', document.currentScript.src);
let requestId = 0;
document.querySelectorAll('[data-preview]').forEach(link => link.addEventListener('click', async event => {
  event.preventDefault();
  const id = ++requestId;
  const file = link.dataset.preview;
  const [title, width, height] = screens[file];
  document.querySelector('#preview-title').textContent = title;
  frame.width = width; frame.height = height; frame.style.margin = '0 auto';
  frame.srcdoc = '<p style="font-family:system-ui;padding:24px">Loading preview…</p>';
  dialog.showModal();
  try {
    const response = await fetch(new URL(file, screensBase));
    if (!response.ok) throw new Error('Preview unavailable');
    const html = await response.text();
    if (id !== requestId) return;
    // Artboards are static designs; omit their unavailable design-tool runtime.
    frame.srcdoc = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/#2f698e/gi, '#285b43').replace(/#1c587c/gi, '#204b36');
  } catch {
    if (id === requestId) frame.srcdoc = '<p style="font-family:system-ui;padding:24px">Preview could not load. Serve this project with python3 -m http.server 3000, then open localhost:3000.</p>';
  }
}));
document.querySelector('#close-preview').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', event => { if (event.target === dialog) { const bounds = dialog.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close(); } });

// Manual carousel: no automatic movement while visitors read the event details.
const slides = [...document.querySelectorAll('.hero-slide')];
const slideButtons = [...document.querySelectorAll('[data-slide]')];
let currentSlide = 0;
function showSlide(index) {
  currentSlide = (index + slides.length) % slides.length;
  slides.forEach((slide, i) => { slide.hidden = i !== currentSlide; });
  slideButtons.forEach((button, i) => {
    if (i === currentSlide) button.setAttribute('aria-current', 'true');
    else button.removeAttribute('aria-current');
  });
  document.querySelector('#slide-status').textContent = `${String(currentSlide + 1).padStart(2, '0')} / ${String(slides.length).padStart(2, '0')}`;
}
slideButtons.forEach(button => button.addEventListener('click', () => showSlide(Number(button.dataset.slide))));
document.querySelector('#previous-slide').addEventListener('click', () => showSlide(currentSlide - 1));
document.querySelector('#next-slide').addEventListener('click', () => showSlide(currentSlide + 1));
document.querySelector('.hero-slider').addEventListener('keydown', event => {
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault(); showSlide(currentSlide + (event.key === 'ArrowRight' ? 1 : -1));
  }
});

// A brief court-side entrance; CSS also dismisses it if loading is interrupted.
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const loader = document.querySelector('#court-loader');
if (!reduceMotion.matches) {
  loader.classList.add('is-loading');
  window.setTimeout(() => loader.remove(), 1650);
} else loader.remove();

// Move between page chapters with a tennis-court wipe. Normal links still work
// without JavaScript, and reduced-motion users get an immediate section change.
const transition = document.querySelector('#court-transition');
let navigating = false;
document.querySelectorAll('a[href^="#"]:not([data-preview]):not(.skip)').forEach(link => {
  link.addEventListener('click', event => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const hash = link.getAttribute('href');
    const target = document.querySelector(hash === '#' ? '#main' : hash);
    if (!target) return;
    event.preventDefault();
    if (navigating) return;
    const move = () => {
      target.scrollIntoView({behavior:'instant', block:'start'});
      history.replaceState(null, '', hash === '#' ? '#main' : hash);
      if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
      target.focus({preventScroll:true});
      if (!reduceMotion.matches) {
        target.classList.add('section-arrived');
        window.setTimeout(() => target.classList.remove('section-arrived'), 700);
      }
    };
    if (reduceMotion.matches) { move(); return; }
    navigating = true;
    transition.classList.add('is-moving');
    window.setTimeout(move, 350);
    window.setTimeout(() => { transition.classList.remove('is-moving'); navigating = false; }, 820);
  });
});
const heroCopy = document.querySelector('.hero-copy');
function updateScrollScene() {
  if (reduceMotion.matches) heroCopy.style.removeProperty('--hero-drift');
  else heroCopy.style.setProperty('--hero-drift', `${Math.min(window.scrollY * .05, 35)}px`);
}
const progress = document.querySelector('#reading-progress');
let progressQueued = false;
function updateProgress() {
  const distance = document.documentElement.scrollHeight - window.innerHeight;
  progress.style.width = `${distance > 0 ? Math.min(100, Math.max(0, window.scrollY / distance * 100)) : 0}%`;
  updateScrollScene();
  progressQueued = false;
}
window.addEventListener('scroll', () => {
  if (!progressQueued) { progressQueued = true; requestAnimationFrame(updateProgress); }
}, {passive:true});
window.addEventListener('resize', updateProgress);
updateProgress();

// Reveal groups once; nothing is hidden when JavaScript or motion is disabled.
const revealTargets = [...document.querySelectorAll('.section-heading, .products article, .story-grid figure, .sponsor-lead, .sponsor-grid > div, .tech-showcase, .ai-offerings article, .tech-catalogue article, .gallery-item, .closing')];
let revealObserver;
function configureReveals() {
  revealObserver?.disconnect();
  revealTargets.forEach(element => element.classList.remove('reveal-pending'));
  if (reduceMotion.matches || !('IntersectionObserver' in window)) { updateProgress(); return; }
  revealObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.remove('reveal-pending');
        revealObserver.unobserve(entry.target);
      }
    });
  }, {threshold: .08});
  revealTargets.forEach((element, index) => {
    element.classList.add('scroll-reveal');
    element.style.setProperty('--reveal-delay', `${index % 3 * 45}ms`);
    if (element.getBoundingClientRect().top > window.innerHeight) {
      element.classList.add('reveal-pending');
      revealObserver.observe(element);
    }
  });
  updateProgress();
}
reduceMotion.addEventListener('change', configureReveals);
configureReveals();

const galleryItems = [...document.querySelectorAll('[data-gallery]')];
const galleryDialog = document.querySelector('#gallery-dialog');
let galleryIndex = 0;
function showGalleryImage(index) {
  galleryIndex = (index + galleryItems.length) % galleryItems.length;
  const item = galleryItems[galleryIndex];
  const source = item.querySelector('img');
  const image = document.querySelector('#gallery-image');
  image.src = source.src; image.alt = source.alt;
  document.querySelector('#gallery-dialog-title').textContent = item.querySelector('strong').textContent;
  document.querySelector('#gallery-dialog-note').textContent = item.querySelector('small').textContent;
  document.querySelector('#gallery-count').textContent = `${galleryIndex + 1} / ${galleryItems.length}`;
}
galleryItems.forEach((item, index) => item.addEventListener('click', () => { showGalleryImage(index); galleryDialog.showModal(); }));
document.querySelector('#close-gallery').addEventListener('click', () => galleryDialog.close());
document.querySelector('#gallery-prev').addEventListener('click', () => showGalleryImage(galleryIndex - 1));
document.querySelector('#gallery-next').addEventListener('click', () => showGalleryImage(galleryIndex + 1));
galleryDialog.addEventListener('keydown', event => {
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault(); showGalleryImage(galleryIndex + (event.key === 'ArrowRight' ? 1 : -1));
  }
});
