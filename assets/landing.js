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
document.querySelectorAll('a[href^="#"]:not(.skip)').forEach(link => {
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
const revealTargets = [...document.querySelectorAll('.section-heading, .digital-features article, .sponsor-lead, .sponsor-grid > div, .gallery-item')];
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

// Coach gallery: manual navigation keeps photos still while reading the profile.
const coachCarousel = document.querySelector('.coach-carousel');
if (coachCarousel) {
  const photos = [...coachCarousel.querySelectorAll('.coach-slide')];
  const dots = [...coachCarousel.querySelectorAll('[data-coach-slide]')];
  let currentPhoto = 0;
  function showCoachPhoto(index) {
    currentPhoto = (index + photos.length) % photos.length;
    photos.forEach((photo, i) => { photo.hidden = i !== currentPhoto; });
    dots.forEach((dot, i) => dot.setAttribute('aria-current', String(i === currentPhoto)));
    document.querySelector('#coach-count').textContent = `${String(currentPhoto + 1).padStart(2, '0')} / 04`;
  }
  dots.forEach((dot, index) => dot.addEventListener('click', () => showCoachPhoto(index)));
  document.querySelector('#coach-prev').addEventListener('click', () => showCoachPhoto(currentPhoto - 1));
  document.querySelector('#coach-next').addEventListener('click', () => showCoachPhoto(currentPhoto + 1));
  coachCarousel.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      showCoachPhoto(currentPhoto + (event.key === 'ArrowRight' ? 1 : -1));
    }
  });
  let touchStart = null;
  coachCarousel.addEventListener('touchstart', event => {
    touchStart = {x: event.touches[0].clientX, y: event.touches[0].clientY};
  }, {passive: true});
  coachCarousel.addEventListener('touchend', event => {
    if (!touchStart) return;
    const dx = event.changedTouches[0].clientX - touchStart.x;
    const dy = event.changedTouches[0].clientY - touchStart.y;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) showCoachPhoto(currentPhoto + (dx < 0 ? 1 : -1));
    touchStart = null;
  }, {passive: true});
}
