import {
  confirmationCopy,
  isSavedReply,
  normaliseInterest,
  toFormBody,
  validateInterest,
} from './waitlist-form.js';

const dialog = document.querySelector('#interest-dialog');
const form = document.querySelector('#interest-form');
const statusLine = document.querySelector('#interest-status');
const sendingPanel = document.querySelector('#interest-sending');
const done = document.querySelector('#interest-done');
const submitButton = form.querySelector('button[type="submit"]');
const categoryInputs = [...form.querySelectorAll('input[name="categories"]')];
const allowedCategories = categoryInputs.map((input) => input.value);
const categoryLabels = Object.fromEntries(
  categoryInputs.map((input) => [input.value, input.closest('label').querySelector('strong').textContent]),
);
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

// Links elsewhere (such as the preview page's header button) open the form with this hash.
const OPEN_HASH = '#interest';
// Long enough for one rally of the loader, so a fast reply does not flash it.
const MIN_LOADER_MS = 1100;
const DONE_TITLE_ID = 'interest-done-title';
// Each field's error message has the id `${id}-error`.
const FIELD_IDS = {
  name: 'interest-name',
  email: 'interest-email',
  mobile: 'interest-mobile',
  categories: 'interest-categories',
  request: 'interest-request',
};
const MESSAGES = {
  notOpen: 'The interest list is not open yet. Please check back soon.',
  rejected: 'We could not save your details. Check the form and try again.',
  unsure:
    'Your details may not have been sent. Check your connection and try again. Sending again will not add you twice.',
};

let sending = false;
// CSS hides the intro and title for the "sending" and "done" states.
dialog.dataset.state = 'form';

document.querySelectorAll('[data-open-interest]').forEach((button) => {
  button.addEventListener('click', () => dialog.showModal());
});
dialog.querySelectorAll('[data-close-interest]').forEach((button) => {
  button.addEventListener('click', () => dialog.close());
});
// A click on the backdrop lands on the dialog element itself.
dialog.addEventListener('click', (event) => {
  if (event.target === dialog) dialog.close();
});
// A hash change within the page does not reload it, so listen for it too.
window.addEventListener('hashchange', openFromHash);
// Clear the hash on close so the same link opens the form again.
dialog.addEventListener('close', () => {
  if (window.location.hash === OPEN_HASH) {
    history.replaceState(null, '', window.location.pathname + window.location.search);
  }
});
openFromHash();

// The script checks the fields, so turn off the browser's own messages.
form.noValidate = true;

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (sending) return;

  const interest = readInterest();
  const errors = validateInterest(interest, allowedCategories);
  showErrors(errors);
  if (errors.length > 0) {
    statusLine.textContent =
      errors.length === 1 ? 'Fix 1 field to continue.' : `Fix ${errors.length} fields to continue.`;
    focusField(errors[0].field);
    return;
  }

  // Only bots fill the hidden website field: thank them and send nothing.
  if (form.elements.namedItem('website').value.trim()) {
    showDone(interest);
    return;
  }

  const endpoint = form.getAttribute('action');
  if (!endpoint) {
    statusLine.textContent = MESSAGES.notOpen;
    return;
  }

  sending = true;
  showSending();
  try {
    const [reply] = await Promise.all([
      sendInterest(endpoint, interest),
      pause(reduceMotion.matches ? 0 : MIN_LOADER_MS),
    ]);
    if (isSavedReply(reply)) showDone(interest);
    else showForm(reply === null ? MESSAGES.unsure : MESSAGES.rejected);
  } catch {
    // A network or CORS failure: the row may still have been saved.
    showForm(MESSAGES.unsure);
  } finally {
    sending = false;
  }
});

function openFromHash() {
  if (window.location.hash === OPEN_HASH && !dialog.open) dialog.showModal();
}

/** Resolves to the parsed reply, or null when the reply is not JSON. */
async function sendInterest(endpoint, interest) {
  const response = await fetch(endpoint, { method: 'POST', body: toFormBody(interest) });
  return response.json().catch(() => null);
}

function pause(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function readInterest() {
  const data = new FormData(form);
  return normaliseInterest({
    name: String(data.get('name') ?? ''),
    email: String(data.get('email') ?? ''),
    mobile: String(data.get('mobile') ?? ''),
    categories: data.getAll('categories').map(String),
    request: String(data.get('request') ?? ''),
  });
}

function showErrors(errors) {
  Object.entries(FIELD_IDS).forEach(([field, id]) => {
    const error = errors.find((item) => item.field === field);
    const message = document.getElementById(`${id}-error`);
    message.textContent = error ? error.message : '';
    message.hidden = !error;
    const controls = field === 'categories' ? categoryInputs : [document.getElementById(id)];
    controls.forEach((control) => {
      if (error) control.setAttribute('aria-invalid', 'true');
      else control.removeAttribute('aria-invalid');
    });
  });
}

function focusField(field) {
  const target = field === 'categories' ? categoryInputs[0] : document.getElementById(FIELD_IDS[field]);
  target.focus();
}

function showSending() {
  statusLine.textContent = '';
  form.hidden = true;
  sendingPanel.hidden = false;
  dialog.dataset.state = 'sending';
  sendingPanel.focus();
}

function showForm(message) {
  sendingPanel.hidden = true;
  form.hidden = false;
  dialog.dataset.state = 'form';
  statusLine.textContent = message;
  submitButton.focus();
}

function showDone(interest) {
  const copy = confirmationCopy(interest, categoryLabels);
  done.querySelector('[data-done-heading]').textContent = copy.heading;
  done.querySelector('[data-done-lines]').replaceChildren(
    ...copy.lines.map((line) => {
      const paragraph = document.createElement('p');
      paragraph.textContent = line;
      return paragraph;
    }),
  );
  form.hidden = true;
  sendingPanel.hidden = true;
  done.hidden = false;
  dialog.dataset.state = 'done';
  dialog.setAttribute('aria-labelledby', DONE_TITLE_ID);
  done.focus();
}
