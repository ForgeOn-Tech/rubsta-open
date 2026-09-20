// End-of-September offer, inclusive of the whole final minute in IST.
// Display only: the server must independently determine checkout eligibility.
(() => {
  const expiresAt = Date.parse('2026-10-01T00:00:00+05:30');
  function updateOffer() {
    if (Date.now() < expiresAt) return;
    document.querySelectorAll('[data-early-bird]').forEach(element => {
      element.textContent = 'TENNIS. CONNECTED.';
      element.classList.remove('early-bird');
      element.removeAttribute('data-early-bird');
    });
  }
  updateOffer();
  window.setInterval(updateOffer, 1000);
  document.addEventListener('visibilitychange', updateOffer);
})();
