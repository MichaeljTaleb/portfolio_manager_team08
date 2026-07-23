export const formatCurrency = (value: number): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);

export const formatSignedCurrency = (value: number): string =>
  `${value >= 0 ? '+' : '−'}${formatCurrency(Math.abs(value))}`;

export const formatSignedPercent = (value: number, digits = 2): string =>
  `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value).toFixed(digits)}%`;
