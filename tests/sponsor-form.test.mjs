import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  SPONSOR_LIMITS,
  SPONSOR_TYPE,
  normaliseSponsor,
  sponsorConfirmationCopy,
  toSponsorBody,
  validateSponsor,
} from '../assets/sponsor-form.js';

function raw(overrides) {
  return {
    name: 'Asha Rao',
    organisation: 'Baseline Sports',
    email: 'asha@example.com',
    mobile: '',
    message: '',
    ...overrides,
  };
}

const fields = (errors) => errors.map((error) => error.field);

describe('normaliseSponsor', () => {
  it('trims the fields, folds spaces and lowercases the email', () => {
    const result = normaliseSponsor(
      raw({ name: '  Asha   Rao ', organisation: ' Baseline  Sports ', email: ' ASHA@Example.COM ' }),
    );

    assert.deepEqual(result, {
      name: 'Asha Rao',
      organisation: 'Baseline Sports',
      email: 'asha@example.com',
      mobile: '',
      message: '',
    });
  });

  it('keeps the line breaks in the message', () => {
    const result = normaliseSponsor(raw({ message: '  Court boards.\n\nAnd the player kits.  ' }));

    assert.equal(result.message, 'Court boards.\n\nAnd the player kits.');
  });
});

describe('validateSponsor', () => {
  it('accepts an enquiry with only the required fields', () => {
    assert.deepEqual(validateSponsor(normaliseSponsor(raw({}))), []);
  });

  it('accepts a mobile number and a message', () => {
    const sponsor = normaliseSponsor(raw({ mobile: '+91 98765 43210', message: 'Court boards.' }));

    assert.deepEqual(validateSponsor(sponsor), []);
  });

  it('asks for the name, brand and email when they are missing', () => {
    const errors = validateSponsor(normaliseSponsor(raw({ name: ' ', organisation: '', email: '' })));

    assert.deepEqual(fields(errors), ['name', 'organisation', 'email']);
  });

  it('rejects an email address without a domain', () => {
    const errors = validateSponsor(normaliseSponsor(raw({ email: 'asha@' })));

    assert.deepEqual(fields(errors), ['email']);
  });

  it('rejects a mobile number that is too short, and allows an empty one', () => {
    assert.deepEqual(fields(validateSponsor(normaliseSponsor(raw({ mobile: '12345' })))), ['mobile']);
    assert.deepEqual(validateSponsor(normaliseSponsor(raw({ mobile: '' }))), []);
  });

  it('rejects fields over their limits', () => {
    const errors = validateSponsor(
      normaliseSponsor(
        raw({
          name: 'a'.repeat(SPONSOR_LIMITS.name + 1),
          organisation: 'b'.repeat(SPONSOR_LIMITS.organisation + 1),
          message: 'c'.repeat(SPONSOR_LIMITS.message + 1),
        }),
      ),
    );

    assert.deepEqual(fields(errors), ['name', 'organisation', 'message']);
  });

  it('lists the problems in form order', () => {
    const errors = validateSponsor(normaliseSponsor(raw({ name: '', organisation: '', email: 'x', mobile: '1' })));

    assert.deepEqual(fields(errors), ['name', 'organisation', 'email', 'mobile']);
  });
});

describe('toSponsorBody', () => {
  it('sends every field and the type that picks the Sponsors sheet', () => {
    const sponsor = normaliseSponsor(raw({ mobile: '+91 98765 43210', message: 'Court boards.' }));

    const body = toSponsorBody(sponsor);

    assert.equal(body.get('type'), SPONSOR_TYPE);
    assert.equal(body.get('name'), 'Asha Rao');
    assert.equal(body.get('organisation'), 'Baseline Sports');
    assert.equal(body.get('email'), 'asha@example.com');
    assert.equal(body.get('mobile'), '+91 98765 43210');
    assert.equal(body.get('message'), 'Court boards.');
  });
});

describe('sponsorConfirmationCopy', () => {
  it('thanks the sender by first name and names the brand', () => {
    const copy = sponsorConfirmationCopy(normaliseSponsor(raw({})));

    assert.equal(copy.heading, 'Thank you, Asha.');
    assert.equal(copy.lines[0], 'We’ll reply to asha@example.com about sponsoring Rubsta Open.');
    assert.equal(copy.lines.at(-1), 'Thank you for backing the tournament, Baseline Sports.');
  });

  it('mentions the mobile number only when one was given', () => {
    const withMobile = sponsorConfirmationCopy(normaliseSponsor(raw({ mobile: '+91 98765 43210' })));
    const withoutMobile = sponsorConfirmationCopy(normaliseSponsor(raw({})));

    assert.equal(withMobile.lines[1], 'We may also call or message you on +91 98765 43210.');
    assert.equal(withoutMobile.lines.length, 2);
  });
});
