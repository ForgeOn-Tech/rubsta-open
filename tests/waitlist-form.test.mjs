import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  LIMITS,
  firstName,
  isSavedReply,
  normaliseInterest,
  toFormBody,
  validateInterest,
} from '../assets/waitlist-form.js';

const ALLOWED = ['open-singles', 'womens-30-plus', 'u15-juniors', 'doubles', 'singles-40-plus'];

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

/** @param {import('../assets/waitlist-form.js').Interest} value */
function fieldsWithErrors(value) {
  return validateInterest(value, ALLOWED).map((error) => error.field);
}

describe('normaliseInterest', () => {
  it('trims fields, folds spaces, lowercases the email and drops repeated categories', () => {
    const raw = {
      name: '  Asha   Rao ',
      email: ' Asha@Example.COM ',
      mobile: ' +91  98765 43210 ',
      categories: ['doubles', 'doubles', ' open-singles', ''],
      request: '  mixed   doubles ',
    };

    const result = normaliseInterest(raw);

    assert.deepEqual(result, {
      name: 'Asha Rao',
      email: 'asha@example.com',
      mobile: '+91 98765 43210',
      categories: ['doubles', 'open-singles'],
      request: 'mixed doubles',
    });
  });
});

describe('validateInterest', () => {
  it('accepts a name, an email and one listed category', () => {
    assert.deepEqual(fieldsWithErrors(interest({})), []);
  });

  it('accepts a requested category with no box ticked', () => {
    const value = interest({ categories: [], request: 'Mixed doubles' });

    assert.deepEqual(fieldsWithErrors(value), []);
  });

  it('asks for a category when none is ticked or requested', () => {
    const errors = validateInterest(interest({ categories: [] }), ALLOWED);

    assert.deepEqual(errors, [
      { field: 'categories', message: 'Choose a category, or request one below.' },
    ]);
  });

  it('rejects a category that is not on the form', () => {
    assert.deepEqual(fieldsWithErrors(interest({ categories: ['mixed-doubles'] })), ['categories']);
  });

  it('requires a name and a well-formed email', () => {
    assert.deepEqual(fieldsWithErrors(interest({ name: '', email: '' })), ['name', 'email']);
    assert.deepEqual(fieldsWithErrors(interest({ email: 'asha@example' })), ['email']);
    assert.deepEqual(fieldsWithErrors(interest({ email: 'asha rao@example.com' })), ['email']);
  });

  it('treats the mobile number as optional but checks it when given', () => {
    assert.deepEqual(fieldsWithErrors(interest({ mobile: '+91 98765-43210' })), []);
    assert.deepEqual(fieldsWithErrors(interest({ mobile: '123456' })), ['mobile']);
    assert.deepEqual(fieldsWithErrors(interest({ mobile: '1234567' })), []);
    assert.deepEqual(fieldsWithErrors(interest({ mobile: '1234567890123456' })), ['mobile']);
    assert.deepEqual(fieldsWithErrors(interest({ mobile: '98765 ext 12' })), ['mobile']);
  });

  it('enforces the length limits at their boundaries', () => {
    const atLimit = interest({
      name: 'a'.repeat(LIMITS.name),
      request: 'b'.repeat(LIMITS.request),
    });
    const overLimit = interest({
      name: 'a'.repeat(LIMITS.name + 1),
      request: 'b'.repeat(LIMITS.request + 1),
    });

    assert.deepEqual(fieldsWithErrors(atLimit), []);
    assert.deepEqual(fieldsWithErrors(overLimit), ['name', 'request']);
  });
});

describe('toFormBody', () => {
  it('sends each category as its own pair', () => {
    const body = toFormBody(interest({ categories: ['doubles', 'u15-juniors'] }));

    assert.equal(
      body.toString(),
      'name=Asha+Rao&email=asha%40example.com&mobile=&request=&categories=doubles&categories=u15-juniors',
    );
  });
});

describe('isSavedReply', () => {
  it('is true only for ok: true', () => {
    assert.equal(isSavedReply({ ok: true }), true);
    assert.equal(isSavedReply({ ok: false, errors: [] }), false);
    assert.equal(isSavedReply({ ok: 'true' }), false);
    assert.equal(isSavedReply(null), false);
    assert.equal(isSavedReply('ok'), false);
  });
});

describe('firstName', () => {
  it('returns the first word of the name', () => {
    assert.equal(firstName('Asha Rao'), 'Asha');
    assert.equal(firstName('Asha'), 'Asha');
  });
});
