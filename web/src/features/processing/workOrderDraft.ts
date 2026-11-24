// The work order being built on screen, before it's posted. Pure functions so the weight rules can be unit-tested.
// Money is never calculated here: costs come from the API's preview (the same code that posts).

/** Mirrors WorkOrderPlanner.MaxOutputs on the API. */
export const MAX_OUTPUTS = 50;

export interface DraftOutput {
  /** Stable React key; outputs can repeat exactly (four identical slit coils). */
  key: number;
  productId: number;
  weightLbs: number;
  locationId: number;
}

export type BalanceState = "empty" | "under" | "exact" | "over";

export interface WeightBalance {
  inputLbs: number;
  outputLbs: number;
  /** Input minus outputs: positive = lighter than the input, negative = heavier. */
  remainingLbs: number;
  state: BalanceState;
}

// Weights have at most 2 decimals. Adding them as whole hundredths keeps 0.1 + 0.2 from becoming 0.30000000000000004,
// so a perfectly balanced work order never shows "0.00 lbs over".
const toHundredths = (lbs: number) => Math.round(lbs * 100);

/** Live weight balance. Over blocks posting (the API enforces the same); under only warns. */
export function weightBalance(inputLbs: number, outputs: readonly Pick<DraftOutput, "weightLbs">[]): WeightBalance {
  const input = toHundredths(inputLbs);
  const output = outputs.reduce((sum, o) => sum + toHundredths(o.weightLbs), 0);
  const remaining = input - output;
  const state: BalanceState =
    outputs.length === 0 ? "empty" : remaining < 0 ? "over" : remaining > 0 ? "under" : "exact";
  return { inputLbs: input / 100, outputLbs: output / 100, remainingLbs: remaining / 100, state };
}

/** Adds `count` identical outputs (e.g. four 9,900 lb slit coils into Rack 4), each with its own key. */
export function addOutputs(
  outputs: readonly DraftOutput[],
  entry: Omit<DraftOutput, "key">,
  count: number,
): DraftOutput[] {
  const firstKey = outputs.reduce((max, o) => Math.max(max, o.key), 0) + 1;
  const added = Array.from({ length: count }, (_, i) => ({ ...entry, key: firstKey + i }));
  return [...outputs, ...added];
}

export function removeOutput(outputs: readonly DraftOutput[], key: number): DraftOutput[] {
  return outputs.filter((o) => o.key !== key);
}

/** How many more outputs can be added before hitting the API's cap. */
export function roomForOutputs(outputs: readonly DraftOutput[]): number {
  return Math.max(0, MAX_OUTPUTS - outputs.length);
}

/** Posting needs at least one output, no more than the cap, and not heavier than the input. */
export function canReview(outputs: readonly DraftOutput[], balance: WeightBalance): boolean {
  return outputs.length > 0 && outputs.length <= MAX_OUTPUTS && balance.state !== "over";
}

/**
 * Why "Review and post" can't be tapped yet, for the bar next to it (like the PO, receiving and sales bars).
 * Null when it can. `costsReady` and `canPost` come from the API's preview of the outputs on screen.
 */
export function whyNotReviewable(
  outputs: readonly DraftOutput[],
  balance: WeightBalance,
  costsReady: boolean,
  canPost: boolean,
): string | null {
  if (outputs.length === 0) return "Add what came off the line.";
  if (balance.state === "over") return "The outputs weigh more than the input. Take one off or lower a weight.";
  if (outputs.length > MAX_OUTPUTS) return `A work order can have up to ${MAX_OUTPUTS} outputs.`;
  if (!costsReady) return "Working out the costs…";
  if (!canPost) return "Fix the problem shown above first.";
  return null;
}

const lbsFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

/** 40000 → "40,000 lbs", 1 → "1 lb", 9900.5 → "9,900.5 lbs". */
export function formatLbs(lbs: number): string {
  return `${lbsFormat.format(lbs)} ${lbs === 1 ? "lb" : "lbs"}`;
}

/**
 * The outputs in one plain-English phrase for the confirmation, grouped by product in the order first added:
 * "4 × 12" Slit Coil (39,600 lbs) and 1 × Steel Scrap (400 lbs)".
 */
export function describeOutputs(
  outputs: readonly Pick<DraftOutput, "productId" | "weightLbs">[],
  productName: (productId: number) => string,
): string {
  const groups = new Map<number, { count: number; hundredths: number }>();
  for (const o of outputs) {
    const group = groups.get(o.productId) ?? { count: 0, hundredths: 0 };
    group.count += 1;
    group.hundredths += toHundredths(o.weightLbs);
    groups.set(o.productId, group);
  }
  const parts = [...groups].map(
    ([productId, g]) => `${g.count} × ${productName(productId)} (${formatLbs(g.hundredths / 100)})`,
  );
  return parts.length <= 1 ? (parts[0] ?? "") : `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;
}

/**
 * Where a new output most likely goes, so the purchaser usually doesn't have to pick: scrap into the scrap bin,
 * anything else where the last good output went (four slit coils all go to Rack 4). Null when there's no good guess.
 */
export function suggestLocation(
  isScrap: boolean,
  locations: readonly { id: number; name: string; kind: string }[],
  lastGoodLocationId: number | null,
): number | null {
  if (isScrap) {
    const bins = locations.filter((l) => l.kind === "Bin");
    return (bins.find((l) => /scrap/i.test(l.name)) ?? bins[0])?.id ?? null;
  }
  return locations.some((l) => l.id === lastGoodLocationId) ? lastGoodLocationId : null;
}

/** The location of the most recent output that isn't scrap, or null if there isn't one yet. */
export function lastGoodLocation(
  outputs: readonly Pick<DraftOutput, "productId" | "locationId">[],
  isScrap: (productId: number) => boolean,
): number | null {
  for (let i = outputs.length - 1; i >= 0; i--) if (!isScrap(outputs[i].productId)) return outputs[i].locationId;
  return null;
}
