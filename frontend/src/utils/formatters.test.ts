import { describe, expect, it } from 'vitest';
import {
  formatCurrency,
  formatPrice,
  formatQuantity,
  formatSignedCurrency,
  formatSignedPercent,
  getGreeting,
} from './formatters';

describe('formatters', () => {
  it('formats amounts according to their display purpose', () => {
    expect(formatCurrency(1234.56)).toBe('$1,235');
    expect(formatPrice(1234.5)).toBe('$1,234.50');
    expect(formatQuantity(1234.5678)).toBe('1,234.568');
  });

  it('uses explicit signs for gains, losses, and zero', () => {
    expect(formatSignedCurrency(12.4)).toBe('+$12');
    expect(formatSignedCurrency(-12.4)).toBe('−$12');
    expect(formatSignedPercent(1.234)).toBe('+1.23%');
    expect(formatSignedPercent(-1.234, 1)).toBe('−1.2%');
    expect(formatSignedPercent(0)).toBe('0.00%');
  });

  it('selects greetings using the New York clock', () => {
    expect(getGreeting(new Date('2025-01-01T15:00:00Z'))).toBe('Good morning');
    expect(getGreeting(new Date('2025-01-01T18:00:00Z'))).toBe('Good afternoon');
    expect(getGreeting(new Date('2025-01-01T23:00:00Z'))).toBe('Good evening');
  });
});
