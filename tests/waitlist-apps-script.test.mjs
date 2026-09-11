import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import vm from 'node:vm';

import { LIMITS, normaliseInterest, validateInterest } from '../assets/waitlist-form.js';

// Apps Script has no modules, so load the file into its own context and read
// its functions and constants by name.
const context = vm.createContext({});
vm.runInContext(readFileSync(new URL('../apps-script/waitlist.gs', import.meta.url), 'utf8'), context);
const script = (name) => vm.runInContext(name, context);

// Values made inside the context have that context's prototypes; compare plain copies.
const plain = (value) => JSON.parse(JSON.stringify(value));

const FORM_CATEGORIES = [
  ...readFileSync(new URL('../index.html', import.meta.url), 'utf8').matchAll(
    /name="categories" value="([^"]+)"/g,
  ),
].map((match) => match[1]);

function raw(overrides) {
  return {
    name: 'Asha Rao',
    email: 'asha@example.com',
    mobile: '',
    categories: ['open-singles'],
    request: '',
    ...overrides,
  };
}

describe('waitlist.gs matches the page', () => {
  it('accepts exactly the categories on the form', () => {
    assert.ok(FORM_CATEGORIES.length > 0);
    assert.deepEqual(plain(Object.keys(script('CATEGORY_LABELS'))), FORM_CATEGORIES);
  });

  it('uses the same length limits as the browser checks', () => {
    assert.deepEqual(plain(script('LIMITS')), { ...LIMITS });
  });

  it('gives the same errors as the browser checks', () => {
    const cases = [
      raw({}),
      raw({ categories: [], request: 'Mixed doubles' }),
      raw({ categories: [] }),
      raw({ categories: ['mixed-doubles'] }),
      raw({ name: ' ', email: 'asha@' }),
      raw({ mobile: '12345' }),
      raw({ name: 'a'.repeat(81), request: 'b'.repeat(121) }),
    ];

    for (const value of cases) {
      const browser = validateInterest(normaliseInterest(value), FORM_CATEGORIES);
      const server = script('validateInterest_')(script('normaliseInterest_')(value));
      assert.deepEqual(plain(server), browser);
    }
  });
});

describe('normaliseInterest_', () => {
  it('handles missing fields from a hand-made POST', () => {
    const result = script('normaliseInterest_')({ email: ' A@B.CO ' });

    assert.deepEqual(plain(result), {
      name: '',
      email: 'a@b.co',
      mobile: '',
      categories: [],
      request: '',
    });
  });
});

describe('safeCell_', () => {
  it('stores formula-like text as text', () => {
    const safeCell = script('safeCell_');

    assert.equal(safeCell('=HYPERLINK("x")'), '\'=HYPERLINK("x")');
    assert.equal(safeCell('+91 98765 43210'), "'+91 98765 43210");
    assert.equal(safeCell('-1'), "'-1");
    assert.equal(safeCell('@home'), "'@home");
    assert.equal(safeCell('Asha Rao'), 'Asha Rao');
    assert.equal(safeCell(''), '');
  });
});

describe('findEmailIndex_', () => {
  it('matches an existing email regardless of case or a text apostrophe', () => {
    const findEmailIndex = script('findEmailIndex_');
    const emails = ['first@example.com', "'=odd@example.com", ' ASHA@example.com '];

    assert.equal(findEmailIndex(emails, 'asha@example.com'), 2);
    assert.equal(findEmailIndex(emails, '=odd@example.com'), 1);
    assert.equal(findEmailIndex(emails, 'new@example.com'), -1);
    assert.equal(findEmailIndex([], 'asha@example.com'), -1);
  });
});

describe('toRow_', () => {
  it('keeps the first submission time and lists category labels', () => {
    const submittedAt = new Date('2026-09-11T10:00:00Z');
    const updatedAt = new Date('2026-09-12T10:00:00Z');
    const interest = script('normaliseInterest_')(
      raw({ mobile: '+91 98765 43210', categories: ['doubles', 'womens-30-plus'], request: 'Mixed doubles' }),
    );

    const row = script('toRow_')(interest, submittedAt, updatedAt);

    assert.equal(row[0], submittedAt);
    assert.equal(row[1], updatedAt);
    assert.deepEqual(plain(row.slice(2)), [
      'Asha Rao',
      'asha@example.com',
      "'+91 98765 43210",
      "Doubles, Women's 30+",
      'Mixed doubles',
    ]);
    assert.equal(row.length, script('HEADER').length);
  });
});
