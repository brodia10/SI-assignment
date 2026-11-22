// The live total on the New PO screen. Mirrors the API's PurchaseOrderMath exactly (each line rounded to the cent,
// half away from zero, then summed) so the number on screen is the number that gets saved. The API recalculates
// it anyway; this is only what the purchaser sees while typing.

export interface PricedLine {
  weightLbs: number;
  pricePerLb: number;
}

// Weights have at most 2 decimals and prices at most 4, so scaling them to whole numbers makes the multiplication
// exact (no 0.1 + 0.2 surprises). The product is in millionths of a dollar: at most 99,999,999 × 9,999,999,
// well inside Number.MAX_SAFE_INTEGER.
function lineTotalCents({ weightLbs, pricePerLb }: PricedLine): number {
  const micros = Math.round(weightLbs * 100) * Math.round(pricePerLb * 10_000);
  return Math.sign(micros) * Math.floor((Math.abs(micros) + 5_000) / 10_000);
}

/** 40,000 lbs × $0.42/lb → 16800. */
export function lineTotal(line: PricedLine): number {
  return lineTotalCents(line) / 100;
}

/** Sum of the rounded line totals: PO #2201 → 23550. */
export function poTotal(lines: readonly PricedLine[]): number {
  return lines.reduce((cents, line) => cents + lineTotalCents(line), 0) / 100;
}

export function totalWeight(lines: readonly { weightLbs: number }[]): number {
  return Math.round(lines.reduce((sum, line) => sum + line.weightLbs * 100, 0)) / 100;
}
