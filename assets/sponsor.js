import { isSavedReply } from './waitlist-form.js';
import {
  normaliseSponsor,
  sponsorConfirmationCopy,
  toSponsorBody,
  validateSponsor,
} from './sponsor-form.js';

const dialog = document.querySelector('#sponsor-dialog');
const form = document.querySelector('#sponsor-form');
const statusLine = document.querySelector('#sponsor-status');
const sendingPanel = document.querySelector('#sponsor-sending');
const done = document.querySelector('#sponsor-done');
const submitButton = form.querySelector('button[type="submit"]');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

// Long enough for one rally of the loader, so a fast reply does not flash it.
const MIN_LOADER_MS = 1100;
const DONE_TITLE_ID = 'sponsor-done-title';
// Each field's error message has the id `${id}-error`.
const FIELD_IDS = {
  name: 'sponsor-name',
  organisation: 'sponsor-organisation',
  email: 'sponsor-email',
  mobile: 'sponsor-mobile',
  message: 'sponsor-message',
};
const MESSAGES = {
  notOpen: 'Sponsorship enquiries are not open yet. Please check back soon.',
  rejected: 'We could not send your enquiry. Check the form and try again.',
  unsure:
    'Your enquiry may not have been sent. Check your connection and try again. Sending again will not send it twice.',
};

let sending = false;
// CSS hides the intro and title for the "sending" and "done" states.
dialog.dataset.state = 'form';

document.querySelectorAll('[data-open-sponsor]').forEach((button) => {
  button.addEventListener('click', () => dialog.showModal());
});
dialog.querySelectorAll('[data-close-sponsor]').forEach((button) => {
  button.addEventListener('click', () => dialog.close());
});
// A click on the backdrop lands on the dialog element itself.
dialog.addEventListener('click', (event) => {
  if (event.target === dialog) dialog.close();
});

// The script checks the fields, so turn off the browser's own messages.
form.noValidate = true;

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (sending) return;

  const sponsor = readSponsor();
  const errors = validateSponsor(sponsor);
  showErrors(errors);
  if (errors.length > 0) {
    statusLine.textContent =
      errors.length === 1 ? 'Fix 1 field to continue.' : `Fix ${errors.length} fields to continue.`;
    focusField(errors[0].field);
    return;
  }

  // Only bots fill the hidden website field: thank them and send nothing.
  if (form.elements.namedItem('website').value.trim()) {
    showDone(sponsor);
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
      sendSponsor(endpoint, sponsor),
      pause(reduceMotion.matches ? 0 : MIN_LOADER_MS),
    ]);
    if (isSavedReply(reply)) showDone(sponsor);
    else showForm(reply === null ? MESSAGES.unsure : MESSAGES.rejected);
  } catch {
    // A network or CORS failure: the row may still have been saved.
    showForm(MESSAGES.unsure);
  } finally {
    sending = false;
  }
});

/** Resolves to the parsed reply, or null when the reply is not JSON. */
async function sendSponsor(endpoint, sponsor) {
  const response = await fetch(endpoint, { method: 'POST', body: toSponsorBody(sponsor) });
  return response.json().catch(() => null);
}

function pause(milliseconds) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function readSponsor() {
  const data = new FormData(form);
  return normaliseSponsor({
    name: String(data.get('name') ?? ''),
    organisation: String(data.get('organisation') ?? ''),
    email: String(data.get('email') ?? ''),
    mobile: String(data.get('mobile') ?? ''),
    message: String(data.get('message') ?? ''),
  });
}

function showErrors(errors) {
  Object.entries(FIELD_IDS).forEach(([field, id]) => {
    const error = errors.find((item) => item.field === field);
    const message = document.getElementById(`${id}-error`);
    message.textContent = error ? error.message : '';
    message.hidden = !error;
    const control = document.getElementById(id);
    if (error) control.setAttribute('aria-invalid', 'true');
    else control.removeAttribute('aria-invalid');
  });
}

function focusField(field) {
  document.getElementById(FIELD_IDS[field]).focus();
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

function showDone(sponsor) {
  const copy = sponsorConfirmationCopy(sponsor);
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
