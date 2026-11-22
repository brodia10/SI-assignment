// Display-only formatting. The API stores and adds up money as `decimal` (TotalCost on each item);
// these helpers never feed a number back into a calculation.

// signDisplay "negative": -0 and amounts that round to zero show as "$0.00", not "-$0.00".
const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  signDisplay: "negative",
});

// $/lb is shown with up to 3 decimals so the scenario reads "$0.424/lb", but whole-cent prices stay "$0.42/lb".
const PER_LB_DECIMALS = 3;
const usdPerLb = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: PER_LB_DECIMALS,
  signDisplay: "negative",
});

/** 8400 → "$8,400.00", -12.5 → "-$12.50". */
export function formatMoney(amount: number): string {
  return usd.format(amount);
}

/** 0.42 → "$0.42/lb", 16800 / 39600 → "$0.424/lb". */
export function formatPerLb(pricePerLb: number): string {
  return `${usdPerLb.format(pricePerLb)}/lb`;
}

/** Cost or revenue spread over a weight, for display. Returns null when there's no weight to divide by. */
export function perLb(total: number, weightLbs: number): number | null {
  return weightLbs > 0 ? total / weightLbs : null;
}

/**
 * The sign of the amount as it will be displayed: 1, -1, or 0 when it rounds to zero. Used to color profit and
 * loss, so -$0.004 (shown as "$0.00") isn't painted red.
 */
export function displaySign(amount: number, perLbFormat = false): -1 | 0 | 1 {
  const scale = perLbFormat ? 10 ** PER_LB_DECIMALS : 100;
  const rounded = Math.round(Math.abs(amount) * scale);
  return rounded === 0 ? 0 : amount > 0 ? 1 : -1;
}
