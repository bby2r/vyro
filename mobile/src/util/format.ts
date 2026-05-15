/**
 * Plain-old helpers, free of React imports so test files can use them directly.
 */

export function formatDateShort(d: Date): string {
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${month}-${day} ${hh}:${mm}`;
}

export function formatCurrencyCents(cents: number, currency: string = 'USD'): string {
  const dollars = cents / 100;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(dollars);
  } catch {
    return `${currency} ${dollars.toFixed(2)}`;
  }
}

export function parseAmountToCents(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }
  const normalized = trimmed.replace(/,/g, '.');
  const value = Number.parseFloat(normalized);
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }
  const cents = Math.round(value * 100);
  if (cents > Number.MAX_SAFE_INTEGER) {
    return Number.MAX_SAFE_INTEGER;
  }
  return cents;
}

export function relativeTime(from: number | null, now: number = Date.now()): string {
  if (from === null) {
    return 'never';
  }
  const deltaSec = Math.max(0, Math.floor((now - from) / 1000));
  if (deltaSec < 5) {
    return 'just now';
  }
  if (deltaSec < 60) {
    return `${deltaSec}s ago`;
  }
  const min = Math.floor(deltaSec / 60);
  if (min < 60) {
    return `${min} min ago`;
  }
  const hr = Math.floor(min / 60);
  if (hr < 24) {
    return `${hr}h ago`;
  }
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

export function isValidHttpUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}
