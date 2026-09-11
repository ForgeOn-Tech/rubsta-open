// Rules for the Show interest form. apps-script/waitlist.gs repeats these checks
// on the server; change both files together.

/** @typedef {'name' | 'email' | 'mobile' | 'categories' | 'request'} InterestField */

/**
 * @typedef {object} Interest
 * @property {string} name
 * @property {string} email
 * @property {string} mobile
 * @property {string[]} categories Checkbox values from index.html.
 * @property {string} request A category the player wants added.
 */

/**
 * @typedef {object} FieldError
 * @property {InterestField} field
 * @property {string} message
 */

export const LIMITS = Object.freeze({ name: 80, email: 254, mobile: 20, request: 120 });
const MOBILE_DIGITS = Object.freeze({ min: 7, max: 15 });
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MOBILE_CHARACTERS = /^\+?[\d\s-]+$/;

/**
 * Trims every field, folds repeated spaces, lowercases the email and drops
 * repeated categories.
 * @param {Interest} raw
 * @returns {Interest}
 */
export function normaliseInterest(raw) {
  return {
    name: foldSpaces(raw.name),
    email: raw.email.trim().toLowerCase(),
    mobile: foldSpaces(raw.mobile),
    categories: [...new Set(raw.categories.map((category) => category.trim()))].filter(Boolean),
    request: foldSpaces(raw.request),
  };
}

/**
 * Lists the problems with a normalised interest, in form order.
 * A requested category counts as a choice, so no box needs a tick.
 * @param {Interest} interest
 * @param {readonly string[]} allowedCategories
 * @returns {FieldError[]}
 */
export function validateInterest(interest, allowedCategories) {
  /** @type {FieldError[]} */
  const errors = [];

  if (!interest.name) {
    errors.push({ field: 'name', message: 'Enter your name.' });
  } else if (interest.name.length > LIMITS.name) {
    errors.push({ field: 'name', message: `Keep your name to ${LIMITS.name} characters.` });
  }

  if (!interest.email) {
    errors.push({ field: 'email', message: 'Enter your email address.' });
  } else if (!EMAIL_PATTERN.test(interest.email) || interest.email.length > LIMITS.email) {
    errors.push({ field: 'email', message: 'Enter an email address like name@example.com.' });
  }

  if (interest.mobile && !isMobile(interest.mobile)) {
    errors.push({
      field: 'mobile',
      message: `Enter a mobile number with ${MOBILE_DIGITS.min} to ${MOBILE_DIGITS.max} digits, or leave it empty.`,
    });
  }

  if (interest.categories.some((category) => !allowedCategories.includes(category))) {
    errors.push({ field: 'categories', message: 'Choose from the listed categories.' });
  } else if (interest.categories.length === 0 && !interest.request) {
    errors.push({ field: 'categories', message: 'Choose a category, or request one below.' });
  }

  if (interest.request.length > LIMITS.request) {
    errors.push({ field: 'request', message: `Keep the request to ${LIMITS.request} characters.` });
  }

  return errors;
}

/**
 * Form-encoded body for the Apps Script web app. A form-encoded POST needs no
 * CORS preflight. Each category is its own "categories" pair.
 * @param {Interest} interest
 * @returns {URLSearchParams}
 */
export function toFormBody(interest) {
  const body = new URLSearchParams({
    name: interest.name,
    email: interest.email,
    mobile: interest.mobile,
    request: interest.request,
  });
  interest.categories.forEach((category) => body.append('categories', category));
  return body;
}

/**
 * True only for the script's saved reply, `{"ok": true}`.
 * @param {unknown} reply
 * @returns {boolean}
 */
export function isSavedReply(reply) {
  return typeof reply === 'object' && reply !== null && 'ok' in reply && reply.ok === true;
}

/**
 * @param {string} name A normalised full name.
 * @returns {string}
 */
export function firstName(name) {
  return name.split(' ')[0];
}

/**
 * @param {string} value
 * @returns {string}
 */
function foldSpaces(value) {
  return value.trim().replace(/\s+/g, ' ');
}

/**
 * @param {string} value
 * @returns {boolean}
 */
function isMobile(value) {
  const digits = value.replace(/\D/g, '').length;
  return (
    MOBILE_CHARACTERS.test(value) &&
    value.length <= LIMITS.mobile &&
    digits >= MOBILE_DIGITS.min &&
    digits <= MOBILE_DIGITS.max
  );
}
