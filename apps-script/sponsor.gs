/**
 * Rubsta Open sponsorship enquiries. waitlist.gs routes the Become a Sponsor form
 * here and keeps one row per email address in the "Sponsors" tab of the same sheet.
 * Paste this file into the same Apps Script project as waitlist.gs: it reuses that
 * file's helpers and its SPREADSHEET_ID.
 * The checks repeat assets/sponsor-form.js; change both files together.
 */

const SPONSOR_TYPE = 'sponsor';
const SPONSOR_SHEET_NAME = 'Sponsors';
const SPONSOR_HEADER = [
  'Submitted at',
  'Updated at',
  'Name',
  'Organisation',
  'Email',
  'Mobile',
  'Message',
];
const SPONSOR_EMAIL_COLUMN = SPONSOR_HEADER.indexOf('Email') + 1;
const SPONSOR_LIMITS = { name: 80, organisation: 120, email: 254, mobile: 20, message: 1000 };

function postSponsor_(e) {
  const params = e.parameter;
  const sponsor = normaliseSponsor_({
    name: params.name,
    organisation: params.organisation,
    email: params.email,
    mobile: params.mobile,
    message: params.message,
  });
  const errors = validateSponsor_(sponsor);
  if (errors.length > 0) return jsonReply_({ ok: false, errors: errors });

  // Throws after LOCK_WAIT_MS; the page then offers a retry, which is safe.
  const lock = LockService.getScriptLock();
  lock.waitLock(LOCK_WAIT_MS);
  try {
    saveSponsor_(getSheet_(SPONSOR_SHEET_NAME, SPONSOR_HEADER), sponsor, new Date());
  } finally {
    lock.releaseLock();
  }
  return jsonReply_({ ok: true });
}

/** The message keeps its line breaks, so it reads the way it was typed. */
function normaliseSponsor_(raw) {
  return {
    name: foldSpaces_(raw.name),
    organisation: foldSpaces_(raw.organisation),
    email: String(raw.email || '').trim().toLowerCase(),
    mobile: foldSpaces_(raw.mobile),
    message: String(raw.message || '').trim(),
  };
}

function validateSponsor_(sponsor) {
  const errors = [];

  if (!sponsor.name) {
    errors.push({ field: 'name', message: 'Enter your name.' });
  } else if (sponsor.name.length > SPONSOR_LIMITS.name) {
    errors.push({ field: 'name', message: 'Keep your name to ' + SPONSOR_LIMITS.name + ' characters.' });
  }

  if (!sponsor.organisation) {
    errors.push({ field: 'organisation', message: 'Enter your brand or organisation.' });
  } else if (sponsor.organisation.length > SPONSOR_LIMITS.organisation) {
    errors.push({
      field: 'organisation',
      message: 'Keep the brand name to ' + SPONSOR_LIMITS.organisation + ' characters.',
    });
  }

  if (!sponsor.email) {
    errors.push({ field: 'email', message: 'Enter your email address.' });
  } else if (!EMAIL_PATTERN.test(sponsor.email) || sponsor.email.length > SPONSOR_LIMITS.email) {
    errors.push({ field: 'email', message: 'Enter an email address like name@example.com.' });
  }

  if (sponsor.mobile && !isMobile_(sponsor.mobile)) {
    errors.push({ field: 'mobile', message: MOBILE_MESSAGE });
  }

  if (sponsor.message.length > SPONSOR_LIMITS.message) {
    errors.push({
      field: 'message',
      message: 'Keep your message to ' + SPONSOR_LIMITS.message + ' characters.',
    });
  }

  return errors;
}

function saveSponsor_(sheet, sponsor, now) {
  saveByEmail_(sheet, SPONSOR_HEADER, SPONSOR_EMAIL_COLUMN, sponsor.email, now, function (
    submittedAt,
    updatedAt,
  ) {
    return toSponsorRow_(sponsor, submittedAt, updatedAt);
  });
}

function toSponsorRow_(sponsor, submittedAt, updatedAt) {
  return [
    submittedAt,
    updatedAt,
    safeCell_(sponsor.name),
    safeCell_(sponsor.organisation),
    safeCell_(sponsor.email),
    safeCell_(sponsor.mobile),
    safeCell_(sponsor.message),
  ];
}
