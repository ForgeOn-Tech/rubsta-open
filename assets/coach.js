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
