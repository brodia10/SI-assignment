// Display-only text helpers shared by purchasing and receiving.

const lbs = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

/** 40000 → "40,000 lbs", 1250.5 → "1,250.5 lbs". */
export function formatLbs(weightLbs: number): string {
  return `${lbs.format(weightLbs)} lbs`;
}

// A buy price can have up to 4 decimals (that's what the database stores), so show all of them. The shared
// formatPerLb stops at 3, which is right for calculated costs but would hide part of a typed price.
const buyPrice = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

/** 0.42 → "$0.42/lb", 0.4235 → "$0.4235/lb". */
export function formatBuyPrice(pricePerLb: number): string {
  return `${buyPrice.format(pricePerLb)}/lb`;
}

/** ["a"] → "a", ["a", "b"] → "a and b", ["a", "b", "c"] → "a, b and c". */
export function listInEnglish(items: readonly string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}
