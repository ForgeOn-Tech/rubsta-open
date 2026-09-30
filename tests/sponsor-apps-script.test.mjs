import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import vm from 'node:vm';

import { normaliseSponsor, validateSponsor } from '../assets/sponsor-form.js';

// One sheet of a fake spreadsheet, holding the rows the script writes.
function fakeSheet(rows) {
  return {
    rows,
    getLastRow: () => rows.length,
    setFrozenRows: () => {},
    appendRow: (row) => rows.push([...row]),
    getRange: (row, column, rowCount = 1, columnCount = 1) => ({
      getValue: () => rows[row - 1][column - 1],
      getValues: () =>
        Array.from({ length: rowCount }, (_, offset) =>
          rows[row - 1 + offset].slice(column - 1, column - 1 + columnCount),
        ),
      setValues: (values) =>
        values.forEach((line, lineOffset) =>
          line.forEach((cell, cellOffset) => {
            rows[row - 1 + lineOffset][column - 1 + cellOffset] = cell;
          }),
        ),
    }),
  };
}

/**
 * Loads both script files into one context, as the Apps Script project does, with
 * fakes for the Google services they call.
 */
function loadScripts() {
  const sheets = new Map();
  const context = vm.createContext({
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: (text) => ({ setMimeType: () => ({ text }) }),
    },
    LockService: { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) },
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ({
        getSheetByName: (name) => sheets.get(name) ?? null,
        insertSheet: (name) => {
          const sheet = fakeSheet([]);
          sheets.set(name, sheet);
          return sheet;
        },
      }),
    },
  });
  for (const file of ['waitlist.gs', 'sponsor.gs']) {
    vm.runInContext(readFileSync(new URL(`../apps-script/${file}`, import.meta.url), 'utf8'), context);
  }
  return {
    sheets,
    read: (name) => vm.runInContext(name, context),
    post: (fields) => JSON.parse(vm.runInContext('doPost', context)(toEvent(fields)).text),
    get: () => JSON.parse(vm.runInContext('doGet', context)().text),
  };
}

/**
 * A form POST as Apps Script delivers it: `parameter` holds the first value of each
 * field and `parameters` holds every value, so a field can repeat.
 */
function toEvent(fields) {
  const entries = Object.entries(fields).map(([field, value]) => [field, [value].flat()]);
  return {
    parameter: Object.fromEntries(entries.map(([field, values]) => [field, values[0]])),
    parameters: Object.fromEntries(entries),
  };
}

// Values made inside the context have that context's prototypes; compare plain copies.
const plain = (value) => JSON.parse(JSON.stringify(value));

function raw(overrides) {
  return {
    type: 'sponsor',
    name: 'Asha Rao',
    organisation: 'Baseline Sports',
    email: 'asha@example.com',
    mobile: '',
    message: '',
    ...overrides,
  };
}

/** The sponsor fields as the browser module reads them. */
const browserFields = ({ type, ...fields }) => fields;

describe('sponsor.gs matches the page', () => {
  it('uses the same limits as the browser checks', () => {
    const { read } = loadScripts();

    assert.deepEqual(plain(read('SPONSOR_LIMITS')), {
      name: 80,
      organisation: 120,
      email: 254,
      mobile: 20,
      message: 1000,
    });
  });

  it('sends the row to the sheet the page asks for', () => {
    const { read } = loadScripts();

    assert.equal(read('SPONSOR_TYPE'), 'sponsor');
    assert.equal(read('SPONSOR_SHEET_NAME'), 'Sponsors');
  });

  it('reads the email from the fifth column, where its header sits', () => {
    const { read } = loadScripts();

    assert.equal(read('SPONSOR_EMAIL_COLUMN'), 5);
    assert.equal(read('SPONSOR_HEADER')[read('SPONSOR_EMAIL_COLUMN') - 1], 'Email');
  });

  it('gives the same errors as the browser checks', () => {
    const { read } = loadScripts();
    const cases = [
      raw({}),
      raw({ name: ' ', organisation: '', email: '' }),
      raw({ email: 'asha@' }),
      // Longer than the limit, which only a hand-made POST can reach.
      raw({ email: 'a'.repeat(250) + '@example.com' }),
      raw({ mobile: '12345' }),
      raw({ name: 'a'.repeat(81), organisation: 'b'.repeat(121), message: 'c'.repeat(1001) }),
      raw({ mobile: '+91 98765 43210', message: 'Court boards.\n\nAnd the kits.' }),
    ];

    for (const value of cases) {
      const browser = validateSponsor(normaliseSponsor(browserFields(value)));
      const server = read('validateSponsor_')(read('normaliseSponsor_')(value));
      assert.deepEqual(plain(server), browser);
    }
  });

  it('normalises a hand-made POST the same way as the browser', () => {
    const { read } = loadScripts();
    const value = raw({ name: '  Asha   Rao ', email: ' ASHA@Example.COM ', message: ' Boards.\n Kits. ' });

    assert.deepEqual(
      plain(read('normaliseSponsor_')(value)),
      normaliseSponsor(browserFields(value)),
    );
  });

  it('handles missing fields from a hand-made POST', () => {
    const { read } = loadScripts();

    assert.deepEqual(plain(read('normaliseSponsor_')({ email: ' A@B.CO ' })), {
      name: '',
      organisation: '',
      email: 'a@b.co',
      mobile: '',
      message: '',
    });
  });
});

