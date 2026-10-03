import { describe, expect, it } from 'vitest';
import { parseAmountInput } from '../../src/domain/amountInput';

describe('parseAmountInput', () => {
  it.each([
    ['7880', 7880],
    ['7880.00', 7880],
    ['7,880.00', 7880],
    ['1,234,567.5', 1234567.5],
    ['  0.5  ', 0.5],
    ['.5', 0.5],
    ['0', 0],
    ['12.', 12],
  ])('reads %j as %d', (text, expected) => {
    expect(parseAmountInput(text)).toBe(expected);
  });

  it.each([
    '',
    '   ',
    'abc',
    '-1',
    '+1',
    '1e3',
    '1,23',
    '12,34.5',
    '1.2.3',
    '0x10',
    '1 000',
    'NaN',
    '∞',
  ])('rejects %j instead of guessing', (text) => {
    expect(parseAmountInput(text)).toBeNull();
  });
});
