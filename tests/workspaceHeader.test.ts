import test from 'node:test';
import assert from 'node:assert/strict';
import { convertCurrencyAmount, formatCalculatorAmount, formatWorkspaceRate, parseCurrencyInput, validCurrencyRate, workspaceDateTime } from '../src/utils/workspaceHeader';
const latin = (value: string) => value.replace(/[۰-۹]/g, digit => String(digit.charCodeAt(0) - 0x06f0)).replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 0x0660)).replace(/[\u200e\u200f\u061c]/g, '').replace(/٫/g, '.');

test('workspace date/time represents the actual instant in Kabul, not a fixed screenshot date', () => {
  const first = workspaceDateTime(new Date('2026-10-16T07:30:10Z'));
  assert.equal(latin(first.time), '12:00:10');
  assert.equal(latin(first.date), '1405/07/24');
  assert.equal(first.iso, '2026-10-16T07:30:10.000Z');
  assert.notEqual(workspaceDateTime(new Date('2026-10-17T07:30:10Z')).date, first.date);
  assert.ok(first.fullDate.includes('۱۴۰۵'));
});
test('date and clock roll over together at Kabul midnight (UTC plus four and a half hours)', () => {
  const before = workspaceDateTime(new Date('2026-10-15T19:29:59Z'));
  const after = workspaceDateTime(new Date('2026-10-15T19:30:00Z'));
  assert.equal(latin(before.time), '23:59:59');
  assert.equal(latin(after.time), '00:00:00');
  assert.notEqual(before.date, after.date);
});
test('currency inputs accept Persian/Arabic digits, decimal separators, grouping and bidi marks', () => {
  for (const [input, expected] of [
    ['۱٬۲۳۴٫۱۲۳۴۵۶', 1234.123456], ['١٢٣٫٥', 123.5], ['1,234.500', 1234.5],
    ['\u200f ۶۴٫۷۵ \u200e', 64.75], ['.5', .5], ['65.', 65], ['+65', 65], ['0', 0], [65, 65],
  ] as const) assert.equal(parseCurrencyInput(input), expected, String(input));
});
test('invalid, negative, empty and nonfinite inputs are not silently coerced into money', () => {
  for (const input of ['', ' ', '.', '۶۵دالر', '-5', '12.3.4', '1e309', 'NaN', 'Infinity', Number.NaN, Infinity]) assert.equal(parseCurrencyInput(input), null, String(input));
});
test('only finite positive rates are valid; no invented fallback rate is displayed', () => {
  for (const rate of [0, -65, null, undefined, '65', NaN, Infinity]) assert.equal(validCurrencyRate(rate), false);
  assert.equal(validCurrencyRate(64.75), true);
  assert.equal(formatWorkspaceRate(0), '—');
  assert.equal(formatWorkspaceRate(undefined), '—');
  assert.equal(latin(formatWorkspaceRate(64.123456)), '64.123456');
});
test('both conversion directions preserve fractional AFN and up to six displayed decimal places', () => {
  assert.equal(convertCurrencyAmount(1.25, 64.75, 'usd'), 80.9375);
  assert.equal(convertCurrencyAmount(80.9375, 64.75, 'afn'), 1.25);
  assert.equal(formatCalculatorAmount(convertCurrencyAmount(123.123456, 65, 'afn')), '1.894207');
  assert.equal(formatCalculatorAmount(convertCurrencyAmount(1.12345678, 65, 'usd')), '73.024691');
  assert.equal(formatCalculatorAmount(6500.25), '6,500.25');
  assert.equal(formatCalculatorAmount(6500.25, false), '6500.25');
});
test('zero amounts work in either direction, while invalid rates never reuse a stale calculation', () => {
  assert.equal(convertCurrencyAmount(0, 65, 'usd'), 0);
  assert.equal(convertCurrencyAmount(0, 65, 'afn'), 0);
  assert.equal(formatCalculatorAmount(0), '0');
  for (const rate of [0, -1, null, NaN, Infinity]) for (const source of ['usd', 'afn'] as const) assert.equal(convertCurrencyAmount(100, rate, source), null);
  for (const amount of [null, -1, NaN, Infinity]) assert.equal(convertCurrencyAmount(amount, 65, 'usd'), null);
  assert.equal(formatCalculatorAmount(null), '');
  assert.equal(formatCalculatorAmount(NaN), '');
});
test('conversion and formatting never return Infinity after a multiplication/division overflow', () => {
  assert.equal(convertCurrencyAmount(Number.MAX_VALUE, 65, 'usd'), null);
  assert.equal(convertCurrencyAmount(Number.MAX_VALUE, Number.MIN_VALUE, 'afn'), null);
  assert.equal(formatCalculatorAmount(Infinity), '');
});
