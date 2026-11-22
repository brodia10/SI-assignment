import { formatMoney } from "../../components";
import { formatBuyPrice, formatLbs, listInEnglish } from "./format";
import { type PricedLine, poTotal } from "./poMath";

export interface SummaryLine extends PricedLine {
  productName: string;
}

/**
 * The plain-English confirmation before a PO is created:
 * "Create a PO for Great Lakes Steel Supply: 40,000 lbs Hot-Rolled Steel Coil at $0.42/lb and 5,000 lbs Aluminum
 * Sheet at $1.35/lb. Total $23,550.00."
 */
export function describePurchaseOrder(supplierName: string, lines: readonly SummaryLine[]): string {
  const items = lines.map((l) => `${formatLbs(l.weightLbs)} ${l.productName} at ${formatBuyPrice(l.pricePerLb)}`);
  return `Create a PO for ${supplierName}: ${listInEnglish(items)}. Total ${formatMoney(poTotal(lines))}.`;
}

/** What's still missing before the PO can be reviewed, or null when it's ready. */
export function whatsMissing(hasSupplier: boolean, lineCount: number): string | null {
  if (!hasSupplier && lineCount === 0) return "Pick the supplier and add a product.";
  if (!hasSupplier) return "Pick the supplier.";
  if (lineCount === 0) return "Add at least one product.";
  return null;
}
