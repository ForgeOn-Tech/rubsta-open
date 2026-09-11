import {
  firstName,
  isSavedReply,
  normaliseInterest,
  toFormBody,
  validateInterest,
} from './waitlist-form.js';

const form = document.querySelector('#interest-form');
const statusLine = document.querySelector('#interest-status');
const done = document.querySelector('#interest-done');
const submitButton = form.querySelector('button[type="submit"]');
const submitLabel = submitButton.querySelector('[data-label]');
const categoryInputs = [...form.querySelectorAll('input[name="categories"]')];
const allowedCategories = categoryInputs.map((input) => input.value);

// Each field's error message has the id `${id}-error`.
const FIELD_IDS = {
  name: 'interest-name',
  email: 'interest-email',
  mobile: 'interest-mobile',
  categories: 'interest-categories',
  request: 'interest-request',
};
const SUBMIT_LABEL = submitLabel.textContent;
const MESSAGES = {
  notOpen: 'The interest list is not open yet. Please check back soon.',
  sending: 'Sending your details…',
  rejected: 'We could not save your details. Check the form and try again.',
  unsure:
    'Your details may not have been sent. Check your connection and try again. Sending again will not add you twice.',
};

let sending = false;

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

  setSending(true);
  try {
    const response = await fetch(endpoint, { method: 'POST', body: toFormBody(interest) });
    const reply = await response.json().catch(() => null);
    if (isSavedReply(reply)) showDone(interest);
    else statusLine.textContent = reply === null ? MESSAGES.unsure : MESSAGES.rejected;
  } catch {
    // A network or CORS failure: the row may still have been saved.
    statusLine.textContent = MESSAGES.unsure;
  } finally {
    setSending(false);
  }
});

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

function setSending(isSending) {
  sending = isSending;
  submitButton.disabled = isSending;
  submitLabel.textContent = isSending ? 'Sending…' : SUBMIT_LABEL;
  if (isSending) statusLine.textContent = MESSAGES.sending;
}

function showDone(interest) {
  done.querySelector('[data-first-name]').textContent = firstName(interest.name);
  done.querySelector('[data-email]').textContent = interest.email;
  form.hidden = true;
  statusLine.textContent = '';
  done.hidden = false;
  done.focus();
}