describe('doPost', () => {
  it('saves a sponsor to the Sponsors sheet and leaves Interest alone', () => {
    const { post, sheets, read } = loadScripts();

    const reply = post(raw({ mobile: '+91 98765 43210', message: 'Court boards.' }));

    assert.deepEqual(reply, { ok: true });
    assert.equal(sheets.has('Interest'), false);
    const rows = sheets.get('Sponsors').rows;
    assert.deepEqual(rows[0], plain(read('SPONSOR_HEADER')));
    assert.deepEqual(rows[1].slice(2), [
      'Asha Rao',
      'Baseline Sports',
      'asha@example.com',
      "'+91 98765 43210",
      'Court boards.',
    ]);
  });

  it('sends a post without a type to the Interest sheet', () => {
    const { post, sheets } = loadScripts();

    const reply = post({ name: 'Asha Rao', email: 'asha@example.com', categories: 'open-singles' });

    assert.deepEqual(reply, { ok: true });
    assert.equal(sheets.has('Sponsors'), false);
    assert.equal(sheets.get('Interest').rows.length, 2);
  });

  it('updates the row for a repeated email instead of adding a second one', () => {
    const { post, sheets } = loadScripts();

    post(raw({ message: 'Court boards.' }));
    const first = sheets.get('Sponsors').rows[1][0];
    post(raw({ email: 'ASHA@example.com', organisation: 'Baseline Sports Collective' }));

    const rows = sheets.get('Sponsors').rows;
    assert.equal(rows.length, 2);
    assert.equal(rows[1][0], first, 'keeps the first submission time');
    assert.equal(rows[1][3], 'Baseline Sports Collective');
    assert.equal(rows[1][6], '', 'replaces the message with the latest one');
  });

  it('keeps a second sponsor in its own row', () => {
    const { post, sheets } = loadScripts();

    post(raw({}));
    post(raw({ name: 'Ravi Kumar', organisation: 'Rally Goods', email: 'ravi@example.com' }));

    assert.equal(sheets.get('Sponsors').rows.length, 3);
  });

  it('reports the field problems without writing a row', () => {
    const { post, sheets } = loadScripts();

    const reply = post(raw({ organisation: '' }));

    assert.deepEqual(reply, { ok: false, errors: [{ field: 'organisation', message: 'Enter your brand or organisation.' }] });
    assert.equal(sheets.has('Sponsors'), false);
  });

  it('thanks a bot that fills the hidden field, and stores nothing', () => {
    const { post, sheets } = loadScripts();

    const reply = post(raw({ website: 'https://spam.example' }));

    assert.deepEqual(reply, { ok: true });
    assert.equal(sheets.size, 0);
  });
});

describe('doGet', () => {
  it('names both forms the deployment handles', () => {
    const { get } = loadScripts();

    assert.deepEqual(get(), {
      ok: true,
      service: 'rubsta-open-interest',
      forms: ['interest', 'sponsor'],
    });
  });
});
