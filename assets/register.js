// Hosted links are same-origin. Local static previews use the Next.js dev app.
if (['localhost', '127.0.0.1'].includes(window.location.hostname)) {
  document.querySelectorAll('[data-register], [data-internal], [data-account]').forEach(link => {
    const path = link.hasAttribute('data-account') ? '/home' : link.hasAttribute('data-internal') ? '/internal' : '/register';
    link.href = new URL(path, 'http://localhost:3100').href;
  });
}
