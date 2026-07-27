export const formatCurrency = (value: number): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);

export const formatPrice = (value: number): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

export const formatQuantity = (value: number): string =>
  new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 }).format(value);

export const formatSignedCurrency = (value: number): string =>
  `${value >= 0 ? '+' : '−'}${formatCurrency(Math.abs(value))}`;

export const formatSignedPercent = (value: number, digits = 2): string =>
  `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value).toFixed(digits)}%`;

export const formatAsOf = (date: Date): string => {
  const formatted = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
  return `${formatted.replace(/,(?!.*,)/, ' ·')} ET`;
};

export const getGreeting = (date: Date): string => {
  const hour = Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour: 'numeric',
      hour12: false,
    }).format(date),
  );
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};
