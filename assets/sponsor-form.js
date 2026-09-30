// Rules for the Become a Sponsor form. apps-script/sponsor.gs repeats these checks
// on the server; change both files together. The name, email and mobile checks come
// from waitlist-form.js so both forms accept the same details.

import { MOBILE_MESSAGE, firstName, foldSpaces, isEmail, isMobile } from './waitlist-form.js';

/** @typedef {'name' | 'organisation' | 'email' | 'mobile' | 'message'} SponsorField */

/**
 * @typedef {object} Sponsor
 * @property {string} name
 * @property {string} organisation The brand the enquiry comes from.
 * @property {string} email
 * @property {string} mobile
 * @property {string} message How they would like to support the tournament.
 */

/**
 * @typedef {object} SponsorFieldError
 * @property {SponsorField} field
 * @property {string} message
 */

export const SPONSOR_LIMITS = Object.freeze({
  name: 80,
  organisation: 120,
  email: 254,
  mobile: 20,
  message: 1000,
});
// The value that sends the row to the Sponsors sheet instead of the Interest sheet.
export const SPONSOR_TYPE = 'sponsor';

/**
 * Trims every field, folds repeated spaces and lowercases the email. The message
 * keeps its line breaks, so it reads in the sheet the way it was typed.
 * @param {Sponsor} raw
 * @returns {Sponsor}
 */
export function normaliseSponsor(raw) {
  return {
    name: foldSpaces(raw.name),
    organisation: foldSpaces(raw.organisation),
    email: raw.email.trim().toLowerCase(),
    mobile: foldSpaces(raw.mobile),
    message: raw.message.trim(),
  };
}

/**
 * Lists the problems with a normalised enquiry, in form order.
 * @param {Sponsor} sponsor
 * @returns {SponsorFieldError[]}
 */
export function validateSponsor(sponsor) {
  /** @type {SponsorFieldError[]} */
  const errors = [];

  if (!sponsor.name) {
    errors.push({ field: 'name', message: 'Enter your name.' });
  } else if (sponsor.name.length > SPONSOR_LIMITS.name) {
    errors.push({ field: 'name', message: `Keep your name to ${SPONSOR_LIMITS.name} characters.` });
  }

  if (!sponsor.organisation) {
    errors.push({ field: 'organisation', message: 'Enter your brand or organisation.' });
  } else if (sponsor.organisation.length > SPONSOR_LIMITS.organisation) {
    errors.push({
      field: 'organisation',
      message: `Keep the brand name to ${SPONSOR_LIMITS.organisation} characters.`,
    });
  }

  if (!sponsor.email) {
    errors.push({ field: 'email', message: 'Enter your email address.' });
  } else if (!isEmail(sponsor.email)) {
    errors.push({ field: 'email', message: 'Enter an email address like name@example.com.' });
  }

  if (sponsor.mobile && !isMobile(sponsor.mobile)) {
    errors.push({ field: 'mobile', message: MOBILE_MESSAGE });
  }

  if (sponsor.message.length > SPONSOR_LIMITS.message) {
    errors.push({
      field: 'message',
      message: `Keep your message to ${SPONSOR_LIMITS.message} characters.`,
    });
  }

  return errors;
}

/**
 * Form-encoded body for the Apps Script web app. A form-encoded POST needs no
 * CORS preflight. The type tells the script which sheet the row belongs in.
 * @param {Sponsor} sponsor
 * @returns {URLSearchParams}
 */
export function toSponsorBody(sponsor) {
  return new URLSearchParams({
    type: SPONSOR_TYPE,
    name: sponsor.name,
    organisation: sponsor.organisation,
    email: sponsor.email,
    mobile: sponsor.mobile,
    message: sponsor.message,
  });
}

/**
 * Copy for the confirmation screen, built from what the sponsor sent.
 * @param {Sponsor} sponsor A normalised, valid enquiry.
 * @returns {{ heading: string, lines: string[] }}
 */
export function sponsorConfirmationCopy(sponsor) {
  const lines = [`We’ll reply to ${sponsor.email} about sponsoring Rubsta Open.`];
  if (sponsor.mobile) {
    lines.push(`We may also call or message you on ${sponsor.mobile}.`);
  }
  lines.push(`Thank you for backing the tournament, ${sponsor.organisation}.`);
  return { heading: `Thank you, ${firstName(sponsor.name)}.`, lines };
}
