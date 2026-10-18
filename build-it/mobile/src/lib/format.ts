export function money(n: number) {
  return '$' + Math.round(n || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** Reads a typed number, ignoring $ signs, commas and spaces. Returns 0 for nonsense. */
export function toNumber(v: string | number) {
  const n = parseFloat(String(v).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

export function plural(n: number, one: string, many = one + 's') {
  return `${n} ${n === 1 ? one : many}`;
}
