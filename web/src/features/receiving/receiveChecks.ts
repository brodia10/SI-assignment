import { formatLbs, listInEnglish } from "../purchasing/format";

/** One PO line on the Receive screen: what was ordered, and where it's going at what scale weight. */
export interface ReceiveLineDraft {
  lineId: number;
  productName: string;
  orderedLbs: number;
  locationId: number | null;
  /** Starts at the PO weight. Null while the purchaser has cleared the pad. */
  weightLbs: number | null;
}

/** Received minus ordered, in pounds (negative when lighter). Rounded to the 2 decimals weights are stored with. */
export function weightDifference(orderedLbs: number, receivedLbs: number): number {
  return Math.round((receivedLbs - orderedLbs) * 100) / 100;
}

/** "150 lbs less than the PO (40,000 lbs)", or null when the weight matches. */
export function weightDifferenceText(orderedLbs: number, receivedLbs: number): string | null {
  const diff = weightDifference(orderedLbs, receivedLbs);
  if (diff === 0) return null;
  return `${formatLbs(Math.abs(diff))} ${diff < 0 ? "less" : "more"} than the PO (${formatLbs(orderedLbs)})`;
}

/** The first thing stopping the receipt, in the order the screen asks for it, or null when it's ready. */
export function whatsMissing(lines: readonly ReceiveLineDraft[]): string | null {
  for (const line of lines) {
    if (line.locationId === null) return `Pick where the ${line.productName} goes.`;
    if (line.weightLbs === null || line.weightLbs <= 0) return `Enter the weight of the ${line.productName}.`;
  }
  return null;
}

/**
 * The plain-English confirmation:
 * "Receive PO #2201: 40,000 lbs Hot-Rolled Steel Coil into Bay 2 and 5,000 lbs Aluminum Sheet into Rack 1."
 */
export function describeReceipt(
  poNumber: number,
  lines: readonly { productName: string; weightLbs: number; locationName: string }[],
): string {
  const items = lines.map((l) => `${formatLbs(l.weightLbs)} ${l.productName} into ${l.locationName}`);
  return `Receive PO #${poNumber}: ${listInEnglish(items)}.`;
}

/**
 * The warning on the confirmation when any scale weight differs from the PO. Doesn't block: the material is what
 * it is. The cost stays what was agreed on the PO.
 */
export function weightWarning(lines: readonly ReceiveLineDraft[]): string | null {
  const differences = lines.flatMap((l) => {
    const text = l.weightLbs === null ? null : weightDifferenceText(l.orderedLbs, l.weightLbs);
    return text ? [`${l.productName}: ${text}`] : [];
  });
  if (differences.length === 0) return null;
  return `${differences.join(". ")}. The cost stays at the PO amount.`;
}
