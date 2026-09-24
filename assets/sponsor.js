const sponsorDialog = document.querySelector('#sponsor-dialog');
document.querySelectorAll('[data-open-sponsor]').forEach(button => {
  button.addEventListener('click', () => sponsorDialog.showModal());
});
sponsorDialog.querySelector('.sponsor-close').addEventListener('click', () => sponsorDialog.close());
sponsorDialog.addEventListener('click', event => {
  if (event.target !== sponsorDialog) return;
  const bounds = sponsorDialog.getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) sponsorDialog.close();
});
// Keep preview details on the page until a sponsorship endpoint is connected.
document.querySelector('#sponsor-form').addEventListener('submit', event => event.preventDefault());
