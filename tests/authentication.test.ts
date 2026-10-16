import assert from 'node:assert/strict';
import test from 'node:test';
import { matchesUserPassword } from '../src/utils/authentication';

test('configured passwords accept only the configured value, not shared demo overrides', () => {
  assert.equal(matchesUserPassword('test-only-custom-pass', 'test-only-custom-pass'), true);
  for (const value of ['123', 'admin', 'admin@123', '', 'wrong']) assert.equal(matchesUserPassword('test-only-custom-pass', value), false);
});
test('fresh and old password-less users retain the documented initial password', () => {
  assert.equal(matchesUserPassword('123', '123'), true);
  assert.equal(matchesUserPassword(undefined, '123'), true);
  assert.equal(matchesUserPassword('', '123'), true);
  assert.equal(matchesUserPassword('123', 'admin'), false);
});
test('password comparison keeps existing trimmed-input behavior and rejects blank attempts', () => {
  assert.equal(matchesUserPassword(' custom-password ', ' custom-password '), true);
  assert.equal(matchesUserPassword(' custom-password ', 'other'), false);
  assert.equal(matchesUserPassword(' ', ' '), false);
});
