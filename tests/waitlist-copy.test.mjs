import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { categoryPhrase, confirmationCopy } from '../assets/waitlist-form.js';

const LABELS = {
  'open-singles': 'Open singles',
  'womens-30-plus': 'Women’s 30+',
  'u15-juniors': 'U-15 juniors',
  'open-doubles': 'Open doubles',
  'singles-40-plus': '40+ singles',
};
const TOTAL = Object.keys(LABELS).length;
const CLOSING = 'Keep an eye on your inbox, and keep your serve sharp until October.';

/** @param {Partial<import('../assets/waitlist-form.js').Interest>} overrides */
function interest(overrides) {
  return {
    name: 'Asha Rao',
    email: 'asha@example.com',
    mobile: '',
    categories: ['open-singles'],
    request: '',
    ...overrides,
  };
}

describe('categoryPhrase', () => {
  it('names one, two or several categories', () => {
    assert.equal(categoryPhrase(['Open singles'], TOTAL), 'Open singles');
    assert.equal(categoryPhrase(['Open singles', 'Open doubles'], TOTAL), 'Open singles and Open doubles');
    assert.equal(
      categoryPhrase(['Open singles', 'U-15 juniors', 'Open doubles'], TOTAL),
      'Open singles, U-15 juniors and Open doubles',
    );
  });

  it('says "all" when every category is chosen', () => {
    assert.equal(categoryPhrase(Object.values(LABELS), TOTAL), 'all 5 categories');
  });
});

describe('confirmationCopy', () => {
  it('greets by first name and names the chosen categories', () => {
    const copy = confirmationCopy(interest({ categories: ['open-singles', 'open-doubles'] }), LABELS);

    assert.equal(copy.heading, 'You’re on the list, Asha.');
    assert.deepEqual(copy.lines, [
      'We’ll email asha@example.com as soon as entries open for Open singles and Open doubles.',
      CLOSING,
    ]);
  });

  it('notes a request when no category is ticked', () => {
    const copy = confirmationCopy(interest({ categories: [], request: 'Mixed doubles' }), LABELS);

    assert.deepEqual(copy.lines, [
      'We’ll email asha@example.com as soon as entries open.',
      'We’ve noted your request for “Mixed doubles”.',
      CLOSING,
    ]);
  });

  it('notes a request alongside chosen categories', () => {
    const copy = confirmationCopy(
      interest({ categories: Object.keys(LABELS), request: 'Mixed doubles' }),
      LABELS,
    );

    assert.deepEqual(copy.lines, [
      'We’ll email asha@example.com as soon as entries open for all 5 categories.',
      'We’ve also noted your request for “Mixed doubles”.',
      CLOSING,
    ]);
  });
});
