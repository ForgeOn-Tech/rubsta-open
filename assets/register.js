// Registration runs in the Tournament OS app (web/), not on this static site.
const LIVE_REGISTRATION_URL = 'https://register.rubstaopen.com/register';
// Locally, `npm run dev` in web/ serves the app on port 3100.
const LOCAL_REGISTRATION_URL = 'http://localhost:3100/register';
const LOCAL_HOSTS = ['localhost', '127.0.0.1'];

const registrationUrl = LOCAL_HOSTS.includes(window.location.hostname)
  ? LOCAL_REGISTRATION_URL
  : LIVE_REGISTRATION_URL;
document.querySelectorAll('[data-register]').forEach((link) => {
  link.href = registrationUrl;
});
