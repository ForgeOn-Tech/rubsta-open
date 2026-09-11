/**
 * Rubsta Open interest list. Receives the Show interest form from index.html and
 * keeps one row per email address in the "Interest" sheet.
 *
 * Deploy from the Google Sheet (Extensions > Apps Script) as a web app that
 * executes as you and allows access to anyone. README.md lists the steps.
 * The checks repeat assets/waitlist-form.js; change both files together.
 */

const SHEET_NAME = 'Interest';
const HEADER = ['Submitted at', 'Updated at', 'Name', 'Email', 'Mobile', 'Categories', 'Requested category'];
const EMAIL_COLUMN = HEADER.indexOf('Email') + 1;
const FIRST_DATA_ROW = 2;
// Keys match the checkbox values in index.html.
const CATEGORY_LABELS = {
  'open-singles': 'Open singles',
  'womens-30-plus': "Women's 30+",
  'u15-juniors': 'U-15 juniors',
  'open-doubles': 'Open doubles',
  'singles-40-plus': '40+ singles',
};
const LIMITS = { name: 80, email: 254, mobile: 20, request: 120 };
const MOBILE_DIGITS = { min: 7, max: 15 };
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MOBILE_CHARACTERS = /^\+?[\d\s-]+$/;
// Sheets treats text that starts with one of these characters as a formula.
const FORMULA_START = /^[=+\-@\t\r]/;
const LOCK_WAIT_MS = 10000;

/** Lets you check the deployment URL in a browser. */
function doGet() {
  return jsonReply_({ ok: true, service: 'rubsta-open-interest' });
}

function doPost(e) {
  const params = e.parameter;
  // Bots fill the hidden website field; people never see it.
  if (String(params.website || '').trim()) return jsonReply_({ ok: true });

  const interest = normaliseInterest_({
    name: params.name,
    email: params.email,
    mobile: params.mobile,
    categories: e.parameters.categories,
    request: params.request,
  });
  const errors = validateInterest_(interest);
  if (errors.length > 0) return jsonReply_({ ok: false, errors: errors });

  // Throws after LOCK_WAIT_MS; the page then offers a retry, which is safe.
  const lock = LockService.getScriptLock();
  lock.waitLock(LOCK_WAIT_MS);
  try {
    saveInterest_(getSheet_(), interest, new Date());
  } finally {
    lock.releaseLock();
  }
  return jsonReply_({ ok: true });
}

function normaliseInterest_(raw) {
  const categories = (raw.categories || []).map(function (category) {
    return String(category).trim();
  });
  return {
    name: foldSpaces_(raw.name),
    email: String(raw.email || '').trim().toLowerCase(),
    mobile: foldSpaces_(raw.mobile),
    categories: categories.filter(function (category, index) {
      return category !== '' && categories.indexOf(category) === index;
    }),
    request: foldSpaces_(raw.request),
  };
}

function validateInterest_(interest) {
  const errors = [];

  if (!interest.name) {
    errors.push({ field: 'name', message: 'Enter your name.' });
  } else if (interest.name.length > LIMITS.name) {
    errors.push({ field: 'name', message: 'Keep your name to ' + LIMITS.name + ' characters.' });
  }

  if (!interest.email) {
    errors.push({ field: 'email', message: 'Enter your email address.' });
  } else if (!EMAIL_PATTERN.test(interest.email) || interest.email.length > LIMITS.email) {
    errors.push({ field: 'email', message: 'Enter an email address like name@example.com.' });
  }

  if (interest.mobile && !isMobile_(interest.mobile)) {
    errors.push({
      field: 'mobile',
      message:
        'Enter a mobile number with ' + MOBILE_DIGITS.min + ' to ' + MOBILE_DIGITS.max +
        ' digits, or leave it empty.',
    });
  }

  const unknown = interest.categories.filter(function (category) {
    return !Object.prototype.hasOwnProperty.call(CATEGORY_LABELS, category);
  });
  if (unknown.length > 0) {
    errors.push({ field: 'categories', message: 'Choose from the listed categories.' });
  } else if (interest.categories.length === 0 && !interest.request) {
    errors.push({ field: 'categories', message: 'Choose a category, or request one below.' });
  }

  if (interest.request.length > LIMITS.request) {
    errors.push({ field: 'request', message: 'Keep the request to ' + LIMITS.request + ' characters.' });
  }

  return errors;
}

/** Updates the row for this email when one exists, so a retry never adds a second row. */
function saveInterest_(sheet, interest, now) {
  const lastRow = sheet.getLastRow();
  const emails =
    lastRow >= FIRST_DATA_ROW
      ? sheet
          .getRange(FIRST_DATA_ROW, EMAIL_COLUMN, lastRow - FIRST_DATA_ROW + 1, 1)
          .getValues()
          .map(function (row) {
            return row[0];
          })
      : [];
  const index = findEmailIndex_(emails, interest.email);
  if (index === -1) {
    sheet.appendRow(toRow_(interest, now, now));
    return;
  }
  const rowNumber = FIRST_DATA_ROW + index;
  const submittedAt = sheet.getRange(rowNumber, 1).getValue();
  sheet.getRange(rowNumber, 1, 1, HEADER.length).setValues([toRow_(interest, submittedAt, now)]);
}

function findEmailIndex_(emails, email) {
  return emails.findIndex(function (value) {
    return String(value).replace(/^'/, '').trim().toLowerCase() === email;
  });
}

function toRow_(interest, submittedAt, updatedAt) {
  const categories = interest.categories.map(function (category) {
    return CATEGORY_LABELS[category];
  });
  return [
    submittedAt,
    updatedAt,
    safeCell_(interest.name),
    safeCell_(interest.email),
    safeCell_(interest.mobile),
    safeCell_(categories.join(', ')),
    safeCell_(interest.request),
  ];
}

/** Stores the value as text. The leading apostrophe does not show in the sheet. */
function safeCell_(value) {
  return FORMULA_START.test(value) ? "'" + value : value;
}

// Leave empty when the script is opened from the sheet (Extensions > Apps Script).
// For a standalone project made at script.google.com, paste the sheet's ID: the
// part of the sheet's URL between /d/ and /edit.
const SPREADSHEET_ID = '';

function getSheet_() {
  const spreadsheet = SPREADSHEET_ID
    ? SpreadsheetApp.openById(SPREADSHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet();
  const existing = spreadsheet.getSheetByName(SHEET_NAME);
  if (existing) return existing;
  const sheet = spreadsheet.insertSheet(SHEET_NAME);
  sheet.appendRow(HEADER);
  sheet.setFrozenRows(1);
  return sheet;
}

function jsonReply_(body) {
  return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(ContentService.MimeType.JSON);
}

function foldSpaces_(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function isMobile_(value) {
  const digits = value.replace(/\D/g, '').length;
  return (
    MOBILE_CHARACTERS.test(value) &&
    value.length <= LIMITS.mobile &&
    digits >= MOBILE_DIGITS.min &&
    digits <= MOBILE_DIGITS.max
  );
}
